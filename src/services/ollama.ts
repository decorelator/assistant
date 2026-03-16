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
  keep_alive?: string;
  options?: {
    num_gpu: number;
  };
  stream: boolean;
};

type GenerateResponse = {
  response?: string;
};

type SelectedMessage = {
  role: "user" | "assistant";
  text: string;
};

type UnloadRequest = {
  model: string;
  keep_alive: 0;
};

type DeleteRequest = {
  model: string;
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
const DEFAULT_NUM_GPU = 9999;
const DEFAULT_KEEP_ALIVE = "20m";
const GENERATE_TIMEOUT_MS = 180000;
const MODEL_INFO_TIMEOUT_MS = 20000;
const UNLOAD_TIMEOUT_MS = 10000;
const DELETE_TIMEOUT_MS = 30000;
let activeGenerationController: AbortController | null = null;

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

function buildPrompt(prompt: string, selectedMessages: SelectedMessage[]) {
  if (selectedMessages.length === 0) {
    return prompt;
  }

  const conversationContext = selectedMessages
    .map(({ role, text }) => `${role === "user" ? "User" : "Assistant"}:\n${text}`)
    .join("\n\n");

  return [
    "Use the selected conversation context below when it helps answer the current user message.",
    "",
    "Selected conversation context:",
    conversationContext,
    "",
    "Current user message:",
    prompt,
  ].join("\n");
}

async function generateMessage(
  model: string,
  prompt: string,
  instruction?: string,
  selectedMessages: SelectedMessage[] = [],
) {
  const generationController = new AbortController();
  activeGenerationController = generationController;
  const requestBody = {
    model,
    prompt: buildPrompt(prompt, selectedMessages),
    system: instruction ?? "",
    keep_alive: DEFAULT_KEEP_ALIVE,
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
    generationController.signal,
  ).finally(() => {
    if (activeGenerationController === generationController) {
      activeGenerationController = null;
    }
  });
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

async function unloadModel(model: string) {
  await postOllamaJson(
    "/api/generate",
    UNLOAD_TIMEOUT_MS,
    { model, keep_alive: 0 } satisfies UnloadRequest,
    "Could not unload model from Ollama.",
  );
}

async function deleteModel(model: string) {
  await requestOllamaJson(
    "/api/delete",
    DELETE_TIMEOUT_MS,
    "Could not delete model from Ollama.",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model } satisfies DeleteRequest),
    },
  );
}

function stopActiveGeneration() {
  if (!activeGenerationController) {
    return false;
  }

  activeGenerationController.abort();
  activeGenerationController = null;
  return true;
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
  signal?: AbortSignal,
) {
  const requestOptions: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };

  if (signal) {
    requestOptions.signal = signal;
  }

  return requestOllamaJson<ResponsePayload>(path, timeoutMs, errorMessage, {
    ...requestOptions,
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
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);
  const externalSignal = options?.signal;
  let abortListener: (() => void) | null = null;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      abortListener = () => controller.abort();
      externalSignal.addEventListener("abort", abortListener, { once: true });
    }
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (didTimeout) {
      throw new Error("Could not get a response from Ollama.");
    }

    if (externalSignal?.aborted) {
      throw new Error("Generation stopped.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    if (externalSignal && abortListener) {
      externalSignal.removeEventListener("abort", abortListener);
    }
  }
}

module.exports = {
  deleteModel,
  fetchModels,
  fetchModelInfo,
  generateMessage,
  stopActiveGeneration,
  unloadModel,
};
