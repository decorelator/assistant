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

let availableModels = [];
let lastPrompt = "";

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

function renderModelOptions(models) {
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

function renderMessage(role, text) {
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

function markMessagesAsStale() {
  if (!messageList) {
    return;
  }

  for (const item of messageList.children) {
    item.classList.add("message-stale");
  }
}

function renderModelInfo(text) {
  if (!modelInfo) {
    return;
  }

  modelInfo.textContent = text;
  modelInfo.scrollTop = 0;
}

function clearMessages() {
  if (messageList) {
    messageList.innerHTML = "";
  }

  lastPrompt = "";
}

function setBusy(isBusy) {
  if (clearButton) {
    clearButton.disabled = isBusy;
  }

  if (sendButton) {
    sendButton.disabled = isBusy;
  }

  if (infoButton) {
    infoButton.disabled = isBusy;
  }

  if (promptInput) {
    promptInput.disabled = isBusy;
  }

  if (instructionInput) {
    instructionInput.disabled = isBusy;
  }

  if (modelSelect) {
    modelSelect.disabled = isBusy || availableModels.length === 0;
  }
}

async function sendMessage(model, prompt, instruction) {
  const response = await fetch("/api/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, instruction }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to send message");
  }

  return typeof data.response === "string" ? data.response : "";
}

async function loadModelInfo(model) {
  const response = await fetch("/api/model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load model info");
  }

  return typeof data.details === "string" ? data.details : "No model info available.";
}

async function loadConfig() {
  const response = await fetch("/api/config");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load app config");
  }

  return data;
}

async function handleSubmit(event) {
  event.preventDefault();

  const model = modelSelect?.value?.trim() ?? "";
  const instruction = instructionInput?.value?.trim() ?? "";
  const typedPrompt = promptInput?.value?.trim() ?? "";
  const prompt = typedPrompt || lastPrompt;

  if (!model || !prompt) {
    if (status) {
      status.textContent = "Write a message first.";
    }
    return;
  }

  lastPrompt = prompt;
  markMessagesAsStale();
  renderMessage("user", prompt);
  if (promptInput) {
    promptInput.value = "";
  }

  setBusy(true);
  if (status) {
    status.textContent = `Sending to ${model}...`;
  }

  try {
    const reply = await sendMessage(model, prompt, instruction);
    renderMessage("assistant", reply || "No response from model.");

    if (status) {
      status.textContent = `Ready with ${model}`;
    }
  } catch (error) {
    renderMessage("assistant", error instanceof Error ? error.message : "Request failed");

    if (status) {
      status.textContent = "Message failed";
    }
  } finally {
    setBusy(false);
    promptInput?.focus();
  }
}

async function handleInfoClick() {
  const model = modelSelect?.value?.trim() ?? "";

  if (!model) {
    return;
  }

  setBusy(true);
  if (status) {
    status.textContent = `Loading info for ${model}...`;
  }

  try {
    const details = await loadModelInfo(model);
    renderModelInfo(details);

    if (status) {
      status.textContent = `Info loaded for ${model}`;
    }
  } catch (error) {
    renderModelInfo(error instanceof Error ? error.message : "Could not load model info");

    if (status) {
      status.textContent = "Model info failed";
    }
  } finally {
    setBusy(false);
  }
}

async function loadModels() {
  if (status) {
    status.textContent = "Loading models...";
  }

  try {
    const response = await fetch("/api/models");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load models");
    }

    availableModels = Array.isArray(data.models) ? data.models : [];
    renderModelOptions(availableModels);

    if (status) {
      status.textContent = `${availableModels.length} model${availableModels.length === 1 ? "" : "s"} available`;
    }

    if (availableModels.length > 0) {
      renderModelInfo(`Current model: ${availableModels[0].name ?? "Unnamed model"}`);
    }
  } catch (error) {
    availableModels = [];
    renderModelOptions([]);
    renderModelInfo("Could not load model info.");

    if (status) {
      status.textContent = error instanceof Error ? error.message : "Could not load models";
    }
  }
}

async function loadDefaults() {
  if (!instructionInput && !promptInput) {
    return;
  }

  try {
    const config = await loadConfig();

    if (instructionInput && typeof config.defaultInstruction === "string") {
      instructionInput.value = config.defaultInstruction;
    }

    if (promptInput && typeof config.defaultPrompt === "string") {
      promptInput.value = config.defaultPrompt;
    }
  } catch {
    // Keep inputs empty if config loading fails.
  }
}

function handleClearClick() {
  clearMessages();

  if (status) {
    status.textContent = "Messages cleared.";
  }

  promptInput?.focus();
}

if (chatForm) {
  chatForm.addEventListener("submit", handleSubmit);
}

if (clearButton) {
  clearButton.addEventListener("click", handleClearClick);
}

if (infoButton) {
  infoButton.addEventListener("click", handleInfoClick);
}

if (modelSelect) {
  modelSelect.addEventListener("change", () => {
    const model = modelSelect.value.trim();
    renderModelInfo(model ? `Current model: ${model}` : "Select a model and tap Model info.");
  });
}

void Promise.all([loadModels(), loadDefaults()]);
