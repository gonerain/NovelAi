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
  /** Pre-computed beat budget status for this specific chapter. */
  beatBudgetStatus?: {
    chaptersRemaining: number;
    taskBudgetRemaining: number;
    shortfall: number;
    isFinale: boolean;
  };
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
  const isPawnshopBeat =
    input.beat.payoffPatternIds?.includes("urban_rule_pawnshop_v1") ||
    input.storyOutline?.title.includes("典当") ||
    input.arc.name.includes("典当") ||
    input.arc.arcGoal.includes("典当");
  const pawnshopChapterStaging =
    isPawnshopBeat && input.targetChapterNumber === 1
      ? [
          "CHAPTER 1 PAWNSHOP STAGING — HARD:",
          "- Output for chapter 1 must NOT include signing, handprint, transaction completion, exchange completion, price collection, clue address, or '代价已生效'.",
          "- Chapter 1 endHook should stop at: the client names or nearly names the candidate pawned rule, and the shop prepares a contract. No confirmation yet.",
          "- The first client must appear within openingScene.situationOnPage, not only in midConflict.",
        ].join("\n")
      : isPawnshopBeat && input.targetChapterNumber === 2
        ? [
            "CHAPTER 2 PAWNSHOP STAGING — HARD:",
            "- Output for chapter 2 must NOT include a second client, second deal, anonymous 'I want to sell a rule' message, pause, cancellation, redeem, refund, or full transaction completion.",
            "- Chapter 2 must expose the first client's hidden fault/desire and make the exact rule/cost concrete enough that obvious workarounds fail.",
            "- Chapter 2 endHook should lock pressure around whether the client will confirm the first transaction, not open a new case.",
          ].join("\n")
        : isPawnshopBeat && input.targetChapterNumber === 3
          ? [
              "CHAPTER 3 PAWNSHOP STAGING — HARD:",
              "- Output for chapter 3 may lock/confirm the first transaction and show the first irreversible cost starting.",
              "- Output for chapter 3 must NOT resolve the missing-person case, reveal the missing person is safely found, introduce a second client/deal, or reveal pause/cancel/redeem mechanics.",
              "- Chapter 3 endHook should be first backlash from the completed first transaction, not a new transaction request.",
            ].join("\n")
          : undefined;

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
        "- Concept grounding rule: every rule/cost/clue/relationship shift in this chapter must answer 'so what?' through a visible action, loss, danger, leverage, blocked route, changed access, or concrete behavior. If the consequence only works as symbolism, rewrite it.",
        "- Transaction semantics lock: for any rule/bargain/cost/exchange/debt/contract in the arc or beat, preserve the exact subject, object, beneficiary, loss target, payer, and received benefit. Do not make the protagonist the new owner/target/rescuer/beneficiary unless the arc or beat explicitly says the rule transfers to her.",
        "- Transaction semantics lock: if a character pawns a relationship route (for example: someone would seek them first in danger), the scene cost must damage that route for that character. It must not quietly create a convenient new route to the protagonist.",
        "- Failed workaround rule: identify the obvious workaround a reader would think of and block it inside the scene logic. Do not rely on readers doing literary interpretation.",
        "- Scene proof rule: prove every important concept with an object/action/result on page within this chapter, not with explanation.",
        "- Female-frequency scene rule: every chapter needs a concrete daily-life surface (food, laundry, transport, work, hotel, phone, medicine, clothes, rent, documents) and a relationship pressure embedded in that surface. Do not stage chapters as abstract rule tests.",
        "- Protagonist texture rule: every chapter must include one visible small habit/flaw/action in propsAndAnchors, openingScene, or expectedDeltas (sorting labels, splitting food, hiding a chewed pen cap, arranging tickets, refusing water while clearly thirsty). This prevents the protagonist from reading like a correct-opinion speaker.",
        "- Hearing / explaining rule: every chapter must make clear inside scene text who fails to hear the protagonist, who hears her more accurately, or who explains her away. Encode this through midConflict, climax, endHook, or expectedDeltas.",
        "- Old-intimacy pressure rule: when the old intimate figure appears, his action must contain both real tenderness and real control. He remembers a habit or pain point, but still does not ask or respect the protagonist's current consent.",
        "- Female-friend agency rule: when the female friend appears, she must have her own cost, anger, choice, or boundary. She is not a free safe house, assistant, or exposition partner.",
        "- Witness-character restraint rule: an order/witness character may accurately repeat the protagonist's words, but must not become a rescuer or instant romantic answer in the opening episode.",
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
        "- Pawnshop opening hook rule (urban_rule_pawnshop_v1, chapter 1): the first 800 Chinese characters must establish protagonist + concrete money/life trouble + pawnshop abnormality + first client arrival/request. Do not spend the whole first chapter only on entering the shop.",
        "- Pawnshop first-transaction staging (urban_rule_pawnshop_v1, chapter 1): DO NOT complete the transaction, sign the contract, press a handprint, deliver the clue, or collect the price. Chapter 1 should end after the exact candidate rule / trade question becomes clear.",
        "- Pawnshop first-transaction staging (urban_rule_pawnshop_v1, chapter 2): expose the client's hidden fault/desire, block the obvious workaround, and define the exact rule/cost in concrete terms. DO NOT sign, complete, lock, establish, or fulfill the transaction. DO NOT let the protagonist write the price/代价, fill a post-completion price field, or say the price can be completed later. DO NOT introduce a second client, second transaction, anonymous 'I want to sell a rule' message, refund, pause, cancellation,赎回, or撤销.",
        "- Pawnshop first-transaction staging (urban_rule_pawnshop_v1, chapter 3): complete or lock the first transaction, deliver the first clue, and show the first irreversible cost starting to collect. DO NOT resolve the first case, do not reveal whether the missing person is safe, do not introduce a second transaction, and do not reveal pause/cancel/redeem mechanics.",
        "- Pawnshop first-transaction compression (urban_rule_pawnshop_v1, chapter 1-3): chapter 1 sells the premise; chapter 2 makes the human desire dangerous; chapter 3 lands exchange + first backlash. Keep the first case alive after chapter 3.",
        "- Opening-arc endHook rule (chapter <= 6): endHook MUST be a new problem produced by the POV character's on-page action or choice — NOT 'a new character arrives', 'a message is received', 'a clue is dropped on her'. Acceptable shapes: protagonist makes a cut and reality refuses; she gains a small win and pays for it; she suspects person X but discovers a larger pattern; a supporting character breaks from their default position.",
        "- Opening-arc continuity ban (chapter <= 6): do not use a new incoming client/second deal as the hook while the first case is unresolved. Escalate the active case instead.",
        "- Opening-arc partial-win rhythm (chapter <= 6): MANDATORY protagonistGain field. For every consecutive pair of chapters (1-2, 3-4, 5-6), at least ONE of the two MUST have a non-null protagonistGain. protagonistGain must be a concrete observable on-page acquisition: information she learns, a loophole she discovers, leverage she keeps, an ally she protects. NOT an emotion ('she feels braver') and NOT a restatement of endHook. Set to null only when this chapter intentionally serves the 'cost/failure' side of the pair — and only if its partner chapter already has a non-null entry.",
        "- Skip characters who only observe; only include micro-shifts for characters who actually change in the chapter.",
        "- propsAndAnchors should list 2-4 concrete sensory or material objects/places that anchor the scene.",
        "- Use the protagonistArc.shifts and supportingCharacterArcs.shifts as the source of truth for which shift each chapter advances. Respect their expectedChapterRange.",
        "- Narrative task assignment: if the beat provides narrativeTasks, before writing scene content, look at the task pool and each task's chaptersUsed / targetChapterBudget ratio. Select 1-2 tasks to advance this chapter (put their ids in advancingTaskIds). List the remaining tasks in heldTaskIds. A chapter that tries to advance all tasks simultaneously will feel diffuse — use task assignment to force structural variety across the beat's chapters. If all tasks have reached their targetChapterBudget, do NOT leave advancingTaskIds empty — either carry over the most critical task (at the cost of slightly exceeding its budget) or create a chapter-local task described as 'local: [description]'.",
        "- Anomaly mechanism category diversity rule: six categories exist — (1) communication_override (phones, messages, calls redirected), (2) identity_document_forgery (signatures, records, credentials replaced), (3) physical_presence_substitute (doppelganger, body double in physical space), (4) transportation_redirect (tickets, routes, vehicles altered), (5) surveillance_tracking (location exposed or monitored by system), (6) social_consensus (everyone assumes protagonist is present/agreed without evidence). No two CONSECUTIVE chapters within the same beat may use the same primary category. Track what the prior chapter used and choose a different one. Include the chosen category id in a comment in your reasoning but you do not need to output it as a JSON field.",
        "- Beat payoff rule: the FINAL 1-2 chapters of a beat MUST deliver a payoff scene that resolves or escalates the most prominent hook planted in the OPENING chapter of that beat. If the opening chapter planted 'there is a physical double standing in for her', the beat cannot close without at least one scene where protagonist encounters that double directly. Repeating the same demonstration pattern (system overrides her choice, she observes and escapes, nothing changes hands) across all chapters of a beat is FORBIDDEN — the final chapter must raise the stakes by confrontation, alliance, or betrayal that was impossible in chapter 1.",
        "- Climax outcome diversity rule: three outcome types exist — (1) `blocked`: protagonist is redirected, stopped, or forced onto the preset path; pays a cost but gains nothing concrete. (2) `partial_win`: protagonist gains concrete information, leverage, or capability at a cost; the next chapter starts from a stronger position. (3) `pivot`: protagonist abandons the current approach entirely and commits to a fundamentally different tactic; the story's strategic situation changes. Look at the peer chapters' climax.costPaid and climax.decisionUnderPressure to infer what outcome type they used. Two consecutive `blocked` chapters within the same beat are FORBIDDEN. Plan your chapter's climax outcome type and ensure it differs from the prior chapter.",
        "- characterDecisionArc: fill this for every chapter. It is the psychological shape of the central decision, grounded in the advancing tasks. desire = the one concrete thing the POV character is trying to get (info/leverage/proof/exit, never an emotion). misjudgment = what they got wrong before the chapter corrected them. activeCounter = the named person or mechanism that actively blocks (not passive circumstance — something that acts against them). forcedChoice = the binary the counter imposes. costPaid = the observable price. downstreamImpact = how this cost constrains the next chapter.",
        "Per-chapter shape:",
        "  chapterNumber, beatId, arcId, pov, location, propsAndAnchors[2-4],",
        "  openingScene { entryHook, situationOnPage },",
        "  midConflict { trigger, escalation },",
        "  climax { decisionOwnerId, decisionUnderPressure, costPaid },",
        "  endHook,",
        "  protagonistGain (string | null),",
        "  advancingTaskIds[], heldTaskIds[],",
        "  characterDecisionArc { desire, misjudgment, activeCounter, forcedChoice, costPaid, downstreamImpact },",
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
        input.beat.narrativeTasks?.length
          ? `Beat narrative task pool (assign 1-2 advancing per chapter; hold the rest):\n${JSON.stringify(
              input.beat.narrativeTasks.map((task) => ({
                id: task.id,
                dimension: task.dimension,
                description: task.description,
                budget: `${task.chaptersUsed}/${task.targetChapterBudget} chapters used`,
              })),
              null,
              2,
            )}`
          : undefined,
        (() => {
          const b = input.beatBudgetStatus;
          if (!b) return undefined;
          const lines = [
            `Beat budget status for chapter ${input.targetChapterNumber ?? "?"}:`,
            `  chapters remaining in beat (including this one): ${b.chaptersRemaining}`,
            `  task budget points remaining: ${b.taskBudgetRemaining}`,
          ];
          if (b.shortfall > 0) {
            lines.push(
              `  ⚠ budget shortfall: ${b.shortfall} chapter(s) have no task to advance`,
            );
          }
          if (b.isFinale) {
            lines.push(
              `  → BEAT FINALE MODE: task pool is exhausted before the beat ends. This chapter MUST NOT repeat a prior demonstration. It must deliver the payoff promised by the beat's opening hook — confrontation, revelation, or a pivot that was impossible in chapter 1. Use a 'local:' task in advancingTaskIds.`,
            );
          }
          return lines.join("\n");
        })(),
        input.existingPlans?.length
          ? `Existing scene plans (refine, do not erase fields you keep):\n${JSON.stringify(input.existingPlans, null, 2)}`
          : undefined,
        isSingleChapter && input.peerPlans?.length
          ? `Peer scene plans for other chapters in this beat (must differ structurally — especially the midConflict mechanism — from these):\n${JSON.stringify(
              input.peerPlans.map((p) => ({
                chapterNumber: p.chapterNumber,
                pov: p.pov,
                location: p.location,
                openingScene: { entryHook: p.openingScene?.entryHook },
                midConflict: p.midConflict,
                climax: {
                  decisionOwnerId: p.climax?.decisionOwnerId,
                  decisionUnderPressure: p.climax?.decisionUnderPressure,
                },
                endHook: p.endHook,
                advancingTaskIds: p.advancingTaskIds,
              })),
              null,
              2,
            )}`
          : undefined,
        isSingleChapter
          ? `Produce exactly one scenePlans entry for chapter ${input.targetChapterNumber}. Do not write chapter prose.`
          : "Produce scenePlans[] only. Do not write chapter prose.",
        pawnshopChapterStaging,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

