function send(
  response: import("node:http").ServerResponse,
  statusCode: number,
  payload: string,
  contentType: string,
) {
  response.writeHead(statusCode, { "Content-Type": contentType });
  response.end(payload);
}

function sendJson(
  response: import("node:http").ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  send(response, statusCode, JSON.stringify(payload), "application/json; charset=utf-8");
}

function sendText(
  response: import("node:http").ServerResponse,
  statusCode: number,
  payload: string,
  contentType: string,
) {
  send(response, statusCode, payload, contentType);
}

function sendNotFound(response: import("node:http").ServerResponse) {
  sendJson(response, 404, { error: "Not found." });
}

async function readJsonBody(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

module.exports = { readJsonBody, sendJson, sendNotFound, sendText };
