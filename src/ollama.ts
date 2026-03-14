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
  system?: string;
  options?: {
    num_gpu: number;
  };
  stream: boolean;
};

type GenerateResponse = {
  response?: string;
};

type ShowRequest = {
  model: string;
};

type ShowResponse = {
  details?: string;
  modelfile?: string;
  parameters?: string;
  template?: string;
};

const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_NUM_GPU = 32;
const GENERATE_TIMEOUT_MS = 180000;
const MODEL_INFO_TIMEOUT_MS = 20000;

async function fetchModels() {
  const payload = await requestOllamaJson<OllamaTagsResponse>(
    "/api/tags",
    DEFAULT_TIMEOUT_MS,
    "Could not load models from Ollama.",
  );
  return Array.isArray(payload.models) ? payload.models : [];
}

function getBaseUrl() {
  return (process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
}

async function generateMessage(model: string, prompt: string, instruction?: string) {
  const requestBody = {
    model,
    prompt,
    system: instruction ?? "",
    options: {
      num_gpu: DEFAULT_NUM_GPU,
    },
    stream: false,
  } satisfies GenerateRequest;

  logOllamaRequest("/api/generate", requestBody);

  const payload = await postOllamaJson<GenerateResponse>(
    "/api/generate",
    GENERATE_TIMEOUT_MS,
    requestBody,
    "Could not get a response from Ollama.",
  );
  return typeof payload.response === "string" ? payload.response : "";
}

async function fetchModelInfo(model: string) {
  const payload = await postOllamaJson<ShowResponse>(
    "/api/show",
    MODEL_INFO_TIMEOUT_MS,
    { model } satisfies ShowRequest,
    "Could not load model info from Ollama.",
  );
  return formatModelInfo(model, payload);
}

function formatModelInfo(model: string, payload: ShowResponse) {
  const parts = [`Model: ${model}`];

  if (payload.details) {
    parts.push(`Details: ${payload.details}`);
  }

  if (payload.parameters) {
    parts.push(`Parameters: ${payload.parameters}`);
  }

  if (payload.template) {
    parts.push(`Template: ${payload.template}`);
  }

  if (payload.modelfile) {
    parts.push(`Modelfile: ${payload.modelfile}`);
  }

  return parts.join("\n\n");
}

function logOllamaRequest(path: string, payload: unknown) {
  console.log(
    `[ollama] ${new Date().toISOString()} ${path}\n${JSON.stringify(payload, null, 2)}`,
  );
}

async function postOllamaJson<ResponsePayload>(
  path: string,
  timeoutMs: number,
  payload: unknown,
  errorMessage: string,
) {
  return requestOllamaJson<ResponsePayload>(path, timeoutMs, errorMessage, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function requestOllamaJson<ResponsePayload>(
  path: string,
  timeoutMs: number,
  errorMessage: string,
  options?: RequestInit,
) {
  const response = await fetchWithTimeout(`${getBaseUrl()}${path}`, timeoutMs, options);

  if (!response.ok) {
    throw new Error(errorMessage);
  }

  return (await response.json()) as ResponsePayload;
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

module.exports = { fetchModels, fetchModelInfo, generateMessage };
