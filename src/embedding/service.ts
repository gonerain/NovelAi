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
    if (this.config.mode !== "openai_compatible" || args.candidates.length === 0) {
      return [];
    }

    const queryVector = await this.embedText(args.queryText);
    const candidateVectors = await Promise.all(
      args.candidates.map((candidate) => this.embedText(candidate.text)),
    );
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

  private async embedText(text: string): Promise<number[]> {
    const normalizedText = text.trim();
    const cached = this.cache.get(normalizedText);
    if (cached) {
      return cached;
    }

    if (this.config.mode !== "openai_compatible") {
      return [];
    }

    const response = await fetch(`${this.config.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: normalizedText,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const vector = normalizeVector(data.data?.[0]?.embedding ?? []);
    this.cache.set(normalizedText, vector);
    return vector;
  }
}
