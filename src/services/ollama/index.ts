const { postOllamaJson, requestOllamaJson } = require("./client");
const { buildPrompt } = require("./prompt-builder");
const { launchOllamaProcess } = require("./process-launcher");
import type { GenerateRequest, GenerateResponse, OllamaProcessResponse, OllamaTagsResponse, SelectedMessage, ShowResponse } from "./types";

const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_KEEP_ALIVE = "20m";
const GENERATE_TIMEOUT_MS = 180000;
const MODEL_INFO_TIMEOUT_MS = 20000;
const UNLOAD_TIMEOUT_MS = 10000;
const DELETE_TIMEOUT_MS = 30000;
const START_TIMEOUT_MS = 15000;
let activeGenerationController: AbortController | null = null;

async function fetchModels() {
  const payload = await requestOllamaJson("/api/tags", DEFAULT_TIMEOUT_MS, "Could not load models from Ollama.") as OllamaTagsResponse;
  return Array.isArray(payload.models) ? payload.models : [];
}

async function generateMessage(model: string, prompt: string, instruction = "", selectedMessages: SelectedMessage[] = [], director = "", context = "") {
  const controller = new AbortController();
  activeGenerationController = controller;
  const payload = await postOllamaJson("/api/generate", GENERATE_TIMEOUT_MS, {
    model, prompt: buildPrompt(prompt, selectedMessages, director, context), system: instruction,
    keep_alive: DEFAULT_KEEP_ALIVE, options: { num_gpu: 9999 }, stream: false,
  } satisfies GenerateRequest, "Could not get a response from Ollama.", controller.signal).finally(() => {
    if (activeGenerationController === controller) activeGenerationController = null;
  }) as GenerateResponse;
  return typeof payload.response === "string" ? payload.response : "";
}

async function fetchModelInfo(model: string) {
  const payload = await postOllamaJson("/api/show", MODEL_INFO_TIMEOUT_MS, { model }, "Could not load model info from Ollama.") as ShowResponse;
  return [["Model", model], ["Details", payload.details], ["Parameters", payload.parameters], ["Template", payload.template], ["Modelfile", payload.modelfile]]
    .filter(([, value]) => Boolean(value)).map(([label, value]) => `${label}: ${value}`).join("\n\n");
}

function stopActiveGeneration() {
  if (!activeGenerationController) return false;
  activeGenerationController.abort();
  activeGenerationController = null;
  return true;
}

async function unloadModel(model: string) {
  await postOllamaJson("/api/generate", UNLOAD_TIMEOUT_MS, { model, keep_alive: 0 }, "Could not unload model from Ollama.");
}

async function unloadOtherModels(activeModel: string) {
  const payload = await requestOllamaJson("/api/ps", DEFAULT_TIMEOUT_MS, "Could not inspect loaded Ollama models.") as OllamaProcessResponse;
  for (const model of payload.models ?? []) if (model.name && model.name !== activeModel) await unloadModel(model.name);
}

async function deleteModel(model: string) {
  await requestOllamaJson("/api/delete", DELETE_TIMEOUT_MS, "Could not delete model from Ollama.", {
    method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model }),
  });
}

async function isReachable() {
  try { await fetchModels(); return true; } catch { return false; }
}

async function startOllama() {
  if (await isReachable()) return { alreadyRunning: true, ready: true, started: false };
  await launchOllamaProcess();
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isReachable()) return { alreadyRunning: false, ready: true, started: true };
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return { alreadyRunning: false, ready: false, started: true };
}

module.exports = { deleteModel, fetchModels, fetchModelInfo, generateMessage, startOllama, stopActiveGeneration, unloadModel, unloadOtherModels };
