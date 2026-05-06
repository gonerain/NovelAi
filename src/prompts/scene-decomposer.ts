import type {
  ArcOutline,
  BeatOutline,
  ChapterScenePlan,
  CharacterState,
  RevealItem,
  RevealMode,
  StoryOutline,
  ThemeBible,
  WorldFact,
} from "../domain/index.js";
import {
  buildKnowledgeBoundaryContext,
  effectiveRevealMode,
  getLabelVocabulary,
} from "../domain/knowledge-boundary.js";
import type { DerivedAuthorProfilePacks } from "../domain/author-profile-packs.js";
import type { ChatMessage } from "../llm/types.js";

export interface SceneDecomposerInput {
  arc: ArcOutline;
  beat: BeatOutline;
  themeBible: ThemeBible;
  storyOutline: StoryOutline | undefined;
  authorPack: DerivedAuthorProfilePacks["planner"];
  protagonist: CharacterState;
  supportingCharacters: CharacterState[];
  worldFacts: WorldFact[];
  chapterRange: { start: number; end: number };
  /**
   * When set, the decomposer must produce ONE scene plan for this
   * chapter only; other chapters in the range are passed as context.
   * Without this, it produces every chapter in chapterRange.
   */
  targetChapterNumber?: number;
  /** Existing plans for peer chapters in the same beat, for diversity context. */
  peerPlans?: ChapterScenePlan[];
  /** Optional existing plans the decomposer can refine. */
  existingPlans?: ChapterScenePlan[];
  /** Typed reveal contracts for the beat (effective revealItems). */
  revealItems?: RevealItem[];
  /** Full arc list — used to stage RevealMode defaults. */
  allArcOutlines?: ArcOutline[];
}

export interface SceneDecomposerResult {
  scenePlans: ChapterScenePlan[];
  notes: string[];
}

function compactCharacter(character: CharacterState) {
  return {
    id: character.id,
    name: character.name,
    archetype: character.archetype ?? null,
    decisionProfile: character.decisionProfile,
    currentGoals: character.currentGoals.slice(0, 3),
    voiceNotes: character.voiceNotes.slice(0, 3),
  };
}

