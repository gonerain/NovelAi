import { loadProjectEnv } from "../env.js";

export interface EmbeddingCandidate {
  kind: "memory" | "chapter_card";
  sourceId: string;
  label: string;
  text: string;
}

export interface RankedEmbeddingCandidate extends EmbeddingCandidate {
  score: number;
}

interface EmbeddingConfig {
  mode: "local" | "openai_compatible";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface EmbeddingCacheSnapshot {
  mode: "openai_compatible";
  model: string;
  entries: Array<{
    text: string;
    vector: number[];
  }>;
}

const REMOTE_EMBED_BATCH_SIZE = 24;
const REMOTE_EMBED_MAX_RETRIES = 3;

function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm <= 0) {
    return vector;
  }
  return vector.map((value) => value / norm);
}

function cosineFromNormalized(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
  }
  return dot;
}

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function tokenizeSemanticText(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const tokens: string[] = [];
  const latinWords = normalized.match(/[a-z0-9]{2,}/g) ?? [];
  tokens.push(...latinWords);

  const cjkGroups = normalized.match(/[\u4e00-\u9fff]+/g) ?? [];
  for (const group of cjkGroups) {
    const chars = [...group];
    for (const char of chars) {
      tokens.push(char);
    }
    for (let index = 0; index < chars.length - 1; index += 1) {
      tokens.push(`${chars[index]}${chars[index + 1]}`);
    }
    for (let index = 0; index < chars.length - 2; index += 1) {
      tokens.push(`${chars[index]}${chars[index + 1]}${chars[index + 2]}`);
    }
  }

  return tokens.filter(Boolean).slice(0, 160);
}

function buildLocalSemanticVector(text: string): Map<string, number> {
  const tokens = tokenizeSemanticText(text);
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const vector = new Map<string, number>();
  const length = Math.max(1, tokens.length);
  for (const [token, count] of counts.entries()) {
    vector.set(token, count / Math.sqrt(length));
  }

  return vector;
}

