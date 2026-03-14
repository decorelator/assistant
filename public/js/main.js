import {
  deleteInstructionPreset,
  loadConfig,
  loadInstructionPresets,
  loadModelInfo,
  loadModels,
  saveInstructionPreset,
  sendMessage,
  updateInstructionPreset,
} from "./api.js";
import {
  bindChatForm,
  bindClearButton,
  bindDeleteDialogCancel,
  bindDeleteDialogConfirm,
  bindDeletePresetButton,
  bindInfoButton,
  bindInstructionPresetChange,
  bindModelChange,
  bindSaveDialogCancel,
  bindSaveDialogSubmit,
  bindSavePresetButton,
  bindTabs,
  bindUpdatePresetButton,
  clearMessages,
  closeDeleteDialog,
  closeSaveDialog,
  focusPrompt,
  getInstructionValue,
  getPresetTitleValue,
  getPromptValue,
  getSelectedInstructionPresetId,
  getSelectedModel,
  markMessagesAsStale,
  openDeleteDialog,
  openSaveDialog,
  renderMessage,
  renderInstructionPresetOptions,
  renderModelInfo,
  renderModelOptions,
  setBusy,
  setDeleteDialogCopy,
  setDefaults,
  setInstructionPresetActions,
  setInstructionSource,
  setInstructionValue,
  setPresetTitleError,
  setPromptPlaceholder,
  setStatus,
  setPromptValue,
  resetPromptPlaceholder,
} from "./ui.js";

let availableModels = [];
let fallbackInstruction = "";
let instructionPresets = [];
let selectedInstructionPresetId = null;
let lastSubmittedPrompt = "";

function cropPromptHint(prompt) {
  const singleLinePrompt = prompt.replace(/\s+/g, " ").trim();

  if (!singleLinePrompt) {
    return "";
  }

  return singleLinePrompt.length > 50 ? `${singleLinePrompt.slice(0, 50)}...` : singleLinePrompt;
}

function syncPromptHint() {
  if (!lastSubmittedPrompt) {
    resetPromptPlaceholder();
    return;
  }

  setPromptPlaceholder(cropPromptHint(lastSubmittedPrompt));
}

function updateBusyState(isBusy) {
  setBusy(isBusy, availableModels.length);
}

function getSelectedInstructionPreset() {
  return instructionPresets.find((preset) => preset.id === selectedInstructionPresetId) ?? null;
}

function syncInstructionPresetUi() {
  const selectedPreset = getSelectedInstructionPreset();
  renderInstructionPresetOptions(instructionPresets, selectedInstructionPresetId);
  setInstructionPresetActions(Boolean(selectedPreset));

  if (selectedPreset) {
    setInstructionSource(`Selected preset: ${selectedPreset.title}`);
    return;
  }

  setInstructionSource("Using fallback instruction from .env.");
}

function loadFallbackInstruction() {
  selectedInstructionPresetId = null;
  setInstructionValue(fallbackInstruction);
  syncInstructionPresetUi();
}

function loadInstructionPresetById(presetId) {
  const preset = instructionPresets.find((item) => item.id === presetId);

  if (!preset) {
    loadFallbackInstruction();
    return;
  }

  selectedInstructionPresetId = preset.id;
  setInstructionValue(preset.instructionText ?? "");
  syncInstructionPresetUi();
}

function applyInstructionPresets(presets, selectedPresetId = null) {
  instructionPresets = Array.isArray(presets) ? presets : [];

  if (selectedPresetId) {
    const selectedPreset = instructionPresets.find((preset) => preset.id === selectedPresetId);

    if (selectedPreset) {
      loadInstructionPresetById(selectedPreset.id);
      return;
    }
  }

  if (instructionPresets.length > 0) {
    loadInstructionPresetById(instructionPresets[0].id);
    return;
  }

  loadFallbackInstruction();
}

function isValidationError(error) {
  return Boolean(error && typeof error === "object" && "status" in error && error.status === 409);
}

