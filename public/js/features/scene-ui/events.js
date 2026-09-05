import { flattenCharacterTagGroups } from "./character-cards.js";

function getSelectedCharacterGender(dom) {
  const selectedInput = dom.characterGenderInputs?.find((input) => input.checked);
  return selectedInput?.value ?? "";
}

function getCharacterAge(dom) {
  const age = Number.parseInt(dom.characterAgeInput?.value ?? "", 10);
  return Number.isInteger(age) && age > 0 && age <= 999 ? age : null;
}

function readCharacterDraft(dom, dialogs) {
  return {
    title: dom.characterTitleInput?.value ?? "",
    name: dom.characterNameInput?.value ?? "",
    gender: getSelectedCharacterGender(dom),
    age: getCharacterAge(dom),
    card: dom.characterCardInput?.value ?? "",
    tags: flattenCharacterTagGroups(dialogs.getCharacterTagGroups?.()),
    sourceCardId: Number(dom.characterForm?.dataset.sourceCardId || 0) || null,
    sourceCardTitle: dom.characterForm?.dataset.sourceCardTitle || "",
  };
}

function readSceneCardDraft(dom, dialogs) {
  return {
    type: dialogs.getSceneCardLibraryType?.() ?? "instruction",
    title: dom.sceneCardTitleInput?.value ?? "",
    description: dom.sceneCardDescriptionInput?.value ?? "",
    text: dom.sceneCardTextInput?.value ?? "",
  };
}