function cosineSimilarity(
  left: Map<string, number>,
  right: Map<string, number>,
): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (const value of left.values()) {
    leftNorm += value * value;
  }
  for (const value of right.values()) {
    rightNorm += value * value;
  }
  for (const [token, value] of left.entries()) {
    dot += value * (right.get(token) ?? 0);
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / Math.sqrt(leftNorm * rightNorm);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export class EmbeddingService {
  private readonly config: EmbeddingConfig;
  private readonly cache = new Map<string, number[]>();

  constructor() {
    loadProjectEnv();
    const modeRaw = (process.env.NOVELAI_EMBEDDING_MODE ?? "").trim().toLowerCase();
    const apiKey =
      process.env.NOVELAI_EMBEDDING_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      "";
    const baseUrl =
      process.env.NOVELAI_EMBEDDING_BASE_URL?.trim() ||
      process.env.OPENAI_BASE_URL?.trim() ||
      "https://api.openai.com/v1";
    const model =
      process.env.NOVELAI_EMBEDDING_MODEL?.trim() ||
      "text-embedding-3-small";

    const providerMode =
      modeRaw === "openai_compatible" && apiKey ? "openai_compatible" : "local";
    this.config = {
      mode: providerMode,
      apiKey: providerMode === "openai_compatible" ? apiKey : undefined,
      baseUrl: providerMode === "openai_compatible" ? baseUrl.replace(/\/$/, "") : undefined,
      model: providerMode === "openai_compatible" ? model : undefined,
    };
  }

  get mode(): EmbeddingConfig["mode"] {
    return this.config.mode;
  }

  get isPersistentCacheEnabled(): boolean {
    return this.config.mode === "openai_compatible";
  }

  loadSnapshot(snapshot: EmbeddingCacheSnapshot | null | undefined): void {
    if (
      !snapshot ||
      this.config.mode !== "openai_compatible" ||
      snapshot.mode !== "openai_compatible" ||
      snapshot.model !== this.config.model
    ) {
      return;
    }

    for (const entry of snapshot.entries) {
      if (!entry.text || !Array.isArray(entry.vector) || entry.vector.length === 0) {
        continue;
      }
      this.cache.set(entry.text, entry.vector);
    }
  }

  exportSnapshot(): EmbeddingCacheSnapshot | null {
    if (this.config.mode !== "openai_compatible" || !this.config.model) {
      return null;
    }

    return {
      mode: "openai_compatible",
      model: this.config.model,
      entries: [...this.cache.entries()].map(([text, vector]) => ({
        text,
        vector,
      })),
    };
  }

  async rankCandidates(args: {
    queryText: string;
    candidates: EmbeddingCandidate[];
    topK?: number;
    minScore?: number;
  }): Promise<RankedEmbeddingCandidate[]> {
    if (args.candidates.length === 0) {
      return [];
    }

    try {
      if (this.config.mode === "openai_compatible") {
        const texts = [args.queryText, ...args.candidates.map((candidate) => candidate.text)];
        const vectors = await this.embedTexts(texts);
        const queryVector = vectors[0] ?? [];
        const candidateVectors = vectors.slice(1);
        return rankByVectors(args, queryVector, candidateVectors);
      }
    } catch {
      return this.rankCandidatesLocally(args);
    }

    return this.rankCandidatesLocally(args);
  }

  private rankCandidatesLocally(args: {
    queryText: string;
    candidates: EmbeddingCandidate[];
    topK?: number;
    minScore?: number;
  }): RankedEmbeddingCandidate[] {
    const queryVector = buildLocalSemanticVector(args.queryText);
    const minScore = args.minScore ?? 0.12;
    const topK = args.topK ?? 8;

    return args.candidates
      .map((candidate) => ({
        ...candidate,
        score: cosineSimilarity(queryVector, buildLocalSemanticVector(candidate.text)),
      }))
      .filter((candidate) => candidate.score >= minScore)
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);
  }

  private async embedTexts(texts: string[]): Promise<number[][]> {
    const normalizedTexts = texts.map((text) => text.trim());
    const result = new Array<number[]>(normalizedTexts.length);
    const missingIndices: number[] = [];
    const missingTexts: string[] = [];

    for (let index = 0; index < normalizedTexts.length; index += 1) {
      const text = normalizedTexts[index];
      const cached = this.cache.get(text);
      if (cached) {
        result[index] = cached;
      } else {
        missingIndices.push(index);
        missingTexts.push(text);
      }
    }

    if (this.config.mode !== "openai_compatible") {
      return result.map((vector) => vector ?? []);
    }

    for (const batch of chunkArray(missingTexts, REMOTE_EMBED_BATCH_SIZE)) {
      const vectors = await this.requestEmbeddingBatch(batch);
      for (let offset = 0; offset < batch.length; offset += 1) {
        const text = batch[offset];
        const vector = normalizeVector(vectors[offset] ?? []);
        this.cache.set(text, vector);
      }
    }

    for (const index of missingIndices) {
      result[index] = this.cache.get(normalizedTexts[index]) ?? [];
    }

    return result.map((vector) => vector ?? []);
  }

  private async requestEmbeddingBatch(texts: string[]): Promise<number[][]> {
    let lastError: unknown;

    for (let attempt = 0; attempt < REMOTE_EMBED_MAX_RETRIES; attempt += 1) {
      try {
        const response = await fetch(`${this.config.baseUrl}/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            input: texts,
          }),
        });

        if (!response.ok) {
          if (isRetryableStatus(response.status) && attempt < REMOTE_EMBED_MAX_RETRIES - 1) {
            continue;
          }
          throw new Error(`Embedding request failed with status ${response.status}`);
        }

        const data = (await response.json()) as {
          data?: Array<{ embedding?: number[]; index?: number }>;
        };
        const rows = [...(data.data ?? [])].sort(
          (left, right) => (left.index ?? 0) - (right.index ?? 0),
        );
        return rows.map((row) => row.embedding ?? []);
      } catch (error) {
        lastError = error;
        if (attempt >= REMOTE_EMBED_MAX_RETRIES - 1) {
          break;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

function rankByVectors(
  args: {
    queryText: string;
    candidates: EmbeddingCandidate[];
    topK?: number;
    minScore?: number;
  },
  queryVector: number[],
  candidateVectors: number[][],
): RankedEmbeddingCandidate[] {
  const minScore = args.minScore ?? 0.12;
  const topK = args.topK ?? 8;

  return args.candidates
    .map((candidate, index) => ({
      ...candidate,
      score: cosineFromNormalized(queryVector, candidateVectors[index] ?? []),
    }))
    .filter((candidate) => candidate.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}
