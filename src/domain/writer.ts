import type { ContextPack } from "./context-builder.js";

export interface WriterInput {
  contextPack: ContextPack;
  previousChapterNextSituation?: string;
  /** Last N paragraphs of the previous chapter's actual prose. Overrides nextSituation as narrative anchor. */
  previousChapterTailProse?: string;
  minParagraphs?: number;
  maxParagraphs?: number;
}

export interface WriterResult {
  title?: string;
  draft: string;
  notes: string[];
}
