import type {
  EntityId,
  NarrativeThread,
  NarrativeThreadStatus,
  StateDelta,
  StateDeltaContractImpact,
  StoryContract,
  ThreadSchedulerState,
} from "./types.js";
import { clampSchedulerValue } from "./thread-scheduler.js";

export interface ThreadSchedulerDelta {
  urgency: number;
  heat: number;
  staleness: number;
  payoffReadiness: number;
  setupDebt: number;
  readerDebt: number;
  agencyPotential: number;
  offscreenPressure: number;
}

export interface AppliedDeltaContractImpact {
  contractId: EntityId;
  impact: StateDeltaContractImpact["impact"];
  note: string;
}

export interface AppliedDeltaRecord {
  deltaId: EntityId;
  deltaType: StateDelta["deltaType"];
  causalWeight: StateDelta["causalWeight"];
  visibility: StateDelta["visibility"];
  source: StateDelta["source"];
  matchReason: string;
  schedulerEffect: ThreadSchedulerDelta;
  contractImpacts: AppliedDeltaContractImpact[];
}

export interface ThreadStateSnapshot {
  status: NarrativeThreadStatus;
  scheduler: ThreadSchedulerState;
  lastTouchedChapter: number;
}

export interface ThreadUpdateChange {
  threadId: EntityId;
  before: ThreadStateSnapshot;
  after: ThreadStateSnapshot;
  schedulerDelta: ThreadSchedulerDelta;
  appliedDeltas: AppliedDeltaRecord[];
  statusChangeReasons: string[];
  matchReasons: string[];
}

export interface ThreadContractConflict {
  threadId: EntityId;
  contractId: EntityId;
  deltaId: EntityId;
  impact: "risks" | "violates" | "unknown_contract";
  note: string;
}

export interface ThreadUpdateReport {
  chapterNumber: number;
  threadsConsidered: number;
  threadsTouched: number;
  appliedDeltaCount: number;
  matchedDeltaIds: EntityId[];
  unmatchedDeltaIds: EntityId[];
  changes: ThreadUpdateChange[];
  conflicts: ThreadContractConflict[];
}

export interface ThreadUpdateResult {
  threads: NarrativeThread[];
  report: ThreadUpdateReport;
}

const ZERO_DELTA: ThreadSchedulerDelta = {
  urgency: 0,
  heat: 0,
  staleness: 0,
  payoffReadiness: 0,
  setupDebt: 0,
  readerDebt: 0,
  agencyPotential: 0,
  offscreenPressure: 0,
};

function emptyDelta(): ThreadSchedulerDelta {
  return { ...ZERO_DELTA };
}

function addDelta(left: ThreadSchedulerDelta, right: ThreadSchedulerDelta): ThreadSchedulerDelta {
  return {
    urgency: left.urgency + right.urgency,
    heat: left.heat + right.heat,
    staleness: left.staleness + right.staleness,
    payoffReadiness: left.payoffReadiness + right.payoffReadiness,
    setupDebt: left.setupDebt + right.setupDebt,
    readerDebt: left.readerDebt + right.readerDebt,
    agencyPotential: left.agencyPotential + right.agencyPotential,
    offscreenPressure: left.offscreenPressure + right.offscreenPressure,
  };
}

// Per-chapter aggregate caps. Without these, multiple deltas on the same thread
// stack to saturation in 2-3 chapters (every thread hitting payoffReadiness=100,
// readerDebt=0, etc.), which collapses the scheduler's discrimination power.
const PER_CHAPTER_CAP_POS = 30;
const PER_CHAPTER_CAP_NEG = -30;

function clampField(value: number, posCap = PER_CHAPTER_CAP_POS, negCap = PER_CHAPTER_CAP_NEG): number {
  if (value > posCap) {
    return posCap;
  }
  if (value < negCap) {
    return negCap;
  }
  return value;
}

