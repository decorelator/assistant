import "./translator-types.js";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "Unknown size";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function createTranslatorModelOptions(models) {
  if (!Array.isArray(models)) {
    return [];
  }

  return models.map((model) => {
    const name = typeof model?.name === "string" && model.name.trim() ? model.name.trim() : "Unnamed model";
    return {
      value: name,
      label: `${name} - ${formatBytes(model?.size)}`,
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
