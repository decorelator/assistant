import { loadModelInfo, loadModels, sendMessage } from "./api.js";
import { createInstructionController } from "./instructions.js";
import { createPromptHistoryController } from "./prompt-history.js";
import {
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
  setPromptValue,
} from "./ui.js";

let availableModels = [];
const promptHistory = createPromptHistoryController();

function updateBusyState(isBusy) {
  setBusy(isBusy, availableModels.length);
}
const instructionController = createInstructionController({
  onInstructionNameChange: setCurrentInstructionName,
  setBusy: updateBusyState,
  setStatus,
});

async function handleSubmit(event) {
  event.preventDefault();

  const model = getSelectedModel();
  const instruction = instructionController.getInstructionValue();
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
    const reply = await sendMessage(model, prompt, instruction);
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
bindClearButton(handleClearClick);
bindInfoButton(handleInfoClick);
bindModelChange(handleModelChange);
bindRefreshModelsButton(initializeModels);
bindTabs();
instructionController.bindEvents();

updateBusyState(true);
void Promise.all([initializeModels(), initializeInstructions()]);
