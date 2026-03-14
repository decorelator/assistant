import {
  deleteInstructionPreset,
  loadConfig,
  loadInstructionPresets,
  saveInstructionPreset,
  updateInstructionPreset,
} from "./api.js";
import {
  bindDeleteDialogCancel,
  bindDeleteDialogConfirm,
  bindDeletePresetButton,
  bindInstructionPresetChange,
  bindSaveDialogCancel,
  bindSaveDialogSubmit,
  bindSavePresetButton,
  bindUpdatePresetButton,
  closeDeleteDialog,
  closeSaveDialog,
  getInstructionValue,
  getPresetTitleValue,
  getSelectedInstructionPresetId,
  openDeleteDialog,
  openSaveDialog,
  renderInstructionPresetOptions,
  setDeleteDialogCopy,
  setInstructionPresetActions,
  setInstructionSource,
  setInstructionValue,
  setPresetTitleError,
} from "./ui.js";

function isValidationError(error) {
  return Boolean(error && typeof error === "object" && "status" in error && error.status === 409);
}

export function createInstructionController({ onInstructionNameChange, setBusy, setStatus }) {
  let fallbackInstruction = "";
  let instructionPresets = [];
  let selectedInstructionPresetId = null;

  function getSelectedInstructionPreset() {
    return instructionPresets.find((preset) => preset.id === selectedInstructionPresetId) ?? null;
  }

  function syncInstructionPresetUi() {
    const selectedPreset = getSelectedInstructionPreset();
    renderInstructionPresetOptions(instructionPresets, selectedInstructionPresetId);
    setInstructionPresetActions(Boolean(selectedPreset));

    if (selectedPreset) {
      setInstructionSource(`Selected preset: ${selectedPreset.title}`);
      onInstructionNameChange?.(selectedPreset.title);
      return;
    }

    setInstructionSource("Using fallback instruction from .env.");
    onInstructionNameChange?.(".env fallback");
  }

  function loadFallbackInstruction() {
    selectedInstructionPresetId = null;
    setInstructionValue(fallbackInstruction);
    syncInstructionPresetUi();
  }

  function loadInstructionPresetById(presetId) {
    const preset = instructionPresets.find((item) => item.id === presetId);

    if (!preset) {
      loadFallbackInstruction();
      return;
    }

    selectedInstructionPresetId = preset.id;
    setInstructionValue(preset.instructionText ?? "");
    syncInstructionPresetUi();
  }

  function applyInstructionPresets(presets, presetIdToSelect = null) {
    instructionPresets = Array.isArray(presets) ? presets : [];

    if (presetIdToSelect) {
      const selectedPreset = instructionPresets.find((preset) => preset.id === presetIdToSelect);

      if (selectedPreset) {
        loadInstructionPresetById(selectedPreset.id);
        return;
      }
    }

    if (instructionPresets.length > 0) {
      loadInstructionPresetById(instructionPresets[0].id);
      return;
    }

    loadFallbackInstruction();
  }

  function handleInstructionPresetChange() {
    const presetId = getSelectedInstructionPresetId();

    if (!presetId) {
      return;
    }

    loadInstructionPresetById(presetId);
  }

  function handleSavePresetClick() {
    openSaveDialog();
  }

  function handleSaveDialogCancel() {
    closeSaveDialog();
  }

  async function handleSaveDialogSubmit(event) {
    event.preventDefault();

    const title = getPresetTitleValue();

    if (!title) {
      setPresetTitleError("Title is required.");
      return;
    }

    try {
      setBusy(true);
      const preset = await saveInstructionPreset(title, getInstructionValue());
      closeSaveDialog();

      if (preset) {
        applyInstructionPresets([preset, ...instructionPresets], preset.id);
      }
    } catch (error) {
      if (isValidationError(error)) {
        setPresetTitleError(error.message);
        return;
      }

      setStatus(error instanceof Error ? error.message : "Could not save preset");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdatePresetClick() {
    const selectedPreset = getSelectedInstructionPreset();

    if (!selectedPreset) {
      return;
    }

    try {
      setBusy(true);
      const preset = await updateInstructionPreset(selectedPreset.id, getInstructionValue());

      if (!preset) {
        return;
      }

      instructionPresets = instructionPresets.map((item) => (item.id === preset.id ? preset : item));
      loadInstructionPresetById(preset.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update preset");
    } finally {
      setBusy(false);
    }
  }

  function handleDeletePresetClick() {
    const selectedPreset = getSelectedInstructionPreset();

    if (!selectedPreset) {
      return;
    }

    setDeleteDialogCopy(`Preset "${selectedPreset.title}" will be deleted from the database.`);
    openDeleteDialog();
  }

  function handleDeleteDialogCancel() {
    closeDeleteDialog();
  }

  async function handleDeleteDialogConfirm() {
    const selectedPreset = getSelectedInstructionPreset();

    if (!selectedPreset) {
      closeDeleteDialog();
      return;
    }

    try {
      setBusy(true);
      await deleteInstructionPreset(selectedPreset.id);
      closeDeleteDialog();
      const remainingPresets = instructionPresets.filter((preset) => preset.id !== selectedPreset.id);
      applyInstructionPresets(remainingPresets);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete preset");
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    bindDeleteDialogCancel(handleDeleteDialogCancel);
    bindDeleteDialogConfirm(handleDeleteDialogConfirm);
    bindDeletePresetButton(handleDeletePresetClick);
    bindInstructionPresetChange(handleInstructionPresetChange);
    bindSaveDialogCancel(handleSaveDialogCancel);
    bindSaveDialogSubmit(handleSaveDialogSubmit);
    bindSavePresetButton(handleSavePresetClick);
    bindUpdatePresetButton(handleUpdatePresetClick);
  }

  async function initialize() {
    try {
      const [config, presets] = await Promise.all([loadConfig(), loadInstructionPresets()]);
      fallbackInstruction = typeof config.defaultInstruction === "string" ? config.defaultInstruction : "";
      applyInstructionPresets(presets);
      return config;
    } catch {
      fallbackInstruction = "";
      applyInstructionPresets([]);
      return null;
    }
  }

  return {
    bindEvents,
    getInstructionValue,
    getSelectedPresetId: () => selectedInstructionPresetId,
    initialize,
    markPresetAsUsed(presetId) {
      const selectedPreset = instructionPresets.find((preset) => preset.id === presetId);

      if (!selectedPreset) {
        return;
      }

      const updatedPreset = {
        ...selectedPreset,
        createdAt: new Date().toISOString(),
      };

      instructionPresets = [
        updatedPreset,
        ...instructionPresets.filter((preset) => preset.id !== presetId),
      ];
      loadInstructionPresetById(updatedPreset.id);
    },
  };
}
