import { formatModelOptionLabel, renderSelectOptions } from "../../ui/selects.js";
import {
  SCENE_STATUS,
  SCENE_VIEW,
  SCENE_WORKSPACE,
  SCENE_CHARACTER_IDS,
} from "../scene-state-constants.mjs";
import { normalizeSceneDraft } from "../scene-state-schema.mjs";
import {
  getCurrentSpeaker,
  getSceneRunPairLabel,
  isSceneChatLocked,
} from "../scene-state-selectors.mjs";
import { createSceneDialogs } from "./dialogs.js";
import { getSceneUiDom, setHidden, setText, syncValue } from "./dom.js";
import { bindSceneUiEvents } from "./events.js";
import { renderBeatList } from "./render-beats.js";
import { renderSceneTranscript } from "./render-transcript.js";

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

function getCharacterFallbackName(characterId) {
  return `Character ${characterId}`;
}

function getCharacterPreview(card, characterId) {
  const text = typeof card === "string" ? card.trim() : "";

  if (text) {
    return text;
  }

  return characterId === "A"
    ? "Add a card to define this speaker. (Reminder: Character A is the male character.)"
    : "Add a card to define this speaker. (Reminder: Character B is the female character.)";
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

export function createSceneUi() {
  const dom = getSceneUiDom();
  const dialogs = createSceneDialogs(dom);

  function bind(handlers) {
    bindSceneUiEvents(dom, dialogs, handlers);
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

    dom.mainElement?.classList.toggle(
      "is-scene-workspace",
      scene.workspace === SCENE_WORKSPACE.SCENE,
    );
    if (dom.chatWorkspace) {
      dom.chatWorkspace.hidden = scene.workspace !== SCENE_WORKSPACE.CHAT;
    }
    if (dom.sceneWorkspace) {
      dom.sceneWorkspace.hidden = scene.workspace !== SCENE_WORKSPACE.SCENE;
    }
    if (dom.setupScreen) {
      dom.setupScreen.hidden = scene.view !== SCENE_VIEW.SETUP;
    }
    if (dom.runScreen) {
      dom.runScreen.hidden = scene.view !== SCENE_VIEW.RUN;
    }

    for (const button of dom.workspaceButtons) {
      const targetWorkspace = button.getAttribute("data-workspace-target");
      const isActive = targetWorkspace === scene.workspace;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.disabled = workspaceLocked && targetWorkspace === SCENE_WORKSPACE.CHAT;
    }

    setText(dom.setupTitle, sceneTitleValue);
    setText(dom.setupStatus, STATUS_LABELS[scene.status]);
    setText(
      dom.setupActionCopy,
      setupLocked
        ? "Scene is paused. You can edit only upcoming beats before returning to the run."
        : "Draft is saved locally and does not affect the regular chat history.",
    );
    setHidden(
      dom.backToRunButton,
      !(scene.transcript.length > 0 && scene.view === SCENE_VIEW.SETUP),
    );

    syncValue(dom.titleInput, scene.title);
    syncValue(dom.globalInstructionInput, scene.globalInstruction);
    syncValue(dom.contextInput, scene.context);
    syncValue(dom.modelInput, scene.model);
    syncValue(dom.exchangeCountInput, scene.exchangeCount);
    syncValue(dom.firstSpeakerSelect, scene.firstSpeaker);
    syncValue(dom.runModeSelect, scene.runMode);
    syncValue(dom.cooldownSelect, scene.cooldownSeconds);
    setText(dom.replyCountNote, `${scene.exchangeCount * 2} replies total.`);

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
      if (field) {
        field.disabled = setupLocked;
      }
    }

    for (const characterId of SCENE_CHARACTER_IDS) {
      const character = scene.characters[characterId];
      setText(
        document.querySelector(`[data-scene-character-name='${characterId}']`),
        character.name || getCharacterFallbackName(characterId),
      );
      setText(
        document.querySelector(`[data-scene-character-preview='${characterId}']`),
        getCharacterPreview(character.card, characterId),
      );
      const editButton = document.querySelector(`[data-scene-edit-character='${characterId}']`);
      if (editButton instanceof HTMLButtonElement) {
        editButton.disabled = setupLocked;
      }
    }

    if (dom.addBeatButton instanceof HTMLButtonElement) {
      dom.addBeatButton.disabled = false;
    }

    renderBeatList(dom.setupBeatList, scene, { editable: true });
    renderBeatList(dom.runBeatList, scene);
    renderBeatList(dom.runBeatListMobile, scene);

    setText(dom.runTitle, sceneTitleValue);
    setText(dom.runPair, getSceneRunPairLabel(scene));
    setText(dom.runStatus, STATUS_LABELS[scene.status]);
    setText(dom.currentSpeaker, getCurrentSpeakerLabel(scene));
    setText(dom.currentStatus, STATUS_LABELS[scene.status]);
    setText(
      dom.countdown,
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

    renderSceneTranscript(dom.transcriptList, scene);

    setHidden(dom.runEmpty, scene.transcript.length > 0);
    setHidden(dom.runError, scene.status !== SCENE_STATUS.ERROR || !scene.lastError);
    setText(dom.runError, scene.lastError);

    setHidden(
      dom.pauseButton,
      ![SCENE_STATUS.GENERATING, SCENE_STATUS.COOLING_DOWN].includes(scene.status),
    );
    setHidden(dom.resumeButton, scene.status !== SCENE_STATUS.PAUSED);
    setHidden(dom.continueButton, scene.status !== SCENE_STATUS.WAITING_FOR_CONTINUE);
    setHidden(dom.retryButton, scene.status !== SCENE_STATUS.ERROR);
    setHidden(
      dom.stopButton,
      ![
        SCENE_STATUS.GENERATING,
        SCENE_STATUS.COOLING_DOWN,
        SCENE_STATUS.PAUSED,
        SCENE_STATUS.WAITING_FOR_CONTINUE,
        SCENE_STATUS.ERROR,
      ].includes(scene.status),
    );

    if (dom.pauseButton instanceof HTMLButtonElement) {
      dom.pauseButton.disabled = scene.pauseRequested;
      dom.pauseButton.textContent = scene.pauseRequested ? "Pause pending" : "Pause";
    }

    if (dom.openSetupButton instanceof HTMLButtonElement) {
      dom.openSetupButton.disabled =
        scene.status === SCENE_STATUS.GENERATING ||
        scene.status === SCENE_STATUS.COOLING_DOWN;
    }

    if (dom.openSetupMobileButton instanceof HTMLButtonElement) {
      dom.openSetupMobileButton.disabled =
        scene.status === SCENE_STATUS.GENERATING ||
        scene.status === SCENE_STATUS.COOLING_DOWN;
    }

    if (dom.generateButton instanceof HTMLButtonElement) {
      dom.generateButton.disabled =
        !scene.model ||
        !scene.characters.A.card.trim() ||
        !scene.characters.B.card.trim();
    }

    renderSelectOptions(dom.modelInput, availableModels, {
      emptyLabel: "No models available",
      getValue: (model) => model?.name ?? "",
      getLabel: formatModelOptionLabel,
      selectedValue: dom.modelInput?.value ?? "",
    });
  }

  return {
    bind,
    closeBeatDialog: dialogs.closeBeatDialog,
    closeCharacterDialog: dialogs.closeCharacterDialog,
    openBeatDialog: dialogs.openBeatDialog,
    openCharacterDialog: dialogs.openCharacterDialog,
    render,
    setBeatError: dialogs.setBeatError,
  };
}