// ── SCHEMA EXAMPLE ─────────────────────────────────────────────────────────────
// This example shows a BEAT-FINAL chapter (chapter 5 of 5 in a beat).
// Key design choices to study:
//   • Anomaly category: physical_presence_substitute (doppelganger confronted
//     face-to-face). The prior chapter used transportation_redirect, the one before
//     used surveillance_tracking — categories rotate, never repeat consecutively.
//   • Beat payoff: ch1 planted "there is a physical double standing in for her";
//     this beat-final chapter MUST deliver a direct encounter with that double.
//     Failing to do so (e.g. another ticket-redirect scene) would violate beat payoff rule.
//   • advancingTaskIds: the main_plot task has reached its budget, but rather than
//     leave the array empty, the emotional task is carried over with budget slightly
//     exceeded — the array is never empty.
//   • protagonistGain: non-null; she gains a concrete new rule about the system
//     (the double is self-aware), not an emotion.
//   • characterDecisionArc.desire is chapter-specific (not copied from beat goal).
//   • endHook is produced by protagonist's own action, not by an external arrival.
export const sceneDecomposerResultSchema: SceneDecomposerResult = {
  scenePlans: [
    {
      chapterNumber: 5,
      beatId: "beat_escape_001",
      arcId: "arc_escape",
      pov: "protagonist",
      location: "hotel backstage corridor — dressing room wing, end of beat-1 beat range",
      propsAndAnchors: [
        "wedding veil left on a folding chair",
        "dual mirrors angled to show infinite reflection",
        "the double's handwriting on a crumpled serviette",
        "security badge clipped to the double's collar",
      ],
      openingScene: {
        entryHook: "she slips past a distracted security guard into the backstage corridor, expecting the doppelganger to be alone now that the ceremony is winding down",
        situationOnPage: "the corridor is dim; she sees a figure in the bridal gown at the far end, back turned, touching up lipstick in a pocket mirror",
      },
      midConflict: {
        trigger: "the figure turns and their eyes meet — the double does not run or freeze; instead it says her name, her childhood nickname, in her own voice",
        escalation: "the double recites a specific memory only she knows (the smell of her grandmother's kitchen the morning she left for university), proving it holds her interior life — this was not a shallow copy",
      },
      climax: {
        decisionOwnerId: "protagonist",
        decisionUnderPressure: "she realizes the double does not know it is a copy — it believes it is her, acting freely, and signed the marriage register believing it was making its own choice; she must decide whether to claim her identity back (which means destroying someone who thinks it is real) or step aside and learn what the double knows about the system",
        costPaid: "she steps aside; the double signs the final reception document in her name; the legal act is now complete and cannot be undone tonight",
      },
      endHook: "as she leaves, she finds a handwritten note slipped into her coat pocket — 'I know you exist. I've known since the car. Don't come back unless you're ready to talk.'",
      protagonistGain: "she discovers the doppelganger is self-aware and not a mindless puppet — the system does not merely substitute bodies, it instantiates autonomous identity copies; her prior plan to destroy the system's 'prop' is now ethically impossible",
      advancingTaskIds: ["task_escape_001_emotional"],
      heldTaskIds: ["task_escape_001_relationship"],
      characterDecisionArc: {
        desire: "she wants to reclaim her physical presence at the venue and force at least one witness to acknowledge that two 'Lin Jianyue' exist simultaneously",
        misjudgment: "she assumed the double was a hollow substitute that would panic or glitch on contact — she planned to exploit that breakdown as public proof",
        activeCounter: "the double engages her as a peer, not a prop — it has her full memory, her voice, her affect; a breakdown scene is impossible because there is nothing broken",
        forcedChoice: "assert identity at the cost of a public confrontation that destroys a self-aware being vs observe silently and collect the note (let the double 'win' tonight, gain intelligence)",
        costPaid: "she withdraws; the marriage document is legally signed in her name by another consciousness; she loses tonight's window to invalidate the ceremony",
        downstreamImpact: "next chapter she must decide whether to contact the double through the note — she can no longer treat the double as an obstacle to remove; it is a potential source or a trap",
      },
      dueRevealIds: ["reveal_escape_double_awareness"],
      characterArcMicroShift: [
        {
          characterId: "protagonist",
          arcShiftRef: "shift_escape_01_agency",
          oldDefault: "she would have confronted loudly and demanded the double 'admit' what it is",
          pressureTrigger: "the double recites her private memory verbatim; loud confrontation would only look like a deranged bride attacking herself",
          newChoice: "she asks a single quiet question — 'who told you about the kitchen?' — then waits",
          costPaid: "asking reveals she is testing for consciousness, which the double logs; she is no longer anonymous to it",
        },
      ],
      expectedDeltas: [
        "protagonist's threat model shifts from 'system controlling a prop' to 'system that can instantiate autonomous copies'",
        "double is now a character with potential for alliance or betrayal, not a pure antagonist",
      ],
    },
  ],
  notes: ["string"],
} as unknown as SceneDecomposerResult;
