import type { ChapterShape } from "./beat-annotations.js";
import { ALL_CHAPTER_SHAPES, isChapterShape } from "./beat-annotations.js";
import type { BeatOutline, EntityId } from "./types.js";

export type TaskStatus =
  | "pending"      // brief submitted, not yet decomposed
  | "decomposed"   // beats appended, generation not started
  | "generating"   // chapters being produced
  | "complete"     // chapters generated, awaiting review
  | "reviewed";    // human acknowledged

/**
 * Optional POV hint on a character entry. Authors write
 *   `- yejin (POV)`
 * and the parser captures the marker.
 */
export interface TaskBriefCharacter {
  id: EntityId;
  pov: boolean;
  /** Free-text role hint, e.g. "antagonist", "side". */
  role?: string;
}

export type TaskChapterBudget =
  | { kind: "auto"; min?: number; max?: number }
  | { kind: "exact"; value: number };

export interface TaskBrief {
  /** Globally unique within the project; defaults to `task-NN` if not given. */
  id: EntityId;
  /** Display title. Falls back to a slug of the intent. */
  title: string;
  /** REQUIRED. The high-level direction the showrunner is giving. */
  intent: string;
  /** REQUIRED. Characters expected to participate. */
  characters: TaskBriefCharacter[];
  /** Optional emotional vector this task is meant to nudge. */
  emotionalTarget?: string;
  /** Things that must NOT happen anywhere in the task's chapters. */
  constraints: string[];
  /** Sensory or behavioural anchors that must show up. */
  textureMust: string[];
  /** "auto" lets the decomposer choose; otherwise an exact integer. */
  chapterBudget: TaskChapterBudget;
  /** Free-text pacing hint surfaced to the decomposer. */
  pacingHint?: string;
  /** Shape allow-list. If non-empty, decomposer must pick from these. */
  preferredShapes: ChapterShape[];
  /** Shape deny-list. Decomposer must NOT pick from these. */
  forbiddenShapes: ChapterShape[];
  /** Free-text notes. Anything not captured by the structured fields. */
  notes: string[];
  /** ISO timestamp when the brief was submitted. */
  submittedAt: string;
  /** Lifecycle. Defaults to "pending" on submit. */
  status: TaskStatus;
}

/**
 * Output of the decomposer. Persisted alongside the brief.
 */
export interface TaskDecomposition {
  taskId: EntityId;
  generatedAt: string;
  /** How many chapters the decomposer allocated. */
  chapterCount: number;
  /**
   * Beats produced from this task. Each entry already includes the optional
   * `annotations` field set by the decomposer. Beats are appended to the
   * project's `beat-outlines.json` so the chapter pipeline picks them up.
   */
  beats: BeatOutline[];
  /** Contract ids the decomposer commits to honour. */
  coherenceCommitments: EntityId[];
  /** 4–6 sentences in natural prose. */
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Markdown parser
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = ["intent", "characters"] as const;

const KNOWN_FIELDS = new Set<string>([
  "intent",
  "characters",
  "emotional-target",
  "constraints",
  "texture-must",
  "chapter-budget",
  "pacing-hint",
  "preferred-shapes",
  "forbidden-shapes",
  "notes",
]);

export interface ParseTaskBriefIssue {
  severity: "error" | "warning";
  message: string;
}

export interface ParseTaskBriefResult {
  brief: TaskBrief | null;
  issues: ParseTaskBriefIssue[];
}

interface RawSection {
  key: string;
  inline: string | null;
  body: string[]; // lines after the `key:` header, dedented
}

function splitSections(input: string): { title: string | null; sections: RawSection[]; issues: ParseTaskBriefIssue[] } {
  const issues: ParseTaskBriefIssue[] = [];
  const lines = input.split(/\r?\n/);
  let title: string | null = null;
  const sections: RawSection[] = [];
  let current: RawSection | null = null;

  const headerMatch = (line: string): { key: string; inline: string | null } | null => {
    // Match "key: optional inline value" at column 0 (no leading whitespace).
    const trimmed = line.replace(/\s+$/g, "");
    if (!trimmed) {
      return null;
    }
    if (/^\s/.test(trimmed)) {
      return null;
    }
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx <= 0) {
      return null;
    }
    const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
    if (!KNOWN_FIELDS.has(key)) {
      return null;
    }
    const inline = trimmed.slice(colonIdx + 1).trim();
    return { key, inline: inline.length > 0 ? inline : null };
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, "");
    if (title === null && /^#\s/.test(line)) {
      title = line.replace(/^#+\s*/, "").trim();
      continue;
    }
    const header = headerMatch(line);
    if (header) {
      current = { key: header.key, inline: header.inline, body: [] };
      sections.push(current);
      continue;
    }
    if (current && line.trim().length > 0) {
      // Strip a single level of leading whitespace; preserve relative indent.
      const dedented = line.replace(/^[ \t]{2,}/, "");
      current.body.push(dedented);
    }
  }

