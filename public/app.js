const modelList = document.querySelector("[data-model-list]");
const status = document.querySelector("[data-status]");

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

function formatDate(value) {
  if (!value) {
    return "Unknown update date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown update date";
  }

  return date.toLocaleString();
}

function renderModels(models) {
  if (!modelList) {
    return;
  }

  modelList.innerHTML = "";

  if (models.length === 0) {
    modelList.innerHTML = "<li>No local models found.</li>";
    return;
  }

  for (const model of models) {
    const item = document.createElement("li");
    const title = model.name ?? "Unnamed model";
    const size = formatBytes(model.size);
    const updated = formatDate(model.modified_at);

    item.innerHTML = `
      <strong>${title}</strong>
      <span>${size}</span>
      <span>${updated}</span>
    `;
    modelList.appendChild(item);
  }
}

async function loadModels() {
  if (status) {
    status.textContent = "Loading models from your local Ollama install...";
  }

  try {
    const response = await fetch("/api/models");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load models");
    }

    const models = Array.isArray(data.models) ? data.models : [];
    renderModels(models);

    if (status) {
      const suffix = data.baseUrl ? ` via ${data.baseUrl}` : "";
      status.textContent = `${models.length} model${models.length === 1 ? "" : "s"} available${suffix}`;
    }
  } catch (error) {
    if (modelList) {
      modelList.innerHTML = "";
    }

    if (status) {
      status.textContent =
        error instanceof Error ? error.message : "Failed to load models from Ollama";
    }

    try {
      const response = await fetch("/api/models");
      const data = await response.json();
      if (!response.ok && Array.isArray(data.attempts) && modelList) {
        modelList.innerHTML = data.attempts.map((attempt) => `<li>${attempt}</li>`).join("");
      }
    } catch {
      // Keep the initial error text if the diagnostics fetch also fails.
    }
  }
}

void loadModels();
