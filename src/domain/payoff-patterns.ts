import type { EntityId, PayoffPattern } from "./types.js";

export const defaultPayoffPatterns: PayoffPattern[] = [
  {
    id: "payoff-forced-exposure",
    name: "Forced Exposure",
    category: "relationship",
    summary:
      "A hidden truth, injury, resource, or dependency is dragged into the open by pressure rather than voluntary confession.",
    readerReward:
      "The story stops hovering around secrecy and finally forces the consequences into the scene.",
    whenToUse: [
      "A character has already hidden something successfully multiple times.",
      "The current crisis makes continued concealment implausible.",
      "The reveal should immediately change power or trust.",
    ],
    requiredSetup: [
      "Earlier scenes established what is being hidden and why exposure matters.",
      "At least one prior near-reveal failed or was deflected.",
    ],
    avoidWhen: [
      "The reveal would not alter behavior, stakes, or relationship state.",
      "The hidden information has not been seeded clearly enough.",
    ],
    risks: [
      "If nobody pays a price for the exposure, the scene feels hollow.",
      "If used too early, later secrecy beats lose force.",
    ],
    arcUses: [
      "Opening arcs that establish the main hidden fault line.",
      "Midpoint arcs where concealment becomes structurally unsustainable.",
    ],
    beatUses: [
      "Revelation beat",
      "Escalation beat",
      "Trust fracture beat",
    ],
  },
  {
    id: "payoff-costly-rescue",
    name: "Costly Rescue",
    category: "plot",
    summary:
      "A rescue or life-saving intervention succeeds, but it permanently alters relationships, leverage, or future risk.",
    readerReward:
      "The reader gets the release of survival without losing the weight of consequence.",
    whenToUse: [
      "The story centers on refusal of help, dependency, or debt.",
      "Survival should create a new burden rather than reset the board.",
    ],
    requiredSetup: [
      "The rescue option has been foreshadowed as costly, humiliating, or dangerous.",
      "The rescuer and recipient already have unresolved tension.",
    ],
    avoidWhen: [
      "The scene only needs a clean victory.",
      "The cost would be immediately erased in the next chapter.",
    ],
    risks: [
      "If the cost is vague, the beat reads as fake seriousness.",
      "If every rescue is costly in the same way, the pattern goes flat.",
    ],
    arcUses: [
      "Early arcs to define the story's survival logic.",
      "Late arcs to cash out the theme with irreversible consequences.",
    ],
    beatUses: [
      "Decision beat",
      "Crisis survival beat",
      "Aftermath beat",
    ],
  },
  {
    id: "payoff-delayed-confession",
    name: "Delayed Confession",
    category: "emotional",
    summary:
      "A character finally names a fear, attachment, guilt, or need after a long stretch of avoidance.",
    readerReward:
      "The reader gets emotional release from something that has been painfully deferred.",
    whenToUse: [
      "The relationship has been driven by subtext and evasion.",
      "The confession should reframe prior behavior rather than only summarize it.",
    ],
    requiredSetup: [
      "Multiple prior scenes show the character nearly admitting the truth.",
      "The confession addresses a real internal cost, not just withheld exposition.",
    ],
    avoidWhen: [
      "The confession happens before enough restraint has accumulated.",
      "The other character has no meaningful response or stake in hearing it.",
    ],
    risks: [
      "If phrased too cleanly, it breaks character voice.",
      "If it solves the relationship immediately, it feels cheap.",
    ],
    arcUses: [
      "Repair arcs",
      "Late-mid arcs where emotional pressure can no longer stay submerged.",
    ],
    beatUses: [
      "Confession beat",
      "Repair attempt beat",
      "Collapse beat",
    ],
  },
  {
    id: "payoff-relationship-breakpoint",
    name: "Relationship Breakpoint",
    category: "relationship",
    summary:
      "An important relationship crosses a line that makes the old equilibrium impossible to restore.",
    readerReward:
      "The relationship finally moves instead of endlessly circling the same argument.",
    whenToUse: [
      "The core pair has repeated the same concealment or rescue loop too many times.",
      "A chapter needs irreversible interpersonal change rather than more atmosphere.",
    ],
    requiredSetup: [
      "There is a clear existing equilibrium worth breaking.",
      "Both characters have something to lose from the rupture.",
    ],
    avoidWhen: [
      "The relationship has not yet earned a decisive break.",
      "The story cannot yet support the fallout.",
    ],
    risks: [
      "If the break is too loud and too early, later escalation becomes repetitive.",
      "If the fallout is skipped, the break looks cosmetic.",
    ],
    arcUses: [
      "Middle arcs that need a strong structural turn.",
      "Pre-repair arcs where damage must become undeniable.",
    ],
    beatUses: [
      "Confrontation beat",
      "Betrayal beat",
      "Rupture beat",
    ],
  },
  {
    id: "payoff-earned-reconciliation",
    name: "Earned Reconciliation",
    category: "theme",
    summary:
      "A relationship or self-concept moves toward repair only after visible cost, changed behavior, and partial truth.",
    readerReward:
      "The reader gets emotional relief without the story betraying its own standards.",
    whenToUse: [
      "The story refuses cheap forgiveness but still wants movement toward healing.",
      "A character has already demonstrated some costly change.",
    ],
    requiredSetup: [
      "Prior damage is concrete and remembered.",
      "The repairing character has paid or accepted a meaningful cost.",
    ],
    avoidWhen: [
      "The only evidence of change is a speech.",
      "The harmed party has not had room to resist or withhold forgiveness.",
    ],
    risks: [
      "If the reconciliation fully closes the wound, later chapters lose tension.",
      "If the cost stays abstract, the beat feels sentimental.",
    ],
    arcUses: [
      "Late arcs that pay off long-term fracture.",
      "Ending arcs that need bittersweet stability rather than total restoration.",
    ],
    beatUses: [
      "Repair beat",
      "Mutual recognition beat",
      "Thematic payoff beat",
    ],
  },
  {
    id: "payoff-collateral-damage",
    name: "Collateral Damage",
    category: "plot",
    summary:
      "A protagonist's old pattern finally harms someone else badly enough that it cannot remain a private flaw.",
    readerReward:
      "The story proves that the core flaw has external stakes, not just internal angst.",
    whenToUse: [
      "A repeated flaw needs to become morally and structurally unavoidable.",
      "The story needs to move from self-harm to consequences for others.",
    ],
    requiredSetup: [
      "The flaw has already been shown in smaller forms.",
      "The harmed character matters enough to carry emotional and plot weight.",
    ],
    avoidWhen: [
      "The harmed character exists only to be hurt.",
      "The damage would not change future decisions or relationships.",
    ],
    risks: [
      "If overused, the protagonist starts looking mechanically destructive.",
      "If the harmed character lacks agency, the beat feels manipulative.",
    ],
    arcUses: [
      "First half turning arcs",
      "Rock-bottom arcs",
    ],
    beatUses: [
      "Consequences beat",
      "Guilt beat",
      "Moral escalation beat",
    ],
  },
  {
    id: "payoff-mirror-warning",
    name: "Mirror Warning",
    category: "theme",
    summary:
      "Another character embodies a possible future, failure, or compromise that warns the protagonist what their path leads to.",
    readerReward:
      "The reader sees the theme dramatized through a person instead of explained through exposition.",
    whenToUse: [
      "The story needs to externalize an internal arc.",
      "A long serial needs variation beyond the core pair's repeated dynamic.",
    ],
    requiredSetup: [
      "The mirror character overlaps with the protagonist in one key pattern.",
      "Their divergence point is clear enough to matter.",
    ],
    avoidWhen: [
      "The mirror character is only symbolic and has no independent agenda.",
      "The comparison is so direct that it feels like a lecture.",
    ],
    risks: [
      "If too blunt, the mirror feels like a prop.",
      "If the mirror never pressures choice, it becomes wasted thematic scenery.",
    ],
    arcUses: [
      "Middle arcs where the protagonist still resists self-knowledge.",
      "Repair arcs that need an alternative outcome in view.",
    ],
    beatUses: [
      "Warning beat",
      "Comparison beat",
      "Choice-framing beat",
    ],
  },
  {
    id: "payoff-old-setup-payoff",
    name: "Old Setup Payoff",
    category: "plot",
    summary:
      "A previously seeded object, promise, injury rule, debt, or line of dialogue returns at the exact moment it can change the story.",
    readerReward:
      "The reader gets the pleasure of continuity, competence, and delayed payoff.",
    whenToUse: [
      "The story already seeded a concrete element with future utility.",
      "The current chapter benefits from a sense of inevitability rather than surprise alone.",
    ],
    requiredSetup: [
      "The original setup was clear enough to be remembered.",
      "The payoff changes action, not just symbolism.",
    ],
    avoidWhen: [
      "The callback is too minor to matter.",
      "The setup was never properly seeded on the page.",
    ],
    risks: [
      "If the payoff is too convenient, it reads as contrived.",
      "If every setup pays off immediately, long-form anticipation weakens.",
    ],
    arcUses: [
      "Any arc with stored resources, vows, or unresolved threads.",
      "Climactic arcs that need earned continuity.",
    ],
    beatUses: [
      "Resource trigger beat",
      "Callback beat",
      "Resolution beat",
    ],
  },
];

export function getPayoffPatternById(id: EntityId): PayoffPattern | undefined {
  return defaultPayoffPatterns.find((pattern) => pattern.id === id);
}
