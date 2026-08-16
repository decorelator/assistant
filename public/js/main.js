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
  bindRefreshModelsButton,
  bindStartOllamaButton,
  bindStopButton,
  bindTabs,
  clearDirectorValue,
  clearMessages,
  closeDeleteModelDialog,
  focusPrompt,
  getSelectedModel,
  getIncludedMessages,
  getChatTranscript,
  getContextValue,
  getDirectorValue,
  getMessagesForStorage,
  markMessagesAsStale,
  openDeleteModelDialog,
  renderMessage,
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
  setStopEnabled,
} from "./ui.js";
import { clearChatHistory, loadChatHistory, saveChatHistory } from "./chat-history.js";

const promptHistory = createPromptHistoryController();
const savedInstructionPresetId = getSavedInstructionPresetId();
let appliedTranslatorSettings = null;
let isGenerating = false;
let pendingDeleteModel = "";
let initializationPromise = Promise.resolve();
const translatorController = createTranslatorController({
  onAppliedSelectionChange(settings) {
    appliedTranslatorSettings = settings;
    setAssistantTranslateEnabled(Boolean(settings));
  },
  setStatus,
});

function renderAndSaveMessage(role, text, metadata = {}) {
  renderMessage(role, text, metadata);
  saveChatHistory(getMessagesForStorage());
}

function restoreChatHistory() {
  for (const { role, text, metadata } of loadChatHistory()) {
    renderMessage(role, text, metadata);
  }
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

  const model = getSelectedModel();
  const translatorModel = translatorController.getSelectedModel();
  const instruction = instructionController.getInstructionValue();
  const selectedPresetId = instructionController.getSelectedPresetId();
  const prompt = promptHistory.getPromptForSubmit();
  const context = getContextValue();
  const director = getDirectorValue();
  const includedMessages = getIncludedMessages();

  if (!model || !prompt) {
    setStatus("Write a message first.");
    return;
  }

  promptHistory.rememberSubmittedPrompt(prompt);
  markMessagesAsStale();
  renderAndSaveMessage("user", prompt, { context, director });
  setPromptValue("");
  clearDirectorValue();

  updateBusyState(true);
  beginGeneration();
  setStatus(`Sending to ${model}...`);

  try {
    await modelController.releaseInactiveModels(model, translatorModel, modelController.getLastUsedModel());
    const requestMetadata = {
      instructionName: instructionController.getCurrentInstructionName(),
      modelName: model,
    };
    const reply = await sendMessage(
      model,
      prompt,
      instruction,
      selectedPresetId,
      includedMessages,
      director,
      context,
    );
    modelController.markUsed(model);
    if (selectedPresetId) {
      instructionController.markPresetAsUsed(selectedPresetId);
    }
    renderAndSaveMessage("assistant", reply.response || "No response from model.", requestMetadata);
    setStatus(`Ready with ${model}`);
  } catch (error) {
    if (isGenerationStoppedError(error)) {
      setStatus("Generation stopped.");
    } else {
      renderAndSaveMessage("assistant", error instanceof Error ? error.message : "Request failed");
      setStatus("Message failed");
    }
  } finally {
    endGeneration();
    updateBusyState(false);
    focusPrompt();
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

  markMessagesAsStale();
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

async function initializeInstructions() {
  const config = await instructionController.initialize(savedInstructionPresetId);

  if (config) {
    setDefaults(config);
  }

  promptHistory.initialize();
}

bindChatForm(handleSubmit);
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
bindRefreshModelsButton(() => modelController.initialize("", getSelectedModel));
bindStartOllamaButton(handleStartOllamaClick);
bindStopButton(handleStopClick);
bindTabs();
instructionController.bindEvents();
promptHistory.bindEvents();
translatorController.bindEvents();
restoreChatHistory();
setContextValue(getSavedContext());

updateBusyState(true);
translatorController.initialize();
initializationPromise = Promise.all([modelController.initialize("", getSelectedModel), initializeInstructions()]);
