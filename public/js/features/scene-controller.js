import {
  createCharacterCard,
  loadCharacterCards,
  loadCharacterTags,
  loadModels,
  sendMessage,
  stopGeneration,
  updateCharacterCard,
} from "../api.js";
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
  let characterLibraryCards = [];
  let characterLibraryTags = [];
  let characterLibrarySearch = "";
  let activeCharacterLibraryTagIds = [];
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
      renderScene();
    },
  });

  function renderScene() {
    ui.render(scene, {
      availableModels,
      characterLibraryCards,
      characterLibraryTags,
      activeCharacterLibraryTagIds,
    });
  }

  function updateScene(patch) {
    scene = normalizeSceneDraft(
      typeof patch === "function" ? patch(cloneSceneDraft(scene)) : patch,
    );
    saveSceneDraft(scene);
    runner.replaceScene(scene);
    renderScene();
  }

  async function ensureModelsLoaded() {
    try {
      availableModels = await loadModels();
    } catch {
      availableModels = [];
    }

    renderScene();
  }

  async function refreshCharacterLibrary() {
    try {
      const [cards, tags] = await Promise.all([
        loadCharacterCards({
          q: characterLibrarySearch,
          tagIds: activeCharacterLibraryTagIds,
        }),
        loadCharacterTags(),
      ]);
      characterLibraryCards = cards;
      characterLibraryTags = tags;
      ui.setLibraryError("");
    } catch (error) {
      characterLibraryCards = [];
      characterLibraryTags = [];
      ui.setLibraryError(
        error instanceof Error ? error.message : "Could not load character library.",
      );
    }

    renderScene();
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

  function openCharacterLibrary(characterId) {
    ui.openCharacterLibraryDialog(characterId);
    void refreshCharacterLibrary();
  }

  function saveCharacter(characterId, characterDraft) {
    updateScene((currentScene) =>
      applyCharacterSave(currentScene, characterId, {
        ...characterDraft,
        sourceCardTitle: characterDraft.sourceCardId ? characterDraft.title : "",
      }),
    );
    ui.closeCharacterDialog();
  }

  async function saveCharacterToLibrary(characterId, characterDraft) {
    const input = {
      title: characterDraft.title,
      characterName: characterDraft.name,
      gender: characterDraft.gender,
      age: characterDraft.age,
      cardText: characterDraft.card,
      tags: characterDraft.tags,
    };

    try {
      const savedCard = characterDraft.sourceCardId
        ? await updateCharacterCard(characterDraft.sourceCardId, input)
        : await createCharacterCard(input);

      if (!savedCard) {
        ui.setCharacterError("Could not save character card.");
        return;
      }

      updateScene((currentScene) =>
        applyCharacterSave(currentScene, characterId, {
          name: savedCard.characterName,
          gender: savedCard.gender,
          age: savedCard.age,
          card: savedCard.cardText,
          sourceCardId: savedCard.id,
          sourceCardTitle: savedCard.title,
          tags: savedCard.tags,
        }),
      );
      ui.openCharacterDialog(characterId, scene.characters[characterId]);
      await refreshCharacterLibrary();
    } catch (error) {
      ui.setCharacterError(
        error instanceof Error ? error.message : "Could not save character card.",
      );
    }
  }

  function useCharacterCard(cardIdParam) {
    const cardId = Number.parseInt(cardIdParam, 10);
    const card = characterLibraryCards.find((entry) => entry.id === cardId);

    if (!card) {
      ui.setLibraryError("Character card not found.");
      return;
    }

    const characterId = ui.getEditingCharacterId?.();

    if (!characterId) {
      ui.setLibraryError("Choose a character slot first.");
      return;
    }

    updateScene((currentScene) =>
      applyCharacterSave(currentScene, characterId, {
        name: card.characterName,
        gender: card.gender,
        age: card.age,
        card: card.cardText,
        sourceCardId: card.id,
        sourceCardTitle: card.title,
        tags: card.tags,
      }),
    );
    ui.closeCharacterLibraryDialog();
  }

  function setLibrarySearch(value) {
    characterLibrarySearch = typeof value === "string" ? value : "";
    void refreshCharacterLibrary();
  }

  function toggleLibraryTag(tagIdParam) {
    const tagId = Number.parseInt(tagIdParam, 10);

    if (!Number.isInteger(tagId) || tagId <= 0) {
      return;
    }

    activeCharacterLibraryTagIds = activeCharacterLibraryTagIds.includes(tagId)
      ? activeCharacterLibraryTagIds.filter((entry) => entry !== tagId)
      : [...activeCharacterLibraryTagIds, tagId];
    void refreshCharacterLibrary();
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
      onLoadCharacter: openCharacterLibrary,
      onLibrarySearch: setLibrarySearch,
      onLibraryTagToggle: toggleLibraryTag,
      onUseCharacterCard: useCharacterCard,
      onSaveCharacter(action, characterId, characterDraft) {
        if (action === "open") {
          openCharacterDialog(characterId);
          return;
        }

        saveCharacter(characterId, characterDraft);
      },
      onSaveCharacterToLibrary(characterId, characterDraft) {
        void saveCharacterToLibrary(characterId, characterDraft);
      },
      onSaveBeat: saveBeat,
    });

    renderScene();
    void ensureModelsLoaded();
    void refreshCharacterLibrary();
  }

  return {
    initialize,
  };
}
