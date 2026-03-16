import { createTranslatorModelOptions, createTranslatorSystemMessageOptions } from "./translator-data.js";
import { createTranslatorState } from "./translator-state.js";
import { mountTranslatorTabUi } from "./translator-tab-ui.js";

export function createTranslatorController({ setStatus }) {
  const state = createTranslatorState();
  const ui = mountTranslatorTabUi();
  let isBusy = false;
  let areModelsLoading = true;
  let areSystemMessagesLoading = true;

  function syncUi() {
    ui.renderModelOptions(state.getModelOptions(), areModelsLoading);
    ui.renderSystemMessageOptions(state.getSystemMessageOptions(), areSystemMessagesLoading);
    ui.setPendingSelection(state.getPendingSelection());
    ui.renderAppliedSelection(state.getAppliedSelection());
    ui.setBusy(isBusy);
    ui.setApplyEnabled(!isBusy && state.canApply());
  }

  function handleModelChange() {
    state.setPendingModel(ui.getSelectedModel());
    syncUi();
  }

  function handleSystemMessageChange() {
    state.setPendingSystemMessageId(ui.getSelectedSystemMessageId());
    syncUi();
  }

  function handleApplyClick() {
    const appliedSelection = state.applyPendingSelection();
    syncUi();

    if (!appliedSelection) {
      setStatus?.("Choose a translator model and system message first.");
      return;
    }

    setStatus?.(
      `Translator applied: ${appliedSelection.model} + ${appliedSelection.systemMessageLabel}`,
    );
  }

  return {
    bindEvents() {
      ui.bindApply(handleApplyClick);
      ui.bindModelChange(handleModelChange);
      ui.bindSystemMessageChange(handleSystemMessageChange);
    },
    getAppliedSelection() {
      return state.getAppliedSelection();
    },
    async initialize() {
      syncUi();
    },
    setBusy(nextBusyState) {
      isBusy = nextBusyState;
      syncUi();
    },
    updateAvailableModels(models) {
      areModelsLoading = false;
      state.setModelOptions(createTranslatorModelOptions(models));
      syncUi();
    },
    updateSystemMessages(presets) {
      areSystemMessagesLoading = false;
      state.setSystemMessageOptions(createTranslatorSystemMessageOptions(presets));
      syncUi();
    },
  };
}
