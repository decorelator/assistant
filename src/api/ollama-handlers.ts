const { getDefaultInstruction } = require("../config/env");
const { touchInstructionPreset } = require("../db/instruction-presets");
const { readJsonBody, sendJson } = require("../lib/http");
const {
  deleteModel,
  fetchModels,
  fetchModelInfo,
  generateMessage,
  stopActiveGeneration,
  unloadModel,
} = require("../services/ollama");
const { readPositiveInteger, readTrimmedString } = require("./request-utils");

async function handleModelsRequest(response: import("node:http").ServerResponse) {
  try {
    const models = await fetchModels();
    sendJson(response, 200, { models });
  } catch {
    sendJson(response, 502, { error: "Could not connect to Ollama." });
  }
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
    const presetId =
      typeof body.presetId === "number" || typeof body.presetId === "string"
        ? readPositiveInteger(String(body.presetId))
        : null;
    const effectiveInstruction = instruction || getDefaultInstruction().trim();

    if (!model || !prompt) {
      sendJson(response, 400, { error: "Model and prompt are required." });
      return;
    }

    const reply = await generateMessage(model, prompt, effectiveInstruction);

    if (presetId) {
      touchInstructionPreset(presetId);
    }

    sendJson(response, 200, { response: reply });
  } catch (error) {
    if (error instanceof Error && error.message === "Generation stopped.") {
      sendJson(response, 499, { error: "Generation stopped." });
      return;
    }

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

async function handleModelStopRequest(
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

    await unloadModel(model);
    sendJson(response, 200, { stopped: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not stop model.";
    sendJson(response, 502, { error: message });
  }
}

async function handleModelDeleteRequest(
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

    await deleteModel(model);
    sendJson(response, 200, { deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete model.";
    sendJson(response, 502, { error: message });
  }
}

function handleMessageStopRequest(response: import("node:http").ServerResponse) {
  sendJson(response, 200, { stopped: stopActiveGeneration() });
}

module.exports = {
  handleMessageRequest,
  handleModelDeleteRequest,
  handleMessageStopRequest,
  handleModelInfoRequest,
  handleModelStopRequest,
  handleModelsRequest,
};
