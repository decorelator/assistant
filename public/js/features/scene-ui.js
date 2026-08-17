import { formatModelOptionLabel, renderSelectOptions } from "../ui/selects.js";
import {
  canEditBeatInRun,
  getBeatProgressStatus,
  getCurrentSpeaker,
  getSceneRunPairLabel,
  isSceneChatLocked,
  normalizeSceneDraft,
  SCENE_BEAT_MOMENT,
  SCENE_STATUS,
  SCENE_VIEW,
  SCENE_WORKSPACE,
} from "./scene-state.mjs";

const STATUS_LABELS = {
  [SCENE_STATUS.DRAFT]: "Draft",
  [SCENE_STATUS.GENERATING]: "Generating",
  [SCENE_STATUS.COOLING_DOWN]: "Cooling down",
  [SCENE_STATUS.PAUSED]: "Paused",
  [SCENE_STATUS.WAITING_FOR_CONTINUE]: "Waiting",
  [SCENE_STATUS.STOPPED]: "Stopped",
  [SCENE_STATUS.COMPLETED]: "Completed",
  [SCENE_STATUS.ERROR]: "Error",
};

const MOMENT_LABELS = {
  [SCENE_BEAT_MOMENT.BEFORE_A]: "Before A",
  [SCENE_BEAT_MOMENT.BEFORE_B]: "Before B",
  [SCENE_BEAT_MOMENT.PAIR]: "Whole pair",
};

function getCharacterFallbackName(characterId) {
  return `Character ${characterId}`;
}

function getCharacterPreview(card) {
  const text = typeof card === "string" ? card.trim() : "";
  return text || "Add a card to define this speaker.";
}

