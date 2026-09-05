const { refreshEnv } = require("../config/env");
const {
  handleConfigRequest,
  handleCharacterCardCreateRequest,
  handleCharacterCardDeleteRequest,
  handleCharacterCardListRequest,
  handleCharacterCardReadRequest,
  handleCharacterCardUpdateRequest,
  handleCharacterTagListRequest,
  handleInstructionPresetCreateRequest,
  handleInstructionPresetDeleteRequest,
  handleInstructionPresetListRequest,
  handleInstructionPresetUpdateRequest,
  handleOllamaStartRequest,
  handleMessageRequest,
  handleMessageStopRequest,
  handleModelDeleteRequest,
  handleModelInfoRequest,
  handleModelStopRequest,
  handleOtherModelsReleaseRequest,
  handleModelsRequest,
  handleSceneCardCreateRequest,
  handleSceneCardDeleteRequest,
  handleSceneCardListRequest,
  handleSceneCardReadRequest,
  handleSceneCardUpdateRequest,
} = require("../api/handlers");
const { sendNotFound } = require("../lib/http");
const { servePublicAsset } = require("../static/serve-public");

async function handleRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
) {
  refreshEnv();
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const url = requestUrl.pathname;
  const presetMatch = url.match(/^\/api\/instruction-presets\/(\d+)$/);
  const characterCardMatch = url.match(/^\/api\/character-cards\/(\d+)$/);
  const sceneCardMatch = url.match(/^\/api\/scene-cards\/(\d+)$/);

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

  if (url === "/api/character-cards" && request.method === "GET") {
    handleCharacterCardListRequest(response, requestUrl.searchParams);
    return;
  }

  if (url === "/api/character-cards" && request.method === "POST") {
    await handleCharacterCardCreateRequest(request, response);
    return;
  }

  if (characterCardMatch && request.method === "GET") {
    handleCharacterCardReadRequest(response, characterCardMatch[1]);
    return;
  }

  if (characterCardMatch && request.method === "PUT") {
    await handleCharacterCardUpdateRequest(request, response, characterCardMatch[1]);
    return;
  }

  if (characterCardMatch && request.method === "DELETE") {
    handleCharacterCardDeleteRequest(response, characterCardMatch[1]);
    return;
  }

  if (url === "/api/character-tags" && request.method === "GET") {
    handleCharacterTagListRequest(response);
    return;
  }

  if (url === "/api/scene-cards" && request.method === "GET") {
    handleSceneCardListRequest(response, requestUrl.searchParams);
    return;
  }

  if (url === "/api/scene-cards" && request.method === "POST") {
    await handleSceneCardCreateRequest(request, response);
    return;
  }

  if (sceneCardMatch && request.method === "GET") {
    handleSceneCardReadRequest(response, sceneCardMatch[1]);
    return;
  }

  if (sceneCardMatch && request.method === "PUT") {
    await handleSceneCardUpdateRequest(request, response, sceneCardMatch[1]);
    return;
  }

  if (sceneCardMatch && request.method === "DELETE") {
    handleSceneCardDeleteRequest(response, sceneCardMatch[1]);
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

  if (url === "/api/ollama/start" && request.method === "POST") {
    await handleOllamaStartRequest(response);
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

  if (url === "/api/models/release-others" && request.method === "POST") {
    await handleOtherModelsReleaseRequest(request, response);
    return;
  }

  if (url === "/api/model" && request.method === "DELETE") {
    await handleModelDeleteRequest(request, response);
    return;
  }

  if (servePublicAsset(response, url)) {
    return;
  }

  sendNotFound(response);
}

module.exports = { handleRequest };
