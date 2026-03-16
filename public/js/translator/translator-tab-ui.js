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
    <div class="instruction-source" data-translator-summary>
      Translator settings are runtime-only. Nothing has been applied yet.
    </div>
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

  let isBusy = false;
  let hasModels = false;
  let hasSystemMessages = false;

  function syncDisabledState() {
    if (modelSelect) {
      modelSelect.disabled = isBusy || !hasModels;
    }

    if (systemMessageSelect) {
      systemMessageSelect.disabled = isBusy || !hasSystemMessages;
    }
  }

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
    getSelectedModel() {
      return modelSelect?.value?.trim() ?? "";
    },
    getSelectedSystemMessageId() {
      const value = systemMessageSelect?.value?.trim() ?? "";
      return value ? Number.parseInt(value, 10) : null;
    },
    renderAppliedSelection(selection) {
      if (!summary) {
        return;
      }

      if (!selection?.model || selection.systemMessageId === null || !selection.systemMessageLabel) {
        summary.textContent = "Translator settings are runtime-only. Nothing has been applied yet.";
        return;
      }

      summary.textContent = `Applied translator: ${selection.model} + ${selection.systemMessageLabel}`;
    },
    renderModelOptions(options, isLoading = false) {
      if (!modelSelect) {
        return;
      }

      hasModels = Array.isArray(options) && options.length > 0;
      modelSelect.innerHTML = "";

      if (!hasModels) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = isLoading ? "Loading models..." : "No models available";
        modelSelect.appendChild(option);
        syncDisabledState();
        return;
      }

      for (const optionData of options) {
        const option = document.createElement("option");
        option.value = optionData.value;
        option.textContent = optionData.label;
        modelSelect.appendChild(option);
      }

      syncDisabledState();
    },
    renderSystemMessageOptions(options, isLoading = false) {
      if (!systemMessageSelect) {
        return;
      }

      hasSystemMessages = Array.isArray(options) && options.length > 0;
      systemMessageSelect.innerHTML = "";

      if (!hasSystemMessages) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = isLoading ? "Loading system messages..." : "No saved system messages";
        systemMessageSelect.appendChild(option);
        syncDisabledState();
        return;
      }

      for (const optionData of options) {
        const option = document.createElement("option");
        option.value = String(optionData.id);
        option.textContent = optionData.label;
        systemMessageSelect.appendChild(option);
      }

      syncDisabledState();
    },
    setApplyEnabled(isEnabled) {
      if (applyButton) {
        applyButton.disabled = !isEnabled;
      }
    },
    setBusy(nextBusyState) {
      isBusy = nextBusyState;
      syncDisabledState();
    },
    setPendingSelection(selection) {
      if (modelSelect && selection?.model) {
        modelSelect.value = selection.model;
      }

      if (systemMessageSelect) {
        systemMessageSelect.value = selection?.systemMessageId ? String(selection.systemMessageId) : "";
      }
    },
  };
}
