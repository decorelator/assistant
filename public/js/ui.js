import { renderMessageMarkdown } from "./message-markdown.mjs";
import { installMobileViewportHandling } from "./ui/mobile-viewport.js";
import { formatModelOptionLabel, renderSelectOptions } from "./ui/selects.js";

const modelSelect = document.querySelector("[data-model-select]");
const modelInfo = document.querySelector("[data-model-info]");
const messageList = document.querySelector("[data-message-list]");
const status = document.querySelector("[data-status]");
const chatForm = document.querySelector("[data-chat-form]");
const instructionInput = document.querySelector("[data-instruction]");
const instructionPresetSelect = document.querySelector("[data-instruction-preset-select]");
const instructionSource = document.querySelector("[data-instruction-source]");
const promptInput = document.querySelector("[data-prompt]");
const contextInput = document.querySelector("[data-context]");
const directorInput = document.querySelector("[data-director]");
const recentPromptsSelect = document.querySelector("[data-recent-prompts-select]");
const clearButton = document.querySelector("[data-clear-button]");
const copyChatButton = document.querySelector("[data-copy-chat-button]");
const deleteDialog = document.querySelector("[data-delete-preset-dialog]");
const deleteDialogCancelButton = document.querySelector("[data-delete-dialog-cancel]");
const deleteDialogConfirmButton = document.querySelector("[data-delete-dialog-confirm]");
const deleteDialogCopy = document.querySelector("[data-delete-dialog-copy]");
const deleteModelButton = document.querySelector("[data-delete-model-button]");
const deleteModelDialog = document.querySelector("[data-delete-model-dialog]");
const deleteModelDialogCancelButton = document.querySelector("[data-delete-model-dialog-cancel]");
const deleteModelDialogConfirmButton = document.querySelector("[data-delete-model-dialog-confirm]");
const deleteModelDialogCopy = document.querySelector("[data-delete-model-dialog-copy]");
const sendButton = document.querySelector("[data-send-button]");
const stopButton = document.querySelector("[data-stop-button]");
const startOllamaButton = document.querySelector("[data-start-ollama-button]");
const infoButton = document.querySelector("[data-info-button]");
const refreshModelsButton = document.querySelector("[data-refresh-models-button]");
const currentInstructionName = document.querySelector("[data-current-instruction-name]");
const currentModelName = document.querySelector("[data-current-model-name]");
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
let canStopGeneration = false;
let assistantTranslateEnabled = false;
let assistantTranslateHandler = null;

installMobileViewportHandling();

function syncMessageIncludeCheckboxes() {
  const includeCheckboxes = document.querySelectorAll("[data-message-include-checkbox]");

  for (const checkbox of includeCheckboxes) {
    checkbox.disabled = isBusyState;
  }
}

function syncInstructionPresetControls() {
  if (instructionPresetSelect) {
    instructionPresetSelect.disabled = isBusyState || !hasInstructionPresets;
  }

  savePresetButton && (savePresetButton.disabled = isBusyState);
  updatePresetButton && (updatePresetButton.disabled = isBusyState || !instructionPresetSelectionEnabled);
  deletePresetButton && (deletePresetButton.disabled = isBusyState || !instructionPresetSelectionEnabled);
}

function syncAssistantTranslateButtons() {
  const translateButtons = document.querySelectorAll("[data-message-translate-button]");

  for (const button of translateButtons) {
    button.disabled = isBusyState || !assistantTranslateEnabled;
  }
}