async function handleSubmit(event) {
  event.preventDefault();

  const model = getSelectedModel();
  const instruction = getInstructionValue();
  const prompt = getPromptValue() || lastSubmittedPrompt;

  if (!model || !prompt) {
    setStatus("Write a message first.");
    return;
  }

  lastSubmittedPrompt = prompt;
  syncPromptHint();
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
  lastSubmittedPrompt = "";
  resetPromptPlaceholder();
  setStatus("Messages cleared.");
  focusPrompt();
}

function handleModelChange() {
  const model = getSelectedModel();
  renderModelInfo(model ? `Current model: ${model}` : "Select a model and tap Model info.");
}

function handleInstructionPresetChange() {
  const presetId = getSelectedInstructionPresetId();

  if (!presetId) {
    return;
  }

  loadInstructionPresetById(presetId);
}

function handleSavePresetClick() {
  openSaveDialog();
}

function handleSaveDialogCancel() {
  closeSaveDialog();
}

async function handleSaveDialogSubmit(event) {
  event.preventDefault();

  const title = getPresetTitleValue();

  if (!title) {
    setPresetTitleError("Title is required.");
    return;
  }

  try {
    updateBusyState(true);
    const preset = await saveInstructionPreset(title, getInstructionValue());
    closeSaveDialog();

    if (preset) {
      applyInstructionPresets([preset, ...instructionPresets], preset.id);
    }
  } catch (error) {
    if (isValidationError(error)) {
      setPresetTitleError(error.message);
      return;
    }

    setStatus(error instanceof Error ? error.message : "Could not save preset");
  } finally {
    updateBusyState(false);
  }
}

async function handleUpdatePresetClick() {
  const selectedPreset = getSelectedInstructionPreset();

  if (!selectedPreset) {
    return;
  }

  try {
    updateBusyState(true);
    const preset = await updateInstructionPreset(selectedPreset.id, getInstructionValue());

    if (!preset) {
      return;
    }

    instructionPresets = instructionPresets.map((item) => (item.id === preset.id ? preset : item));
    loadInstructionPresetById(preset.id);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not update preset");
  } finally {
    updateBusyState(false);
  }
}

function handleDeletePresetClick() {
  const selectedPreset = getSelectedInstructionPreset();

  if (!selectedPreset) {
    return;
  }

  setDeleteDialogCopy(`Preset "${selectedPreset.title}" will be deleted from the database.`);
  openDeleteDialog();
}

function handleDeleteDialogCancel() {
  closeDeleteDialog();
}

async function handleDeleteDialogConfirm() {
  const selectedPreset = getSelectedInstructionPreset();

  if (!selectedPreset) {
    closeDeleteDialog();
    return;
  }

  try {
    updateBusyState(true);
    await deleteInstructionPreset(selectedPreset.id);
    closeDeleteDialog();
    const remainingPresets = instructionPresets.filter((preset) => preset.id !== selectedPreset.id);
    applyInstructionPresets(remainingPresets);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not delete preset");
  } finally {
    updateBusyState(false);
  }
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
    const [config, presets] = await Promise.all([loadConfig(), loadInstructionPresets()]);
    fallbackInstruction = typeof config.defaultInstruction === "string" ? config.defaultInstruction : "";
    setDefaults(config);
    syncPromptHint();
    applyInstructionPresets(presets);
  } catch {
    fallbackInstruction = "";
    syncPromptHint();
    applyInstructionPresets([]);
  }
}

bindChatForm(handleSubmit);
bindClearButton(handleClearClick);
bindDeleteDialogCancel(handleDeleteDialogCancel);
bindDeleteDialogConfirm(handleDeleteDialogConfirm);
bindDeletePresetButton(handleDeletePresetClick);
bindInfoButton(handleInfoClick);
bindInstructionPresetChange(handleInstructionPresetChange);
bindModelChange(handleModelChange);
bindSaveDialogCancel(handleSaveDialogCancel);
bindSaveDialogSubmit(handleSaveDialogSubmit);
bindSavePresetButton(handleSavePresetClick);
bindTabs();
bindUpdatePresetButton(handleUpdatePresetClick);

updateBusyState(true);
void Promise.all([initializeModels(), initializeDefaults()]);
