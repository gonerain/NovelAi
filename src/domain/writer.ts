import type { ContextPack } from "./context-builder.js";

export interface WriterInput {
  contextPack: ContextPack;
  minParagraphs?: number;
  maxParagraphs?: number;
}

export interface WriterResult {
  title?: string;
  draft: string;
  notes: string[];
}
