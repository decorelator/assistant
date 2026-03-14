const modelSelect = document.querySelector("[data-model-select]");
const modelInfo = document.querySelector("[data-model-info]");
const messageList = document.querySelector("[data-message-list]");
const status = document.querySelector("[data-status]");
const chatForm = document.querySelector("[data-chat-form]");
const instructionInput = document.querySelector("[data-instruction]");
const instructionPresetSelect = document.querySelector("[data-instruction-preset-select]");
const instructionSource = document.querySelector("[data-instruction-source]");
const promptInput = document.querySelector("[data-prompt]");
const clearButton = document.querySelector("[data-clear-button]");
const deleteDialog = document.querySelector("[data-delete-preset-dialog]");
const deleteDialogCancelButton = document.querySelector("[data-delete-dialog-cancel]");
const deleteDialogConfirmButton = document.querySelector("[data-delete-dialog-confirm]");
const deleteDialogCopy = document.querySelector("[data-delete-dialog-copy]");
const sendButton = document.querySelector("[data-send-button]");
const infoButton = document.querySelector("[data-info-button]");
const emptyState = document.querySelector("[data-empty-state]");
const presetTitleError = document.querySelector("[data-preset-title-error]");
const presetTitleInput = document.querySelector("[data-preset-title-input]");
const saveDialog = document.querySelector("[data-save-preset-dialog]");
const saveDialogCancelButton = document.querySelector("[data-save-dialog-cancel]");
const saveDialogForm = document.querySelector("[data-save-preset-form]");
const savePresetButton = document.querySelector("[data-save-preset-button]");
const updatePresetButton = document.querySelector("[data-update-preset-button]");
const deletePresetButton = document.querySelector("[data-delete-preset-button]");
const tabButtons = Array.from(document.querySelectorAll("[data-tab-button]"));
const tabPanels = Array.from(document.querySelectorAll("[data-tab-panel]"));
const defaultPromptPlaceholder = promptInput?.getAttribute("placeholder") ?? "Ask something...";
let hasInstructionPresets = false;
let instructionPresetSelectionEnabled = false;
let isBusyState = false;

function syncInstructionPresetControls() {
  if (instructionPresetSelect) {
    instructionPresetSelect.disabled = isBusyState || !hasInstructionPresets;
  }

  savePresetButton && (savePresetButton.disabled = isBusyState);
  updatePresetButton && (updatePresetButton.disabled = isBusyState || !instructionPresetSelectionEnabled);
  deletePresetButton && (deletePresetButton.disabled = isBusyState || !instructionPresetSelectionEnabled);
}

function scrollPageToBottom() {
  requestAnimationFrame(() => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  });
}

