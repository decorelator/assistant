const {
  createInstructionPreset,
  deleteInstructionPreset,
  isUniqueTitleConstraintError,
  listInstructionPresets,
  updateInstructionPreset,
} = require("../db/instruction-presets");
const { readJsonBody, sendJson } = require("../lib/http");
const { readPositiveInteger, readTrimmedString } = require("./request-utils");

function handleInstructionPresetListRequest(response: import("node:http").ServerResponse) {
  sendJson(response, 200, { presets: listInstructionPresets() });
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
  const presetId = readPositiveInteger(presetIdParam);

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
  const presetId = readPositiveInteger(presetIdParam);

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

module.exports = {
  handleInstructionPresetCreateRequest,
  handleInstructionPresetDeleteRequest,
  handleInstructionPresetListRequest,
  handleInstructionPresetUpdateRequest,
};
