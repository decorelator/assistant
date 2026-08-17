import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("ts-node/register/transpile-only");

const { buildPrompt } = require("../src/services/ollama/prompt-builder.ts");

test("chat prompt builder preserves the existing context and director structure", () => {
  const prompt = buildPrompt(
    "How do we get out?",
    [
      { role: "user", text: "Where are we?" },
      { role: "assistant", text: "Inside the archive." },
    ],
    "Keep the answer terse.",
    "Lights are failing.",
  );

  assert.equal(
    prompt,
    [
      "[CONTEXT: Lights are failing.]",
      "Use the selected conversation context below when it helps answer the current user message.",
      "Selected conversation context:\nUser:\nWhere are we?\n\nAssistant:\nInside the archive.",
      "Current user message:\n[DIRECTOR: Keep the answer terse.]\n\nHow do we get out?",
    ].join("\n\n"),
  );
});
