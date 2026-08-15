import {
  deleteModel,
  loadModelInfo,
  loadModels,
  releaseOtherModels as releaseOtherOllamaModels,
  sendMessage,
  startOllama,
  stopGeneration,
  stopModel,
} from "./api.js";
import { createInstructionController } from "./instructions.js";
import { createPromptHistoryController } from "./prompt-history.js";
import {
  getSavedInstructionPresetId,
  getLastUsedModel,
  getSavedModel,
  getSavedContext,
  saveInstructionPresetId,
  saveLastUsedModel,
  saveModel,
  saveContext,
} from "./preferences.js";
import { createTranslatorController } from "./translator/translator-controller.js";
import {
  bindAssistantTranslate,
  bindChatForm,
  bindContextChange,
  bindClearButton,
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
  setBusy,
  setDeleteModelDialogCopy,
  setDefaults,
  setStatus,
  setAssistantTranslateEnabled,
  setPromptValue,
  setStopEnabled,
} from "./ui.js";
import { clearChatHistory, loadChatHistory, saveChatHistory } from "./chat-history.js";

let availableModels = [];
const promptHistory = createPromptHistoryController();
const savedModel = getSavedModel();
const savedInstructionPresetId = getSavedInstructionPresetId();
let appliedTranslatorSettings = null;
let isGenerating = false;
let pendingDeleteModel = "";
let lastUsedModel = getLastUsedModel();
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
  setBusy(isBusy, availableModels.length);
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
  renderAndSaveMessage("user", prompt);
  setPromptValue("");
  clearDirectorValue();

  updateBusyState(true);
  beginGeneration();
  setStatus(`Sending to ${model}...`);

  try {
    await releaseOtherModels(model, translatorModel, lastUsedModel);
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
    lastUsedModel = model;
    saveLastUsedModel(model);
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
  const preferredModel = getSelectedModel();

  updateBusyState(true);
  setStatus("Starting Ollama...");

  try {
    const result = await startOllama();
    setStatus(result?.message || "Ollama start request sent.");

    if (result?.ready) {
      await initializeModels(preferredModel);
      return;
    }

    renderModelInfo(result?.message || "Ollama is starting. Refresh models in a moment.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start Ollama.";
    renderModelInfo(message);
    setStatus(message);
  } finally {
    updateBusyState(false);
  }
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
    await releaseOtherModels(appliedTranslatorSettings.model, getSelectedModel(), lastUsedModel);
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
    lastUsedModel = appliedTranslatorSettings.model;
    saveLastUsedModel(lastUsedModel);
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

async function tryStopModel(modelToStop, activeModel) {
  if (!modelToStop || modelToStop === activeModel) {
    return;
  }

  try {
    await stopModel(modelToStop);
  } catch (error) {
    console.warn(
      `[assistant] Could not stop model "${modelToStop}" before switching.`,
      error,
    );
  }
}

async function releaseOtherModels(activeModel, ...modelsToStop) {
  await releaseOtherOllamaModels(activeModel);

  const inactiveModels = [...new Set(modelsToStop)].filter(
    (model) => model && model !== activeModel,
  );

  for (const model of inactiveModels) {
    await tryStopModel(model, activeModel);
  }
}

function handleClearClick() {
  clearMessages();
  clearChatHistory();
  promptHistory.clear();
  setStatus("Messages cleared.");
  focusPrompt();
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
    await deleteModel(model);
    renderModelInfo(`Removed model: ${model}`);
    setStatus(`Removed ${model}`);
    await initializeModels();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not remove model.");
  } finally {
    updateBusyState(false);
  }
}

function handleModelChange() {
  const model = getSelectedModel();
  saveModel(model);
  setCurrentModelName(model);
  renderModelInfo(model ? `Current model: ${model}` : "Select a model and tap Model info.");
}

async function initializeModels(preferredModel = "") {
  setStatus("Loading models...");

  try {
    try {
      availableModels = await loadModels();
    } catch {
      setStatus("Ollama is unavailable. Starting it...");
      const result = await startOllama();

      if (!result?.ready) {
        throw new Error(result?.message || "Ollama did not become ready.");
      }

      availableModels = await loadModels();
    }

    const fallbackModel = preferredModel || savedModel || getSelectedModel();
    renderModelOptions(availableModels, fallbackModel);
    translatorController.updateAvailableModels(availableModels);
    const selectedModel = getSelectedModel();
    setStatus(`${availableModels.length} model${availableModels.length === 1 ? "" : "s"} available`);

    if (availableModels.length > 0) {
      const currentModel = selectedModel || availableModels[0]?.name || "Unnamed model";
      setCurrentModelName(currentModel);
      renderModelInfo(`Current model: ${currentModel}`);
    } else {
      setCurrentModelName("Not selected");
      renderModelInfo("Select a model and load info.");
    }
  } catch (error) {
    availableModels = [];
    renderModelOptions([]);
    translatorController.updateAvailableModels([]);
    setCurrentModelName("Not available");
    renderModelInfo("Could not load model info. Start Ollama and refresh the models list.");
    setStatus(error instanceof Error ? error.message : "Could not load models");
  } finally {
    updateBusyState(false);
  }
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
bindDeleteModelButton(handleDeleteModelClick);
bindDeleteModelDialogCancel(handleDeleteModelCancel);
bindDeleteModelDialogConfirm(handleDeleteModelConfirm);
bindInfoButton(handleInfoClick);
bindMessageIncludeChange(() => saveChatHistory(getMessagesForStorage()));
bindModelChange(handleModelChange);
bindRefreshModelsButton(initializeModels);
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
initializationPromise = Promise.all([initializeModels(), initializeInstructions()]);