function capAggregate(delta: ThreadSchedulerDelta): ThreadSchedulerDelta {
  return {
    urgency: clampField(delta.urgency),
    heat: clampField(delta.heat),
    staleness: clampField(delta.staleness),
    payoffReadiness: clampField(delta.payoffReadiness),
    // Set/reader debt can move further per chapter (e.g. a major payoff legitimately wipes debt).
    setupDebt: clampField(delta.setupDebt, 25, -40),
    readerDebt: clampField(delta.readerDebt, 25, -50),
    agencyPotential: clampField(delta.agencyPotential, 20, -20),
    offscreenPressure: clampField(delta.offscreenPressure, 40, -25),
  };
}

function applySchedulerDelta(
  state: ThreadSchedulerState,
  delta: ThreadSchedulerDelta,
): ThreadSchedulerState {
  return {
    urgency: clampSchedulerValue(state.urgency + delta.urgency),
    heat: clampSchedulerValue(state.heat + delta.heat),
    staleness: clampSchedulerValue(state.staleness + delta.staleness),
    payoffReadiness: clampSchedulerValue(state.payoffReadiness + delta.payoffReadiness),
    setupDebt: clampSchedulerValue(state.setupDebt + delta.setupDebt),
    readerDebt: clampSchedulerValue(state.readerDebt + delta.readerDebt),
    agencyPotential: clampSchedulerValue(state.agencyPotential + delta.agencyPotential),
    offscreenPressure: clampSchedulerValue(state.offscreenPressure + delta.offscreenPressure),
    lastScore: state.lastScore,
    lastScoreReasons: state.lastScoreReasons,
  };
}

function snapshotScheduler(state: ThreadSchedulerState): ThreadSchedulerState {
  return { ...state };
}

function ownerIdsFromTargetId(targetId: string | undefined): string[] {
  if (!targetId) {
    return [];
  }
  return targetId.split("__").map((part) => part.trim()).filter(Boolean);
}

function deltaMatchesThread(args: {
  delta: StateDelta;
  thread: NarrativeThread;
}): { match: boolean; reason: string } {
  const { delta, thread } = args;

  if (delta.targetType === "thread" && delta.targetId === thread.id) {
    return { match: true, reason: `direct thread target ${delta.targetId}` };
  }

  if (
    delta.targetType === "contract" &&
    delta.targetId &&
    thread.relatedContracts.includes(delta.targetId)
  ) {
    return {
      match: true,
      reason: `contract ${delta.targetId} listed in thread.relatedContracts`,
    };
  }

  for (const impact of delta.contractImpact) {
    if (thread.relatedContracts.includes(impact.contractId)) {
      return {
        match: true,
        reason: `contractImpact ${impact.impact} on ${impact.contractId}`,
      };
    }
  }

  if (
    (delta.targetType === "character" || delta.targetType === "relationship") &&
    delta.targetId
  ) {
    const candidates = ownerIdsFromTargetId(delta.targetId);
    const overlap = candidates.find((id) => thread.ownerCharacterIds.includes(id));
    if (overlap) {
      return {
        match: true,
        reason: `${delta.targetType} target shares thread owner ${overlap}`,
      };
    }
  }

  return { match: false, reason: "" };
}

