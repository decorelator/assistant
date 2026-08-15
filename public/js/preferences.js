const STORAGE_KEY = "ollama-assistant.preferences.v1";

function readPreferences() {
  try {
    const storedPreferences = localStorage.getItem(STORAGE_KEY);
    const parsedPreferences = storedPreferences ? JSON.parse(storedPreferences) : {};

    return parsedPreferences && typeof parsedPreferences === "object" ? parsedPreferences : {};
  } catch {
    return {};
  }
}

function writePreferences(nextPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readPreferences(), ...nextPreferences }));
  } catch {
    // Preferences are optional when browser storage is unavailable.
  }
}

export function getSavedModel() {
  const model = readPreferences().model;
  return typeof model === "string" ? model : "";
}

export function saveModel(model) {
  writePreferences({ model: typeof model === "string" ? model : "" });
}

export function getLastUsedModel() {
  const model = readPreferences().lastUsedModel;
  return typeof model === "string" ? model : "";
}

export function saveLastUsedModel(model) {
  writePreferences({ lastUsedModel: typeof model === "string" ? model : "" });
}

export function getSavedInstructionPresetId() {
  const presetId = readPreferences().instructionPresetId;
  return Number.isInteger(presetId) && presetId > 0 ? presetId : null;
}

export function saveInstructionPresetId(presetId) {
  writePreferences({ instructionPresetId: Number.isInteger(presetId) && presetId > 0 ? presetId : null });
}

export function getSavedContext() {
  const context = readPreferences().context;
  return typeof context === "string" ? context : "";
}

export function saveContext(context) {
  writePreferences({ context: typeof context === "string" ? context : "" });
}
