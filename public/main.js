import { loadConfig, loadModelInfo, loadModels, sendMessage } from "./api.js";
import {
  bindChatForm,
  bindClearButton,
  bindInfoButton,
  bindModelChange,
  clearMessages,
  focusPrompt,
  getInstructionValue,
  getPromptValue,
  getSelectedModel,
  markMessagesAsStale,
  renderMessage,
  renderModelInfo,
  renderModelOptions,
  setBusy,
  setDefaults,
  setPromptValue,
  setStatus,
} from "./ui.js";

let availableModels = [];
let lastPrompt = "";

function updateBusyState(isBusy) {
  setBusy(isBusy, availableModels.length);
}

async function handleSubmit(event) {
  event.preventDefault();

  const model = getSelectedModel();
  const instruction = getInstructionValue();
  const typedPrompt = getPromptValue();
  const prompt = typedPrompt || lastPrompt;

  if (!model || !prompt) {
    setStatus("Write a message first.");
    return;
  }

  lastPrompt = prompt;
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
  lastPrompt = "";
  setStatus("Messages cleared.");
  focusPrompt();
}

function handleModelChange() {
  const model = getSelectedModel();
  renderModelInfo(model ? `Current model: ${model}` : "Select a model and tap Model info.");
}

async function initializeModels() {
  setStatus("Loading models...");

  try {
    availableModels = await loadModels();
    renderModelOptions(availableModels);
    setStatus(`${availableModels.length} model${availableModels.length === 1 ? "" : "s"} available`);

    if (availableModels.length > 0) {
      renderModelInfo(`Current model: ${availableModels[0].name ?? "Unnamed model"}`);
    }
  } catch (error) {
    availableModels = [];
    renderModelOptions([]);
    renderModelInfo("Could not load model info.");
    setStatus(error instanceof Error ? error.message : "Could not load models");
  } finally {
    updateBusyState(false);
  }
}

async function initializeDefaults() {
  try {
    const config = await loadConfig();
    setDefaults(config);
  } catch {
    // Keep inputs empty if config loading fails.
  }
}

bindChatForm(handleSubmit);
bindClearButton(handleClearClick);
bindInfoButton(handleInfoClick);
bindModelChange(handleModelChange);

updateBusyState(true);
void Promise.all([initializeModels(), initializeDefaults()]);
