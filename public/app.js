const modelSelect = document.querySelector("[data-model-select]");
const messageList = document.querySelector("[data-message-list]");
const status = document.querySelector("[data-status]");
const chatForm = document.querySelector("[data-chat-form]");
const promptInput = document.querySelector("[data-prompt]");
const sendButton = document.querySelector("[data-send-button]");

let availableModels = [];

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

function setBusy(isBusy) {
  if (sendButton) {
    sendButton.disabled = isBusy;
  }

  if (promptInput) {
    promptInput.disabled = isBusy;
  }

  if (modelSelect) {
    modelSelect.disabled = isBusy || availableModels.length === 0;
  }
}

async function sendMessage(model, prompt) {
  const response = await fetch("/api/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to send message");
  }

  return typeof data.response === "string" ? data.response : "";
}

async function handleSubmit(event) {
  event.preventDefault();

  const model = modelSelect?.value?.trim() ?? "";
  const prompt = promptInput?.value?.trim() ?? "";

  if (!model || !prompt) {
    return;
  }

  renderMessage("user", prompt);
  if (promptInput) {
    promptInput.value = "";
  }

  setBusy(true);
  if (status) {
    status.textContent = `Sending to ${model}...`;
  }

  try {
    const reply = await sendMessage(model, prompt);
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
      renderMessage("assistant", `Selected model: ${availableModels[0].name ?? "Unnamed model"}`);
    }
  } catch (error) {
    availableModels = [];
    renderModelOptions([]);

    if (status) {
      status.textContent = error instanceof Error ? error.message : "Could not load models";
    }
  }
}

if (chatForm) {
  chatForm.addEventListener("submit", handleSubmit);
}

void loadModels();