function syncStopButton() {
  if (stopButton) {
    stopButton.disabled = !canStopGeneration;
  }
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

export { formatModelOptionLabel, renderSelectOptions } from "./ui/selects.js";

export function bindChatForm(handler) {
  chatForm?.addEventListener("submit", handler);
}

export function bindContextChange(handler) {
  contextInput?.addEventListener("input", handler);
}

export function bindClearButton(handler) {
  clearButton?.addEventListener("click", handler);
}

export function bindCopyChatButton(handler) {
  copyChatButton?.addEventListener("click", handler);
}

export function bindRecentPromptChange(handler) {
  recentPromptsSelect?.addEventListener("change", handler);
}

export function bindDeleteDialogCancel(handler) {
  deleteDialogCancelButton?.addEventListener("click", handler);
}

export function bindDeleteDialogConfirm(handler) {
  deleteDialogConfirmButton?.addEventListener("click", handler);
}

export function bindDeleteModelButton(handler) {
  deleteModelButton?.addEventListener("click", handler);
}

export function bindDeleteModelDialogCancel(handler) {
  deleteModelDialogCancelButton?.addEventListener("click", handler);
}

export function bindDeleteModelDialogConfirm(handler) {
  deleteModelDialogConfirmButton?.addEventListener("click", handler);
}

export function bindInfoButton(handler) {
  infoButton?.addEventListener("click", handler);
}

export function bindStartOllamaButton(handler) {
  startOllamaButton?.addEventListener("click", handler);
}

export function bindStopButton(handler) {
  stopButton?.addEventListener("click", handler);
}

export function bindRefreshModelsButton(handler) {
  refreshModelsButton?.addEventListener("click", handler);
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

export function bindAssistantTranslate(handler) {
  assistantTranslateHandler = handler;
  syncAssistantTranslateButtons();
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

export function getDirectorValue() {
  return directorInput?.value?.trim() ?? "";
}

export function getContextValue() {
  return contextInput?.value?.trim() ?? "";
}

export function setContextValue(value) {
  if (contextInput) {
    contextInput.value = typeof value === "string" ? value : "";
  }
}

export function clearDirectorValue() {
  if (directorInput) {
    directorInput.value = "";
  }
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

export function getSelectedRecentPromptIndex() {
  const value = recentPromptsSelect?.value?.trim() ?? "";
  return value ? Number.parseInt(value, 10) : null;
}

export function bindMessageIncludeChange(handler) {
  messageList?.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.matches("[data-message-include-checkbox]")) {
      handler();
    }
  });
}

export function getMessagesForStorage() {
  if (!messageList) {
    return [];
  }

  return Array.from(messageList.querySelectorAll("[data-message-role]")).flatMap((item) => {
    const role = item.getAttribute("data-message-role") ?? "";
    const text = item.querySelector(".message-text")?.getAttribute("data-message-raw-text") ?? "";
    const checkbox = item.querySelector("[data-message-include-checkbox]");

    if ((role !== "user" && role !== "assistant") || !text) {
      return [];
    }

    return [{
      role,
      text,
      metadata: {
        modelName: item.getAttribute("data-message-model") ?? undefined,
        instructionName: item.getAttribute("data-message-instruction-name") ?? undefined,
        included: checkbox instanceof HTMLInputElement ? checkbox.checked : true,
      },
    }];
  });
}

export function getChatTranscript() {
  if (!messageList) {
    return "";
  }

  return Array.from(messageList.querySelectorAll("[data-message-role]")).flatMap((item) => {
    const role = item.getAttribute("data-message-role");
    const text = item.querySelector(".message-text")?.getAttribute("data-message-raw-text")?.trim();

    if ((role !== "user" && role !== "assistant") || !text) {
      return [];
    }

    return [`${role === "user" ? "User" : "Assistant"}:\n${text}`];
  }).join("\n\n");
}

export function showChatCopied() {
  if (!copyChatButton) {
    return;
  }

  copyChatButton.textContent = "Copied";
  setTimeout(() => {
    copyChatButton.textContent = "Copy chat";
  }, 1200);
}

export function getIncludedMessages() {
  if (!messageList) {
    return [];
  }

  return Array.from(messageList.querySelectorAll("[data-message-role]")).flatMap((item) => {
    const checkbox = item.querySelector("[data-message-include-checkbox]");
    const textElement = item.querySelector(".message-text");
    const role = item.getAttribute("data-message-role") ?? "";
    const text = textElement?.getAttribute("data-message-raw-text")?.trim() ?? "";

    if (!(checkbox instanceof HTMLInputElement) || !checkbox.checked || !text) {
      return [];
    }

    if (role !== "user" && role !== "assistant") {
      return [];
    }

    return [{ role, text }];
  });
}

export function renderMessage(role, text, metadata = {}) {
  if (!messageList) {
    return;
  }

  emptyState?.remove();

  const item = document.createElement("li");
  item.className = `message ${role === "user" ? "message-user" : ""}`.trim();
  item.setAttribute("data-message-role", role);
  const isSelectableMessage = role === "user" || role === "assistant";
  const headerElement = document.createElement("div");
  headerElement.className = "message-header";
  const roleMetaElement = document.createElement("div");
  roleMetaElement.className = "message-heading";
  const roleElement = document.createElement("span");
  roleElement.className = "message-role";
  roleElement.textContent = role;
  roleMetaElement.appendChild(roleElement);

  if (role === "assistant") {
    const detailParts = [];

    if (typeof metadata.modelName === "string" && metadata.modelName.trim()) {
      item.setAttribute("data-message-model", metadata.modelName);
      detailParts.push(`Model: ${metadata.modelName}`);
    }

    if (typeof metadata.instructionName === "string" && metadata.instructionName.trim()) {
      item.setAttribute("data-message-instruction-name", metadata.instructionName);
      detailParts.push(`Instruction: ${metadata.instructionName}`);
    }

    if (detailParts.length > 0) {
      const detailsElement = document.createElement("span");
      detailsElement.className = "message-details";
      detailsElement.textContent = detailParts.join(" | ");
      roleMetaElement.appendChild(detailsElement);
    }
  }

  headerElement.appendChild(roleMetaElement);

  if (isSelectableMessage) {
    const includeLabel = document.createElement("label");
    includeLabel.className = "message-include-toggle";

    const includeCheckbox = document.createElement("input");
    includeCheckbox.type = "checkbox";
    includeCheckbox.className = "message-include-checkbox";
    includeCheckbox.checked = metadata.included !== false;
    includeCheckbox.disabled = isBusyState;
    includeCheckbox.setAttribute("data-message-include-checkbox", "");
    includeCheckbox.setAttribute("aria-label", `Include ${role} message in next request`);

    const includeText = document.createElement("span");
    includeText.textContent = "Use";

    includeLabel.appendChild(includeCheckbox);
    includeLabel.appendChild(includeText);
    headerElement.appendChild(includeLabel);
  }

  const textElement = document.createElement("span");
  textElement.className = "message-text";
  textElement.setAttribute("data-message-raw-text", text);
  textElement.innerHTML = renderMessageMarkdown(text);

  item.appendChild(headerElement);
  item.appendChild(textElement);

  if (isSelectableMessage) {
    const actionsElement = document.createElement("div");
    actionsElement.className = "message-actions";

    const translateButton = document.createElement("button");
    translateButton.type = "button";
    translateButton.className = "button-secondary message-copy-button";
    translateButton.textContent = "Translate";
    translateButton.setAttribute("data-message-translate-button", "");
    translateButton.disabled = isBusyState || !assistantTranslateEnabled;
    translateButton.addEventListener("click", () => {
      assistantTranslateHandler?.(text);
    });

    actionsElement.appendChild(translateButton);

    if (role !== "user") {
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "button-secondary message-copy-button";
      copyButton.textContent = "Copy";
      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(text);
          copyButton.textContent = "Copied";
          setTimeout(() => {
            copyButton.textContent = "Copy";
          }, 1200);
        } catch {
          copyButton.textContent = "Failed";
          setTimeout(() => {
            copyButton.textContent = "Copy";
          }, 1200);
        }
      });

      actionsElement.appendChild(copyButton);
    }

    item.appendChild(actionsElement);
  }

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

