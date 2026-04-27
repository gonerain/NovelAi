import { access } from "node:fs/promises";
import path from "node:path";

import type { ChapterArtifact, StoryProject } from "./domain/index.js";
import {
  formatApplyDraftRewriteRunResult,
  formatChangeImpactRunResult,
  formatConsequenceInspectionRunResult,
  formatInspectDraftRewriteRunResult,
  formatInvalidateResult,
  formatInvalidateTargetRunResult,
  formatListDraftRewriteVersionsRunResult,
  formatOutlinePatchSuggestionRunResult,
  formatRegenerateFromTargetRunResult,
  formatRetrievalEvalRunResult,
  formatRetrievalEvalSeedResult,
  formatRewriteChapterRunResult,
  formatRewriteDraftRunResult,
  formatRewritePlanRunResult,
  formatV1RunResult,
} from "./v1-formatters.js";
import {
  approveDetailedOutline,
  exportOutlineDrafts,
  formatOutlineStackResult,
  formatOutlineValidationResult,
  generateOutlineStack,
  validateOutlineStack,
} from "./outline-lib.js";
import { loadStoryProject } from "./project/index.js";
import { FileProjectRepository } from "./storage/index.js";
import {
  bootstrapProject,
  defaultDemoProjectId,
  formatAuthorPresetCatalog,
  interviewProject,
  invalidateFromChapter,
  invalidateFromTarget,
  regenerateFromTarget,
  applyDraftRewrite,
  inspectDraftRewrite,
  inspectConsequences,
  listDraftRewriteVersions,
  rewriteChapter,
  rewriteChapterDraft,
  runChangeImpact,
  runRewritePlan,
  runRetrievalEval,
  suggestOutlinePatches,
  runV1,
  seedRetrievalEvalSet,
} from "./v1-lib.js";

type CommandName =
  | "project:bootstrap"
  | "project:interview"
  | "project:profiles"
  | "project:inspect"
  | "project:paths"
  | "project:impact"
  | "project:inspect-consequences"
  | "project:rewrite-plan"
  | "project:regenerate-from-target"
  | "memory:eval-seed"
  | "memory:eval-run"
  | "outline:inspect"
  | "outline:suggest-patches"
  | "outline:generate-stack"
  | "outline:generate-drafts"
  | "outline:approve-detail"
  | "outline:validate"
  | "chapter:generate"
  | "chapter:generate-first"
  | "chapter:inspect"
  | "chapter:rewrite"
  | "chapter:rewrite-draft"
  | "chapter:apply-draft-rewrite"
  | "chapter:list-draft-rewrites"
  | "chapter:inspect-draft-rewrite"
  | "chapter:invalidate-from"
  | "chapter:invalidate-target"
  | "chapter:reset-all";

interface ParsedArgs {
  command: CommandName;
  projectId: string;
  chapterNumber?: number;
  fromChapter?: number;
  count?: number;
  versionId?: string;
  profileId?: string;
  answers?: string;
  approver?: string;
  note?: string;
  targetId?: string;
  withEval?: boolean;
  strictEval?: boolean;
}

function readOption(args: Map<string, string>, key: string): string | undefined {
  return args.get(key);
}

function parseFlags(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(item, next);
      index += 1;
    } else {
      args.set(item, "true");
    }
  }

  return args;
}

