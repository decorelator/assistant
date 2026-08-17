import { loadModels, sendMessage, stopGeneration } from "../api.js";
import { createSceneRunner } from "./scene-runner.mjs";
import {
  cloneSceneDraft,
  createSceneId,
  getCurrentPairNumber,
  normalizeSceneDraft,
  SCENE_STATUS,
  SCENE_VIEW,
  SCENE_WORKSPACE,
  sortSceneBeats,
} from "./scene-state.mjs";
import { loadSceneDraft, saveSceneDraft } from "./scene-storage.mjs";
import { createSceneUi } from "./scene-ui.js";

function isStoppedError(error) {
  return (
    error instanceof Error &&
    (error.message === "Generation stopped." || error.status === 499)
  );
}

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

export function createSceneController({
  releaseInactiveModels,
  getLastUsedModel,
  getSelectedChatModel,
  markModelUsed,
}) {
  const ui = createSceneUi();
  let availableModels = [];
  let scene = normalizeSceneDraft(loadSceneDraft(), { restoreStopped: true });

  const runner = createSceneRunner({
    initialScene: scene,
    async generateReply({ scene: sceneSnapshot, request }) {
      try {
        await releaseInactiveModels(
          request.model,
          getSelectedChatModel(),
          getLastUsedModel(),
          sceneSnapshot.characters.A.model,
          sceneSnapshot.characters.B.model,
        );
        const reply = await sendMessage(
          request.model,
          request.prompt,
          request.instruction,
          null,
          [],
        );
        markModelUsed(request.model);
        return reply.response || "No response from model.";
      } catch (error) {
        if (isStoppedError(error)) {
          const stoppedError = new Error("Generation stopped.");
          stoppedError.status = 499;
          throw stoppedError;
        }

        throw error;
      }
    },
    async stopGeneration() {
      await stopGeneration();
    },
    onChange(nextScene) {
      scene = normalizeSceneDraft(nextScene);
      saveSceneDraft(scene);
      ui.render(scene, { availableModels });
    },
  });

  function updateScene(patch) {
    scene = normalizeSceneDraft(
      typeof patch === "function" ? patch(cloneSceneDraft(scene)) : patch,
    );
    saveSceneDraft(scene);
    runner.replaceScene(scene);
    ui.render(scene, { availableModels });
  }

  async function ensureModelsLoaded() {
    try {
      availableModels = await loadModels();
    } catch {
      availableModels = [];
    }

    ui.render(scene, { availableModels });
  }

  function setWorkspace(workspace) {
    if (workspace === SCENE_WORKSPACE.CHAT && scene.view === SCENE_VIEW.RUN && [
      SCENE_STATUS.GENERATING,
      SCENE_STATUS.COOLING_DOWN,
      SCENE_STATUS.PAUSED,
      SCENE_STATUS.WAITING_FOR_CONTINUE,
      SCENE_STATUS.ERROR,
    ].includes(scene.status)) {
      return;
    }

    updateScene({
      ...scene,
      workspace: workspace === SCENE_WORKSPACE.SCENE ? SCENE_WORKSPACE.SCENE : SCENE_WORKSPACE.CHAT,
    });
  }

  function handleFieldChange(fieldName, value) {
    updateScene((currentScene) => {
      const nextScene = cloneSceneDraft(currentScene);

      switch (fieldName) {
        case "title":
          nextScene.title = value;
          break;
        case "globalInstruction":
          nextScene.globalInstruction = value;
          break;
        case "context":
          nextScene.context = value;
          break;
        case "exchangeCount":
          nextScene.exchangeCount = clampExchangeCount(value, nextScene.exchangeCount);
          nextScene.beats = sortSceneBeats(
            nextScene.beats.map((beat) => ({
              ...beat,
              pairNumber: Math.min(nextScene.exchangeCount, beat.pairNumber),
            })),
          );
          break;
        case "firstSpeaker":
          nextScene.firstSpeaker = value === "B" ? "B" : "A";
          break;
        case "runMode":
          nextScene.runMode = value === "step" ? "step" : "auto";
          break;
        case "cooldownSeconds":
          nextScene.cooldownSeconds = [2, 5, 10].includes(Number(value)) ? Number(value) : 5;
          break;
        default:
          break;
      }

      return nextScene;
    });
  }

  function openCharacterDialog(characterId) {
    ui.openCharacterDialog(characterId, scene.characters[characterId], availableModels);
  }

  function saveCharacter(characterId, characterDraft) {
    updateScene((currentScene) => ({
      ...currentScene,
      characters: {
        ...currentScene.characters,
        [characterId]: {
          name: characterDraft.name?.trim() || `Character ${characterId}`,
          model: characterDraft.model?.trim() || "",
          card: characterDraft.card ?? "",
        },
      },
    }));
    ui.closeCharacterDialog();
  }

  function openAddBeatDialog() {
    ui.openBeatDialog(null, scene.exchangeCount);
  }

  function openEditBeatDialog(beatId) {
    const beat = scene.beats.find((entry) => entry.id === beatId);
    if (!beat) {
      return;
    }

    ui.openBeatDialog(beat, scene.exchangeCount);
  }

  function saveBeat(beatId, beatInput) {
    const beatResult = buildBeatFromInput(
      beatInput,
      getCurrentPairNumber(scene),
      scene.exchangeCount,
      beatId,
    );

    if (beatResult.error) {
      ui.setBeatError(beatResult.error);
      return;
    }

    updateScene((currentScene) => {
      const existingBeats = currentScene.beats.filter((beat) => beat.id !== beatId);
      return {
        ...currentScene,
        beats: sortSceneBeats([...existingBeats, beatResult.beat]),
      };
    });

    ui.closeBeatDialog();
  }

  function deleteBeat(beatId) {
    updateScene((currentScene) => ({
      ...currentScene,
      beats: currentScene.beats.filter((beat) => beat.id !== beatId),
    }));
  }

  function openSetup() {
    updateScene({
      ...scene,
      view: SCENE_VIEW.SETUP,
      workspace: SCENE_WORKSPACE.SCENE,
    });
  }

  function backToRun() {
    updateScene({
      ...scene,
      view: SCENE_VIEW.RUN,
      workspace: SCENE_WORKSPACE.SCENE,
    });
  }

  function startScene() {
    updateScene({
      ...scene,
      view: SCENE_VIEW.RUN,
      workspace: SCENE_WORKSPACE.SCENE,
      status: SCENE_STATUS.DRAFT,
      transcript: [],
      failedTurn: null,
      lastError: "",
      countdownRemainingMs: 0,
      pauseRequested: false,
    });
    runner.start();
  }

  function pauseScene() {
    runner.pause();
  }

  function resumeScene() {
    runner.resume();
  }

  function continueScene() {
    runner.continueStep();
  }

  function retryScene() {
    runner.retry();
  }

  async function stopScene() {
    try {
      await runner.stop();
    } catch (error) {
      updateScene({
        ...scene,
        status: SCENE_STATUS.ERROR,
        lastError: error instanceof Error ? error.message : "Could not stop scene.",
      });
    }
  }

  function initialize() {
    ui.bind({
      onWorkspaceChange(workspace) {
        if (workspace === SCENE_WORKSPACE.SCENE) {
          void ensureModelsLoaded();
        }
        setWorkspace(workspace);
      },
      onFieldChange: handleFieldChange,
      onGenerate: startScene,
      onPause: pauseScene,
      onResume: resumeScene,
      onContinue: continueScene,
      onRetry: retryScene,
      onStop() {
        void stopScene();
      },
      onOpenSetup: openSetup,
      onBackToRun: backToRun,
      onAddBeat: openAddBeatDialog,
      onEditBeat: openEditBeatDialog,
      onDeleteBeat: deleteBeat,
      onSaveCharacter(action, characterId, characterDraft) {
        if (action === "open") {
          openCharacterDialog(characterId);
          return;
        }

        saveCharacter(characterId, characterDraft);
      },
      onSaveBeat: saveBeat,
    });

    ui.render(scene, { availableModels });
    void ensureModelsLoaded();
  }

  return {
    initialize,
  };
}
