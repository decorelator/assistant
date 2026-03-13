const { readFileSync } = require("node:fs");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { getClientConfig, refreshEnv } = require("./config");
const { fetchModels, fetchModelInfo, generateMessage } = require("./ollama");

const html = readFileSync(join(process.cwd(), "public", "index.html"), "utf8");
const appJs = readFileSync(join(process.cwd(), "public", "app.js"), "utf8");
const stylesCss = readFileSync(join(process.cwd(), "public", "styles.css"), "utf8");

function sendJson(
  response: import("node:http").ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
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
    const model = typeof body.model === "string" ? body.model.trim() : "";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";

    if (!model || !prompt) {
      sendJson(response, 400, { error: "Model and prompt are required." });
      return;
    }

    const reply = await generateMessage(model, prompt, instruction);
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
    const model = typeof body.model === "string" ? body.model.trim() : "";

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

function serveScript(response: import("node:http").ServerResponse) {
  response.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
  response.end(appJs);
}

function serveStyles(response: import("node:http").ServerResponse) {
  response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
  response.end(stylesCss);
}

function serveHtml(response: import("node:http").ServerResponse) {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
}

async function readJsonBody(request: import("node:http").IncomingMessage) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function handleRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
) {
  refreshEnv();
  const url = request.url ?? "/";

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

  if (url === "/app.js") {
    serveScript(response);
    return;
  }

  if (url === "/styles.css") {
    serveStyles(response);
    return;
  }

  serveHtml(response);
}

function startServer() {
  createServer(handleRequest).listen(Number(process.env.PORT ?? 3000));
}

module.exports = { startServer };
