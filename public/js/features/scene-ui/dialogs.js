import { SCENE_BEAT_MOMENT } from "../scene-state-constants.mjs";
import { setText, syncValue } from "./dom.js";

function getCharacterFallbackName(characterId) {
  return `Character ${characterId}`;
}

export function createSceneDialogs(dom) {
  let editingCharacterId = null;
  let editingBeatId = null;

  function openCharacterDialog(characterId, character) {
    editingCharacterId = characterId;
    setText(
      dom.characterDialogTitle,
      `Edit ${characterId === "A" ? "Character A" : "Character B"}`,
    );
    syncValue(
      dom.characterNameInput,
      character.name || getCharacterFallbackName(characterId),
    );
    syncValue(dom.characterCardInput, character.card || "");
    dom.characterDialog?.showModal();
    dom.characterNameInput?.focus();
  }

  function closeCharacterDialog() {
    dom.characterDialog?.close();
    editingCharacterId = null;
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

  return {
    closeBeatDialog,
    closeCharacterDialog,
    getEditingBeatId: () => editingBeatId,
    getEditingCharacterId: () => editingCharacterId,
    openBeatDialog,
    openCharacterDialog,
    setBeatError,
  };
}
