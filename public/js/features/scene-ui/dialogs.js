import { SCENE_BEAT_MOMENT } from "../scene-state-constants.mjs";
import {
  groupCharacterTags,
  renderCharacterTagEditor,
} from "./character-cards.js";
import { setText, syncValue } from "./dom.js";

function getCharacterFallbackName(characterId) {
  return `Character ${characterId}`;
}

export function createSceneDialogs(dom) {
  let editingCharacterId = null;
  let editingBeatId = null;
  let characterTagGroups = groupCharacterTags([]);
  let characterTagSuggestions = [];

  function openCharacterDialog(characterId, character) {
    editingCharacterId = characterId;
    setText(
      dom.characterDialogTitle,
      `Edit ${characterId === "A" ? "Character A" : "Character B"}`,
    );
    syncValue(
      dom.characterTitleInput,
      character.sourceCardTitle || character.name || getCharacterFallbackName(characterId),
    );
    syncValue(
      dom.characterNameInput,
      character.name || getCharacterFallbackName(characterId),
    );
    syncCharacterGender(dom.characterGenderInputs, character.gender || "");
    syncValue(dom.characterAgeInput, character.age ?? "");
    syncCharacterTagGroups(character.tags);
    syncValue(dom.characterCardInput, character.card || "");
    setText(
      dom.characterSource,
      character.sourceCardId
        ? `Library copy: ${character.sourceCardTitle || "Untitled card"}`
        : "Scene copy",
    );
    if (dom.characterSaveLibraryButton) {
      dom.characterSaveLibraryButton.textContent = character.sourceCardId
        ? "Update library"
        : "Save to library";
    }
    setCharacterError("");
    if (dom.characterForm) {
      dom.characterForm.dataset.sourceCardId = character.sourceCardId
        ? String(character.sourceCardId)
        : "";
      dom.characterForm.dataset.sourceCardTitle = character.sourceCardTitle || "";
    }
    dom.characterDialog?.showModal();
    dom.characterNameInput?.focus();
  }

  function closeCharacterDialog() {
    dom.characterDialog?.close();
    editingCharacterId = null;
    setCharacterError("");
  }

  function syncCharacterTagGroups(tags) {
    characterTagGroups = groupCharacterTags(tags);
    renderCharacterTagEditor(dom, characterTagGroups, characterTagSuggestions);
  }

  function setCharacterTagSuggestions(tags) {
    characterTagSuggestions = Array.isArray(tags) ? tags : [];
    renderCharacterTagEditor(dom, characterTagGroups, characterTagSuggestions);
  }

  function addCharacterTag(kind, name) {
    const tagName = typeof name === "string" ? name.trim() : "";

    if (!kind || !tagName || !characterTagGroups[kind]) {
      return;
    }

    if (!characterTagGroups[kind].some((tag) => tag.name.toLowerCase() === tagName.toLowerCase())) {
      characterTagGroups[kind] = [...characterTagGroups[kind], { kind, name: tagName }];
    }

    const input = dom.characterTagEditorInputs?.find(
      (entry) => entry.getAttribute("data-scene-tag-editor-input") === kind,
    );
    syncValue(input, "");
    renderCharacterTagEditor(dom, characterTagGroups, characterTagSuggestions);
  }

  function removeCharacterTag(kind, name) {
    const tagName = typeof name === "string" ? name.trim().toLowerCase() : "";

    if (!kind || !tagName || !characterTagGroups[kind]) {
      return;
    }

    characterTagGroups[kind] = characterTagGroups[kind].filter(
      (tag) => tag.name.toLowerCase() !== tagName,
    );
    renderCharacterTagEditor(dom, characterTagGroups, characterTagSuggestions);
  }

  function refreshCharacterTagEditor() {
    renderCharacterTagEditor(dom, characterTagGroups, characterTagSuggestions);
  }

  function openCharacterLibraryDialog(characterId) {
    editingCharacterId = characterId;
    setText(dom.characterLibraryTarget, `For Character ${characterId}`);
    setLibraryError("");
    dom.characterLibraryDialog?.showModal();
    dom.characterLibrarySearch?.focus();
  }

  function closeCharacterLibraryDialog() {
    dom.characterLibraryDialog?.close();
    setLibraryError("");
  }

  function openBeatDialog(beat, exchangeCount) {
    editingBeatId = beat?.id ?? null;
    setText(dom.beatDialogTitle, beat ? "Edit beat" : "Add beat");
    syncValue(dom.beatPairInput, beat?.pairNumber ?? Math.max(1, exchangeCount || 1));
    syncValue(dom.beatMomentInput, beat?.moment ?? SCENE_BEAT_MOMENT.PAIR);
    syncValue(dom.beatTextInput, beat?.text ?? "");
    setBeatError("");
    dom.beatDialog?.showModal();
    dom.beatTextInput?.focus();
  }

  function closeBeatDialog() {
    dom.beatDialog?.close();
    editingBeatId = null;
    setBeatError("");
  }

  function setBeatError(message) {
    if (dom.beatError) {
      dom.beatError.textContent = message;
      dom.beatError.hidden = !message;
    }
  }

  function setCharacterError(message) {
    if (dom.characterError) {
      dom.characterError.textContent = message;
      dom.characterError.hidden = !message;
    }
  }

  function setLibraryError(message) {
    if (dom.characterLibraryError) {
      dom.characterLibraryError.textContent = message;
      dom.characterLibraryError.hidden = !message;
    }
  }

  return {
    closeBeatDialog,
    closeCharacterDialog,
    closeCharacterLibraryDialog,
    getEditingBeatId: () => editingBeatId,
    getEditingCharacterId: () => editingCharacterId,
    openBeatDialog,
    openCharacterDialog,
    openCharacterLibraryDialog,
    addCharacterTag,
    getCharacterTagGroups: () => characterTagGroups,
    removeCharacterTag,
    refreshCharacterTagEditor,
    setBeatError,
    setCharacterError,
    setCharacterTagSuggestions,
    setLibraryError,
  };
}

function syncCharacterGender(inputs, value) {
  const legacyGenderValues = {
    "муж": "male",
    "жен": "female",
    "небинарн": "non-binary",
    "другое": "other",
  };
  const rawValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  const normalizedValue = legacyGenderValues[rawValue] ?? rawValue;

  for (const input of inputs ?? []) {
    if (input instanceof HTMLInputElement) {
      input.checked = input.value === normalizedValue;
    }
  }
}
