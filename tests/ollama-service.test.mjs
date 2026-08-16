import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("ts-node/register/transpile-only");

const { generateMessage, startOllama } = require("../src/services/ollama");

const originalFetch = globalThis.fetch;
const originalKeepAlive = process.env.OLLAMA_KEEP_ALIVE;

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalKeepAlive === undefined) {
    delete process.env.OLLAMA_KEEP_ALIVE;
  } else {
    process.env.OLLAMA_KEEP_ALIVE = originalKeepAlive;
  }
});

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("generation keeps the model loaded with a numeric keep_alive", async () => {
  delete process.env.OLLAMA_KEEP_ALIVE;
  let requestBody;

  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return jsonResponse({ response: "Ready" });
  };

  const reply = await generateMessage("test-model", "Hello");

  assert.equal(reply, "Ready");
  assert.equal(requestBody.keep_alive, -1);
  assert.equal(typeof requestBody.keep_alive, "number");
  assert.equal(requestBody.model, "test-model");
  assert.equal(requestBody.stream, false);
});

test("startOllama reuses an already available server", async () => {
  const requestedUrls = [];

  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    return jsonResponse({ models: [{ name: "test-model" }] });
  };

  const result = await startOllama();

  assert.deepEqual(result, {
    alreadyRunning: true,
    ready: true,
    started: false,
  });
  assert.deepEqual(requestedUrls, ["http://127.0.0.1:11434/api/tags"]);
});

test("generation exposes the error returned by Ollama", async () => {
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: "unknown model architecture: 'gemma4'" }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  );

  await assert.rejects(
    generateMessage("unsupported-model", "Hello"),
    /unknown model architecture: 'gemma4'/,
  );
});