function syncValue(element, value) {
  if (!element) {
    return;
  }

  const normalizedValue = String(value ?? "");

  if (element.value !== normalizedValue) {
    element.value = normalizedValue;
  }
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function setHidden(element, isHidden) {
  if (element) {
    element.hidden = isHidden;
  }
}

function formatCountdown(countdownRemainingMs) {
  if (countdownRemainingMs <= 0) {
    return "Ready";
  }

  return `${(countdownRemainingMs / 1000).toFixed(1)}s remaining`;
}

function getCurrentSpeakerLabel(scene) {
  const speaker = getCurrentSpeaker(scene);

  if (!speaker) {
    return "Completed";
  }

  return scene.characters[speaker]?.name || getCharacterFallbackName(speaker);
}

function renderBeatList(listElement, scene, options = {}) {
  if (!listElement) {
    return;
  }

  const { editable = false } = options;

  listElement.innerHTML = "";

  if (scene.beats.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "scene-beat-item scene-beat-item-empty";
    emptyItem.textContent = "No director beats yet.";
    listElement.appendChild(emptyItem);
    return;
  }

  for (const beat of scene.beats) {
    const item = document.createElement("li");
    const progressStatus = getBeatProgressStatus(scene, beat);
    item.className = `scene-beat-item scene-beat-item-${progressStatus}`;

    const heading = document.createElement("div");
    heading.className = "scene-beat-item-heading";

    const meta = document.createElement("div");
    meta.className = "scene-beat-item-meta";
    meta.textContent = `Pair ${beat.pairNumber} • ${MOMENT_LABELS[beat.moment]}`;

    const badge = document.createElement("span");
    badge.className = `scene-beat-status scene-beat-status-${progressStatus}`;
    badge.textContent = progressStatus;

    heading.appendChild(meta);
    heading.appendChild(badge);
    item.appendChild(heading);

    const text = document.createElement("p");
    text.className = "scene-beat-text";
    text.textContent = beat.text;
    item.appendChild(text);

    if (editable) {
      const actions = document.createElement("div");
      actions.className = "scene-beat-actions";
      const canEdit = canEditBeatInRun(scene, beat);

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "button-secondary scene-compact-button";
      editButton.textContent = "Edit";
      editButton.disabled = !canEdit;
      editButton.setAttribute("data-scene-edit-beat", beat.id);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "button-secondary scene-compact-button";
      deleteButton.textContent = "Delete";
      deleteButton.disabled = !canEdit;
      deleteButton.setAttribute("data-scene-delete-beat", beat.id);

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      item.appendChild(actions);
    }

    listElement.appendChild(item);
  }
}

export function createSceneUi() {
  const mainElement = document.querySelector("[data-app-main]");
  const workspaceButtons = Array.from(document.querySelectorAll("[data-workspace-button]"));
  const chatWorkspace = document.querySelector("[data-chat-workspace]");
  const sceneWorkspace = document.querySelector("[data-scene-workspace]");
  const setupScreen = document.querySelector("[data-scene-setup-screen]");
  const runScreen = document.querySelector("[data-scene-run-screen]");
  const setupTitle = document.querySelector("[data-scene-setup-title]");
  const setupStatus = document.querySelector("[data-scene-setup-status]");
  const setupActionCopy = document.querySelector("[data-scene-setup-action-copy]");
  const backToRunButton = document.querySelector("[data-scene-back-to-run]");
  const generateButton = document.querySelector("[data-scene-generate]");
  const titleInput = document.querySelector("[data-scene-field='title']");
  const globalInstructionInput = document.querySelector("[data-scene-field='globalInstruction']");
  const contextInput = document.querySelector("[data-scene-field='context']");
  const exchangeCountInput = document.querySelector("[data-scene-field='exchangeCount']");
  const firstSpeakerSelect = document.querySelector("[data-scene-field='firstSpeaker']");
  const runModeSelect = document.querySelector("[data-scene-field='runMode']");
  const cooldownSelect = document.querySelector("[data-scene-field='cooldownSeconds']");
  const replyCountNote = document.querySelector("[data-scene-reply-count-note]");
  const setupBeatList = document.querySelector("[data-scene-setup-beat-list]");
  const addBeatButton = document.querySelector("[data-scene-add-beat]");
  const runTitle = document.querySelector("[data-scene-run-title]");
  const runPair = document.querySelector("[data-scene-run-pair]");
  const runStatus = document.querySelector("[data-scene-run-status]");
  const currentSpeaker = document.querySelector("[data-scene-current-speaker]");
  const currentStatus = document.querySelector("[data-scene-current-status]");
  const countdown = document.querySelector("[data-scene-countdown]");
  const transcriptList = document.querySelector("[data-scene-transcript]");
  const runEmpty = document.querySelector("[data-scene-run-empty]");
  const runError = document.querySelector("[data-scene-run-error]");
  const pauseButton = document.querySelector("[data-scene-pause]");
  const resumeButton = document.querySelector("[data-scene-resume]");
  const continueButton = document.querySelector("[data-scene-continue]");
  const retryButton = document.querySelector("[data-scene-retry]");
  const stopButton = document.querySelector("[data-scene-stop]");
  const openSetupButton = document.querySelector("[data-scene-open-setup]");
  const openSetupMobileButton = document.querySelector("[data-scene-open-setup-mobile]");
  const runBeatList = document.querySelector("[data-scene-run-beat-list]");
  const runBeatListMobile = document.querySelector("[data-scene-run-beat-list-mobile]");
  const characterDialog = document.querySelector("[data-scene-character-dialog]");
  const characterDialogTitle = document.querySelector("[data-scene-character-dialog-title]");
  const characterForm = document.querySelector("[data-scene-character-form]");
  const characterNameInput = document.querySelector("#scene-character-name-input");
  const characterModelInput = document.querySelector("#scene-character-model-input");
  const characterCardInput = document.querySelector("#scene-character-card-input");
  const characterCancelButton = document.querySelector("[data-scene-character-cancel]");
  const beatDialog = document.querySelector("[data-scene-beat-dialog]");
  const beatDialogTitle = document.querySelector("[data-scene-beat-dialog-title]");
  const beatForm = document.querySelector("[data-scene-beat-form]");
  const beatPairInput = document.querySelector("#scene-beat-pair-input");
  const beatMomentInput = document.querySelector("#scene-beat-moment-input");
  const beatTextInput = document.querySelector("#scene-beat-text-input");
  const beatError = document.querySelector("[data-scene-beat-error]");
  const beatCancelButton = document.querySelector("[data-scene-beat-cancel]");
  let editingCharacterId = null;
  let editingBeatId = null;

  function bind({
    onWorkspaceChange,
    onFieldChange,
    onGenerate,
    onPause,
    onResume,
    onContinue,
    onRetry,
    onStop,
    onOpenSetup,
    onBackToRun,
    onAddBeat,
    onEditBeat,
    onDeleteBeat,
    onSaveCharacter,
    onSaveBeat,
  }) {
    for (const button of workspaceButtons) {
      button.addEventListener("click", () => {
        onWorkspaceChange?.(button.getAttribute("data-workspace-target"));
      });
    }

    for (const field of [titleInput, globalInstructionInput, contextInput, exchangeCountInput, firstSpeakerSelect, runModeSelect, cooldownSelect]) {
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

    characterForm?.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!editingCharacterId) {
        return;
      }

      onSaveCharacter?.("save", editingCharacterId, {
        name: characterNameInput?.value ?? "",
        model: characterModelInput?.value ?? "",
        card: characterCardInput?.value ?? "",
      });
    });

    characterCancelButton?.addEventListener("click", () => {
      closeCharacterDialog();
    });

    beatForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      onSaveBeat?.(editingBeatId, {
        pairNumber: beatPairInput?.value ?? "",
        moment: beatMomentInput?.value ?? "",
        text: beatTextInput?.value ?? "",
      });
    });

    beatCancelButton?.addEventListener("click", () => {
      closeBeatDialog();
    });
  }

  function render(sceneInput, { availableModels = [] } = {}) {
    const scene = normalizeSceneDraft(sceneInput);
    const setupLocked =
      scene.view === SCENE_VIEW.SETUP &&
      scene.transcript.length > 0 &&
      (scene.status === SCENE_STATUS.PAUSED ||
        scene.status === SCENE_STATUS.WAITING_FOR_CONTINUE ||
        scene.status === SCENE_STATUS.ERROR);
    const workspaceLocked = isSceneChatLocked(scene);
    const sceneTitleValue = scene.title.trim() || "Untitled scene";

    mainElement?.classList.toggle("is-scene-workspace", scene.workspace === SCENE_WORKSPACE.SCENE);
    chatWorkspace && (chatWorkspace.hidden = scene.workspace !== SCENE_WORKSPACE.CHAT);
    sceneWorkspace && (sceneWorkspace.hidden = scene.workspace !== SCENE_WORKSPACE.SCENE);
    setupScreen && (setupScreen.hidden = scene.view !== SCENE_VIEW.SETUP);
    runScreen && (runScreen.hidden = scene.view !== SCENE_VIEW.RUN);

    for (const button of workspaceButtons) {
      const targetWorkspace = button.getAttribute("data-workspace-target");
      const isActive = targetWorkspace === scene.workspace;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.disabled = workspaceLocked && targetWorkspace === SCENE_WORKSPACE.CHAT;
    }

    setText(setupTitle, sceneTitleValue);
    setText(setupStatus, STATUS_LABELS[scene.status]);
    setText(
      setupActionCopy,
      setupLocked
        ? "Scene is paused. You can edit only upcoming beats before returning to the run."
        : "Draft is saved locally and does not affect the regular chat history.",
    );
    setHidden(backToRunButton, !(scene.transcript.length > 0 && scene.view === SCENE_VIEW.SETUP));

    syncValue(titleInput, scene.title);
    syncValue(globalInstructionInput, scene.globalInstruction);
    syncValue(contextInput, scene.context);
    syncValue(exchangeCountInput, scene.exchangeCount);
    syncValue(firstSpeakerSelect, scene.firstSpeaker);
    syncValue(runModeSelect, scene.runMode);
    syncValue(cooldownSelect, scene.cooldownSeconds);
    setText(replyCountNote, `${scene.exchangeCount * 2} replies total.`);

    for (const field of [titleInput, globalInstructionInput, contextInput, exchangeCountInput, firstSpeakerSelect, runModeSelect, cooldownSelect]) {
      if (field) {
        field.disabled = setupLocked;
      }
    }

    for (const characterId of ["A", "B"]) {
      const character = scene.characters[characterId];
      setText(
        document.querySelector(`[data-scene-character-name='${characterId}']`),
        character.name || getCharacterFallbackName(characterId),
      );
      setText(
        document.querySelector(`[data-scene-character-model='${characterId}']`),
        character.model || "Model not selected",
      );
      setText(
        document.querySelector(`[data-scene-character-preview='${characterId}']`),
        getCharacterPreview(character.card),
      );
      const editButton = document.querySelector(`[data-scene-edit-character='${characterId}']`);
      if (editButton instanceof HTMLButtonElement) {
        editButton.disabled = setupLocked;
      }
    }

    if (addBeatButton instanceof HTMLButtonElement) {
      addBeatButton.disabled = false;
    }

    renderBeatList(setupBeatList, scene, { editable: true });
    renderBeatList(runBeatList, scene);
    renderBeatList(runBeatListMobile, scene);

    setText(runTitle, sceneTitleValue);
    setText(runPair, getSceneRunPairLabel(scene));
    setText(runStatus, STATUS_LABELS[scene.status]);
    setText(currentSpeaker, getCurrentSpeakerLabel(scene));
    setText(currentStatus, STATUS_LABELS[scene.status]);
    setText(
      countdown,
      scene.status === SCENE_STATUS.COOLING_DOWN || scene.countdownRemainingMs > 0
        ? formatCountdown(scene.countdownRemainingMs)
        : scene.status === SCENE_STATUS.WAITING_FOR_CONTINUE
          ? "Waiting for Continue"
          : scene.status === SCENE_STATUS.PAUSED
            ? scene.countdownRemainingMs > 0
              ? `Paused with ${formatCountdown(scene.countdownRemainingMs)}`
              : "Paused"
            : "Not running",
    );

    if (transcriptList) {
      transcriptList.innerHTML = "";

      for (const line of scene.transcript) {
        const item = document.createElement("li");
        item.className = `scene-transcript-item scene-transcript-item-${line.speaker.toLowerCase()}`;

        const header = document.createElement("div");
        header.className = "scene-transcript-header";
        header.textContent = `${line.characterName} • Pair ${line.pairNumber}${line.model ? ` • ${line.model}` : ""}`;

        const text = document.createElement("p");
        text.className = "scene-transcript-text";
        text.textContent = line.text;

        item.appendChild(header);
        item.appendChild(text);
        transcriptList.appendChild(item);
      }
    }

    setHidden(runEmpty, scene.transcript.length > 0);
    setHidden(runError, scene.status !== SCENE_STATUS.ERROR || !scene.lastError);
    setText(runError, scene.lastError);

    setHidden(pauseButton, ![SCENE_STATUS.GENERATING, SCENE_STATUS.COOLING_DOWN].includes(scene.status));
    setHidden(resumeButton, scene.status !== SCENE_STATUS.PAUSED);
    setHidden(continueButton, scene.status !== SCENE_STATUS.WAITING_FOR_CONTINUE);
    setHidden(retryButton, scene.status !== SCENE_STATUS.ERROR);
    setHidden(
      stopButton,
      ![
        SCENE_STATUS.GENERATING,
        SCENE_STATUS.COOLING_DOWN,
        SCENE_STATUS.PAUSED,
        SCENE_STATUS.WAITING_FOR_CONTINUE,
        SCENE_STATUS.ERROR,
      ].includes(scene.status),
    );

    if (pauseButton instanceof HTMLButtonElement) {
      pauseButton.disabled = scene.pauseRequested;
      pauseButton.textContent = scene.pauseRequested ? "Pause pending" : "Pause";
    }

    if (openSetupButton instanceof HTMLButtonElement) {
      openSetupButton.disabled =
        scene.status === SCENE_STATUS.GENERATING || scene.status === SCENE_STATUS.COOLING_DOWN;
    }

    if (openSetupMobileButton instanceof HTMLButtonElement) {
      openSetupMobileButton.disabled =
        scene.status === SCENE_STATUS.GENERATING || scene.status === SCENE_STATUS.COOLING_DOWN;
    }

    if (generateButton instanceof HTMLButtonElement) {
      generateButton.disabled =
        !scene.characters.A.model ||
        !scene.characters.B.model ||
        !scene.characters.A.card.trim() ||
        !scene.characters.B.card.trim();
    }

    renderSelectOptions(characterModelInput, availableModels, {
      emptyLabel: "No models available",
      getValue: (model) => model?.name ?? "",
      getLabel: formatModelOptionLabel,
      selectedValue: characterModelInput?.value ?? "",
    });
  }

  function openCharacterDialog(characterId, character, availableModels) {
    editingCharacterId = characterId;
    setText(
      characterDialogTitle,
      `Edit ${characterId === "A" ? "Character A" : "Character B"}`,
    );
    syncValue(characterNameInput, character.name || getCharacterFallbackName(characterId));
    syncValue(characterCardInput, character.card || "");
    renderSelectOptions(characterModelInput, availableModels, {
      emptyLabel: "No models available",
      getValue: (model) => model?.name ?? "",
      getLabel: formatModelOptionLabel,
      selectedValue: character.model ?? "",
    });
    characterDialog?.showModal();
    characterNameInput?.focus();
  }

  function closeCharacterDialog() {
    characterDialog?.close();
    editingCharacterId = null;
  }

  function openBeatDialog(beat, exchangeCount) {
    editingBeatId = beat?.id ?? null;
    setText(beatDialogTitle, beat ? "Edit beat" : "Add beat");
    syncValue(beatPairInput, beat?.pairNumber ?? Math.min(1, exchangeCount || 1));
    syncValue(beatMomentInput, beat?.moment ?? SCENE_BEAT_MOMENT.PAIR);
    syncValue(beatTextInput, beat?.text ?? "");
    setBeatError("");
    beatDialog?.showModal();
    beatTextInput?.focus();
  }

  function closeBeatDialog() {
    beatDialog?.close();
    editingBeatId = null;
    setBeatError("");
  }

  function setBeatError(message) {
    if (beatError) {
      beatError.textContent = message;
      beatError.hidden = !message;
    }
  }

  return {
    bind,
    closeBeatDialog,
    closeCharacterDialog,
    openBeatDialog,
    openCharacterDialog,
    render,
    setBeatError,
  };
}
