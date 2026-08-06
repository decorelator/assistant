const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

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
const START_TIMEOUT_MS = 15000;
const START_POLL_INTERVAL_MS = 500;
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

  //logOllamaRequest("/api/generate", requestBody);

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

async function startOllama() {
  if (await isOllamaReachable()) {
    return {
      alreadyRunning: true,
      ready: true,
      started: false,
    };
  }

  await launchOllamaProcess();

  return {
    alreadyRunning: false,
    ready: await waitForOllamaReady(START_TIMEOUT_MS),
    started: true,
  };
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

function getOllamaExecutable() {
  return process.env.OLLAMA_EXECUTABLE?.trim() || "ollama";
}

function getOllamaLaunchMode() {
  return process.env.OLLAMA_LAUNCH_MODE?.trim().toLowerCase() === "app" ? "app" : "serve";
}

async function isOllamaReachable() {
  try {
    await requestOllamaJson<OllamaTagsResponse>(
      "/api/tags",
      DEFAULT_TIMEOUT_MS,
      "Could not connect to Ollama.",
    );
    return true;
  } catch {
    return false;
  }
}

async function launchOllamaProcess() {
  const { command, args, env, executableLabel } = getOllamaLaunchSpec();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      env,
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error(`Could not find the Ollama executable: ${executableLabel}`));
        return;
      }

      reject(error);
    });

    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

function getOllamaLaunchSpec() {
  const configuredExecutable = getOllamaExecutable();
  const resolvedExecutable = resolveExecutablePath(configuredExecutable);
  const launchEnv = buildOllamaLaunchEnv(resolvedExecutable);

  if (process.platform === "win32" && getOllamaLaunchMode() === "app") {
    const appExecutable = getOllamaAppExecutable(resolvedExecutable);

    if (appExecutable) {
      return {
        command: appExecutable,
        args: [],
        env: launchEnv,
        executableLabel: appExecutable,
      };
    }
  }

  return {
    command: configuredExecutable,
    args: ["serve"],
    env: launchEnv,
    executableLabel: resolvedExecutable || configuredExecutable,
  };
}

function buildOllamaLaunchEnv(resolvedExecutable: string | null) {
  const env = { ...process.env } as NodeJS.ProcessEnv;

  if (!env.OLLAMA_MODELS) {
    const detectedModelsDirectory = detectOllamaModelsDirectory(resolvedExecutable);

    if (detectedModelsDirectory) {
      env.OLLAMA_MODELS = detectedModelsDirectory;
    }
  }

  return env;
}

function detectOllamaModelsDirectory(resolvedExecutable: string | null) {
  if (!resolvedExecutable) {
    return null;
  }

  const installationModelsDirectory = path.join(path.dirname(resolvedExecutable), "models");

  if (fs.existsSync(installationModelsDirectory)) {
    return installationModelsDirectory;
  }

  const defaultModelsDirectory = path.join(process.env.USERPROFILE || "", ".ollama", "models");

  if (defaultModelsDirectory && fs.existsSync(defaultModelsDirectory)) {
    return defaultModelsDirectory;
  }

  return null;
}

function getOllamaAppExecutable(resolvedExecutable: string | null) {
  if (!resolvedExecutable) {
    return null;
  }

  const executableDirectory = path.dirname(resolvedExecutable);
  const appExecutable = path.join(executableDirectory, "ollama app.exe");

  return fs.existsSync(appExecutable) ? appExecutable : null;
}

function resolveExecutablePath(executable: string) {
  const trimmedExecutable = executable.trim();

  if (!trimmedExecutable) {
    return null;
  }

  if (path.isAbsolute(trimmedExecutable) && fs.existsSync(trimmedExecutable)) {
    return trimmedExecutable;
  }

  const pathEntries = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const candidateNames =
    process.platform === "win32" && path.extname(trimmedExecutable) === ""
      ? [`${trimmedExecutable}.exe`, `${trimmedExecutable}.cmd`, `${trimmedExecutable}.bat`]
      : [trimmedExecutable];

  for (const directory of pathEntries) {
    for (const candidateName of candidateNames) {
      const candidatePath = path.join(directory, candidateName);

      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return null;
}

async function waitForOllamaReady(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isOllamaReachable()) {
      return true;
    }

    await delay(START_POLL_INTERVAL_MS);
  }

  return false;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
  startOllama,
  stopActiveGeneration,
  unloadModel,
};
