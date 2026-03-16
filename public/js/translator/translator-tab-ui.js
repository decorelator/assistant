import { renderSelectOptions } from "../ui.js";

const DEFAULT_TRANSLATOR_SUMMARY = "Translator settings are runtime-only. Nothing has been applied yet.";

function buildTranslatorTabMarkup() {
  return `
    <div class="field">
      <label class="label" for="translator-model-select">Translator model</label>
      <select id="translator-model-select" data-translator-model-select disabled>
        <option value="">Loading models...</option>
      </select>
    </div>
    <div class="field">
      <label class="label" for="translator-system-message-select">Translator system message</label>
      <select
        id="translator-system-message-select"
        data-translator-system-message-select
        disabled
      >
        <option value="">Loading system messages...</option>
      </select>
    </div>
    <div class="instruction-source" data-translator-summary>${DEFAULT_TRANSLATOR_SUMMARY}</div>
    <div class="actions">
      <button type="button" data-translator-apply-button disabled>Apply</button>
    </div>
  `;
}

export function mountTranslatorTabUi() {
  const root = document.querySelector("[data-translator-tab-root]");

  if (!root) {
    throw new Error("Translator tab root not found.");
  }

  root.innerHTML = buildTranslatorTabMarkup();

  const modelSelect = root.querySelector("[data-translator-model-select]");
  const systemMessageSelect = root.querySelector("[data-translator-system-message-select]");
  const applyButton = root.querySelector("[data-translator-apply-button]");
  const summary = root.querySelector("[data-translator-summary]");

  return {
    bindApply(handler) {
      applyButton?.addEventListener("click", handler);
    },
    bindModelChange(handler) {
      modelSelect?.addEventListener("change", handler);
    },
    bindSystemMessageChange(handler) {
      systemMessageSelect?.addEventListener("change", handler);
    },
    getSelection() {
      const systemMessageValue = systemMessageSelect?.value?.trim() ?? "";
      return {
        model: modelSelect?.value?.trim() ?? "",
        systemMessageId: systemMessageValue ? Number.parseInt(systemMessageValue, 10) : null,
      };
    },
    render({
      appliedSummary,
      canApply,
      isBusy,
      isModelsLoading,
      isSystemMessagesLoading,
      modelOptions,
      selection,
      systemMessageOptions,
    }) {
      const hasModels = renderSelectOptions(modelSelect, modelOptions, {
        emptyLabel: isModelsLoading ? "Loading models..." : "No models available",
        selectedValue: selection?.model,
      });
      const hasSystemMessages = renderSelectOptions(systemMessageSelect, systemMessageOptions, {
        emptyLabel: isSystemMessagesLoading ? "Loading system messages..." : "No saved system messages",
        getValue: (option) => option?.id ?? "",
        selectedValue: selection?.systemMessageId,
      });

      if (modelSelect) {
        modelSelect.disabled = isBusy || !hasModels;
      }

      if (systemMessageSelect) {
        systemMessageSelect.disabled = isBusy || !hasSystemMessages;
      }

      if (summary) {
        summary.textContent = appliedSummary || DEFAULT_TRANSLATOR_SUMMARY;
      }

      if (applyButton) {
        applyButton.disabled = !canApply;
      }
    },
  };
}