  return { title, sections, issues };
}

function asMultiline(section: RawSection): string {
  const parts: string[] = [];
  if (section.inline) {
    parts.push(section.inline);
  }
  for (const body of section.body) {
    if (body.trim().length === 0) {
      continue;
    }
    if (/^- /.test(body.trim())) {
      // bullet within a multi-line text field — flatten with separator
      parts.push(body.trim().slice(2).trim());
    } else {
      parts.push(body.trim());
    }
  }
  return parts.join(" ").trim();
}

function asBulletList(section: RawSection): string[] {
  const items: string[] = [];
  if (section.inline) {
    // Accept inline form like `forbidden-shapes: [confrontation, payoff]`
    const bracket = section.inline.match(/^\[(.*)\]$/);
    if (bracket) {
      const inner = bracket[1] ?? "";
      for (const piece of inner.split(",")) {
        const trimmed = piece.trim();
        if (trimmed.length > 0) {
          items.push(trimmed);
        }
      }
      return items;
    }
    // CSV-ish inline `key: a, b, c`
    if (section.inline.includes(",")) {
      for (const piece of section.inline.split(",")) {
        const trimmed = piece.trim();
        if (trimmed.length > 0) {
          items.push(trimmed);
        }
      }
      return items;
    }
    items.push(section.inline);
  }
  for (const body of section.body) {
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (/^- /.test(trimmed)) {
      items.push(trimmed.slice(2).trim());
    } else if (items.length > 0) {
      // continuation of the previous bullet
      items[items.length - 1] = `${items[items.length - 1]} ${trimmed}`;
    } else {
      items.push(trimmed);
    }
  }
  return items.filter((item) => item.length > 0);
}

function parseCharacters(items: string[]): TaskBriefCharacter[] {
  const characters: TaskBriefCharacter[] = [];
  for (const raw of items) {
    // Format: `id` or `id (POV)` or `id (POV) - role`
    const match = raw.match(/^([a-zA-Z0-9_-]+)\s*(\(([^)]+)\))?\s*(?:[-—]\s*(.+))?$/);
    if (!match) {
      continue;
    }
    const id = match[1]!.trim();
    const tag = match[3]?.toLowerCase() ?? "";
    const role = match[4]?.trim();
    characters.push({
      id,
      pov: tag.includes("pov"),
      role: role && role.length > 0 ? role : undefined,
    });
  }
  return characters;
}

function parseChapterBudget(
  text: string | undefined,
  issues: ParseTaskBriefIssue[],
): TaskChapterBudget {
  if (!text || text.trim().length === 0 || text.trim().toLowerCase() === "auto") {
    return { kind: "auto" };
  }
  const trimmed = text.trim();
  // Bare integer — must be 1..10. Out-of-range values are author errors,
  // not silent downgrades to "auto".
  if (/^\d+$/.test(trimmed)) {
    const exact = Number(trimmed);
    if (exact >= 1 && exact <= 10) {
      return { kind: "exact", value: Math.round(exact) };
    }
    issues.push({
      severity: "error",
      message: `chapter-budget must be between 1 and 10 (got ${exact}).`,
    });
    return { kind: "auto" };
  }
  const range = trimmed.match(/^auto\s*\(\s*(\d+)\s*[-–]\s*(\d+)\s*\)$/i);
  if (range) {
    const min = Math.max(1, Number(range[1]));
    const max = Math.min(10, Number(range[2]));
    if (Number.isFinite(min) && Number.isFinite(max) && min <= max) {
      return { kind: "auto", min, max };
    }
  }
  // Treat "estimate 1-2" or other freeform as auto with optional range hint.
  const looseRange = trimmed.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (looseRange) {
    const min = Math.max(1, Number(looseRange[1]));
    const max = Math.min(10, Number(looseRange[2]));
    if (Number.isFinite(min) && Number.isFinite(max) && min <= max) {
      return { kind: "auto", min, max };
    }
  }
  return { kind: "auto" };
}

