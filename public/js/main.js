import { deleteModel, loadModelInfo, loadModels, sendMessage, stopGeneration, stopModel } from "./api.js";
import { createInstructionController } from "./instructions.js";
import { createPromptHistoryController } from "./prompt-history.js";
import { createTranslatorController } from "./translator/translator-controller.js";
import {
  bindAssistantTranslate,
  bindChatForm,
  bindClearButton,
  bindDeleteModelButton,
  bindDeleteModelDialogCancel,
  bindDeleteModelDialogConfirm,
  bindInfoButton,
  bindModelChange,
  bindRefreshModelsButton,
  bindStopButton,
  bindTabs,
  clearMessages,
  closeDeleteModelDialog,
  focusPrompt,
  getSelectedModel,
  markMessagesAsStale,
  openDeleteModelDialog,
  renderMessage,
  renderModelInfo,
  renderModelOptions,
  setCurrentInstructionName,
  setCurrentModelName,
  setBusy,
  setDeleteModelDialogCopy,
  setDefaults,
  setStatus,
  setAssistantTranslateEnabled,
  setPromptValue,
  setStopEnabled,
} from "./ui.js";

let availableModels = [];
const promptHistory = createPromptHistoryController();
let appliedTranslatorSettings = null;
let isGenerating = false;
let pendingDeleteModel = "";
const translatorController = createTranslatorController({
  onAppliedSelectionChange(settings) {
    appliedTranslatorSettings = settings;
    setAssistantTranslateEnabled(Boolean(settings));
  },
  setStatus,
});

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
  onPresetsChange: translatorController.updateSystemMessages,
  setBusy: updateBusyState,
  setStatus,
});

async function handleSubmit(event) {
  event.preventDefault();

  const model = getSelectedModel();
  const translatorModel = translatorController.getSelectedModel();
  const instruction = instructionController.getInstructionValue();
  const selectedPresetId = instructionController.getSelectedPresetId();
  const prompt = promptHistory.getPromptForSubmit();

  if (!model || !prompt) {
    setStatus("Write a message first.");
    return;
  }

  promptHistory.rememberSubmittedPrompt(prompt);
  markMessagesAsStale();
  renderMessage("user", prompt);
  setPromptValue("");

  updateBusyState(true);
  beginGeneration();
  setStatus(`Sending to ${model}...`);

  try {
    await tryStopModel(translatorModel, model);
    const reply = await sendMessage(model, prompt, instruction, selectedPresetId);
    if (selectedPresetId) {
      instructionController.markPresetAsUsed(selectedPresetId);
    }
    renderMessage("assistant", reply || "No response from model.");
    setStatus(`Ready with ${model}`);
  } catch (error) {
    if (isGenerationStoppedError(error)) {
      setStatus("Generation stopped.");
    } else {
      renderMessage("assistant", error instanceof Error ? error.message : "Request failed");
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

async function handleAssistantTranslate(sourceText) {
  if (!appliedTranslatorSettings?.model) {
    setStatus("Apply translator settings first.");
    return;
  }

  markMessagesAsStale();
  renderMessage("user", sourceText);

  updateBusyState(true);
  beginGeneration();
  setStatus(`Translating with ${appliedTranslatorSettings.model}...`);

  try {
    await tryStopModel(getSelectedModel(), appliedTranslatorSettings.model);
    const reply = await sendMessage(
      appliedTranslatorSettings.model,
      sourceText,
      appliedTranslatorSettings.instructionText,
    );
    renderMessage("assistant", reply || "No response from model.");
    setStatus(`Translation ready with ${appliedTranslatorSettings.model}`);
  } catch (error) {
    if (isGenerationStoppedError(error)) {
      setStatus("Generation stopped.");
    } else {
      renderMessage("assistant", error instanceof Error ? error.message : "Translation failed");
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

function handleClearClick() {
  clearMessages();
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
  setCurrentModelName(model);
  renderModelInfo(model ? `Current model: ${model}` : "Select a model and tap Model info.");
}

async function initializeModels(preferredModel = "") {
  setStatus("Loading models...");

  try {
    availableModels = await loadModels();
    const fallbackModel = preferredModel || getSelectedModel();
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
    renderModelInfo("Could not load model info.");
    setStatus(error instanceof Error ? error.message : "Could not load models");
  } finally {
    updateBusyState(false);
  }
}

async function initializeInstructions() {
  const config = await instructionController.initialize();

  if (config) {
    setDefaults(config);
  }

  promptHistory.initialize();
}

bindChatForm(handleSubmit);
bindAssistantTranslate(handleAssistantTranslate);
bindClearButton(handleClearClick);
bindDeleteModelButton(handleDeleteModelClick);
bindDeleteModelDialogCancel(handleDeleteModelCancel);
bindDeleteModelDialogConfirm(handleDeleteModelConfirm);
bindInfoButton(handleInfoClick);
bindModelChange(handleModelChange);
bindRefreshModelsButton(initializeModels);
bindStopButton(handleStopClick);
bindTabs();
instructionController.bindEvents();
promptHistory.bindEvents();
translatorController.bindEvents();

updateBusyState(true);
translatorController.initialize();
void Promise.all([initializeModels(), initializeInstructions()]);
