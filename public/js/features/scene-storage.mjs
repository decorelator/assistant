import { createDefaultSceneDraft, normalizeSceneDraft } from "./scene-state.mjs";

const STORAGE_KEY = "ollama-assistant.scene-draft.v1";

export function loadSceneDraft() {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    const parsedValue = storedValue ? JSON.parse(storedValue) : createDefaultSceneDraft();
    return normalizeSceneDraft(parsedValue, { restoreStopped: true });
  } catch {
    return createDefaultSceneDraft();
  }
}

export function saveSceneDraft(scene) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSceneDraft(scene)));
  } catch {
    // Scene draft persistence is optional.
  }
}

export function clearSceneDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Some browsers can block local storage access.
  }
}
