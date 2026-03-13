const { readFileSync } = require("node:fs");
const { createServer } = require("node:http");
const { join } = require("node:path");

const html = readFileSync(join(process.cwd(), "public", "index.html"), "utf8");
const appJs = readFileSync(join(process.cwd(), "public", "app.js"), "utf8");
const resolvConfPath = "/etc/resolv.conf";

function sendJson(
  response: import("node:http").ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function handleModelsRequest(response: import("node:http").ServerResponse) {
  const candidates = getOllamaBaseUrls();
  const failures: string[] = [];

  for (const baseUrl of candidates) {
    try {
      const ollamaResponse = await fetchWithTimeout(`${baseUrl}/api/tags`, 2500);

      if (!ollamaResponse.ok) {
        failures.push(`${baseUrl} returned ${ollamaResponse.status} ${ollamaResponse.statusText}`);
        continue;
      }

      const body = await ollamaResponse.json();
      sendJson(response, 200, { ...body, baseUrl });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown connection error";
      failures.push(`${baseUrl} failed: ${message}`);
    }
  }

  sendJson(response, 502, {
    error:
      "Could not connect to Ollama from the Node server. If this app is running in WSL and Ollama is running on Windows, set OLLAMA_BASE_URL to your Windows host, for example http://<windows-host-ip>:11434.",
    attempts: failures,
  });
}

function getOllamaBaseUrls() {
  const candidates = new Set<string>();
  const envUrl = process.env.OLLAMA_BASE_URL?.trim();

  if (envUrl) {
    candidates.add(envUrl.replace(/\/+$/, ""));
  }

  candidates.add("http://127.0.0.1:11434");
  candidates.add("http://localhost:11434");

  const windowsHostIp = readWindowsHostIp();
  if (windowsHostIp) {
    candidates.add(`http://${windowsHostIp}:11434`);
  }

  return [...candidates];
}

function readWindowsHostIp() {
  try {
    const resolvConf = readFileSync(resolvConfPath, "utf8");
    const nameserverLine = resolvConf
      .split("\n")
      .find((line: string) => line.trim().startsWith("nameserver "));

    if (!nameserverLine) {
      return null;
    }

    const ip = nameserverLine.trim().split(/\s+/)[1];
    return ip || null;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function startServer() {
  createServer(
    async (
      request: import("node:http").IncomingMessage,
      response: import("node:http").ServerResponse,
    ) => {
      const url = request.url ?? "/";

      if (url === "/api/models") {
        await handleModelsRequest(response);
        return;
      }

      if (url === "/app.js") {
        response.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
        response.end(appJs);
        return;
      }

      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
    },
  ).listen(Number(process.env.PORT ?? 3000));
}

module.exports = { startServer };
