const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const envPath = join(process.cwd(), ".env");
const loadedEnvKeys = new Set<string>();

refreshEnv();

function refreshEnv() {
  for (const key of loadedEnvKeys) {
    delete process.env[key];
  }

  loadedEnvKeys.clear();

  const values = parseEnvFile();

  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
    loadedEnvKeys.add(key);
  }
}

function parseEnvFile() {
  if (!existsSync(envPath)) {
    return {};
  }

  const content = readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);
  let pendingKey: string | null = null;
  let pendingValueLines: string[] = [];
  let pendingQuote: '"' | "'" | null = null;
  const values: Record<string, string> = {};

  for (const line of lines) {
    if (pendingKey && pendingQuote) {
      pendingValueLines.push(line);

      if (line.trimEnd().endsWith(pendingQuote)) {
        values[pendingKey] = normalizeEnvValue(pendingValueLines.join("\n"));
        pendingKey = null;
        pendingValueLines = [];
        pendingQuote = null;
      }

      continue;
    }

    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    const quote = getOpeningQuote(rawValue);

    if (quote && !hasClosingQuote(rawValue, quote)) {
      pendingKey = key;
      pendingValueLines = [rawValue];
      pendingQuote = quote;
      continue;
    }

    values[key] = normalizeEnvValue(rawValue);
  }

  return values;
}

function getOpeningQuote(value: string) {
  if (value.startsWith('"')) {
    return '"';
  }

  if (value.startsWith("'")) {
    return "'";
  }

  return null;
}

function hasClosingQuote(value: string, quote: '"' | "'") {
  return value.length > 1 && value.endsWith(quote);
}

function normalizeEnvValue(value: string) {
  const unwrappedValue =
    (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))
      ? value.slice(1, -1)
      : value;

  return unwrappedValue.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
}

function getClientConfig() {
  return {
    defaultInstruction: process.env.DEFAULT_INSTRUCTION ?? "",
    defaultPrompt: process.env.DEFAULT_PROMPT ?? "",
  };
}

module.exports = { getClientConfig, refreshEnv };
