const { getDefaultInstruction } = require("../config/env");
const { touchInstructionPreset } = require("../db/instruction-presets");
const { readJsonBody, sendJson } = require("../lib/http");
const { fetchModels, fetchModelInfo, generateMessage } = require("../services/ollama");
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
  handleMessageRequest,
  handleModelInfoRequest,
  handleModelsRequest,
};
