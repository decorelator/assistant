import {
  SCENE_STATUS,
  SCENE_VIEW,
  SCENE_WORKSPACE,
} from "./scene-state-constants.mjs";
import { sortSceneBeats } from "./scene-state-beats.mjs";
import { createSceneId } from "./scene-state-schema.mjs";
import { getCurrentPairNumber, isSceneChatLocked } from "./scene-state-selectors.mjs";

const DEFAULT_COOLDOWN_SECONDS = 5;

function clampExchangeCount(value, fallback, maximum = 50) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isInteger(numericValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(1, numericValue));
}

function buildBeatFromInput(input, fallbackPairNumber, maximumPairNumber, beatId = null) {
  const pairNumber = clampExchangeCount(input.pairNumber, fallbackPairNumber, maximumPairNumber);
  const text = typeof input.text === "string" ? input.text.trim() : "";

  if (!text) {
    return { error: "Direction text is required." };
  }

  return {
    beat: {
      id: beatId ?? createSceneId("beat"),
      pairNumber,
      moment: input.moment === "beforeA" || input.moment === "beforeB" ? input.moment : "pair",
      text,
    },
  };
}

export function applySceneWorkspace(scene, workspace) {
  if (workspace === SCENE_WORKSPACE.CHAT && isSceneChatLocked(scene)) {
    return scene;
  }

  return {
    ...scene,
    workspace:
      workspace === SCENE_WORKSPACE.SCENE ? SCENE_WORKSPACE.SCENE : SCENE_WORKSPACE.CHAT,
  };
}

export function applySceneFieldChange(scene, fieldName, value) {
  switch (fieldName) {
    case "title":
      return {
        ...scene,
        title: value,
      };
    case "globalInstruction":
      return {
        ...scene,
        globalInstruction: value,
      };
    case "context":
      return {
        ...scene,
        context: value,
      };
    case "model":
      return {
        ...scene,
        model: typeof value === "string" ? value.trim() : "",
      };
    case "exchangeCount": {
      const exchangeCount = clampExchangeCount(value, scene.exchangeCount, 50);
      return {
        ...scene,
        exchangeCount,
        beats: sortSceneBeats(
          scene.beats.map((beat) => ({
            ...beat,
            pairNumber: Math.min(exchangeCount, beat.pairNumber),
          })),
        ),
      };
    }
    case "firstSpeaker":
      return {
        ...scene,
        firstSpeaker: value === "B" ? "B" : "A",
      };
    case "runMode":
      return {
        ...scene,
        runMode: value === "step" ? "step" : "auto",
      };
    case "cooldownSeconds":
      return {
        ...scene,
        cooldownSeconds: [2, 5, 10].includes(Number(value))
          ? Number(value)
          : DEFAULT_COOLDOWN_SECONDS,
      };
    default:
      return scene;
  }
}

export function applyCharacterSave(scene, characterId, characterDraft) {
  return {
    ...scene,
    characters: {
      ...scene.characters,
      [characterId]: {
        name: characterDraft.name?.trim() || `Character ${characterId}`,
        card: characterDraft.card ?? "",
      },
    },
  };
}

export function applyBeatSave(scene, beatId, beatInput) {
  const beatResult = buildBeatFromInput(
    beatInput,
    getCurrentPairNumber(scene),
    scene.exchangeCount,
    beatId,
  );

  if (beatResult.error) {
    return beatResult;
  }

  const existingBeats = scene.beats.filter((beat) => beat.id !== beatId);

  return {
    scene: {
      ...scene,
      beats: sortSceneBeats([...existingBeats, beatResult.beat]),
    },
  };
}

export function applyBeatDelete(scene, beatId) {
  return {
    ...scene,
    beats: scene.beats.filter((beat) => beat.id !== beatId),
  };
}

export function openSceneSetup(scene) {
  return {
    ...scene,
    view: SCENE_VIEW.SETUP,
    workspace: SCENE_WORKSPACE.SCENE,
  };
}

export function returnSceneToRun(scene) {
  return {
    ...scene,
    view: SCENE_VIEW.RUN,
    workspace: SCENE_WORKSPACE.SCENE,
  };
}

export function prepareSceneStart(scene) {
  return {
    ...scene,
    view: SCENE_VIEW.RUN,
    workspace: SCENE_WORKSPACE.SCENE,
    status: SCENE_STATUS.DRAFT,
    transcript: [],
    failedTurn: null,
    lastError: "",
    countdownRemainingMs: 0,
    pauseRequested: false,
  };
}
