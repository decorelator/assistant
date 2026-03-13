type OllamaModel = {
  name?: string;
  size?: number;
};

type OllamaTagsResponse = {
  models?: OllamaModel[];
};

type GenerateRequest = {
  model: string;
  prompt: string;
  options?: {
    num_gpu: number;
  };
  stream: boolean;
};

type GenerateResponse = {
  response?: string;
};

const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_NUM_GPU = 999;

async function fetchModels() {
  const response = await fetchWithTimeout(`${getBaseUrl()}/api/tags`, DEFAULT_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error("Could not load models from Ollama.");
  }

  const payload = (await response.json()) as OllamaTagsResponse;
  return Array.isArray(payload.models) ? payload.models : [];
}

function getBaseUrl() {
  return (process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
}

async function generateMessage(model: string, prompt: string) {
  const requestBody = {
    model,
    prompt,
    options: {
      num_gpu: DEFAULT_NUM_GPU,
    },
    stream: false,
  } satisfies GenerateRequest;

  const response = await fetchWithTimeout(`${getBaseUrl()}/api/generate`, DEFAULT_TIMEOUT_MS * 24, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error("Could not get a response from Ollama.");
  }

  const payload = (await response.json()) as GenerateResponse;
  return typeof payload.response === "string" ? payload.response : "";
}

async function fetchWithTimeout(url: string, timeoutMs: number, options?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { fetchModels, generateMessage };
