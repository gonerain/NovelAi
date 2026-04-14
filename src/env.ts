import fs from "node:fs";
import path from "node:path";

let loaded = false;

function parseEnvValue(rawValue: string): string {
  const value = rawValue.trim();
  if (!value) {
    return "";
  }

  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    const unwrapped = value.slice(1, -1);
    if (value.startsWith("\"")) {
      return unwrapped
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, "\"")
        .replace(/\\\\/g, "\\");
    }
    return unwrapped;
  }

  return value;
}

export function loadProjectEnv(options?: {
  cwd?: string;
  fileName?: string;
  override?: boolean;
}): void {
  if (loaded) {
    return;
  }

  const cwd = options?.cwd ?? process.cwd();
  const fileName = options?.fileName ?? ".env";
  const override = options?.override ?? true;
  const envPath = path.resolve(cwd, fileName);

  loaded = true;
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const normalized = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length)
      : trimmed;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    const rawValue = normalized.slice(separatorIndex + 1);
    const parsedValue = parseEnvValue(rawValue);

    if (override || process.env[key] == null) {
      process.env[key] = parsedValue;
    }
  }
}