function parseCommand(argv: string[]): ParsedArgs {
  const [group = "chapter", action = "generate"] = argv.filter((item) => !item.startsWith("--"));
  const flags = parseFlags(argv);
  const projectId = readOption(flags, "--project") ?? defaultDemoProjectId;
  const chapterOption = readOption(flags, "--chapter");
  const fromChapterOption = readOption(flags, "--from-chapter");
  const countOption = readOption(flags, "--count");
  const versionOption = readOption(flags, "--version");
  const profileOption = readOption(flags, "--profile");
  const answersOption = readOption(flags, "--answers");
  const approverOption = readOption(flags, "--approver");
  const noteOption = readOption(flags, "--note");
  const targetOption = readOption(flags, "--target");
  const withEvalOption = readOption(flags, "--with-eval");
  const strictEvalOption = readOption(flags, "--strict-eval");
  const strictEval = strictEvalOption === "true";
  const withEval = withEvalOption === "true" || strictEval;

  const command = `${group}:${action}` as CommandName;
  const allowed = new Set<CommandName>([
    "project:bootstrap",
    "project:interview",
    "project:profiles",
    "project:inspect",
    "project:paths",
    "project:impact",
    "project:inspect-consequences",
    "project:rewrite-plan",
    "project:regenerate-from-target",
    "memory:eval-seed",
    "memory:eval-run",
    "outline:inspect",
    "outline:suggest-patches",
    "outline:generate-stack",
    "outline:generate-drafts",
    "outline:approve-detail",
    "outline:validate",
    "chapter:generate",
    "chapter:generate-first",
    "chapter:inspect",
    "chapter:rewrite",
    "chapter:rewrite-draft",
    "chapter:apply-draft-rewrite",
    "chapter:list-draft-rewrites",
    "chapter:inspect-draft-rewrite",
    "chapter:invalidate-from",
    "chapter:invalidate-target",
    "chapter:reset-all",
  ]);

  if (!allowed.has(command)) {
    throw new Error(`Unsupported command: ${group} ${action}`);
  }

  return {
    command,
    projectId,
    chapterNumber: chapterOption ? Number(chapterOption) : undefined,
    fromChapter: fromChapterOption ? Number(fromChapterOption) : undefined,
    count: countOption ? Number(countOption) : undefined,
    versionId: versionOption,
    profileId: profileOption,
    answers: answersOption,
    approver: approverOption,
    note: noteOption,
    targetId: targetOption,
    withEval,
    strictEval,
  };
}

function projectDir(projectId: string): string {
  return path.resolve(process.cwd(), "data", "projects", projectId);
}

function chapterDir(projectId: string, chapterNumber: number): string {
  return path.join(
    projectDir(projectId),
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
  );
}

function detailedOutlineApprovalPath(projectId: string): string {
  return path.join(projectDir(projectId), "detailed-outline-approved.json");
}

async function assertDetailedOutlineApproved(projectId: string): Promise<void> {
  try {
    await access(detailedOutlineApprovalPath(projectId));
  } catch {
    throw new Error(
      [
        `Detailed outline is not approved for project=${projectId}.`,
        "Required workflow:",
        `1) ./run-v1.sh outline generate-stack --project ${projectId} --count 120`,
        `2) ./run-v1.sh outline generate-drafts --project ${projectId}`,
        `3) 人工审阅 data/projects/${projectId}/detailed-outline.md`,
        `4) ./run-v1.sh outline approve-detail --project ${projectId} --approver <name> --note \"ok\"`,
        "Then chapter generation is unlocked.",
      ].join("\n"),
    );
  }
}

function summarizeProject(project: StoryProject): string {
  const lines: string[] = [];

  lines.push(`Project: ${project.id}`);
  lines.push(`Title: ${project.title}`);
  lines.push(`Premise: ${project.premise}`);
  lines.push(`Author profile: ${project.authorProfile.name}`);
  lines.push(`Theme: ${project.themeBible.coreTheme}`);
  lines.push(`Current arc goal: ${project.storySetup.currentArcGoal}`);
  lines.push(`Story outline: ${project.storyOutline ? "yes" : "no"}`);
  lines.push(`Arc outlines: ${project.arcOutlines.length}`);
  lines.push(`Beat outlines: ${project.beatOutlines.length}`);
  lines.push(`Cast outlines: ${project.castOutlines?.length ?? 0}`);
  lines.push(`Characters: ${project.characters.length}`);
  lines.push(`World facts: ${project.worldFacts.length}`);
  lines.push(`Memories: ${project.memories.length}`);
  lines.push(`Chapter plans: ${project.chapterPlans.length}`);

  return lines.join("\n");
}

