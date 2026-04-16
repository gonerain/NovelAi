import type { WriterResult } from "./domain/index.js";
import { parseStructuredOutput } from "./llm/utils.js";

interface WriterLikeResult {
  title?: string;
  draft: string;
  notes: string[];
}

function normalizeNotes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 8);
}

function parseMetaBlock(text: string): {
  draft: string;
  title?: string;
  notes: string[];
} {
  const match = text.match(/\[\[META\]\]([\s\S]*?)\[\[\/META\]\]/i);
  if (!match) {
    return {
      draft: text.trim(),
      notes: [],
    };
  }

  const rawMeta = match[1].trim();
  const draft = text.replace(match[0], "").trim();

  try {
    const parsed = JSON.parse(rawMeta) as {
      title?: unknown;
      notes?: unknown;
    };
    return {
      draft,
      title: typeof parsed.title === "string" ? parsed.title.trim() : undefined,
      notes: normalizeNotes(parsed.notes),
    };
  } catch {
    const titleLine = rawMeta
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => /^title\s*:/i.test(line));
    const notesLine = rawMeta
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => /^notes\s*:/i.test(line));

    const title = titleLine?.replace(/^title\s*:\s*/i, "").trim();
    const notes = notesLine
      ? notesLine
          .replace(/^notes\s*:\s*/i, "")
          .split(/[|,]/)
          .map((part) => part.trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];

    return {
      draft,
      title: title || undefined,
      notes,
    };
  }
}

function inferTitleFromDraft(draft: string): string | undefined {
  const firstLine = draft
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return undefined;
  }

  const cleaned = firstLine.replace(/^#+\s*/, "").trim();
  if (cleaned.length >= 2 && cleaned.length <= 40) {
    return cleaned;
  }

  return undefined;
}

export function parseWriterLikeOutput(args: {
  provider: string;
  rawText: string;
  fallbackTitle?: string;
}): WriterLikeResult {
  const cleaned = args.rawText.trim();

  if (!cleaned) {
    throw new Error(`Empty writer output from ${args.provider}`);
  }

  try {
    const parsed = parseStructuredOutput<{
      title?: unknown;
      draft?: unknown;
      notes?: unknown;
    }>(cleaned, args.provider);

    if (typeof parsed.draft === "string" && parsed.draft.trim().length > 0) {
      return {
        title: typeof parsed.title === "string" ? parsed.title.trim() : args.fallbackTitle,
        draft: parsed.draft.trim(),
        notes: normalizeNotes(parsed.notes),
      };
    }
  } catch {
    // Fall back to soft extraction.
  }

  const fromMeta = parseMetaBlock(cleaned);
  const draft = fromMeta.draft.trim();
  if (!draft) {
    throw new Error(`Writer output from ${args.provider} has no draft content`);
  }

  return {
    title: fromMeta.title ?? args.fallbackTitle ?? inferTitleFromDraft(draft),
    draft,
    notes: fromMeta.notes,
  };
}

export function mergeWriterResult(base: WriterResult, override: WriterLikeResult): WriterResult {
  return {
    ...base,
    title: override.title ?? base.title,
    draft: override.draft,
    notes: override.notes.length > 0 ? override.notes : base.notes,
  };
}