function effectFromDelta(delta: StateDelta, thread: NarrativeThread): ThreadSchedulerDelta {
  const result = emptyDelta();
  const isReaderVisible = delta.visibility === "reader_visible";
  const isOffscreen = delta.visibility === "offscreen";
  const isCharacterVisible = delta.visibility === "character_visible";
  const weight = delta.causalWeight;

  if (isReaderVisible) {
    if (weight === "irreversible") {
      result.readerDebt -= 60;
      result.heat += 12;
      result.payoffReadiness += 25;
    } else if (weight === "major") {
      result.readerDebt -= 35;
      result.heat += 8;
      result.payoffReadiness += 15;
    } else {
      result.readerDebt -= 8;
      result.heat += 3;
      result.payoffReadiness += 4;
    }
  }

  if (isOffscreen) {
    if (weight === "irreversible") {
      result.offscreenPressure += 35;
      result.urgency += 20;
    } else if (weight === "major") {
      result.offscreenPressure += 25;
      result.urgency += 10;
    } else {
      result.offscreenPressure += 10;
    }
  }

  if (isCharacterVisible) {
    if (weight === "major" || weight === "irreversible") {
      result.urgency += 5;
      result.heat += 4;
    } else {
      result.urgency += 2;
    }
  }

  if ((weight === "major" || weight === "irreversible") && !isOffscreen) {
    result.urgency += 8;
  }

  if (delta.deltaType === "thread_progress" && (weight === "major" || weight === "irreversible")) {
    result.payoffReadiness += 10;
    result.setupDebt -= 15;
  }

  if (delta.deltaType === "relationship_shift" && isReaderVisible) {
    result.heat += 5;
    result.agencyPotential += 4;
  }

  if (delta.deltaType === "character_state" && isReaderVisible && weight !== "minor") {
    result.agencyPotential += 6;
  }

  if (delta.deltaType === "knowledge_change" || delta.deltaType === "memory_change") {
    if (isReaderVisible) {
      result.payoffReadiness += 4;
      result.setupDebt -= 5;
    }
    if (isOffscreen) {
      result.offscreenPressure += 4;
    }
  }

  for (const impact of delta.contractImpact) {
    if (!thread.relatedContracts.includes(impact.contractId)) {
      continue;
    }
    if (impact.impact === "fulfills") {
      result.payoffReadiness += 30;
      result.readerDebt -= 25;
    } else if (impact.impact === "supports") {
      result.payoffReadiness += 5;
      result.readerDebt -= 5;
    } else if (impact.impact === "risks") {
      result.urgency += 10;
      result.heat += 4;
    } else if (impact.impact === "violates") {
      result.urgency += 25;
      result.heat += 12;
    }
  }

  return result;
}

function computeStatusChange(args: {
  thread: NarrativeThread;
  scheduler: ThreadSchedulerState;
  applied: AppliedDeltaRecord[];
}): { status: NarrativeThreadStatus; reasons: string[] } {
  const reasons: string[] = [];
  const previous = args.thread.currentStatus;
  let status = previous;

  if (previous === "resolved" || previous === "retired") {
    return { status: previous, reasons };
  }

  const fulfillsContract = args.applied.some((entry) =>
    entry.contractImpacts.some((impact) => impact.impact === "fulfills"),
  );
  const violatesContract = args.applied.some((entry) =>
    entry.contractImpacts.some((impact) => impact.impact === "violates"),
  );
  const irreversibleVisiblePayoff = args.applied.some(
    (entry) => entry.causalWeight === "irreversible" && entry.visibility === "reader_visible",
  );
  const payoffConditionsMet =
    args.scheduler.payoffReadiness >= 90 && args.scheduler.setupDebt <= 30;

  if (fulfillsContract && payoffConditionsMet) {
    status = "resolved";
    reasons.push("delta fulfills related contract and payoff conditions met");
  } else if (irreversibleVisiblePayoff && payoffConditionsMet) {
    status = "resolved";
    reasons.push("irreversible reader-visible delta with payoff conditions met");
  } else if (
    args.scheduler.payoffReadiness >= 80 &&
    args.scheduler.readerDebt >= 50 &&
    previous !== "ready_for_payoff"
  ) {
    status = "ready_for_payoff";
    reasons.push("payoffReadiness and readerDebt indicate payoff readiness");
  } else if (
    args.scheduler.heat >= 75 &&
    args.scheduler.urgency >= 70 &&
    (previous === "seeded" || previous === "active") &&
    !irreversibleVisiblePayoff
  ) {
    status = "intensifying";
    reasons.push("scheduler heat and urgency indicate intensifying state");
  } else if (previous === "seeded" && args.applied.length > 0) {
    status = "active";
    reasons.push("thread received first delta");
  }

  if (violatesContract && status !== "resolved") {
    reasons.push("delta violates a related contract; status held");
  }

  return { status, reasons };
}

