import type {
  ChapterArtifact,
  EpisodePacket,
  StateDelta,
  StateDeltaContractImpact,
  StateDeltaEvalReport,
  StateDeltaVisibility,
} from "./domain/index.js";
import { evaluateStateDeltas } from "./domain/index.js";
import { FileProjectRepository } from "./storage/index.js";
import { readJsonArtifact, writeJsonArtifact } from "./v1-artifacts.js";
import {
  chapterConsequenceEdgesPath,
  chapterDecisionLogPath,
  chapterEpisodePacketPath,
  chapterRelationshipShiftPath,
  chapterStateDeltasEvalPath,
  chapterStateDeltasPath,
} from "./v1-paths.js";
import type {
  ConsequenceEdgeArtifact,
  DecisionLogArtifact,
  RelationshipShiftArtifact,
} from "./v1-role-drive.js";

export interface StateDeltaInspectRunResult {
  projectId: string;
  chapterNumber: number;
  deltasPath: string;
  evalPath: string;
  deltas: StateDelta[];
  report: StateDeltaEvalReport;
}

function confidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function snippet(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function impactsFromContracts(contractIds: string[], note: string): StateDeltaContractImpact[] {
  return contractIds.map((contractId) => ({
    contractId,
    impact: "supports",
    note,
  }));
}

function contractImpactsForText(args: {
  text: string;
  packet: EpisodePacket | null;
}): StateDeltaContractImpact[] {
  if (!args.packet) {
    return [];
  }
  const lower = args.text.toLowerCase();
  const impacts = impactsFromContracts(args.packet.contractIds, "Delta supports active episode contracts.");
  if (args.packet.doNotResolve.some((item) => lower.includes(item.toLowerCase()))) {
    return impacts.map((impact) => ({
      ...impact,
      impact: "risks",
      note: "Delta overlaps a do-not-resolve constraint.",
    }));
  }
  return impacts;
}

function fromEpisodePacket(packet: EpisodePacket | null): StateDelta[] {
  if (!packet) {
    return [];
  }

  return packet.stateDeltasExpected.map((delta, index) => ({
    id: `delta-${String(packet.chapterNumber).padStart(3, "0")}-episode-${index + 1}`,
    chapterNumber: packet.chapterNumber,
    deltaType:
      delta.targetType === "character"
        ? "character_state"
        : delta.targetType === "relationship"
          ? "relationship_shift"
          : delta.targetType === "thread"
            ? "thread_progress"
            : delta.targetType === "contract"
              ? "contract_progress"
              : "knowledge_change",
    targetType: delta.targetType,
    targetId: delta.targetId,
    before: "expected_before_chapter",
    after: delta.description,
    causalWeight: delta.causalWeight,
    visibility: delta.visibility,
    evidenceSnippet: packet.nonTransferableChoice,
    confidence: confidence(delta.causalWeight === "minor" ? 0.72 : 0.82),
    contractImpact: contractImpactsForText({
      text: delta.description,
      packet,
    }),
    source: "episode_packet",
  }));
}

function fromMemoryUpdate(artifact: ChapterArtifact): StateDelta[] {
  const result: StateDelta[] = [];
  result.push({
    id: `delta-${String(artifact.chapterNumber).padStart(3, "0")}-memory-summary`,
    chapterNumber: artifact.chapterNumber,
    deltaType: "memory_change",
    targetType: "knowledge",
    before: artifact.plan.chapterGoal,
    after: artifact.memoryUpdate.chapterSummary,
    causalWeight: "major",
    visibility: "reader_visible",
    evidenceSnippet: snippet(artifact.memoryUpdate.chapterSummary, artifact.writerResult.draft.slice(0, 160)),
    confidence: confidence(0.75),
    contractImpact: [],
    source: "memory_update",
  });

  for (const [index, patch] of artifact.memoryUpdate.memoryPatches.entries()) {
    result.push({
      id: `delta-${String(artifact.chapterNumber).padStart(3, "0")}-memory-patch-${index + 1}`,
      chapterNumber: artifact.chapterNumber,
      deltaType: "memory_change",
      targetType: "knowledge",
      targetId: patch.memoryId,
      before: "memory active state before patch",
      after: `${patch.action}: ${patch.reason}`,
      causalWeight: patch.action === "resolved" || patch.action === "consumed" ? "major" : "minor",
      visibility: patch.action === "hidden" ? "offscreen" : "reader_visible",
      evidenceSnippet: snippet(patch.notes[0], patch.reason),
      confidence: confidence(0.68),
      contractImpact: [],
      source: "memory_update",
    });
  }

  for (const [index, memory] of artifact.memoryUpdate.newMemories.entries()) {
    result.push({
      id: `delta-${String(artifact.chapterNumber).padStart(3, "0")}-new-memory-${index + 1}`,
      chapterNumber: artifact.chapterNumber,
      deltaType: "knowledge_change",
      targetType: "knowledge",
      before: "memory not recorded",
      after: `${memory.title}: ${memory.summary}`,
      causalWeight: memory.priority === "critical" || memory.priority === "high" ? "major" : "minor",
      visibility: visibilityFromMemory(memory.visibility),
      evidenceSnippet: snippet(memory.summary, memory.title),
      confidence: confidence(0.7),
      contractImpact: [],
      source: "memory_update",
    });
  }

  return result;
}

function visibilityFromMemory(value: "public" | "private" | "hidden"): StateDeltaVisibility {
  if (value === "hidden") {
    return "offscreen";
  }
  if (value === "private") {
    return "character_visible";
  }
  return "reader_visible";
}

function fromDecisionLog(decisionLog: DecisionLogArtifact | null): StateDelta[] {
  if (!decisionLog) {
    return [];
  }
  const owner = decisionLog.owners[0];
  if (!owner) {
    return [];
  }

  return [
    {
      id: `delta-${String(decisionLog.chapterNumber).padStart(3, "0")}-decision`,
      chapterNumber: decisionLog.chapterNumber,
      deltaType: "character_state",
      targetType: "character",
      targetId: owner.id,
      before: decisionLog.decisionPressure ?? owner.coreFear ?? "choice pressure before chapter",
      after: decisionLog.immediateConsequence ?? owner.immediateConsequence ?? "choice creates new pressure",
      causalWeight: "major",
      visibility: "reader_visible",
      evidenceSnippet: snippet(owner.evidenceSnippets[0], decisionLog.likelyChoice ?? "decision evidence missing"),
      confidence: confidence(owner.evidenceSnippets.length > 0 ? 0.78 : 0.46),
      contractImpact: [],
      source: "decision_log",
    },
  ];
}

function fromRelationshipShift(relationshipShift: RelationshipShiftArtifact | null): StateDelta[] {
  if (!relationshipShift?.shift) {
    return [];
  }

  return [
    {
      id: `delta-${String(relationshipShift.chapterNumber).padStart(3, "0")}-relationship`,
      chapterNumber: relationshipShift.chapterNumber,
      deltaType: "relationship_shift",
      targetType: "relationship",
      targetId: relationshipShift.involvedCharacters.map((item) => item.id).join("__") || undefined,
      before: "relationship state before chapter",
      after: relationshipShift.shift,
      causalWeight: "major",
      visibility: "reader_visible",
      evidenceSnippet: snippet(relationshipShift.evidenceSnippets[0], relationshipShift.shift),
      confidence: confidence(relationshipShift.evidenceSnippets.length > 0 ? 0.74 : 0.48),
      contractImpact: [],
      source: "relationship_shift",
    },
  ];
}

function fromConsequenceEdges(consequenceEdges: ConsequenceEdgeArtifact | null): StateDelta[] {
  if (!consequenceEdges) {
    return [];
  }

  return consequenceEdges.edges.slice(0, 6).map((edge, index) => ({
    id: `delta-${String(consequenceEdges.chapterNumber).padStart(3, "0")}-edge-${index + 1}`,
    chapterNumber: consequenceEdges.chapterNumber,
    deltaType: edge.targetType === "relationship" ? "relationship_shift" : "thread_progress",
    targetType: edge.targetType === "relationship" ? "relationship" : "thread",
    targetId: edge.targetId,
    before: `${edge.sourceType}:${edge.sourceId}`,
    after: edge.detail,
    causalWeight: edge.targetType === "delayed_consequence" ? "major" : "minor",
    visibility: "reader_visible",
    evidenceSnippet: snippet(edge.label, edge.detail),
    confidence: confidence(0.64),
    contractImpact: [],
    source: "consequence_edge",
  }));
}

function uniqueDeltas(deltas: StateDelta[]): StateDelta[] {
  const seen = new Set<string>();
  const result: StateDelta[] = [];
  for (const delta of deltas) {
    const key = `${delta.deltaType}|${delta.targetType}|${delta.targetId ?? ""}|${delta.after}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(delta);
  }
  return result;
}

export function extractStateDeltas(args: {
  artifact: ChapterArtifact;
  packet: EpisodePacket | null;
  decisionLog: DecisionLogArtifact | null;
  relationshipShift: RelationshipShiftArtifact | null;
  consequenceEdges: ConsequenceEdgeArtifact | null;
}): StateDelta[] {
  return uniqueDeltas([
    ...fromEpisodePacket(args.packet),
    ...fromMemoryUpdate(args.artifact),
    ...fromDecisionLog(args.decisionLog),
    ...fromRelationshipShift(args.relationshipShift),
    ...fromConsequenceEdges(args.consequenceEdges),
  ]);
}

export async function inspectStateDeltas(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<StateDeltaInspectRunResult> {
  const repository = new FileProjectRepository();
  const [artifact, contracts] = await Promise.all([
    repository.loadChapterArtifact(args.projectId, args.chapterNumber),
    repository.loadStoryContracts(args.projectId),
  ]);
  if (!artifact) {
    throw new Error(`Chapter artifact not found: project=${args.projectId}, chapter=${args.chapterNumber}`);
  }

  const deltasPath = chapterStateDeltasPath(args.projectId, args.chapterNumber);
  let deltas = await readJsonArtifact<StateDelta[]>(deltasPath);
  if (!deltas) {
    const [packet, decisionLog, relationshipShift, consequenceEdges] = await Promise.all([
      readJsonArtifact<EpisodePacket>(chapterEpisodePacketPath(args.projectId, args.chapterNumber)),
      readJsonArtifact<DecisionLogArtifact>(chapterDecisionLogPath(args.projectId, args.chapterNumber)),
      readJsonArtifact<RelationshipShiftArtifact>(
        chapterRelationshipShiftPath(args.projectId, args.chapterNumber),
      ),
      readJsonArtifact<ConsequenceEdgeArtifact>(
        chapterConsequenceEdgesPath(args.projectId, args.chapterNumber),
      ),
    ]);
    deltas = extractStateDeltas({
      artifact,
      packet,
      decisionLog,
      relationshipShift,
      consequenceEdges,
    });
    await writeJsonArtifact(deltasPath, deltas);
  }

  const report = evaluateStateDeltas({
    chapterNumber: args.chapterNumber,
    deltas,
    contracts,
  });
  const evalPath = chapterStateDeltasEvalPath(args.projectId, args.chapterNumber);
  await writeJsonArtifact(evalPath, report);

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    deltasPath,
    evalPath,
    deltas,
    report,
  };
}

