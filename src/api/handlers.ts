const { getClientConfig, getDefaultInstruction } = require("../config/env");
const {
  createInstructionPreset,
  deleteInstructionPreset,
  isUniqueTitleConstraintError,
  listInstructionPresets,
  updateInstructionPreset,
} = require("../db/instruction-presets");
const { readJsonBody, sendJson } = require("../lib/http");
const { fetchModels, fetchModelInfo, generateMessage } = require("../services/ollama");

function readTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readPresetId(value: string) {
  const presetId = Number.parseInt(value, 10);
  return Number.isInteger(presetId) && presetId > 0 ? presetId : null;
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

function handleInstructionPresetListRequest(response: import("node:http").ServerResponse) {
  sendJson(response, 200, { presets: listInstructionPresets() });
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

async function handleInstructionPresetCreateRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
) {
  try {
    const body = await readJsonBody(request);
    const title = readTrimmedString(body.title);
    const instructionText = typeof body.instructionText === "string" ? body.instructionText : "";

    if (!title) {
      sendJson(response, 400, { error: "Title is required." });
      return;
    }

    const preset = createInstructionPreset(title, instructionText);
    sendJson(response, 201, { preset });
  } catch (error) {
    if (isUniqueTitleConstraintError(error)) {
      sendJson(response, 409, { error: "A preset with this title already exists." });
      return;
    }

    const message = error instanceof Error ? error.message : "Could not save preset.";
    sendJson(response, 500, { error: message });
  }
}

async function handleInstructionPresetUpdateRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  presetIdParam: string,
) {
  const presetId = readPresetId(presetIdParam);

  if (!presetId) {
    sendJson(response, 400, { error: "Valid preset id is required." });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const instructionText = typeof body.instructionText === "string" ? body.instructionText : "";
    const preset = updateInstructionPreset(presetId, instructionText);

    if (!preset) {
      sendJson(response, 404, { error: "Preset not found." });
      return;
    }

    sendJson(response, 200, { preset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update preset.";
    sendJson(response, 500, { error: message });
  }
}

function handleInstructionPresetDeleteRequest(
  response: import("node:http").ServerResponse,
  presetIdParam: string,
) {
  const presetId = readPresetId(presetIdParam);

  if (!presetId) {
    sendJson(response, 400, { error: "Valid preset id is required." });
    return;
  }

  const deleted = deleteInstructionPreset(presetId);

  if (!deleted) {
    sendJson(response, 404, { error: "Preset not found." });
    return;
  }

  sendJson(response, 200, { deletedId: presetId });
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
  handleInstructionPresetCreateRequest,
  handleInstructionPresetDeleteRequest,
  handleInstructionPresetListRequest,
  handleInstructionPresetUpdateRequest,
  handleMessageRequest,
  handleModelInfoRequest,
  handleModelsRequest,
};
