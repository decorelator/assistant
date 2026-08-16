import { loadModelInfo, sendMessage, stopGeneration } from "./api.js";
import { createModelController } from "./features/models/model-controller.js";
import { createInstructionController } from "./instructions.js";
import { createPromptHistoryController } from "./prompt-history.js";
import {
  getSavedInstructionPresetId,
  getSavedContext,
  saveInstructionPresetId,
  saveContext,
} from "./preferences.js";
import { createTranslatorController } from "./translator/translator-controller.js";
import {
  bindAssistantTranslate,
  bindChatForm,
  bindContextChange,
  bindClearButton,
  bindCopyChatButton,
  bindDeleteModelButton,
  bindDeleteModelDialogCancel,
  bindDeleteModelDialogConfirm,
  bindInfoButton,
  bindMessageIncludeChange,
  bindModelChange,
  bindPromptSubmitShortcut,
  bindReviewApprove,
  bindReviewCancel,
  bindReviewRegenerate,
  bindRefreshModelsButton,
  bindStartOllamaButton,
  bindStopButton,
  bindTabs,
  clearDirectorValue,
  clearMessages,
  closeReviewDialog,
  closeDeleteModelDialog,
  focusPrompt,
  getSelectedModel,
  getIncludedMessages,
  getChatTranscript,
  getContextValue,
  getDirectorValue,
  getMessagesForStorage,
  markMessagesAsStale,
  openReviewDialog,
  openDeleteModelDialog,
  renderMessage,
  renderReviewDialogContent,
  renderModelInfo,
  renderModelOptions,
  setCurrentInstructionName,
  setCurrentModelName,
  setContextValue,
  showChatCopied,
  setBusy,
  setDeleteModelDialogCopy,
  setDefaults,
  setStatus,
  setAssistantTranslateEnabled,
  setPromptValue,
  setReviewBusy,
  setStopEnabled,
} from "./ui.js";
import { clearChatHistory, loadChatHistory, saveChatHistory } from "./chat-history.js";

const promptHistory = createPromptHistoryController();
const savedInstructionPresetId = getSavedInstructionPresetId();
let appliedTranslatorSettings = null;
let isGenerating = false;
let pendingDeleteModel = "";
let pendingReview = null;
let initializationPromise = Promise.resolve();
const translatorController = createTranslatorController({
  onAppliedSelectionChange(settings) {
    appliedTranslatorSettings = settings;
    setAssistantTranslateEnabled(Boolean(settings));
  },
  setStatus,
});

function renderAndSaveMessage(role, text, metadata = {}) {
  markMessagesAsStale();
  renderMessage(role, text, metadata);
  saveChatHistory(getMessagesForStorage());
}

function restoreChatHistory() {
  let lastUserPrompt = "";

  for (const { role, text, metadata } of loadChatHistory()) {
    renderMessage(role, text, metadata);
    if (role === "user" && text.trim()) lastUserPrompt = text.trim();
  }

  return lastUserPrompt;
}

function updateBusyState(isBusy) {
  setBusy(isBusy, modelController.getAvailableModelCount());
  translatorController.setBusy(isBusy);
}

function isGenerationStoppedError(error) {
  return (
    error instanceof Error &&
    (error.message === "Generation stopped." || error.status === 499)
  );
}

function beginGeneration() {
  isGenerating = true;
  setStopEnabled(true);
}

function endGeneration() {
  isGenerating = false;
  setStopEnabled(false);
}

function clearPendingReview() {
  pendingReview = null;
  setReviewBusy(false);
}

function buildPendingReview() {
  const model = getSelectedModel();
  const translatorModel = translatorController.getSelectedModel();
  const instruction = instructionController.getInstructionValue();
  const selectedPresetId = instructionController.getSelectedPresetId();
  const prompt = promptHistory.getPromptForSubmit();
  const context = getContextValue();
  const director = getDirectorValue();
  const includedMessages = getIncludedMessages().map((message) => ({ ...message }));

  if (!model || !prompt) {
    setStatus("Write a message first.");
    return null;
  }

  return {
    model,
    translatorModel,
    instruction,
    selectedPresetId,
    prompt,
    context,
    director,
    includedMessages,
    requestMetadata: {
      instructionName: instructionController.getCurrentInstructionName(),
      modelName: model,
    },
    reply: "",
  };
}

