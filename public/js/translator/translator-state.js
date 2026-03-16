export function createTranslatorState() {
  let appliedSelection = {
    model: "",
    systemMessageId: null,
  };

  return {
    applySelection(selection) {
      if (!selection?.model || selection.systemMessageId === null) {
        return null;
      }

      appliedSelection = {
        model: selection.model,
        systemMessageId: selection.systemMessageId,
      };
      return { ...appliedSelection };
    },
    getAppliedSelection() {
      return { ...appliedSelection };
    },
    hasPendingChanges(selection) {
      return (
        selection?.model !== appliedSelection.model ||
        selection?.systemMessageId !== appliedSelection.systemMessageId
      );
    },
    syncAppliedSelection(modelOptions, systemMessageOptions) {
      if (!modelOptions.some((option) => option.value === appliedSelection.model)) {
        appliedSelection = {
          ...appliedSelection,
          model: "",
        };
      }

      if (!systemMessageOptions.some((option) => option.id === appliedSelection.systemMessageId)) {
        appliedSelection = {
          ...appliedSelection,
          systemMessageId: null,
        };
      }

      return { ...appliedSelection };
    },
  };
}
