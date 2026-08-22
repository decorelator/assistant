import { loadModels, sendMessage, stopGeneration } from "../api.js";
import {
  applyBeatDelete,
  applyBeatSave,
  applyCharacterSave,
  applySceneFieldChange,
  applySceneWorkspace,
  openSceneSetup,
  prepareSceneStart,
  returnSceneToRun,
} from "./scene-actions.mjs";
import { createSceneRunner } from "./scene-runner.mjs";
import { SCENE_STATUS, SCENE_WORKSPACE } from "./scene-state-constants.mjs";
import { cloneSceneDraft, normalizeSceneDraft } from "./scene-state-schema.mjs";
import { loadSceneDraft, saveSceneDraft } from "./scene-storage.mjs";
import { createSceneUi } from "./scene-ui.js";

function isStoppedError(error) {
  return (
    error instanceof Error &&
    (error.message === "Generation stopped." || error.status === 499)
  );
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
          sceneSnapshot.model,
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
    updateScene(applySceneWorkspace(scene, workspace));
  }

  function handleFieldChange(fieldName, value) {
    updateScene((currentScene) => applySceneFieldChange(currentScene, fieldName, value));
  }

  function openCharacterDialog(characterId) {
    ui.openCharacterDialog(characterId, scene.characters[characterId]);
  }

  function saveCharacter(characterId, characterDraft) {
    updateScene((currentScene) =>
      applyCharacterSave(currentScene, characterId, characterDraft),
    );
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
    const beatResult = applyBeatSave(scene, beatId, beatInput);

    if (beatResult.error) {
      ui.setBeatError(beatResult.error);
      return;
    }

    updateScene(beatResult.scene);

    ui.closeBeatDialog();
  }

  function deleteBeat(beatId) {
    updateScene((currentScene) => applyBeatDelete(currentScene, beatId));
  }

  function openSetup() {
    updateScene(openSceneSetup(scene));
  }

  function backToRun() {
    updateScene(returnSceneToRun(scene));
  }

  function startScene() {
    updateScene(prepareSceneStart(scene));
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
