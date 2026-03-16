import "./translator-types.js";

export function createTranslatorState() {
  let modelOptions = [];
  let systemMessageOptions = [];
  let pendingSelection = {
    model: "",
    systemMessageId: null,
  };
  let appliedSelection = {
    model: "",
    systemMessageId: null,
  };

  function hasModel(value) {
    return modelOptions.some((option) => option.value === value);
  }

  function hasSystemMessage(id) {
    return systemMessageOptions.some((option) => option.id === id);
  }

  function normalizeSelection() {
    if (!hasModel(pendingSelection.model)) {
      pendingSelection = {
        ...pendingSelection,
        model: modelOptions[0]?.value ?? "",
      };
    }

    if (!hasSystemMessage(pendingSelection.systemMessageId)) {
      pendingSelection = {
        ...pendingSelection,
        systemMessageId: systemMessageOptions[0]?.id ?? null,
      };
    }

    if (!hasModel(appliedSelection.model)) {
      appliedSelection = {
        ...appliedSelection,
        model: "",
      };
    }

    if (!hasSystemMessage(appliedSelection.systemMessageId)) {
      appliedSelection = {
        ...appliedSelection,
        systemMessageId: null,
      };
    }
  }

  function getSystemMessageById(id) {
    return systemMessageOptions.find((option) => option.id === id) ?? null;
  }

  function getAppliedSelection() {
    const selectedSystemMessage = getSystemMessageById(appliedSelection.systemMessageId);

    return {
      model: appliedSelection.model,
      systemMessageId: selectedSystemMessage?.id ?? null,
      systemMessageLabel: selectedSystemMessage?.label ?? "",
      instructionText: selectedSystemMessage?.instructionText ?? "",
    };
  }

  return {
    applyPendingSelection() {
      if (!pendingSelection.model || pendingSelection.systemMessageId === null) {
        return null;
      }

      appliedSelection = { ...pendingSelection };
      return getAppliedSelection();
    },
    canApply() {
      return (
        Boolean(pendingSelection.model) &&
        pendingSelection.systemMessageId !== null &&
        (pendingSelection.model !== appliedSelection.model ||
          pendingSelection.systemMessageId !== appliedSelection.systemMessageId)
      );
    },
    getAppliedSelection,
    getModelOptions() {
      return modelOptions;
    },
    getPendingSelection() {
      return { ...pendingSelection };
    },
    getSystemMessageOptions() {
      return systemMessageOptions;
    },
    setModelOptions(options) {
      modelOptions = Array.isArray(options) ? options : [];
      normalizeSelection();
    },
    setPendingModel(model) {
      pendingSelection = {
        ...pendingSelection,
        model: hasModel(model) ? model : modelOptions[0]?.value ?? "",
      };
    },
    setPendingSystemMessageId(systemMessageId) {
      pendingSelection = {
        ...pendingSelection,
        systemMessageId: hasSystemMessage(systemMessageId)
          ? systemMessageId
          : systemMessageOptions[0]?.id ?? null,
      };
    },
    setSystemMessageOptions(options) {
      systemMessageOptions = Array.isArray(options) ? options : [];
      normalizeSelection();
    },
  };
}
