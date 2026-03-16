import {
  createTranslatorModelOptions,
  createTranslatorSystemMessageOptions,
  findTranslatorSystemMessage,
} from "./translator-data.js";
import { createTranslatorState } from "./translator-state.js";
import { mountTranslatorTabUi } from "./translator-tab-ui.js";

export function createTranslatorController({ setStatus }) {
  const state = createTranslatorState();
  const ui = mountTranslatorTabUi();
  let modelOptions = [];
  let systemMessageOptions = [];
  let isBusy = false;
  let areModelsLoading = true;
  let areSystemMessagesLoading = true;

  function normalizeSelection(selection) {
    const hasModel = modelOptions.some((option) => option.value === selection?.model);
    const hasSystemMessage = systemMessageOptions.some(
      (option) => option.id === selection?.systemMessageId,
    );

    return {
      model: hasModel ? selection.model : modelOptions[0]?.value ?? "",
      systemMessageId: hasSystemMessage
        ? selection.systemMessageId
        : systemMessageOptions[0]?.id ?? null,
    };
  }

  function buildAppliedSummary() {
    const appliedSelection = state.getAppliedSelection();
    const systemMessage = findTranslatorSystemMessage(
      systemMessageOptions,
      appliedSelection.systemMessageId,
    );

    if (!appliedSelection.model || !systemMessage) {
      return "";
    }

    return `Applied translator: ${appliedSelection.model} + ${systemMessage.label}`;
  }

  function syncUi() {
    const selection = normalizeSelection(ui.getSelection());

    ui.render({
      appliedSummary: buildAppliedSummary(),
      canApply:
        !isBusy &&
        Boolean(selection.model) &&
        selection.systemMessageId !== null &&
        state.hasPendingChanges(selection),
      isBusy,
      isModelsLoading: areModelsLoading,
      isSystemMessagesLoading: areSystemMessagesLoading,
      modelOptions,
      selection,
      systemMessageOptions,
    });
  }

  function handleSelectionChange() {
    syncUi();
  }

  function handleApplyClick() {
    const selection = normalizeSelection(ui.getSelection());
    const appliedSelection = state.applySelection(selection);
    syncUi();

    if (!appliedSelection) {
      setStatus?.("Choose a translator model and system message first.");
      return;
    }

    const systemMessage = findTranslatorSystemMessage(
      systemMessageOptions,
      appliedSelection.systemMessageId,
    );
    setStatus?.(
      `Translator applied: ${appliedSelection.model} + ${systemMessage?.label ?? "Unknown preset"}`,
    );
  }

  return {
    bindEvents() {
      ui.bindApply(handleApplyClick);
      ui.bindModelChange(handleSelectionChange);
      ui.bindSystemMessageChange(handleSelectionChange);
    },
    initialize() {
      syncUi();
    },
    setBusy(nextBusyState) {
      isBusy = nextBusyState;
      syncUi();
    },
    updateAvailableModels(models) {
      areModelsLoading = false;
      modelOptions = createTranslatorModelOptions(models);
      state.syncAppliedSelection(modelOptions, systemMessageOptions);
      syncUi();
    },
    updateSystemMessages(presets) {
      areSystemMessagesLoading = false;
      systemMessageOptions = createTranslatorSystemMessageOptions(presets);
      state.syncAppliedSelection(modelOptions, systemMessageOptions);
      syncUi();
    },
  };
}