export function bindSceneUiEvents(dom, dialogs, handlers) {
  const {
    onAddBeat,
    onBackToRun,
    onContinue,
    onDeleteBeat,
    onEditBeat,
    onFieldChange,
    onGenerate,
    onLoadCharacter,
    onLibrarySearch,
    onLibraryTagToggle,
    onLoadSceneCard,
    onOpenSetup,
    onPause,
    onResume,
    onRetry,
    onSaveBeat,
    onSaveCharacter,
    onSaveCharacterToLibrary,
    onSaveSceneCard,
    onSceneCardDelete,
    onSceneCardEdit,
    onSceneCardLibrarySearch,
    onSceneCardRemove,
    onSceneCardUse,
    onUseCharacterCard,
    onStop,
    onWorkspaceChange,
  } = handlers;

  for (const button of dom.workspaceButtons) {
    button.addEventListener("click", () => {
      onWorkspaceChange?.(button.getAttribute("data-workspace-target"));
    });
  }

  for (const field of [
    dom.titleInput,
    dom.globalInstructionInput,
    dom.contextInput,
    dom.modelInput,
    dom.exchangeCountInput,
    dom.firstSpeakerSelect,
    dom.runModeSelect,
    dom.cooldownSelect,
  ]) {
    field?.addEventListener("input", () => {
      const fieldName = field.getAttribute("data-scene-field");
      if (fieldName) {
        onFieldChange?.(fieldName, field.value);
      }
    });
    field?.addEventListener("change", () => {
      const fieldName = field.getAttribute("data-scene-field");
      if (fieldName) {
        onFieldChange?.(fieldName, field.value);
      }
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const actionTarget = target.closest("button, [data-scene-edit-beat], [data-scene-delete-beat]");

    if (!(actionTarget instanceof HTMLElement)) {
      return;
    }

    const characterId = actionTarget.getAttribute("data-scene-edit-character");
    if (characterId) {
      onSaveCharacter?.("open", characterId);
      return;
    }

    const loadCharacterId = actionTarget.getAttribute("data-scene-load-character");
    if (loadCharacterId) {
      onLoadCharacter?.(loadCharacterId);
      return;
    }

    const libraryTagId = actionTarget.getAttribute("data-scene-character-library-tag");
    if (libraryTagId) {
      onLibraryTagToggle?.(libraryTagId);
      return;
    }

    const characterCardId = actionTarget.getAttribute("data-scene-use-character-card");
    if (characterCardId) {
      onUseCharacterCard?.(characterCardId);
      return;
    }

    const loadSceneCardType = actionTarget.getAttribute("data-scene-load-card");
    if (loadSceneCardType) {
      onLoadSceneCard?.(loadSceneCardType);
      return;
    }

    const removeSceneCardId = actionTarget.getAttribute("data-scene-remove-card");
    if (removeSceneCardId) {
      onSceneCardRemove?.(
        actionTarget.getAttribute("data-scene-card-type"),
        removeSceneCardId,
      );
      return;
    }

    const sceneCardId = actionTarget.getAttribute("data-scene-use-card");
    if (sceneCardId) {
      onSceneCardUse?.(sceneCardId);
      return;
    }

    const editSceneCardId = actionTarget.getAttribute("data-scene-edit-card");
    if (editSceneCardId) {
      onSceneCardEdit?.(editSceneCardId);
      return;
    }

    const deleteSceneCardId = actionTarget.getAttribute("data-scene-delete-card");
    if (deleteSceneCardId) {
      onSceneCardDelete?.(deleteSceneCardId);
      return;
    }

    const removeTagKind = actionTarget.getAttribute("data-scene-tag-remove");
    if (removeTagKind) {
      dialogs.removeCharacterTag?.(removeTagKind, actionTarget.getAttribute("data-scene-tag-name"));
      return;
    }

    const suggestionKind = actionTarget.getAttribute("data-scene-tag-suggestion");
    if (suggestionKind) {
      dialogs.addCharacterTag?.(suggestionKind, actionTarget.getAttribute("data-scene-tag-name"));
      return;
    }

    if (actionTarget.hasAttribute("data-scene-generate")) {
      onGenerate?.();
      return;
    }

    if (actionTarget.hasAttribute("data-scene-pause")) {
      onPause?.();
      return;
    }

    if (actionTarget.hasAttribute("data-scene-resume")) {
      onResume?.();
      return;
    }

    if (actionTarget.hasAttribute("data-scene-continue")) {
      onContinue?.();
      return;
    }

    if (actionTarget.hasAttribute("data-scene-retry")) {
      onRetry?.();
      return;
    }

    if (actionTarget.hasAttribute("data-scene-stop")) {
      onStop?.();
      return;
    }

    if (
      actionTarget.hasAttribute("data-scene-open-setup") ||
      actionTarget.hasAttribute("data-scene-open-setup-mobile")
    ) {
      onOpenSetup?.();
      return;
    }

    if (actionTarget.hasAttribute("data-scene-back-to-run")) {
      onBackToRun?.();
      return;
    }

    if (actionTarget.hasAttribute("data-scene-add-beat")) {
      onAddBeat?.();
      return;
    }

    if (actionTarget.hasAttribute("data-scene-character-library-close")) {
      dialogs.closeCharacterLibraryDialog();
      return;
    }

    if (actionTarget.hasAttribute("data-scene-card-library-close")) {
      dialogs.closeSceneCardLibraryDialog();
      return;
    }

    if (actionTarget.hasAttribute("data-scene-card-new")) {
      dialogs.resetSceneCardForm();
      return;
    }

    if (actionTarget.hasAttribute("data-scene-character-open-library")) {
      const editingCharacterId = dialogs.getEditingCharacterId();

      if (editingCharacterId) {
        dialogs.closeCharacterDialog();
        onLoadCharacter?.(editingCharacterId);
      }
      return;
    }

    if (actionTarget.hasAttribute("data-scene-character-save-library")) {
      const editingCharacterId = dialogs.getEditingCharacterId();

      if (editingCharacterId) {
        onSaveCharacterToLibrary?.(editingCharacterId, readCharacterDraft(dom, dialogs));
      }
      return;
    }

    const editBeatId = actionTarget.getAttribute("data-scene-edit-beat");
    if (editBeatId) {
      onEditBeat?.(editBeatId);
      return;
    }

    const deleteBeatId = actionTarget.getAttribute("data-scene-delete-beat");
    if (deleteBeatId) {
      onDeleteBeat?.(deleteBeatId);
    }
  });

  dom.characterLibrarySearch?.addEventListener("input", () => {
    onLibrarySearch?.(dom.characterLibrarySearch?.value ?? "");
  });

  dom.sceneCardLibrarySearch?.addEventListener("input", () => {
    onSceneCardLibrarySearch?.(dom.sceneCardLibrarySearch?.value ?? "");
  });

  for (const input of dom.characterTagEditorInputs ?? []) {
    input.addEventListener("input", () => {
      dialogs.refreshCharacterTagEditor?.();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      const kind = input.getAttribute("data-scene-tag-editor-input");
      dialogs.addCharacterTag?.(kind, input.value);
    });
  }

  dom.characterForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const editingCharacterId = dialogs.getEditingCharacterId();

    if (!editingCharacterId) {
      return;
    }

    onSaveCharacter?.("save", editingCharacterId, readCharacterDraft(dom, dialogs));
  });

  dom.characterCancelButton?.addEventListener("click", () => {
    dialogs.closeCharacterDialog();
  });

  dom.beatForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    onSaveBeat?.(dialogs.getEditingBeatId(), {
      pairNumber: dom.beatPairInput?.value ?? "",
      moment: dom.beatMomentInput?.value ?? "",
      text: dom.beatTextInput?.value ?? "",
    });
  });

  dom.sceneCardForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    onSaveSceneCard?.(dialogs.getEditingSceneCardId(), readSceneCardDraft(dom, dialogs));
  });

  dom.beatCancelButton?.addEventListener("click", () => {
    dialogs.closeBeatDialog();
  });
}
