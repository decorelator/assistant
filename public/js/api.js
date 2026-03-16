async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error ?? "Request failed");
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function loadModels() {
  const data = await requestJson("/api/models");
  return Array.isArray(data.models) ? data.models : [];
}

export async function loadModelInfo(model) {
  const data = await requestJson("/api/model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });

  return typeof data.details === "string" ? data.details : "No model info available.";
}

export async function stopModel(model) {
  return requestJson("/api/model/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
}

export async function stopGeneration() {
  return requestJson("/api/message/stop", {
    method: "POST",
  });
}

export async function loadConfig() {
  return requestJson("/api/config");
}

export async function loadInstructionPresets() {
  const data = await requestJson("/api/instruction-presets");
  return Array.isArray(data.presets) ? data.presets : [];
}

export async function saveInstructionPreset(title, instructionText) {
  const data = await requestJson("/api/instruction-presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, instructionText }),
  });

  return data.preset ?? null;
}

export async function updateInstructionPreset(id, instructionText) {
  const data = await requestJson(`/api/instruction-presets/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructionText }),
  });

  return data.preset ?? null;
}

export async function deleteInstructionPreset(id) {
  return requestJson(`/api/instruction-presets/${id}`, {
    method: "DELETE",
  });
}

export async function sendMessage(model, prompt, instruction, presetId = null) {
  const data = await requestJson("/api/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, instruction, presetId }),
  });

  return typeof data.response === "string" ? data.response : "";
}