export function renderModelOptions(models, selectedValue = getSelectedModel()) {
  if (!modelSelect) {
    return;
  }

  const hasModels = renderSelectOptions(modelSelect, models, {
    emptyLabel: "No models available",
    getValue: (model) => model?.name ?? "Unnamed model",
    getLabel: formatModelOptionLabel,
    selectedValue,
  });

  modelSelect.disabled = !hasModels;
}

export function renderRecentPromptOptions(prompts) {
  if (!recentPromptsSelect) {
    return;
  }

  recentPromptsSelect.innerHTML = "";

  if (prompts.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No recent messages";
    recentPromptsSelect.appendChild(option);
    recentPromptsSelect.disabled = true;
    return;
  }

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = "Choose a recent message";
  recentPromptsSelect.appendChild(placeholderOption);

  for (const prompt of prompts) {
    const option = document.createElement("option");
    option.value = String(prompt.index);
    option.textContent = prompt.label;
    recentPromptsSelect.appendChild(option);
  }

  recentPromptsSelect.value = "";
  recentPromptsSelect.disabled = false;
}

export function resetRecentPromptSelection() {
  if (recentPromptsSelect) {
    recentPromptsSelect.value = "";
  }
}

export function renderInstructionPresetOptions(presets, selectedPresetId) {
  if (!instructionPresetSelect) {
    return;
  }

  hasInstructionPresets = renderSelectOptions(instructionPresetSelect, presets, {
    emptyLabel: "No saved presets",
    getValue: (preset) => preset?.id ?? "",
    getLabel: (preset) => preset?.title ?? "Untitled preset",
    selectedValue: selectedPresetId,
  });

  syncInstructionPresetControls();
}

export function setBusy(isBusy, availableModelCount) {
  isBusyState = isBusy;
  clearButton && (clearButton.disabled = isBusy);
  deleteModelButton && (deleteModelButton.disabled = isBusy || availableModelCount === 0);
  sendButton && (sendButton.disabled = isBusy);
  infoButton && (infoButton.disabled = isBusy);
  startOllamaButton && (startOllamaButton.disabled = isBusy);
  refreshModelsButton && (refreshModelsButton.disabled = isBusy);
  recentPromptsSelect && (recentPromptsSelect.disabled = isBusy || recentPromptsSelect.options.length <= 1);
  promptInput && (promptInput.disabled = isBusy);
  contextInput && (contextInput.disabled = isBusy);
  directorInput && (directorInput.disabled = isBusy);
  instructionInput && (instructionInput.disabled = isBusy);

  if (modelSelect) {
    modelSelect.disabled = isBusy || availableModelCount === 0;
  }

  syncInstructionPresetControls();
  syncAssistantTranslateButtons();
  syncMessageIncludeCheckboxes();
  syncStopButton();
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

export function setCurrentInstructionName(name) {
  if (currentInstructionName) {
    currentInstructionName.textContent = `Instruction: ${name || ".env fallback"}`;
  }
}

export function setCurrentModelName(name) {
  if (currentModelName) {
    currentModelName.textContent = `Model: ${name || "Not selected"}`;
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

export function openDeleteModelDialog() {
  deleteModelDialog?.showModal();
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

export function closeDeleteModelDialog() {
  deleteModelDialog?.close();
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

export function setDeleteModelDialogCopy(text) {
  if (deleteModelDialogCopy) {
    deleteModelDialogCopy.textContent = text;
  }
}

export function setAssistantTranslateEnabled(isEnabled) {
  assistantTranslateEnabled = isEnabled;
  syncAssistantTranslateButtons();
}

export function setStopEnabled(isEnabled) {
  canStopGeneration = isEnabled;
  syncStopButton();
}
