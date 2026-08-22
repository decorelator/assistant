export function bindSceneUiEvents(dom, dialogs, handlers) {
  const {
    onAddBeat,
    onBackToRun,
    onContinue,
    onDeleteBeat,
    onEditBeat,
    onFieldChange,
    onGenerate,
    onOpenSetup,
    onPause,
    onResume,
    onRetry,
    onSaveBeat,
    onSaveCharacter,
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

    const characterId = target.getAttribute("data-scene-edit-character");
    if (characterId) {
      onSaveCharacter?.("open", characterId);
      return;
    }

    if (target.hasAttribute("data-scene-generate")) {
      onGenerate?.();
      return;
    }

    if (target.hasAttribute("data-scene-pause")) {
      onPause?.();
      return;
    }

    if (target.hasAttribute("data-scene-resume")) {
      onResume?.();
      return;
    }

    if (target.hasAttribute("data-scene-continue")) {
      onContinue?.();
      return;
    }

    if (target.hasAttribute("data-scene-retry")) {
      onRetry?.();
      return;
    }

    if (target.hasAttribute("data-scene-stop")) {
      onStop?.();
      return;
    }

    if (
      target.hasAttribute("data-scene-open-setup") ||
      target.hasAttribute("data-scene-open-setup-mobile")
    ) {
      onOpenSetup?.();
      return;
    }

    if (target.hasAttribute("data-scene-back-to-run")) {
      onBackToRun?.();
      return;
    }

    if (target.hasAttribute("data-scene-add-beat")) {
      onAddBeat?.();
      return;
    }

    const editBeatId = target.getAttribute("data-scene-edit-beat");
    if (editBeatId) {
      onEditBeat?.(editBeatId);
      return;
    }

    const deleteBeatId = target.getAttribute("data-scene-delete-beat");
    if (deleteBeatId) {
      onDeleteBeat?.(deleteBeatId);
    }
  });

  dom.characterForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const editingCharacterId = dialogs.getEditingCharacterId();

    if (!editingCharacterId) {
      return;
    }

    onSaveCharacter?.("save", editingCharacterId, {
      name: dom.characterNameInput?.value ?? "",
      card: dom.characterCardInput?.value ?? "",
    });
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

  dom.beatCancelButton?.addEventListener("click", () => {
    dialogs.closeBeatDialog();
  });
}
