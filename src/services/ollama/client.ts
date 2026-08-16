const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

function getBaseUrl() {
  return (process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
}

async function requestOllamaJson<ResponsePayload>(path: string, timeoutMs: number, errorMessage: string, options?: RequestInit) {
  const response = await fetchWithTimeout(`${getBaseUrl()}${path}`, timeoutMs, options);
  if (!response.ok) {
    let ollamaError = "";
    try {
      const payload = await response.json() as { error?: unknown };
      if (typeof payload.error === "string") ollamaError = payload.error.trim();
    } catch {
      // Some Ollama failures do not include a JSON response body.
    }
    throw new Error(ollamaError ? `${errorMessage} ${ollamaError}` : errorMessage);
  }
  return (await response.json()) as ResponsePayload;
}

function postOllamaJson<ResponsePayload>(path: string, timeoutMs: number, payload: unknown, errorMessage: string, signal?: AbortSignal) {
  return requestOllamaJson<ResponsePayload>(path, timeoutMs, errorMessage, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  });
}

module.exports = { postOllamaJson, requestOllamaJson };

async function fetchWithTimeout(url: string, timeoutMs: number, options?: RequestInit) {
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = setTimeout(() => { didTimeout = true; controller.abort(); }, timeoutMs);
  const externalSignal = options?.signal;
  const abortListener = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", abortListener, { once: true });
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (didTimeout) throw new Error("Could not get a response from Ollama.");
    if (externalSignal?.aborted) throw new Error("Generation stopped.");
    throw error;
  } finally {
    clearTimeout(timeout);
    if (externalSignal) externalSignal.removeEventListener("abort", abortListener);
  }
}