function slugify(text: string, fallback: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return fallback;
  }
  const ascii = trimmed
    .replace(/[\s\p{P}\p{S}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return ascii.length > 0 ? ascii.slice(0, 64) : fallback;
}

function parseShapeList(items: string[], issues: ParseTaskBriefIssue[]): ChapterShape[] {
  const result: ChapterShape[] = [];
  for (const raw of items) {
    const lower = raw.trim().toLowerCase();
    if (isChapterShape(lower)) {
      if (!result.includes(lower)) {
        result.push(lower);
      }
    } else {
      issues.push({
        severity: "warning",
        message: `Ignoring unknown chapter shape "${raw}". Allowed: ${ALL_CHAPTER_SHAPES.join(", ")}.`,
      });
    }
  }
  return result;
}

export function parseTaskBriefMarkdown(args: {
  markdown: string;
  /** Optional default id, e.g. "task-03" derived from filename. */
  defaultId?: string;
  /** Optional ISO timestamp; defaults to now. */
  submittedAt?: string;
}): ParseTaskBriefResult {
  const { title, sections, issues } = splitSections(args.markdown);
  const sectionsByKey = new Map<string, RawSection>();
  for (const section of sections) {
    if (sectionsByKey.has(section.key)) {
      issues.push({
        severity: "warning",
        message: `Duplicate "${section.key}" section; later one wins.`,
      });
    }
    sectionsByKey.set(section.key, section);
  }

  const intentSection = sectionsByKey.get("intent");
  const intent = intentSection ? asMultiline(intentSection) : "";
  if (!intent) {
    issues.push({ severity: "error", message: "intent: is required and must be non-empty." });
  }

  const charSection = sectionsByKey.get("characters");
  const characters = charSection ? parseCharacters(asBulletList(charSection)) : [];
  if (characters.length === 0) {
    issues.push({ severity: "error", message: "characters: must list at least one character id." });
  }

  const emotionalSection = sectionsByKey.get("emotional-target");
  const emotionalTarget = emotionalSection ? asMultiline(emotionalSection) : undefined;

  const constraintsSection = sectionsByKey.get("constraints");
  const constraints = constraintsSection ? asBulletList(constraintsSection) : [];

  const textureSection = sectionsByKey.get("texture-must");
  const textureMust = textureSection ? asBulletList(textureSection) : [];

  const budgetSection = sectionsByKey.get("chapter-budget");
  const chapterBudget = parseChapterBudget(
    budgetSection ? (budgetSection.inline ?? asMultiline(budgetSection)) : undefined,
    issues,
  );

  const pacingSection = sectionsByKey.get("pacing-hint");
  const pacingHint = pacingSection ? asMultiline(pacingSection) : undefined;

  const preferredSection = sectionsByKey.get("preferred-shapes");
  const preferredShapes = preferredSection
    ? parseShapeList(asBulletList(preferredSection), issues)
    : [];

  const forbiddenSection = sectionsByKey.get("forbidden-shapes");
  const forbiddenShapes = forbiddenSection
    ? parseShapeList(asBulletList(forbiddenSection), issues)
    : [];

  const notesSection = sectionsByKey.get("notes");
  const notes = notesSection ? asBulletList(notesSection) : [];

  const overlap = preferredShapes.filter((shape) => forbiddenShapes.includes(shape));
  if (overlap.length > 0) {
    issues.push({
      severity: "error",
      message: `Shapes appear in both preferred and forbidden: ${overlap.join(", ")}.`,
    });
  }

  if (chapterBudget.kind === "exact" && (chapterBudget.value < 1 || chapterBudget.value > 10)) {
    issues.push({
      severity: "error",
      message: `chapter-budget must be between 1 and 10 (got ${chapterBudget.value}).`,
    });
  }

  const id = args.defaultId ?? slugify(title ?? intent, "task");
  const briefTitle = title?.replace(/^Task:\s*/i, "").trim() || (intent.slice(0, 60) + (intent.length > 60 ? "…" : ""));

  const hasErrors = issues.some((issue) => issue.severity === "error");
  const brief: TaskBrief | null = hasErrors
    ? null
    : {
        id,
        title: briefTitle,
        intent,
        characters,
        emotionalTarget,
        constraints,
        textureMust,
        chapterBudget,
        pacingHint,
        preferredShapes,
        forbiddenShapes,
        notes,
        submittedAt: args.submittedAt ?? new Date().toISOString(),
        status: "pending",
      };

  // Warn about unknown top-level keys outside the known set.
  for (const section of sections) {
    if (REQUIRED_FIELDS.includes(section.key as (typeof REQUIRED_FIELDS)[number])) {
      continue;
    }
    if (!KNOWN_FIELDS.has(section.key)) {
      issues.push({
        severity: "warning",
        message: `Unknown field "${section.key}:" — ignored. Known fields: ${[...KNOWN_FIELDS].join(", ")}.`,
      });
    }
  }

  return { brief, issues };
}

export function validateTaskBrief(brief: TaskBrief): ParseTaskBriefIssue[] {
  const issues: ParseTaskBriefIssue[] = [];
  if (!brief.id || brief.id.trim().length === 0) {
    issues.push({ severity: "error", message: "id missing." });
  }
  if (!brief.intent || brief.intent.trim().length < 8) {
    issues.push({ severity: "error", message: "intent must be at least 8 characters." });
  }
  if (brief.characters.length === 0) {
    issues.push({ severity: "error", message: "at least one character is required." });
  }
  if (brief.chapterBudget.kind === "exact" && (brief.chapterBudget.value < 1 || brief.chapterBudget.value > 10)) {
    issues.push({ severity: "error", message: "chapter-budget must be 1..10." });
  }
  for (const shape of brief.preferredShapes) {
    if (brief.forbiddenShapes.includes(shape)) {
      issues.push({
        severity: "error",
        message: `shape ${shape} is both preferred and forbidden.`,
      });
    }
  }
  return issues;
}
