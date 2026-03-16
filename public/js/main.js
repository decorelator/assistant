import { loadModelInfo, loadModels, sendMessage, stopModel } from "./api.js";
import { createInstructionController } from "./instructions.js";
import { createPromptHistoryController } from "./prompt-history.js";
import { createTranslatorController } from "./translator/translator-controller.js";
import {
  bindAssistantTranslate,
  bindChatForm,
  bindClearButton,
  bindInfoButton,
  bindModelChange,
  bindRefreshModelsButton,
  bindTabs,
  clearMessages,
  focusPrompt,
  getSelectedModel,
  markMessagesAsStale,
  renderMessage,
  renderModelInfo,
  renderModelOptions,
  setCurrentInstructionName,
  setCurrentModelName,
  setBusy,
  setDefaults,
  setStatus,
  setAssistantTranslateEnabled,
  setPromptValue,
} from "./ui.js";

let availableModels = [];
const promptHistory = createPromptHistoryController();
let appliedTranslatorSettings = null;
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
    renderMessage("assistant", error instanceof Error ? error.message : "Request failed");
    setStatus("Message failed");
  } finally {
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
    renderMessage("assistant", error instanceof Error ? error.message : "Translation failed");
    setStatus("Translation failed");
  } finally {
    updateBusyState(false);
    focusPrompt();
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

function handleModelChange() {
  const model = getSelectedModel();
  setCurrentModelName(model);
  renderModelInfo(model ? `Current model: ${model}` : "Select a model and tap Model info.");
}

async function initializeModels() {
  setStatus("Loading models...");

  try {
    availableModels = await loadModels();
    renderModelOptions(availableModels);
    translatorController.updateAvailableModels(availableModels);
    setStatus(`${availableModels.length} model${availableModels.length === 1 ? "" : "s"} available`);

    if (availableModels.length > 0) {
      const initialModelName = availableModels[0].name ?? "Unnamed model";
      setCurrentModelName(initialModelName);
      renderModelInfo(`Current model: ${initialModelName}`);
    } else {
      setCurrentModelName("Not selected");
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
bindInfoButton(handleInfoClick);
bindModelChange(handleModelChange);
bindRefreshModelsButton(initializeModels);
bindTabs();
instructionController.bindEvents();
promptHistory.bindEvents();
translatorController.bindEvents();

updateBusyState(true);
translatorController.initialize();
void Promise.all([initializeModels(), initializeInstructions()]);
