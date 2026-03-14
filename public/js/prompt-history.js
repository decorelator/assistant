import {
  bindRecentPromptChange,
  getSelectedRecentPromptIndex,
  getPromptValue,
  renderRecentPromptOptions,
  resetPromptPlaceholder,
  resetRecentPromptSelection,
  setPromptPlaceholder,
  setPromptValue,
} from "./ui.js";

const MAX_RECENT_PROMPTS = 20;

export function createPromptHistoryController() {
  let lastSubmittedPrompt = "";
  let recentPrompts = [];

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

  function syncRecentPrompts() {
    renderRecentPromptOptions(
      recentPrompts.map((prompt, index) => ({
        index,
        label: cropPromptHint(prompt),
      })),
    );
  }

  function rememberRecentPrompt(prompt) {
    recentPrompts = [prompt, ...recentPrompts.filter((item) => item !== prompt)].slice(
      0,
      MAX_RECENT_PROMPTS,
    );
    syncRecentPrompts();
  }

  function rememberSubmittedPrompt(prompt) {
    lastSubmittedPrompt = prompt;
    syncPromptHint();
    rememberRecentPrompt(prompt);
  }

  function handleRecentPromptChange() {
    const promptIndex = getSelectedRecentPromptIndex();

    if (promptIndex === null) {
      return;
    }

    const prompt = recentPrompts[promptIndex];

    if (prompt) {
      setPromptValue(prompt);
      resetRecentPromptSelection();
    }
  }

  function clear() {
    lastSubmittedPrompt = "";
    recentPrompts = [];
    resetPromptPlaceholder();
    syncRecentPrompts();
  }

  function initialize() {
    syncPromptHint();
    syncRecentPrompts();
  }

  function bindEvents() {
    bindRecentPromptChange(handleRecentPromptChange);
  }

  return {
    bindEvents,
    clear,
    getPromptForSubmit,
    initialize,
    rememberSubmittedPrompt,
  };
}