export function buildSceneDecomposerMessages(input: SceneDecomposerInput): ChatMessage[] {
  const beatSnapshot = {
    id: input.beat.id,
    arcId: input.beat.arcId,
    chapterRangeHint: input.beat.chapterRangeHint ?? null,
    beatGoal: input.beat.beatGoal,
    conflict: input.beat.conflict,
    expectedChange: input.beat.expectedChange,
    revealTargets: input.beat.revealTargets,
    constraints: input.beat.constraints,
    decisionPressure: input.beat.decisionPressure ?? null,
    likelyChoice: input.beat.likelyChoice ?? null,
    immediateConsequence: input.beat.immediateConsequence ?? null,
    delayedConsequence: input.beat.delayedConsequence ?? null,
    openingAnchor: input.beat.openingAnchor ?? null,
  };

  const arcSnapshot = {
    id: input.arc.id,
    name: input.arc.name,
    arcGoal: input.arc.arcGoal,
    requiredTurns: input.arc.requiredTurns,
    relationshipChanges: input.arc.relationshipChanges,
    protagonistArc: input.arc.protagonistArc ?? null,
    supportingCharacterArcs: input.arc.supportingCharacterArcs ?? [],
  };

  const supportingSnapshots = input.supportingCharacters
    .filter((character) => character.id !== input.protagonist.id)
    .slice(0, 6)
    .map(compactCharacter);

  const worldFactsForArc = input.worldFacts
    .slice(0, 12)
    .map((fact) => ({
      id: fact.id,
      title: fact.title,
      category: fact.category,
      scope: fact.scope,
      description: fact.description,
    }));

  const chapterCount = input.chapterRange.end - input.chapterRange.start + 1;
  const isSingleChapter = typeof input.targetChapterNumber === "number";

  return [
    {
      role: "system",
      content: [
        isSingleChapter
          ? `Task: produce exactly ONE ChapterScenePlan object for chapter ${input.targetChapterNumber} inside the beat range ${input.chapterRange.start}-${input.chapterRange.end}.`
          : `Task: produce ${chapterCount} ChapterScenePlan objects, one per chapter from ${input.chapterRange.start} to ${input.chapterRange.end}.`,
        "A ChapterScenePlan is the per-chapter scene blocking that sits between the beat (which spans many chapters) and the planner (which writes the final ChapterPlan).",
        "Hard constraints:",
        "- JSON only.",
        isSingleChapter
          ? "- Output exactly ONE scenePlans entry. The chapterNumber must match the requested target chapter."
          : "- Output exactly one entry for each chapter in the requested range. Do not skip, merge, or duplicate.",
        isSingleChapter
          ? "- The new scene plan must differ from any 'peer scene plans' (already-written chapters in this beat) on at least three of: pov, location, openingScene.entryHook, climax.decisionOwnerId/decisionUnderPressure, endHook."
          : "- Two consecutive chapters must differ on at least three of: pov, location, openingScene.entryHook, climax.decisionOwnerId/decisionUnderPressure, endHook. Byte-identical scene plans are forbidden.",
        "- Each chapter must own ONE concrete scene with a real on-page entry, a real escalation, a real climax under pressure, and a real exit hook. Do not paraphrase the beatGoal.",
        "- pov and climax.decisionOwnerId MUST be known character ids ('protagonist', 'char_01', 'char_05', etc.) — NEVER display names. Do not output Chinese names in these two fields.",
        "- climax.decisionOwnerId must match a known character id; the character must be present in this chapter; the choice must be one only that character could make.",
        "- climax.costPaid must be observable (info exposed, leverage spent, relationship damaged, identity revealed). Not an emotion.",
        "- characterArcMicroShift entries are MANDATORY structured objects. Never a slogan. Each entry has:",
        "  - characterId",
        "  - arcShiftRef (point at parent ArcShift.id when this chapter advances it; omit only when the shift is purely chapter-local)",
        "  - oldDefault: what the character would have done given their decisionProfile",
        "  - pressureTrigger: the on-page event in THIS chapter forcing a different call",
        "  - newChoice: the concrete action they actually take, observable behaviour",
        "  - costPaid: the visible price paid",
        "- Forbidden output shapes (will be rejected):",
        "  - generic phrases like \"她变得主动\" / \"成长\" / \"突破自己\" / \"觉醒\"",
        "  - micro-shift entries that restate the same arc-level shift verbatim across chapters",
        "  - copy-pasting beatGoal into chapterGoal-shaped fields",
        "- dueRevealIds entries MUST be ids drawn from the provided 'Beat reveal items' list. Never invent reveal ids. Distribute reveals across chapters so every reveal lands by its dueChapter; HARD reveals must land on or before their dueChapter.",
        "- Knowledge boundary rule (CRITICAL): each reveal carries a `revealMode`. When `experienced_as_anomaly`, the scene plan must phrase the chapter so the POV character experiences anomalies through their existing frame (family pressure, social conspiracy, gaslighting, coincidence, perception failing) WITHOUT naming the world-builder's rule. The text fields you generate (climax.decisionUnderPressure, midConflict.escalation, characterArcMicroShift.newChoice and pressureTrigger, endHook) MUST NOT contain any word from the per-fact `forbiddenVocabulary` list when the bound reveal is in `experienced_as_anomaly` mode. Same rule for `suspected_as_pattern`. Forbidden words are off-limits whether quoted, paraphrased, or 戏称.",
        "- climax.decisionUnderPressure must be phrased in the POV character's own frame at this stage. For early-arc chapters: 'she returns to confirm whether her family is conspiring or whether she's losing it', NOT 'she returns to verify whether the world will refuse to acknowledge her exit'. The latter presupposes the worldview the protagonist does not yet have.",
        // ────────────────────────────────────────────────────────────────────
        // Opening-arc scene-plan constraints (chapter <= 6). Mirrors the same
        // rules baked into the planner, applied one level upstream so scene
        // plans don't pre-bake supporting-character POVs that the planner
        // would then dutifully obey. See P15 audit checklist.
        // ────────────────────────────────────────────────────────────────────
        "- Opening-arc POV anchor (chapter <= 6): pov MUST be 'protagonist' UNLESS that specific chapter genuinely owns a supporting-character non-transferable choice with on-page cost; never assign a supporting-character POV just to deliver information / backstory / observation. A 'witness chapter' or 'recall chapter' from a supporting-character POV in chapter 1-6 is forbidden. Distribute supporting-character pressure into the protagonist's POV (she sees their reaction, hears their words, reads their actions) instead of switching narration.",
        "- Opening-arc supporting-POV gate (chapter <= 6): if a chapter's pov is NOT 'protagonist', that chapter's climax.decisionOwnerId must equal that POV character AND climax.costPaid must be a concrete cost paid by that POV character on-page (not by the protagonist). If you cannot ground both, the chapter must use protagonist POV instead.",
        "- Opening-arc info-release ceiling (chapter <= 6): each chapter's dueRevealIds may include AT MOST 1-3 reveals about world rules. Distribute beat reveals so the opening-arc chapters surface signals at a varied cadence; do not stack 4+ reveals in any single chapter even if they all 'belong to the same beat'. SOFT anomaly hints (atmospheric weirdness, POV's private mis-readings, sensory glitches NOT bound to a reveal contract id) are encouraged on top of the dueRevealIds budget — plant one such hint per chapter to keep mid-arc texture varied.",
        "- Opening-arc mechanism-explanation ban (chapter <= 6): climax.decisionUnderPressure / midConflict.escalation / endHook MUST NOT contain 'explain the rule', 'reveal the mechanism', 'walk through how X works' framings. The chapter shows experience, not exposition. Mechanism description belongs to chapter 7+.",
        "- Opening-arc endHook rule (chapter <= 6): endHook MUST be a new problem produced by the POV character's on-page action or choice — NOT 'a new character arrives', 'a message is received', 'a clue is dropped on her'. Acceptable shapes: protagonist makes a cut and reality refuses; she gains a small win and pays for it; she suspects person X but discovers a larger pattern; a supporting character breaks from their default position.",
        "- Opening-arc partial-win rhythm (chapter <= 6): MANDATORY protagonistGain field. For every consecutive pair of chapters (1-2, 3-4, 5-6), at least ONE of the two MUST have a non-null protagonistGain. protagonistGain must be a concrete observable on-page acquisition: information she learns, a loophole she discovers, leverage she keeps, an ally she protects. NOT an emotion ('she feels braver') and NOT a restatement of endHook. Set to null only when this chapter intentionally serves the 'cost/failure' side of the pair — and only if its partner chapter already has a non-null entry.",
        "- Skip characters who only observe; only include micro-shifts for characters who actually change in the chapter.",
        "- propsAndAnchors should list 2-4 concrete sensory or material objects/places that anchor the scene.",
        "- Use the protagonistArc.shifts and supportingCharacterArcs.shifts as the source of truth for which shift each chapter advances. Respect their expectedChapterRange.",
        "Per-chapter shape:",
        "  chapterNumber, beatId, arcId, pov, location, propsAndAnchors[2-4],",
        "  openingScene { entryHook, situationOnPage },",
        "  midConflict { trigger, escalation },",
        "  climax { decisionOwnerId, decisionUnderPressure, costPaid },",
        "  endHook,",
        "  protagonistGain (string | null),",
        "  dueRevealIds[],",
        "  characterArcMicroShift: SceneMicroShift[],",
        "  expectedDeltas[]",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        input.storyOutline
          ? `Story core theme: ${input.storyOutline.coreTheme}\nEnding target: ${input.storyOutline.endingTarget}`
          : undefined,
        `Theme baseline: core=${input.themeBible.coreTheme}; ending=${input.themeBible.endingTarget}`,
        `Author summary: ${input.authorPack.summary}`,
        `Author must rules: ${input.authorPack.mustRules.join(" | ")}`,
        `Arc:\n${JSON.stringify(arcSnapshot, null, 2)}`,
        `Beat to decompose:\n${JSON.stringify(beatSnapshot, null, 2)}`,
        `Chapter range to fill: ${input.chapterRange.start}-${input.chapterRange.end} (${chapterCount} chapters)`,
        `Protagonist:\n${JSON.stringify(compactCharacter(input.protagonist), null, 2)}`,
        supportingSnapshots.length
          ? `Supporting cast:\n${JSON.stringify(supportingSnapshots, null, 2)}`
          : undefined,
        worldFactsForArc.length
          ? `World facts available (use only as needed for beat reveals):\n${JSON.stringify(worldFactsForArc, null, 2)}`
          : undefined,
        input.revealItems?.length
          ? `Beat reveal items (dueRevealIds must reference these ids, never invent new ones):\n${JSON.stringify(
              input.revealItems.map((reveal) => {
                const mode = effectiveRevealMode(
                  reveal,
                  input.beat,
                  input.allArcOutlines ?? (input.arc ? [input.arc] : []),
                );
                const fact =
                  reveal.refId && reveal.kind === "world_fact"
                    ? input.worldFacts.find((f) => f.id === reveal.refId)
                    : undefined;
                return {
                  id: reveal.id,
                  kind: reveal.kind,
                  refId: reveal.refId,
                  text: reveal.text,
                  dueChapter: reveal.dueChapter,
                  severityIfMissed: reveal.severityIfMissed,
                  revealMode: mode,
                  forbiddenVocabulary:
                    mode === "named_explicitly" || !fact ? [] : getLabelVocabulary(fact),
                };
              }),
              null,
              2,
            )}`
          : undefined,
        (() => {
          const ctx = buildKnowledgeBoundaryContext({
            beat: input.beat,
            arcs: input.allArcOutlines ?? (input.arc ? [input.arc] : []),
            worldFacts: input.worldFacts,
          });
          const blocks: string[] = [];
          if (ctx.factsByMode.experienced_as_anomaly.length > 0) {
            blocks.push(
              `Knowledge boundary for THIS beat — experienced_as_anomaly facts (POV must NOT name these in the scene plan text):\n${ctx.factsByMode.experienced_as_anomaly
                .map((entry) => `  ${entry.factId}: forbidden=${entry.vocab.join(" / ") || "(none)"}`)
                .join("\n")}`,
            );
          }
          if (ctx.factsByMode.suspected_as_pattern.length > 0) {
            blocks.push(
              `Knowledge boundary for THIS beat — suspected_as_pattern facts (POV may suspect a pattern, never name canonical labels):\n${ctx.factsByMode.suspected_as_pattern
                .map((entry) => `  ${entry.factId}: forbidden=${entry.vocab.join(" / ") || "(none)"}`)
                .join("\n")}`,
            );
          }
          if (ctx.factsByMode.named_explicitly.length > 0) {
            blocks.push(
              `Knowledge boundary for THIS beat — named_explicitly facts (canonical labels allowed):\n${ctx.factsByMode.named_explicitly
                .map((entry) => `  ${entry.factId}: allowed=${entry.vocab.join(" / ") || "(none)"}`)
                .join("\n")}`,
            );
          }
          return blocks.length > 0 ? blocks.join("\n\n") : undefined;
        })(),
        input.existingPlans?.length
          ? `Existing scene plans (refine, do not erase fields you keep):\n${JSON.stringify(input.existingPlans, null, 2)}`
          : undefined,
        isSingleChapter && input.peerPlans?.length
          ? `Peer scene plans for other chapters in this beat (must differ structurally from these):\n${JSON.stringify(
              input.peerPlans,
              null,
              2,
            )}`
          : undefined,
        isSingleChapter
          ? `Produce exactly one scenePlans entry for chapter ${input.targetChapterNumber}. Do not write chapter prose.`
          : "Produce scenePlans[] only. Do not write chapter prose.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export const sceneDecomposerResultSchema: SceneDecomposerResult = {
  scenePlans: [
    {
      chapterNumber: 1,
      beatId: "string",
      arcId: "string",
      pov: "string",
      location: "string",
      propsAndAnchors: ["string"],
      openingScene: {
        entryHook: "string",
        situationOnPage: "string",
      },
      midConflict: {
        trigger: "string",
        escalation: "string",
      },
      climax: {
        decisionOwnerId: "string",
        decisionUnderPressure: "string",
        costPaid: "string",
      },
      endHook: "string",
      protagonistGain: "string | null",
      dueRevealIds: ["string"],
      characterArcMicroShift: [
        {
          characterId: "string",
          arcShiftRef: "string",
          oldDefault: "string",
          pressureTrigger: "string",
          newChoice: "string",
          costPaid: "string",
        },
      ],
      expectedDeltas: ["string"],
    },
  ],
  notes: ["string"],
} as unknown as SceneDecomposerResult;