async function generateReviewDraft() {
  if (!pendingReview) {
    return false;
  }

  updateBusyState(true);
  beginGeneration();
  setStatus(`Sending to ${pendingReview.model}...`);

  try {
    await modelController.releaseInactiveModels(
      pendingReview.model,
      pendingReview.translatorModel,
      modelController.getLastUsedModel(),
    );
    const reply = await sendMessage(
      pendingReview.model,
      pendingReview.prompt,
      pendingReview.instruction,
      pendingReview.selectedPresetId,
      pendingReview.includedMessages,
      pendingReview.director,
      pendingReview.context,
    );

    modelController.markUsed(pendingReview.model);

    if (pendingReview.selectedPresetId) {
      instructionController.markPresetAsUsed(pendingReview.selectedPresetId);
    }

    pendingReview.reply = reply.response || "No response from model.";
    renderReviewDialogContent({
      current: pendingReview.prompt,
      draft: pendingReview.reply,
      draftRole: "assistant",
    });
    openReviewDialog();
    setStatus(`Draft ready with ${pendingReview.model}`);
    return true;
  } catch (error) {
    if (isGenerationStoppedError(error)) {
      setStatus("Generation stopped.");
      return false;
    }

    setStatus(error instanceof Error ? error.message : "Request failed");
    return false;
  } finally {
    endGeneration();
    updateBusyState(false);
    setReviewBusy(false);

    if (!pendingReview?.reply) {
      focusPrompt();
    }
  }
}

function approvePendingReview() {
  if (!pendingReview) {
    return;
  }

  renderAndSaveMessage("user", pendingReview.prompt, {
    context: pendingReview.context,
    director: pendingReview.director,
  });
  renderMessage("assistant", pendingReview.reply, pendingReview.requestMetadata);
  saveChatHistory(getMessagesForStorage());
  promptHistory.rememberSubmittedPrompt(pendingReview.prompt);
  setPromptValue("");
  clearDirectorValue();
  closeReviewDialog();
  setStatus(`Approved reply from ${pendingReview.model}.`);
  clearPendingReview();
}

function cancelPendingReview() {
  closeReviewDialog();
  clearPendingReview();
  setStatus("Draft discarded.");
}

async function regeneratePendingReview() {
  if (!pendingReview) {
    return;
  }

  setReviewBusy(true);
  pendingReview.reply = "";
  renderReviewDialogContent({
    current: pendingReview.prompt,
    draft: "",
    draftRole: "assistant",
  });
  setStatus(`Regenerating draft with ${pendingReview.model}...`);
  await generateReviewDraft();
}
const instructionController = createInstructionController({
  onInstructionNameChange: setCurrentInstructionName,
  onInstructionPresetChange: saveInstructionPresetId,
  onPresetsChange: translatorController.updateSystemMessages,
  setBusy: updateBusyState,
  setStatus,
});
const modelController = createModelController({
  renderModelInfo,
  renderModelOptions,
  setCurrentModelName,
  setStatus,
  setBusy: updateBusyState,
  updateTranslatorModels: translatorController.updateAvailableModels,
});

async function handleSubmit(event) {
  event.preventDefault();

  await initializationPromise;

  if (pendingReview) {
    openReviewDialog();
    setStatus("Approve, regenerate, or cancel the current draft first.");
    return;
  }

  pendingReview = buildPendingReview();

  if (!pendingReview) {
    return;
  }

  const didGenerateDraft = await generateReviewDraft();

  if (!didGenerateDraft) {
    clearPendingReview();
  }
}

async function handleInfoClick() {
  const model = getSelectedModel();

  if (!model) {
    return;
  }

  updateBusyState(true);
  setStatus(`Loading info for ${model}...`);

  try {
    const details = await loadModelInfo(model);
    renderModelInfo(details);
    setStatus(`Info loaded for ${model}`);
  } catch (error) {
    renderModelInfo(error instanceof Error ? error.message : "Could not load model info");
    setStatus("Model info failed");
  } finally {
    updateBusyState(false);
  }
}

async function handleStartOllamaClick() {
  await modelController.start(getSelectedModel(), getSelectedModel);
}