export function applyDeltasToThreads(args: {
  threads: NarrativeThread[];
  deltas: StateDelta[];
  contracts: StoryContract[];
  chapterNumber: number;
}): ThreadUpdateResult {
  const knownContractIds = new Set(args.contracts.map((contract) => contract.id));
  const matchedDeltaIds = new Set<EntityId>();
  const conflicts: ThreadContractConflict[] = [];
  const changes: ThreadUpdateChange[] = [];
  let appliedDeltaCount = 0;

  const updatedThreads = args.threads.map((thread) => {
    const before: ThreadStateSnapshot = {
      status: thread.currentStatus,
      scheduler: snapshotScheduler(thread.scheduler),
      lastTouchedChapter: thread.lastTouchedChapter,
    };

    const applied: AppliedDeltaRecord[] = [];
    const matchReasons = new Set<string>();
    let aggregate = emptyDelta();

    for (const delta of args.deltas) {
      const match = deltaMatchesThread({ delta, thread });
      if (!match.match) {
        continue;
      }
      matchedDeltaIds.add(delta.id);

      const effect = effectFromDelta(delta, thread);
      const relatedImpacts = delta.contractImpact
        .filter((impact) => thread.relatedContracts.includes(impact.contractId))
        .map((impact) => ({
          contractId: impact.contractId,
          impact: impact.impact,
          note: impact.note,
        }));

      for (const impact of relatedImpacts) {
        if (impact.impact === "risks" || impact.impact === "violates") {
          conflicts.push({
            threadId: thread.id,
            contractId: impact.contractId,
            deltaId: delta.id,
            impact: impact.impact,
            note: impact.note,
          });
        }
        if (!knownContractIds.has(impact.contractId)) {
          conflicts.push({
            threadId: thread.id,
            contractId: impact.contractId,
            deltaId: delta.id,
            impact: "unknown_contract",
            note: "Delta references contract id not present in story-contracts.json",
          });
        }
      }

      applied.push({
        deltaId: delta.id,
        deltaType: delta.deltaType,
        causalWeight: delta.causalWeight,
        visibility: delta.visibility,
        source: delta.source,
        matchReason: match.reason,
        schedulerEffect: effect,
        contractImpacts: relatedImpacts,
      });
      aggregate = addDelta(aggregate, effect);
      matchReasons.add(match.reason);
    }

    if (applied.length === 0) {
      return thread;
    }

    appliedDeltaCount += applied.length;

    const cappedAggregate = capAggregate(aggregate);
    let nextScheduler = applySchedulerDelta(thread.scheduler, cappedAggregate);
    if (args.chapterNumber > thread.lastTouchedChapter) {
      nextScheduler = { ...nextScheduler, staleness: 0 };
    }

    const lastTouchedChapter = Math.max(thread.lastTouchedChapter, args.chapterNumber);

    const status = computeStatusChange({
      thread,
      scheduler: nextScheduler,
      applied,
    });

    const updatedThread: NarrativeThread = {
      ...thread,
      scheduler: nextScheduler,
      lastTouchedChapter,
      currentStatus: status.status,
    };

    changes.push({
      threadId: thread.id,
      before,
      after: {
        status: status.status,
        scheduler: snapshotScheduler(nextScheduler),
        lastTouchedChapter,
      },
      schedulerDelta: cappedAggregate,
      appliedDeltas: applied,
      statusChangeReasons: status.reasons,
      matchReasons: Array.from(matchReasons),
    });

    return updatedThread;
  });

  const matchedIds = Array.from(matchedDeltaIds);
  const unmatchedDeltaIds = args.deltas
    .filter((delta) => !matchedDeltaIds.has(delta.id))
    .map((delta) => delta.id);

  const report: ThreadUpdateReport = {
    chapterNumber: args.chapterNumber,
    threadsConsidered: args.threads.length,
    threadsTouched: changes.length,
    appliedDeltaCount,
    matchedDeltaIds: matchedIds,
    unmatchedDeltaIds,
    changes,
    conflicts,
  };

  return {
    threads: updatedThreads,
    report,
  };
}
