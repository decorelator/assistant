import test from "node:test";
import assert from "node:assert/strict";

import {
  canEditBeatInRun,
  createDefaultSceneDraft,
  normalizeSceneDraft,
  SCENE_STATUS,
} from "../public/js/features/scene-state.mjs";
import { createScene } from "./scene-test-helpers.mjs";

test("completed scenes allow director beats to be edited again", () => {
  const beat = { id: "beat-1", pairNumber: 1, moment: "pair", text: "The room gets quieter." };

  const completedScene = createScene({
    status: SCENE_STATUS.COMPLETED,
    beats: [beat],
    transcript: [
      {
        id: "line-1",
        pairNumber: 1,
        speaker: "A",
        characterName: "Alice",
        model: "scene-model",
        text: "[SAY] Done.",
      },
      {
        id: "line-2",
        pairNumber: 1,
        speaker: "B",
        characterName: "Bob",
        model: "scene-model",
        text: "[SAY] Done too.",
      },
    ],
  });

  const waitingScene = createScene({
    status: SCENE_STATUS.WAITING_FOR_CONTINUE,
    beats: [beat],
    transcript: [
      {
        id: "line-1",
        pairNumber: 1,
        speaker: "A",
        characterName: "Alice",
        model: "scene-model",
        text: "[SAY] Done.",
      },
      {
        id: "line-2",
        pairNumber: 1,
        speaker: "B",
        characterName: "Bob",
        model: "scene-model",
        text: "[SAY] Done too.",
      },
    ],
  });

  assert.equal(canEditBeatInRun(completedScene, beat), true);
  assert.equal(canEditBeatInRun(waitingScene, beat), false);
});

test("legacy scene drafts recover the shared model from character models", () => {
  const restoredScene = normalizeSceneDraft({
    ...createDefaultSceneDraft(),
    characters: {
      A: {
        name: "Alice",
        model: "legacy-model-a",
        card: "Alice card",
      },
      B: {
        name: "Bob",
        model: "legacy-model-b",
        card: "Bob card",
      },
    },
  });

  assert.equal(restoredScene.model, "legacy-model-a");
  assert.equal("model" in restoredScene.characters.A, false);
  assert.equal("model" in restoredScene.characters.B, false);
});
