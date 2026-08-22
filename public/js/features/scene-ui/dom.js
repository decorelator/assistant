export function syncValue(element, value) {
  if (!element) {
    return;
  }

  const normalizedValue = String(value ?? "");

  if (element.value !== normalizedValue) {
    element.value = normalizedValue;
  }
}

export function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

export function setHidden(element, isHidden) {
  if (element) {
    element.hidden = isHidden;
  }
}

export function getSceneUiDom() {
  return {
    mainElement: document.querySelector("[data-app-main]"),
    workspaceButtons: Array.from(document.querySelectorAll("[data-workspace-button]")),
    chatWorkspace: document.querySelector("[data-chat-workspace]"),
    sceneWorkspace: document.querySelector("[data-scene-workspace]"),
    setupScreen: document.querySelector("[data-scene-setup-screen]"),
    runScreen: document.querySelector("[data-scene-run-screen]"),
    setupTitle: document.querySelector("[data-scene-setup-title]"),
    setupStatus: document.querySelector("[data-scene-setup-status]"),
    setupActionCopy: document.querySelector("[data-scene-setup-action-copy]"),
    backToRunButton: document.querySelector("[data-scene-back-to-run]"),
    generateButton: document.querySelector("[data-scene-generate]"),
    titleInput: document.querySelector("[data-scene-field='title']"),
    globalInstructionInput: document.querySelector("[data-scene-field='globalInstruction']"),
    contextInput: document.querySelector("[data-scene-field='context']"),
    modelInput: document.querySelector("[data-scene-field='model']"),
    exchangeCountInput: document.querySelector("[data-scene-field='exchangeCount']"),
    firstSpeakerSelect: document.querySelector("[data-scene-field='firstSpeaker']"),
    runModeSelect: document.querySelector("[data-scene-field='runMode']"),
    cooldownSelect: document.querySelector("[data-scene-field='cooldownSeconds']"),
    replyCountNote: document.querySelector("[data-scene-reply-count-note]"),
    setupBeatList: document.querySelector("[data-scene-setup-beat-list]"),
    addBeatButton: document.querySelector("[data-scene-add-beat]"),
    runTitle: document.querySelector("[data-scene-run-title]"),
    runPair: document.querySelector("[data-scene-run-pair]"),
    runStatus: document.querySelector("[data-scene-run-status]"),
    currentSpeaker: document.querySelector("[data-scene-current-speaker]"),
    currentStatus: document.querySelector("[data-scene-current-status]"),
    countdown: document.querySelector("[data-scene-countdown]"),
    transcriptList: document.querySelector("[data-scene-transcript]"),
    runEmpty: document.querySelector("[data-scene-run-empty]"),
    runError: document.querySelector("[data-scene-run-error]"),
    pauseButton: document.querySelector("[data-scene-pause]"),
    resumeButton: document.querySelector("[data-scene-resume]"),
    continueButton: document.querySelector("[data-scene-continue]"),
    retryButton: document.querySelector("[data-scene-retry]"),
    stopButton: document.querySelector("[data-scene-stop]"),
    openSetupButton: document.querySelector("[data-scene-open-setup]"),
    openSetupMobileButton: document.querySelector("[data-scene-open-setup-mobile]"),
    runBeatList: document.querySelector("[data-scene-run-beat-list]"),
    runBeatListMobile: document.querySelector("[data-scene-run-beat-list-mobile]"),
    characterDialog: document.querySelector("[data-scene-character-dialog]"),
    characterDialogTitle: document.querySelector("[data-scene-character-dialog-title]"),
    characterForm: document.querySelector("[data-scene-character-form]"),
    characterNameInput: document.querySelector("#scene-character-name-input"),
    characterCardInput: document.querySelector("#scene-character-card-input"),
    characterCancelButton: document.querySelector("[data-scene-character-cancel]"),
    beatDialog: document.querySelector("[data-scene-beat-dialog]"),
    beatDialogTitle: document.querySelector("[data-scene-beat-dialog-title]"),
    beatForm: document.querySelector("[data-scene-beat-form]"),
    beatPairInput: document.querySelector("#scene-beat-pair-input"),
    beatMomentInput: document.querySelector("#scene-beat-moment-input"),
    beatTextInput: document.querySelector("#scene-beat-text-input"),
    beatError: document.querySelector("[data-scene-beat-error]"),
    beatCancelButton: document.querySelector("[data-scene-beat-cancel]"),
  };
}
