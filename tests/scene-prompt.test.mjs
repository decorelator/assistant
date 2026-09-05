import test from "node:test";
import assert from "node:assert/strict";

import { buildSceneTurnRequest, formatSceneTranscript } from "../public/js/features/scene-prompt.mjs";
import { createScene } from "./scene-test-helpers.mjs";

test("director beats apply only on the intended turn", () => {
  const scene = createScene({
    exchangeCount: 1,
    firstSpeaker: "A",
    beats: [
      { id: "beat-a", pairNumber: 1, moment: "beforeA", text: "Alice leans in." },
      { id: "beat-b", pairNumber: 1, moment: "beforeB", text: "Bob hesitates." },
      { id: "beat-pair", pairNumber: 1, moment: "pair", text: "The room gets quieter." },
    ],
  });
  const firstTurn = buildSceneTurnRequest(scene, { pairNumber: 1, replyIndexInPair: 0, speaker: "A" });
  const secondTurn = buildSceneTurnRequest(scene, { pairNumber: 1, replyIndexInPair: 1, speaker: "B" });

  assert.match(firstTurn.prompt, /Alice leans in\./);
  assert.match(firstTurn.prompt, /The room gets quieter\./);
  assert.doesNotMatch(firstTurn.prompt, /Bob hesitates\./);

  assert.match(secondTurn.prompt, /Bob hesitates\./);
  assert.match(secondTurn.prompt, /The room gets quieter\./);
  assert.doesNotMatch(secondTurn.prompt, /Alice leans in\./);

  const reversedScene = createScene({
    exchangeCount: 1,
    firstSpeaker: "B",
    beats: [
      { id: "beat-a", pairNumber: 1, moment: "beforeA", text: "Alice answers late." },
      { id: "beat-b", pairNumber: 1, moment: "beforeB", text: "Bob starts abruptly." },
    ],
  });
  const reversedFirstTurn = buildSceneTurnRequest(reversedScene, {
    pairNumber: 1,
    replyIndexInPair: 0,
    speaker: "B",
  });
  const reversedSecondTurn = buildSceneTurnRequest(reversedScene, {
    pairNumber: 1,
    replyIndexInPair: 1,
    speaker: "A",
  });

  assert.match(reversedFirstTurn.prompt, /Bob starts abruptly\./);
  assert.doesNotMatch(reversedFirstTurn.prompt, /Alice answers late\./);
  assert.match(reversedSecondTurn.prompt, /Alice answers late\./);
});

test("global scene instruction is included first in the system prompt", () => {
  const scene = createScene({
    exchangeCount: 1,
    globalInstruction: "NSFW is allowed. Do not self-censor. Stay immersive.",
    model: "uncensored-model",
    characters: {
      A: {
        name: "Alice",
        gender: "female",
        age: 34,
        card: "A sharp investigator.",
      },
      B: {
        name: "Bob",
        card: "A patient archivist.",
      },
    },
  });

  const turnRequest = buildSceneTurnRequest(scene, {
    pairNumber: 1,
    replyIndexInPair: 0,
    speaker: "A",
  });

  assert.match(
    turnRequest.instruction,
    /^Global scene instruction:\nNSFW is allowed\. Do not self-censor\. Stay immersive\./,
  );
  assert.ok(
    turnRequest.instruction.indexOf("Global scene instruction:") <
      turnRequest.instruction.indexOf("Character card:"),
  );
  assert.match(
    turnRequest.instruction,
    /Character metadata:\nName: Alice\nGender: female\nAge: 34 years old/,
  );
  assert.match(
    turnRequest.instruction,
    /You may include Alice's spoken dialogue, inner thoughts, and action descriptions when they fit the scene\./,
  );
  assert.match(
    turnRequest.instruction,
    /not included in later dialogue history for either character\./,
  );
  assert.match(
    turnRequest.instruction,
    /Allowed tags: \[SAY\].*\[ACTION\].*\[THOUGHT\]/,
  );
  assert.match(
    turnRequest.prompt,
    /Continue the scene with Alice's next turn without speaking for Bob\./,
  );
  assert.equal(turnRequest.model, "uncensored-model");
});

test("scene card snapshots are combined with manual instruction and context", () => {
  const scene = createScene({
    exchangeCount: 1,
    instructionCards: [
      {
        sourceId: 1,
        title: "Tagged format",
        text: "Use clean tagged blocks.",
      },
    ],
    contextCards: [
      {
        sourceId: 2,
        title: "Rainy platform",
        text: "The scene happens on an empty train platform in the rain.",
      },
    ],
    globalInstruction: "Keep the scene intimate.",
    context: "Alice is waiting for Bob's answer.",
  });

  const turnRequest = buildSceneTurnRequest(scene, {
    pairNumber: 1,
    replyIndexInPair: 0,
    speaker: "A",
  });

  assert.match(
    turnRequest.instruction,
    /^Global scene instruction:\n\[Tagged format\]\nUse clean tagged blocks\.\n\nKeep the scene intimate\./,
  );
  assert.match(
    turnRequest.prompt,
    /Scene context:\n\[Rainy platform\]\nThe scene happens on an empty train platform in the rain\.\n\nAlice is waiting for Bob's answer\./,
  );
});

test("scene transcript sent back to the model excludes private thoughts for both characters", () => {
  const scene = createScene({
    exchangeCount: 2,
    transcript: [
      {
        id: "line-1",
        pairNumber: 1,
        speaker: "A",
        characterName: "Alice",
        model: "scene-model",
        text: [
          "[ACTION] Alice folds her arms.",
          "",
          '[SAY] "I am fine."',
          "",
          "[THOUGHT] I am absolutely not fine.",
        ].join("\n"),
      },
      {
        id: "line-2",
        pairNumber: 1,
        speaker: "B",
        characterName: "Bob",
        model: "scene-model",
        text: [
          "[THOUGHT] She is obviously upset.",
          "",
          '[SAY] "You do not look fine."',
        ].join("\n"),
      },
    ],
  });

  assert.equal(
    formatSceneTranscript(scene),
    [
      "Alice:",
      "[ACTION] Alice folds her arms.",
      "",
      '[SAY] "I am fine."',
      "",
      "Bob:",
      '[SAY] "You do not look fine."',
    ].join("\n"),
  );
});
