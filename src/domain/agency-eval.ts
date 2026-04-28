import type { CharacterState, EpisodePacket } from "./types.js";

export type AgencyCheckId =
  | "non_transferable_choice"
  | "two_tolerable_options"
  | "choice_has_cost"
  | "protagonist_causes_consequence"
  | "not_passive_observer";

export interface AgencyEvalCheck {
  id: AgencyCheckId;
  passed: boolean;
  score: number;
  reason: string;
}

export interface AgencyEvalReport {
  episodeId: string;
  chapterNumber: number;
  agencyOwnerId: string;
  agencyScore: number;
  passed: boolean;
  failureReasons: string[];
  checks: AgencyEvalCheck[];
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

function hasSubstantialText(text: string | undefined): boolean {
  return Boolean(text && text.trim().length >= 8);
}

function stripRecentConsequenceContext(text: string): string {
  // The episode packet builder embeds the prior chapter's recent-consequence summary as
  //   "...不能绕开上一轮后果：<recent>。 代价必须触及：..."
  // That segment is descriptive backstory, not the protagonist's current decision,
  // so it must not feed the passive-language check.
  return text.replace(/不能绕开上一轮后果：[\s\S]*?(?= 代价必须触及：|$)/g, "");
}

function isPassiveText(text: string): boolean {
  const normalized = normalizeText(stripRecentConsequenceContext(text));
  return includesAny(normalized, [
    "观察",
    "旁观",
    "听说",
    "收到消息",
    "被告知",
    "等待",
    "被安排",
    "is told",
    "observes",
    "watches",
    "waits",
  ]);
}

function ownerName(owner: CharacterState | undefined, fallbackId: string): string {
  return owner?.name?.trim() || fallbackId;
}

export function evaluateEpisodeAgency(args: {
  packet: EpisodePacket;
  agencyOwner?: CharacterState;
}): AgencyEvalReport {
  const owner = ownerName(args.agencyOwner, args.packet.agencyOwnerId);
  const choiceText = args.packet.nonTransferableChoice;
  const consequenceText = args.packet.protagonistConsequence;
  const costText = args.packet.choiceCost;
  const options = args.packet.tolerableOptions.filter((item) => item.trim().length > 0);
  const choiceMentionsOwner =
    choiceText.includes(owner) ||
    choiceText.includes(args.packet.agencyOwnerId) ||
    choiceText.includes("主角");
  const personalChoiceLanguage = includesAny(choiceText, [
    "必须亲自",
    "亲自",
    "选择",
    "决定",
    "拒绝",
    "承认",
    "公开",
    "承担",
  ]);
  const consequenceHasAgency =
    hasSubstantialText(consequenceText) &&
    (consequenceText.includes(owner) ||
      consequenceText.includes(args.packet.agencyOwnerId) ||
      consequenceText.includes("主角") ||
      consequenceText.includes("因此") ||
      consequenceText.includes("导致"));
  const visibleMajorDelta = args.packet.stateDeltasExpected.some(
    (delta) =>
      delta.visibility === "reader_visible" &&
      (delta.causalWeight === "major" || delta.causalWeight === "irreversible") &&
      (delta.targetId === args.packet.agencyOwnerId ||
        delta.targetType === "character" ||
        delta.targetType === "relationship" ||
        delta.targetType === "thread"),
  );
  const passive =
    isPassiveText(choiceText) ||
    isPassiveText(consequenceText) ||
    includesAny(choiceText, ["只是", "仅仅", "only"]);

  const checks: AgencyEvalCheck[] = [
    {
      id: "non_transferable_choice",
      passed: hasSubstantialText(choiceText) && choiceMentionsOwner && personalChoiceLanguage,
      score: hasSubstantialText(choiceText) && choiceMentionsOwner && personalChoiceLanguage ? 25 : 0,
      reason:
        hasSubstantialText(choiceText) && choiceMentionsOwner && personalChoiceLanguage
          ? "Choice names the agency owner and requires a personal decision."
          : "Choice is missing a named, non-transferable protagonist decision.",
    },
    {
      id: "two_tolerable_options",
      passed: options.length >= 2,
      score: options.length >= 2 ? 20 : 0,
      reason:
        options.length >= 2
          ? "Packet gives at least two tolerable options."
          : "Packet needs at least two tolerable options, not one forced path.",
    },
    {
      id: "choice_has_cost",
      passed: hasSubstantialText(costText) && !includesAny(costText, ["无代价", "没有代价", "none"]),
      score: hasSubstantialText(costText) && !includesAny(costText, ["无代价", "没有代价", "none"]) ? 20 : 0,
      reason:
        hasSubstantialText(costText) && !includesAny(costText, ["无代价", "没有代价", "none"])
          ? "Choice has an explicit cost."
          : "Choice lacks an explicit cost.",
    },
    {
      id: "protagonist_causes_consequence",
      passed: consequenceHasAgency && visibleMajorDelta,
      score: consequenceHasAgency && visibleMajorDelta ? 25 : 0,
      reason:
        consequenceHasAgency && visibleMajorDelta
          ? "Consequence is caused by the protagonist and reflected in visible state deltas."
          : "Consequence could happen without the protagonist or lacks visible state delta.",
    },
    {
      id: "not_passive_observer",
      passed: !passive,
      score: !passive ? 10 : 0,
      reason: !passive
        ? "Packet does not reduce the protagonist to observation or receiving information."
        : "Packet contains passive observation/receiving-info language.",
    },
  ];
  const agencyScore = checks.reduce((sum, check) => sum + check.score, 0);
  const failureReasons = checks
    .filter((check) => !check.passed)
    .map((check) => check.reason);
  if (agencyScore < 60) {
    failureReasons.unshift("low_agency");
  }

  return {
    episodeId: args.packet.id,
    chapterNumber: args.packet.chapterNumber,
    agencyOwnerId: args.packet.agencyOwnerId,
    agencyScore,
    passed: agencyScore >= 60 && checks.every((check) => check.passed),
    failureReasons,
    checks,
  };
}