async function handleAssistantTranslate(sourceText) {
  await initializationPromise;

  const includedMessages = getIncludedMessages();

  if (!appliedTranslatorSettings?.model) {
    setStatus("Apply translator settings first.");
    return;
  }

  renderAndSaveMessage("user", sourceText);

  updateBusyState(true);
  beginGeneration();
  setStatus(`Translating with ${appliedTranslatorSettings.model}...`);

  try {
    await modelController.releaseInactiveModels(appliedTranslatorSettings.model, getSelectedModel(), modelController.getLastUsedModel());
    const requestMetadata = {
      instructionName: appliedTranslatorSettings.systemMessageLabel,
      modelName: appliedTranslatorSettings.model,
    };
    const reply = await sendMessage(
      appliedTranslatorSettings.model,
      sourceText,
      appliedTranslatorSettings.instructionText,
      null,
      includedMessages,
    );
    modelController.markUsed(appliedTranslatorSettings.model);
    renderAndSaveMessage("assistant", reply.response || "No response from model.", requestMetadata);
    setStatus(`Translation ready with ${appliedTranslatorSettings.model}`);
  } catch (error) {
    if (isGenerationStoppedError(error)) {
      setStatus("Generation stopped.");
    } else {
      renderAndSaveMessage("assistant", error instanceof Error ? error.message : "Translation failed");
      setStatus("Translation failed");
    }
  } finally {
    endGeneration();
    updateBusyState(false);
    focusPrompt();
  }
}

async function handleStopClick() {
  if (!isGenerating) {
    return;
  }

  setStopEnabled(false);
  setStatus("Stopping generation...");

  try {
    await stopGeneration();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not stop generation.");
    if (isGenerating) {
      setStopEnabled(true);
    }
  }
}

function handleClearClick() {
  closeReviewDialog();
  clearPendingReview();
  clearMessages();
  clearChatHistory();
  promptHistory.clear();
  setStatus("Messages cleared.");
  focusPrompt();
}

async function handleCopyChatClick() {
  const transcript = getChatTranscript();

  if (!transcript) {
    setStatus("There are no messages to copy.");
    return;
  }

  try {
    await navigator.clipboard.writeText(transcript);
    showChatCopied();
    setStatus("Chat copied to clipboard.");
  } catch {
    setStatus("Could not copy chat to clipboard.");
  }
}

function handleDeleteModelClick() {
  const model = getSelectedModel();

  if (!model) {
    setStatus("Select a model first.");
    return;
  }

  pendingDeleteModel = model;
  setDeleteModelDialogCopy(`Remove "${model}" from the Ollama server? This cannot be undone.`);
  openDeleteModelDialog();
}

function handleDeleteModelCancel() {
  pendingDeleteModel = "";
  closeDeleteModelDialog();
}

async function handleDeleteModelConfirm() {
  const model = pendingDeleteModel || getSelectedModel();

  if (!model) {
    closeDeleteModelDialog();
    setStatus("Select a model first.");
    return;
  }

  closeDeleteModelDialog();
  pendingDeleteModel = "";
  updateBusyState(true);
  setStatus(`Removing ${model}...`);

  try {
    await modelController.remove(model, getSelectedModel);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not remove model.");
  } finally {
    updateBusyState(false);
  }
}

function handleModelChange() {
  const model = getSelectedModel();
  modelController.select(model);
}

function handlePromptSubmitShortcut(event) {
  if (
    event.key !== "Enter" ||
    event.shiftKey ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.isComposing
  ) {
    return;
  }

  event.preventDefault();
  event.currentTarget?.form?.requestSubmit();
}

async function initializeInstructions() {
  const config = await instructionController.initialize(savedInstructionPresetId);

  if (config) {
    setDefaults({
      ...config,
      defaultPrompt: restoredPrompt || config.defaultPrompt,
    });
  }

  promptHistory.initialize(restoredPrompt);
}

bindChatForm(handleSubmit);
bindPromptSubmitShortcut(handlePromptSubmitShortcut);
bindContextChange(() => saveContext(getContextValue()));
bindAssistantTranslate(handleAssistantTranslate);
bindClearButton(handleClearClick);
bindCopyChatButton(handleCopyChatClick);
bindDeleteModelButton(handleDeleteModelClick);
bindDeleteModelDialogCancel(handleDeleteModelCancel);
bindDeleteModelDialogConfirm(handleDeleteModelConfirm);
bindInfoButton(handleInfoClick);
bindMessageIncludeChange(() => saveChatHistory(getMessagesForStorage()));
bindModelChange(handleModelChange);
bindReviewApprove(approvePendingReview);
bindReviewCancel(cancelPendingReview);
bindReviewRegenerate(regeneratePendingReview);
bindRefreshModelsButton(() => modelController.initialize("", getSelectedModel));
bindStartOllamaButton(handleStartOllamaClick);
bindStopButton(handleStopClick);
bindTabs();
instructionController.bindEvents();
promptHistory.bindEvents();
translatorController.bindEvents();
const restoredPrompt = restoreChatHistory();
setContextValue(getSavedContext());

updateBusyState(true);
translatorController.initialize();
initializationPromise = Promise.all([modelController.initialize("", getSelectedModel), initializeInstructions()]);