function summarizeOutline(project: StoryProject): string {
  const lines: string[] = [];

  lines.push(`Project: ${project.id}`);
  lines.push(`Story outline: ${project.storyOutline?.title ?? "(missing)"}`);
  if (project.storyOutline) {
    lines.push(`Core theme: ${project.storyOutline.coreTheme}`);
    lines.push(`Ending target: ${project.storyOutline.endingTarget}`);
    lines.push(`Turning points: ${project.storyOutline.keyTurningPoints.join(" | ")}`);
  }

  for (const arc of project.arcOutlines) {
    lines.push("");
    lines.push(`Arc: ${arc.id} - ${arc.name}`);
    lines.push(`Goal: ${arc.arcGoal}`);
    lines.push(`Start: ${arc.startState}`);
    lines.push(`End: ${arc.endState}`);
    lines.push(`Required turns: ${arc.requiredTurns.join(" | ")}`);
    lines.push(`Relationship changes: ${arc.relationshipChanges.join(" | ")}`);

    const beats = project.beatOutlines
      .filter((beat) => beat.arcId === arc.id)
      .sort((left, right) => left.order - right.order);

    for (const beat of beats) {
      lines.push(`  Beat ${beat.order}: ${beat.id}`);
      lines.push(`  Goal: ${beat.beatGoal}`);
      lines.push(`  Conflict: ${beat.conflict}`);
      lines.push(`  Change: ${beat.expectedChange}`);
      if (beat.openingAnchor) {
        lines.push(`  Opening hook: ${beat.openingAnchor.hook}`);
      }
    }
  }

  return lines.join("\n");
}

function summarizeChapterArtifact(projectId: string, artifact: ChapterArtifact): string {
  const lines: string[] = [];

  lines.push(`Project: ${projectId}`);
  lines.push(`Chapter: ${artifact.chapterNumber}`);
  lines.push(`Title: ${artifact.writerResult.title ?? artifact.plan.title ?? "(untitled)"}`);
  lines.push(`Goal: ${artifact.plan.chapterGoal}`);
  lines.push(`Outcome: ${artifact.plan.plannedOutcome}`);
  lines.push(`Summary: ${artifact.memoryUpdate.chapterSummary}`);
  lines.push(`Next: ${artifact.memoryUpdate.nextSituation}`);
  lines.push(`Missing resource findings: ${artifact.missingResourceReview.findings.length}`);
  lines.push(`Fact findings: ${artifact.factConsistencyReview.findings.length}`);
  lines.push(`Draft path: ${path.join(chapterDir(projectId, artifact.chapterNumber), "draft.md")}`);
  lines.push(`Result path: ${path.join(chapterDir(projectId, artifact.chapterNumber), "result.json")}`);

  return lines.join("\n");
}

function summarizeProjectPaths(projectId: string): string {
  const dir = projectDir(projectId);

  return [
    `Project root: ${dir}`,
    `Author profile: ${path.join(dir, "author-profile.json")}`,
    `Theme bible: ${path.join(dir, "theme-bible.json")}`,
    `Style bible: ${path.join(dir, "style-bible.json")}`,
    `Story setup: ${path.join(dir, "story-setup.json")}`,
    `Story outline: ${path.join(dir, "story-outline.json")}`,
    `Long outline draft: ${path.join(dir, "story-outline-250.md")}`,
    `Arc outlines: ${path.join(dir, "arc-outlines.json")}`,
    `Beat outlines: ${path.join(dir, "beat-outlines.json")}`,
    `Cast outlines: ${path.join(dir, "cast-outlines.json")}`,
    `Character states: ${path.join(dir, "character-states.json")}`,
    `World facts: ${path.join(dir, "world-facts.json")}`,
    `Story memories: ${path.join(dir, "story-memories.json")}`,
    `Chapter plans: ${path.join(dir, "chapter-plans.json")}`,
    `Chapters dir: ${path.join(dir, "chapters")}`,
    `Semantic index: ${path.join(dir, "memory", "retrieval", "semantic-index.json")}`,
    `Embedding cache: ${path.join(dir, "memory", "retrieval", "embedding-cache.json")}`,
    `Story graph: ${path.join(dir, "memory", "graph", "story-graph.json")}`,
    `Impact reports: ${path.join(dir, "impact")}`,
    `Retrieval eval set: ${path.join(dir, "memory", "eval", "retrieval-eval-set.json")}`,
    `Retrieval eval report: ${path.join(dir, "memory", "eval", "retrieval-eval-report.json")}`,
  ].join("\n");
}