function setActiveTab(tabName) {
  for (const button of tabButtons) {
    const isActive = button.getAttribute("data-tab-target") === tabName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  }

  for (const panel of tabPanels) {
    const isActive = panel.getAttribute("data-tab-name") === tabName;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "Unknown size";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function bindChatForm(handler) {
  chatForm?.addEventListener("submit", handler);
}

export function bindClearButton(handler) {
  clearButton?.addEventListener("click", handler);
}

export function bindDeleteDialogCancel(handler) {
  deleteDialogCancelButton?.addEventListener("click", handler);
}

export function bindDeleteDialogConfirm(handler) {
  deleteDialogConfirmButton?.addEventListener("click", handler);
}

export function bindInfoButton(handler) {
  infoButton?.addEventListener("click", handler);
}

export function bindModelChange(handler) {
  modelSelect?.addEventListener("change", handler);
}

export function bindInstructionPresetChange(handler) {
  instructionPresetSelect?.addEventListener("change", handler);
}

export function bindSaveDialogCancel(handler) {
  saveDialogCancelButton?.addEventListener("click", handler);
}

export function bindSaveDialogSubmit(handler) {
  saveDialogForm?.addEventListener("submit", handler);
}

export function bindSavePresetButton(handler) {
  savePresetButton?.addEventListener("click", handler);
}

export function bindUpdatePresetButton(handler) {
  updatePresetButton?.addEventListener("click", handler);
}

export function bindDeletePresetButton(handler) {
  deletePresetButton?.addEventListener("click", handler);
}

export function bindTabs() {
  for (const button of tabButtons) {
    button.addEventListener("click", () => {
      const tabName = button.getAttribute("data-tab-target");

      if (tabName) {
        setActiveTab(tabName);
      }
    });
  }
}

export function clearMessages() {
  if (messageList) {
    messageList.innerHTML = "";
  }

  if (emptyState && messageList) {
    messageList.appendChild(emptyState);
  }
}

export function focusPrompt() {
  promptInput?.focus();
  setActiveTab("msg");
}

export function getInstructionValue() {
  return instructionInput?.value ?? "";
}

export function getPromptValue() {
  return promptInput?.value?.trim() ?? "";
}

export function getPresetTitleValue() {
  return presetTitleInput?.value?.trim() ?? "";
}

export function getSelectedModel() {
  return modelSelect?.value?.trim() ?? "";
}

export function getSelectedInstructionPresetId() {
  const value = instructionPresetSelect?.value?.trim() ?? "";
  return value ? Number.parseInt(value, 10) : null;
}

export function renderMessage(role, text) {
  if (!messageList) {
    return;
  }

  emptyState?.remove();

  const item = document.createElement("li");
  item.className = `message ${role === "user" ? "message-user" : ""}`.trim();
  item.innerHTML = `
    <span class="message-role">${role}</span>
    <span class="message-text">${escapeHtml(text)}</span>
  `;
  messageList.appendChild(item);
  scrollPageToBottom();
}

export function markMessagesAsStale() {
  if (!messageList) {
    return;
  }

  for (const item of messageList.children) {
    item.classList.add("message-stale");
  }
}

export function renderModelInfo(text) {
  if (!modelInfo) {
    return;
  }

  modelInfo.textContent = text;
  modelInfo.scrollTop = 0;
}

export function renderModelOptions(models) {
  if (!modelSelect) {
    return;
  }

  modelSelect.innerHTML = "";

  if (models.length === 0) {
    modelSelect.innerHTML = '<option value="">No models available</option>';
    modelSelect.disabled = true;
    return;
  }

  for (const model of models) {
    const title = model.name ?? "Unnamed model";
    const size = formatBytes(model.size);
    const option = document.createElement("option");
    option.value = title;
    option.textContent = `${title} - ${size}`;
    modelSelect.appendChild(option);
  }

  modelSelect.disabled = false;
}

export function renderInstructionPresetOptions(presets, selectedPresetId) {
  if (!instructionPresetSelect) {
    return;
  }

  hasInstructionPresets = presets.length > 0;
  instructionPresetSelect.innerHTML = "";

  if (!hasInstructionPresets) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved presets";
    instructionPresetSelect.appendChild(option);
    syncInstructionPresetControls();
    return;
  }

  for (const preset of presets) {
    const option = document.createElement("option");
    option.value = String(preset.id);
    option.textContent = preset.title ?? "Untitled preset";
    instructionPresetSelect.appendChild(option);
  }

  if (selectedPresetId) {
    instructionPresetSelect.value = String(selectedPresetId);
  }

  syncInstructionPresetControls();
}

export function setBusy(isBusy, availableModelCount) {
  isBusyState = isBusy;
  clearButton && (clearButton.disabled = isBusy);
  sendButton && (sendButton.disabled = isBusy);
  infoButton && (infoButton.disabled = isBusy);
  promptInput && (promptInput.disabled = isBusy);
  instructionInput && (instructionInput.disabled = isBusy);

  if (modelSelect) {
    modelSelect.disabled = isBusy || availableModelCount === 0;
  }

  syncInstructionPresetControls();
}

export function setDefaults(config) {
  if (promptInput && typeof config.defaultPrompt === "string") {
    promptInput.value = config.defaultPrompt;
  }
}

export function setDeleteDialogCopy(text) {
  if (deleteDialogCopy) {
    deleteDialogCopy.textContent = text;
  }
}

export function setInstructionPresetActions(canModifySelectedPreset) {
  instructionPresetSelectionEnabled = canModifySelectedPreset;
  syncInstructionPresetControls();
}

export function setInstructionSource(text) {
  if (instructionSource) {
    instructionSource.textContent = text;
  }
}

export function setInstructionValue(value) {
  if (instructionInput) {
    instructionInput.value = value;
  }
}

export function setPresetTitleError(message) {
  if (!presetTitleError) {
    return;
  }

  presetTitleError.textContent = message;
  presetTitleError.hidden = !message;
}

export function openDeleteDialog() {
  deleteDialog?.showModal();
}

export function openSaveDialog() {
  if (!saveDialog) {
    return;
  }

  setPresetTitleValue("");
  setPresetTitleError("");
  saveDialog.showModal();
  presetTitleInput?.focus();
}

export function closeDeleteDialog() {
  deleteDialog?.close();
}

export function closeSaveDialog() {
  saveDialog?.close();
}

export function setPromptValue(value) {
  if (promptInput) {
    promptInput.value = value;
  }
}

export function setPromptPlaceholder(value) {
  if (promptInput) {
    promptInput.placeholder = value || defaultPromptPlaceholder;
  }
}

export function resetPromptPlaceholder() {
  if (promptInput) {
    promptInput.placeholder = defaultPromptPlaceholder;
  }
}

export function setPresetTitleValue(value) {
  if (presetTitleInput) {
    presetTitleInput.value = value;
  }
}

export function setStatus(text) {
  if (status) {
    status.textContent = text;
  }
}
