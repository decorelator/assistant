const { readFileSync } = require("node:fs");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { fetchModels, generateMessage } = require("./ollama");

const html = readFileSync(join(process.cwd(), "public", "index.html"), "utf8");
const appJs = readFileSync(join(process.cwd(), "public", "app.js"), "utf8");

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

async function handleMessageRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
) {
  try {
    const body = await readJsonBody(request);
    const model = typeof body.model === "string" ? body.model.trim() : "";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!model || !prompt) {
      sendJson(response, 400, { error: "Model and prompt are required." });
      return;
    }

    const reply = await generateMessage(model, prompt);
    sendJson(response, 200, { response: reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send message.";
    sendJson(response, 502, { error: message });
  }
}

function serveScript(response: import("node:http").ServerResponse) {
  response.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
  response.end(appJs);
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
  const url = request.url ?? "/";

  if (url === "/api/models") {
    await handleModelsRequest(response);
    return;
  }

  if (url === "/api/message" && request.method === "POST") {
    await handleMessageRequest(request, response);
    return;
  }

  if (url === "/app.js") {
    serveScript(response);
    return;
  }

  serveHtml(response);
}

function startServer() {
  createServer(handleRequest).listen(Number(process.env.PORT ?? 3000));
}

module.exports = { startServer };
