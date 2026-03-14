import {
  getPromptValue,
  resetPromptPlaceholder,
  setPromptPlaceholder,
} from "./ui.js";

export function createPromptHistoryController() {
  let lastSubmittedPrompt = "";

  function cropPromptHint(prompt) {
    const singleLinePrompt = prompt.replace(/\s+/g, " ").trim();

    if (!singleLinePrompt) {
      return "";
    }

    return singleLinePrompt.length > 50 ? `${singleLinePrompt.slice(0, 50)}...` : singleLinePrompt;
  }

  function syncPromptHint() {
    if (!lastSubmittedPrompt) {
      resetPromptPlaceholder();
      return;
    }

    setPromptPlaceholder(cropPromptHint(lastSubmittedPrompt));
  }

  function getPromptForSubmit() {
    return getPromptValue() || lastSubmittedPrompt;
  }

  function rememberSubmittedPrompt(prompt) {
    lastSubmittedPrompt = prompt;
    syncPromptHint();
  }

  function clear() {
    lastSubmittedPrompt = "";
    resetPromptPlaceholder();
  }

  function initialize() {
    syncPromptHint();
  }

  return {
    clear,
    getPromptForSubmit,
    initialize,
    rememberSubmittedPrompt,
  };
}
