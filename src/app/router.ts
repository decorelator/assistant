const { refreshEnv } = require("../config/env");
const {
  handleConfigRequest,
  handleMessageRequest,
  handleModelInfoRequest,
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

  if (url === "/api/models") {
    await handleModelsRequest(response);
    return;
  }

  if (url === "/api/config") {
    handleConfigRequest(response);
    return;
  }

  if (url === "/api/message" && request.method === "POST") {
    await handleMessageRequest(request, response);
    return;
  }

  if (url === "/api/model" && request.method === "POST") {
    await handleModelInfoRequest(request, response);
    return;
  }

  if (servePublicAsset(response, url)) {
    return;
  }

  sendNotFound(response);
}

module.exports = { handleRequest };
