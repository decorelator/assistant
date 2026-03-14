const { getClientConfig, getDefaultInstruction } = require("../config/env");
const { readJsonBody, sendJson } = require("../lib/http");
const { fetchModels, fetchModelInfo, generateMessage } = require("../services/ollama");

function readTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function handleModelsRequest(response: import("node:http").ServerResponse) {
  try {
    const models = await fetchModels();
    sendJson(response, 200, { models });
  } catch {
    sendJson(response, 502, { error: "Could not connect to Ollama." });
  }
}

function handleConfigRequest(response: import("node:http").ServerResponse) {
  sendJson(response, 200, getClientConfig());
}

async function handleMessageRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
) {
  try {
    const body = await readJsonBody(request);
    const model = readTrimmedString(body.model);
    const prompt = readTrimmedString(body.prompt);
    const instruction = readTrimmedString(body.instruction);
    const effectiveInstruction = instruction || getDefaultInstruction().trim();

    if (!model || !prompt) {
      sendJson(response, 400, { error: "Model and prompt are required." });
      return;
    }

    const reply = await generateMessage(model, prompt, effectiveInstruction);
    sendJson(response, 200, { response: reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send message.";
    sendJson(response, 502, { error: message });
  }
}

async function handleModelInfoRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
) {
  try {
    const body = await readJsonBody(request);
    const model = readTrimmedString(body.model);

    if (!model) {
      sendJson(response, 400, { error: "Model is required." });
      return;
    }

    const details = await fetchModelInfo(model);
    sendJson(response, 200, { details });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load model info.";
    sendJson(response, 502, { error: message });
  }
}

module.exports = {
  handleConfigRequest,
  handleMessageRequest,
  handleModelInfoRequest,
  handleModelsRequest,
};