function usage(): string {
  return [
    "Commands:",
    "  project profiles",
    "  project bootstrap --project <id> [--profile <preset_id>]",
    "  project interview --project <id> --answers A,B,C,A,B,C",
    "  project inspect --project <id>",
    "  project paths --project <id>",
    "  project impact --project <id> --target <entity_or_node_id>",
    "  project inspect-consequences --project <id> --chapter <n>",
    "  project rewrite-plan --project <id> --target <entity_or_node_id>",
    "  project regenerate-from-target --project <id> --target <entity_or_node_id> --count <n> [--with-eval] [--strict-eval]",
    "  memory eval-seed --project <id>",
    "  memory eval-run --project <id>",
    "  outline inspect --project <id>",
    "  outline suggest-patches --project <id> --from-chapter <n>",
    "  outline generate-stack --project <id> [--count <chapters>]",
    "  outline generate-drafts --project <id>",
    "  outline approve-detail --project <id> [--approver <name>] [--note <text>]",
    "  outline validate --project <id>",
    "  chapter generate --project <id> --chapter <n> [--with-eval] [--strict-eval]",
    "  chapter generate-first --project <id> --count <n> [--with-eval] [--strict-eval]",
    "  chapter inspect --project <id> --chapter <n>",
    "  chapter rewrite --project <id> --chapter <n> [--with-eval] [--strict-eval]",
    "  chapter rewrite-draft --project <id> --chapter <n> [--with-eval] [--strict-eval]",
    "  chapter apply-draft-rewrite --project <id> --chapter <n> [--version <id>]",
    "  chapter list-draft-rewrites --project <id> --chapter <n>",
    "  chapter inspect-draft-rewrite --project <id> --chapter <n> [--version <id>]",
    "  chapter invalidate-from --project <id> --chapter <n>",
    "  chapter invalidate-target --project <id> --target <entity_or_node_id>",
    "  chapter reset-all --project <id>",
  ].join("\n");
}

