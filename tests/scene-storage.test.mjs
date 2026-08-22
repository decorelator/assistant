import test from "node:test";
import assert from "node:assert/strict";

import { loadSceneDraft, saveSceneDraft } from "../public/js/features/scene-storage.mjs";
import { SCENE_STATUS, SCENE_VIEW } from "../public/js/features/scene-state.mjs";
import { createScene } from "./scene-test-helpers.mjs";

test("scene draft storage restores an interrupted run as a stopped draft", () => {
  const localStorageState = new Map();
  const originalLocalStorage = globalThis.localStorage;

  try {
    globalThis.localStorage = {
      getItem(key) {
        return localStorageState.has(key) ? localStorageState.get(key) : null;
      },
      removeItem(key) {
        localStorageState.delete(key);
      },
      setItem(key, value) {
        localStorageState.set(key, value);
      },
    };

    const runningScene = createScene({
      view: SCENE_VIEW.RUN,
      status: SCENE_STATUS.GENERATING,
      globalInstruction: "Shared system rule.",
      model: "shared-scene-model",
      transcript: [
        {
          id: "line-1",
          pairNumber: 1,
          speaker: "A",
          characterName: "Alice",
          model: "shared-scene-model",
          text: "Already generated.",
        },
      ],
    });

    saveSceneDraft(runningScene);
    const restoredScene = loadSceneDraft();

    assert.equal(restoredScene.status, SCENE_STATUS.STOPPED);
    assert.equal(restoredScene.view, SCENE_VIEW.RUN);
    assert.equal(restoredScene.globalInstruction, "Shared system rule.");
    assert.equal(restoredScene.model, "shared-scene-model");
    assert.equal(restoredScene.transcript.length, 1);
    assert.equal(restoredScene.transcript[0].text, "Already generated.");
  } finally {
    globalThis.localStorage = originalLocalStorage;
  }
});
