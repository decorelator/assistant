import {
  deleteModel,
  loadModels,
  releaseOtherModels,
  startOllama,
  stopModel,
} from "../../api.js";
import { getLastUsedModel, getSavedModel, saveLastUsedModel, saveModel } from "../../preferences.js";

export function createModelController({ renderModelInfo, renderModelOptions, setCurrentModelName, setStatus, setBusy, updateTranslatorModels }) {
  let availableModels = [];
  let lastUsedModel = getLastUsedModel();

  function getAvailableModelCount() {
    return availableModels.length;
  }

  async function initialize(preferredModel = "", getSelectedModel) {
    setStatus("Loading models...");
    try {
      availableModels = await loadModels();
      const fallbackModel = preferredModel || getSavedModel() || getSelectedModel();
      renderModelOptions(availableModels, fallbackModel);
      updateTranslatorModels(availableModels);
      const selectedModel = getSelectedModel();
      setStatus(`${availableModels.length} model${availableModels.length === 1 ? "" : "s"} available`);
      if (availableModels.length > 0) {
        const currentModel = selectedModel || availableModels[0]?.name || "Unnamed model";
        setCurrentModelName(currentModel);
        renderModelInfo(`Current model: ${currentModel}`);
      } else {
        setCurrentModelName("Not selected");
        renderModelInfo("Select a model and load info.");
      }
    } catch (error) {
      availableModels = [];
      renderModelOptions([]);
      updateTranslatorModels([]);
      setCurrentModelName("Not available");
      renderModelInfo("Could not load model info. Start Ollama and refresh the models list.");
      setStatus(error instanceof Error ? error.message : "Could not load models");
    } finally {
      setBusy(false);
    }
  }

  async function start(preferredModel, getSelectedModel) {
    setBusy(true);
    setStatus("Starting Ollama...");
    try {
      const result = await startOllama();
      setStatus(result?.message || "Ollama start request sent.");
      if (result?.ready) {
        await initialize(preferredModel, getSelectedModel);
        return;
      }
      renderModelInfo(result?.message || "Ollama is starting. Refresh models in a moment.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start Ollama.";
      renderModelInfo(message);
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(model, getSelectedModel) {
    await deleteModel(model);
    renderModelInfo(`Removed model: ${model}`);
    setStatus(`Removed ${model}`);
    await initialize("", getSelectedModel);
  }

  function select(model) {
    saveModel(model);
    setCurrentModelName(model);
    renderModelInfo(model ? `Current model: ${model}` : "Select a model and tap Model info.");
  }

  function markUsed(model) {
    lastUsedModel = model;
    saveLastUsedModel(model);
  }

  async function releaseInactiveModels(activeModel, ...modelsToStop) {
    await releaseOtherModels(activeModel);
    for (const model of [...new Set(modelsToStop)].filter((item) => item && item !== activeModel)) {
      try {
        await stopModel(model);
      } catch (error) {
        console.warn(`[assistant] Could not stop model "${model}" before switching.`, error);
      }
    }
  }

  return { getAvailableModelCount, getLastUsedModel: () => lastUsedModel, initialize, markUsed, releaseInactiveModels, remove, select, start };
}