async function main(): Promise<void> {
  const parsed = parseCommand(process.argv.slice(2));
  const repository = new FileProjectRepository();

  switch (parsed.command) {
    case "project:bootstrap": {
      const result = await bootstrapProject(parsed.projectId, {
        authorPresetId: parsed.profileId,
      });
      console.log(`Project bootstrapped: ${result.projectId}`);
      if (result.validationIssues.length > 0) {
        console.log("Validation issues:");
        for (const issue of result.validationIssues) {
          console.log(`- ${issue}`);
        }
      }
      return;
    }

    case "project:profiles": {
      console.log(formatAuthorPresetCatalog());
      return;
    }

    case "project:interview": {
      if (!parsed.answers) {
        throw new Error("project interview requires --answers A,B,C,A,B,C");
      }
      const result = await interviewProject({
        projectId: parsed.projectId,
        answersRaw: parsed.answers,
      });
      console.log(`Project interview completed: ${result.projectId}`);
      if (result.validationIssues.length > 0) {
        console.log("Validation issues:");
        for (const issue of result.validationIssues) {
          console.log(`- ${issue}`);
        }
      }
      return;
    }

    case "project:inspect": {
      const project = await loadStoryProject(repository, parsed.projectId);
      if (!project) {
        throw new Error(`Project not found or incomplete: ${parsed.projectId}`);
      }
      console.log(summarizeProject(project));
      return;
    }

    case "project:paths": {
      console.log(summarizeProjectPaths(parsed.projectId));
      return;
    }

    case "project:impact": {
      if (!parsed.targetId) {
        throw new Error("project impact requires --target <entity_or_node_id>");
      }
      const result = await runChangeImpact({
        projectId: parsed.projectId,
        targetId: parsed.targetId,
      });
      console.log(formatChangeImpactRunResult(result));
      return;
    }

    case "project:inspect-consequences": {
      if (!parsed.chapterNumber || parsed.chapterNumber < 1) {
        throw new Error("project inspect-consequences requires --chapter <n>");
      }
      const result = await inspectConsequences({
        projectId: parsed.projectId,
        chapterNumber: parsed.chapterNumber,
      });
      console.log(formatConsequenceInspectionRunResult(result));
      return;
    }

    case "project:rewrite-plan": {
      if (!parsed.targetId) {
        throw new Error("project rewrite-plan requires --target <entity_or_node_id>");
      }
      const result = await runRewritePlan({
        projectId: parsed.projectId,
        targetId: parsed.targetId,
      });
      console.log(formatRewritePlanRunResult(result));
      return;
    }

    case "project:regenerate-from-target": {
      await assertDetailedOutlineApproved(parsed.projectId);
      if (!parsed.targetId) {
        throw new Error("project regenerate-from-target requires --target <entity_or_node_id>");
      }
      if (!parsed.count || parsed.count < 1) {
        throw new Error("project regenerate-from-target requires --count <n>");
      }
      const result = await regenerateFromTarget({
        projectId: parsed.projectId,
        targetId: parsed.targetId,
        count: parsed.count,
        withEval: parsed.withEval,
        strictEval: parsed.strictEval,
      });
      console.log(formatRegenerateFromTargetRunResult(result));
      return;
    }

    case "memory:eval-seed": {
      const result = await seedRetrievalEvalSet({
        projectId: parsed.projectId,
      });
      console.log(formatRetrievalEvalSeedResult(result));
      return;
    }

    case "memory:eval-run": {
      const result = await runRetrievalEval({
        projectId: parsed.projectId,
      });
      console.log(formatRetrievalEvalRunResult(result));
      return;
    }

    case "outline:inspect": {
      const project = await loadStoryProject(repository, parsed.projectId);
      if (!project) {
        throw new Error(`Project not found or incomplete: ${parsed.projectId}`);
      }
      console.log(summarizeOutline(project));
      return;
    }

    case "outline:suggest-patches": {
      if (!parsed.fromChapter || parsed.fromChapter < 1) {
        throw new Error("outline suggest-patches requires --from-chapter <n>");
      }
      const result = await suggestOutlinePatches({
        projectId: parsed.projectId,
        fromChapter: parsed.fromChapter,
      });
      console.log(formatOutlinePatchSuggestionRunResult(result));
      return;
    }

    case "outline:generate-stack": {
      const result = await generateOutlineStack({
        projectId: parsed.projectId,
        targetChapterCount: parsed.count,
      });
      console.log(formatOutlineStackResult(result));
      return;
    }

    case "outline:generate-drafts": {
      const result = await exportOutlineDrafts({
        projectId: parsed.projectId,
      });
      console.log(`Project: ${result.projectId}`);
      console.log(`Story outline draft: ${result.storyOutlinePath}`);
      console.log(`Detailed outline draft: ${result.detailedOutlinePath}`);
      return;
    }

    case "outline:approve-detail": {
      const result = await approveDetailedOutline({
        projectId: parsed.projectId,
        approver: parsed.approver,
        note: parsed.note,
      });
      console.log(`Detailed outline approved: ${result.projectId}`);
      console.log(`Approval file: ${result.approvalPath}`);
      return;
    }

    case "outline:validate": {
      const result = await validateOutlineStack({
        projectId: parsed.projectId,
      });
      console.log(formatOutlineValidationResult(result));
      if (!result.ok) {
        process.exitCode = 2;
      }
      return;
    }

    case "chapter:generate": {
      await assertDetailedOutlineApproved(parsed.projectId);
      if (!parsed.chapterNumber || parsed.chapterNumber < 1) {
        throw new Error("chapter generate requires --chapter <n>");
      }
      const result = await runV1({
        projectId: parsed.projectId,
        mode: "chapter",
        chapterNumber: parsed.chapterNumber,
        withEval: parsed.withEval,
        strictEval: parsed.strictEval,
      });
      console.log(formatV1RunResult(result));
      return;
    }

    case "chapter:generate-first": {
      await assertDetailedOutlineApproved(parsed.projectId);
      if (!parsed.count || parsed.count < 1) {
        throw new Error("chapter generate-first requires --count <n>");
      }
      const result = await runV1({
        projectId: parsed.projectId,
        mode: "first-n",
        count: parsed.count,
        withEval: parsed.withEval,
        strictEval: parsed.strictEval,
      });
      console.log(formatV1RunResult(result));
      return;
    }

    case "chapter:inspect": {
      if (!parsed.chapterNumber || parsed.chapterNumber < 1) {
        throw new Error("chapter inspect requires --chapter <n>");
      }
      const artifact = await repository.loadChapterArtifact(parsed.projectId, parsed.chapterNumber);
      if (!artifact) {
        throw new Error(
          `Chapter artifact not found: project=${parsed.projectId}, chapter=${parsed.chapterNumber}`,
        );
      }
      console.log(summarizeChapterArtifact(parsed.projectId, artifact));
      return;
    }

    case "chapter:rewrite": {
      await assertDetailedOutlineApproved(parsed.projectId);
      if (!parsed.chapterNumber || parsed.chapterNumber < 1) {
        throw new Error("chapter rewrite requires --chapter <n>");
      }
      const result = await rewriteChapter({
        projectId: parsed.projectId,
        chapterNumber: parsed.chapterNumber,
        withEval: parsed.withEval,
        strictEval: parsed.strictEval,
      });
      console.log(formatRewriteChapterRunResult(result));
      return;
    }

    case "chapter:rewrite-draft": {
      await assertDetailedOutlineApproved(parsed.projectId);
      if (!parsed.chapterNumber || parsed.chapterNumber < 1) {
        throw new Error("chapter rewrite-draft requires --chapter <n>");
      }
      const result = await rewriteChapterDraft({
        projectId: parsed.projectId,
        chapterNumber: parsed.chapterNumber,
        withEval: parsed.withEval,
        strictEval: parsed.strictEval,
      });
      console.log(formatRewriteDraftRunResult(result));
      return;
    }

    case "chapter:apply-draft-rewrite": {
      await assertDetailedOutlineApproved(parsed.projectId);
      if (!parsed.chapterNumber || parsed.chapterNumber < 1) {
        throw new Error("chapter apply-draft-rewrite requires --chapter <n>");
      }
      const result = await applyDraftRewrite({
        projectId: parsed.projectId,
        chapterNumber: parsed.chapterNumber,
        versionId: parsed.versionId,
      });
      console.log(formatApplyDraftRewriteRunResult(result));
      return;
    }

    case "chapter:list-draft-rewrites": {
      await assertDetailedOutlineApproved(parsed.projectId);
      if (!parsed.chapterNumber || parsed.chapterNumber < 1) {
        throw new Error("chapter list-draft-rewrites requires --chapter <n>");
      }
      const result = await listDraftRewriteVersions({
        projectId: parsed.projectId,
        chapterNumber: parsed.chapterNumber,
      });
      console.log(formatListDraftRewriteVersionsRunResult(result));
      return;
    }

    case "chapter:inspect-draft-rewrite": {
      await assertDetailedOutlineApproved(parsed.projectId);
      if (!parsed.chapterNumber || parsed.chapterNumber < 1) {
        throw new Error("chapter inspect-draft-rewrite requires --chapter <n>");
      }
      const result = await inspectDraftRewrite({
        projectId: parsed.projectId,
        chapterNumber: parsed.chapterNumber,
        versionId: parsed.versionId,
      });
      console.log(formatInspectDraftRewriteRunResult(result));
      return;
    }

    case "chapter:invalidate-from": {
      if (!parsed.chapterNumber || parsed.chapterNumber < 1) {
        throw new Error("chapter invalidate-from requires --chapter <n>");
      }
      const result = await invalidateFromChapter({
        projectId: parsed.projectId,
        chapterNumber: parsed.chapterNumber,
      });
      console.log(formatInvalidateResult(result));
      return;
    }

    case "chapter:invalidate-target": {
      if (!parsed.targetId) {
        throw new Error("chapter invalidate-target requires --target <entity_or_node_id>");
      }
      const result = await invalidateFromTarget({
        projectId: parsed.projectId,
        targetId: parsed.targetId,
      });
      console.log(formatInvalidateTargetRunResult(result));
      return;
    }

    case "chapter:reset-all": {
      const result = await invalidateFromChapter({
        projectId: parsed.projectId,
        chapterNumber: 1,
      });
      console.log(formatInvalidateResult(result));
      return;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
