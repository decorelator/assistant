import test from "node:test";
import assert from "node:assert/strict";

import {
  getSceneReplyBlocksForModelContext,
  getSceneReplyBlocksForViewer,
  normalizeSceneReplyBlocks,
  parseSceneReplyBlocks,
  serializeSceneReplyBlocks,
} from "../public/js/features/scene-blocks.mjs";

test("parseSceneReplyBlocks preserves block order and repeated tags", () => {
  const blocks = parseSceneReplyBlocks([
    "[ACTION] Anna folds her arms and looks away.",
    "",
    '[SAY] "I do not want to talk about it right now."',
    "",
    "[THOUGHT] Of course I am angry.",
    "",
    "[ACTION] She glances back at him.",
    "",
    '[SAY] "Why are you smiling?"',
  ].join("\n"));

  assert.deepEqual(blocks, [
    { type: "action", text: "Anna folds her arms and looks away." },
    { type: "say", text: '"I do not want to talk about it right now."' },
    { type: "thought", text: "Of course I am angry." },
    { type: "action", text: "She glances back at him." },
    { type: "say", text: '"Why are you smiling?"' },
  ]);
});

test("parseSceneReplyBlocks falls back to SAY when the model returns untagged text", () => {
  assert.deepEqual(
    parseSceneReplyBlocks('I do not want to talk about it right now.'),
    [{ type: "say", text: "I do not want to talk about it right now." }],
  );
});

test("parseSceneReplyBlocks splits inline tags into separate ordered blocks", () => {
  assert.deepEqual(
    parseSceneReplyBlocks([
      '[SAY] "What? It is what I want." [ACTION] Runs his fingers lightly over the curve of her hip.',
      "",
      "[THOUGHT] He is pushing too hard.",
    ].join("\n")),
    [
      { type: "say", text: '"What? It is what I want."' },
      { type: "action", text: "Runs his fingers lightly over the curve of her hip." },
      { type: "thought", text: "He is pushing too hard." },
    ],
  );
});

test("parseSceneReplyBlocks keeps leading untagged text as SAY before later tags", () => {
  assert.deepEqual(
    parseSceneReplyBlocks('I am not done here. [ACTION] He steps closer.'),
    [
      { type: "say", text: "I am not done here." },
      { type: "action", text: "He steps closer." },
    ],
  );
});

test("normalizeSceneReplyBlocks reparses saved text instead of trusting stale stored blocks", () => {
  assert.deepEqual(
    normalizeSceneReplyBlocks(
      [
        {
          type: "say",
          text: '"Fair? Honey, life ain\'t fair." [ACTION] Scoots forward on the couch.',
        },
      ],
      '"Fair? Honey, life ain\'t fair." [ACTION] Scoots forward on the couch.',
    ),
    [
      { type: "say", text: '"Fair? Honey, life ain\'t fair."' },
      { type: "action", text: "Scoots forward on the couch." },
    ],
  );
});

test("serializeSceneReplyBlocks can omit private THOUGHT blocks", () => {
  const blocks = [
    { type: "action", text: "Anna folds her arms." },
    { type: "say", text: '"I am fine."' },
    { type: "thought", text: "I am absolutely not fine." },
  ];

  assert.equal(
    serializeSceneReplyBlocks(blocks, { includePrivate: false }),
    ['[ACTION] Anna folds her arms.', '', '[SAY] "I am fine."'].join("\n"),
  );
});

test("getSceneReplyBlocksForViewer keeps THOUGHT private from the other speaker", () => {
  const blocks = [
    { type: "action", text: "Anna folds her arms." },
    { type: "thought", text: "I am absolutely not fine." },
  ];

  assert.deepEqual(getSceneReplyBlocksForViewer(blocks, "A", "A"), blocks);
  assert.deepEqual(getSceneReplyBlocksForViewer(blocks, "A", "B"), [
    { type: "action", text: "Anna folds her arms." },
  ]);
});

test("getSceneReplyBlocksForModelContext omits THOUGHT blocks for all later turns", () => {
  const blocks = [
    { type: "action", text: "Anna folds her arms." },
    { type: "say", text: '"I am fine."' },
    { type: "thought", text: "I am absolutely not fine." },
  ];

  assert.deepEqual(getSceneReplyBlocksForModelContext(blocks), [
    { type: "action", text: "Anna folds her arms." },
    { type: "say", text: '"I am fine."' },
  ]);
});
