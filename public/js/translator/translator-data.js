import { formatModelOptionLabel } from "../ui.js";

export function createTranslatorModelOptions(models) {
  if (!Array.isArray(models)) {
    return [];
  }

  return models.map((model) => {
    const name = typeof model?.name === "string" && model.name.trim() ? model.name.trim() : "Unnamed model";
    return {
      value: name,
      label: formatModelOptionLabel(model),
    };
  });
}

export function createTranslatorSystemMessageOptions(presets) {
  if (!Array.isArray(presets)) {
    return [];
  }

  return presets
    .filter((preset) => Number.isInteger(preset?.id))
    .map((preset) => ({
      id: preset.id,
      label:
        typeof preset.title === "string" && preset.title.trim() ? preset.title.trim() : "Untitled preset",
      instructionText:
        typeof preset.instructionText === "string" ? preset.instructionText : "",
    }));
}

export function findTranslatorSystemMessage(options, systemMessageId) {
  return options.find((option) => option.id === systemMessageId) ?? null;
}
