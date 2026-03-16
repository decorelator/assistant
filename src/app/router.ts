const { refreshEnv } = require("../config/env");
const {
  handleConfigRequest,
  handleInstructionPresetCreateRequest,
  handleInstructionPresetDeleteRequest,
  handleInstructionPresetListRequest,
  handleInstructionPresetUpdateRequest,
  handleMessageRequest,
  handleMessageStopRequest,
  handleModelInfoRequest,
  handleModelStopRequest,
  handleModelsRequest,
} = require("../api/handlers");
const { sendNotFound } = require("../lib/http");
const { servePublicAsset } = require("../static/serve-public");

async function handleRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
) {
  refreshEnv();
  const url = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  const presetMatch = url.match(/^\/api\/instruction-presets\/(\d+)$/);

  if (url === "/api/models") {
    await handleModelsRequest(response);
    return;
  }

  if (url === "/api/config") {
    handleConfigRequest(response);
    return;
  }

  if (url === "/api/instruction-presets" && request.method === "GET") {
    handleInstructionPresetListRequest(response);
    return;
  }

  if (url === "/api/instruction-presets" && request.method === "POST") {
    await handleInstructionPresetCreateRequest(request, response);
    return;
  }

  if (presetMatch && request.method === "PUT") {
    await handleInstructionPresetUpdateRequest(request, response, presetMatch[1]);
    return;
  }

  if (presetMatch && request.method === "DELETE") {
    handleInstructionPresetDeleteRequest(response, presetMatch[1]);
    return;
  }

  if (url === "/api/message" && request.method === "POST") {
    await handleMessageRequest(request, response);
    return;
  }

  if (url === "/api/message/stop" && request.method === "POST") {
    handleMessageStopRequest(response);
    return;
  }

  if (url === "/api/model" && request.method === "POST") {
    await handleModelInfoRequest(request, response);
    return;
  }

  if (url === "/api/model/stop" && request.method === "POST") {
    await handleModelStopRequest(request, response);
    return;
  }

  if (servePublicAsset(response, url)) {
    return;
  }

  sendNotFound(response);
}

module.exports = { handleRequest };
