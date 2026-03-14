const modelSelect = document.querySelector("[data-model-select]");
const modelInfo = document.querySelector("[data-model-info]");
const messageList = document.querySelector("[data-message-list]");
const status = document.querySelector("[data-status]");
const chatForm = document.querySelector("[data-chat-form]");
const instructionInput = document.querySelector("[data-instruction]");
const promptInput = document.querySelector("[data-prompt]");
const clearButton = document.querySelector("[data-clear-button]");
const sendButton = document.querySelector("[data-send-button]");
const infoButton = document.querySelector("[data-info-button]");

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

export function bindInfoButton(handler) {
  infoButton?.addEventListener("click", handler);
}

export function bindModelChange(handler) {
  modelSelect?.addEventListener("change", handler);
}

export function clearMessages() {
  if (messageList) {
    messageList.innerHTML = "";
  }
}

export function focusPrompt() {
  promptInput?.focus();
}

export function getInstructionValue() {
  return instructionInput?.value?.trim() ?? "";
}

export function getPromptValue() {
  return promptInput?.value?.trim() ?? "";
}

export function getSelectedModel() {
  return modelSelect?.value?.trim() ?? "";
}

export function renderMessage(role, text) {
  if (!messageList) {
    return;
  }

  const item = document.createElement("li");
  item.className = `message ${role === "user" ? "message-user" : ""}`.trim();
  item.innerHTML = `
    <span class="message-role">${role}</span>
    <span class="message-text">${escapeHtml(text)}</span>
  `;
  messageList.appendChild(item);
  item.scrollIntoView({ block: "end", behavior: "smooth" });
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

export function setBusy(isBusy, availableModelCount) {
  clearButton && (clearButton.disabled = isBusy);
  sendButton && (sendButton.disabled = isBusy);
  infoButton && (infoButton.disabled = isBusy);
  promptInput && (promptInput.disabled = isBusy);
  instructionInput && (instructionInput.disabled = isBusy);

  if (modelSelect) {
    modelSelect.disabled = isBusy || availableModelCount === 0;
  }
}

export function setDefaults(config) {
  if (instructionInput && typeof config.defaultInstruction === "string") {
    instructionInput.value = config.defaultInstruction;
  }

  if (promptInput && typeof config.defaultPrompt === "string") {
    promptInput.value = config.defaultPrompt;
  }
}

export function setPromptValue(value) {
  if (promptInput) {
    promptInput.value = value;
  }
}

export function setStatus(text) {
  if (status) {
    status.textContent = text;
  }
}
