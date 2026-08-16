function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Unknown size";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatModelOptionLabel(model) {
  return `${model?.name ?? "Unnamed model"} - ${formatBytes(model?.size)}`;
}

export function renderSelectOptions(selectElement, options, {
  emptyLabel,
  getValue = (option) => option?.value ?? "",
  getLabel = (option) => option?.label ?? "",
  selectedValue = null,
} = {}) {
  if (!selectElement) return false;
  const normalizedOptions = Array.isArray(options) ? options : [];
  selectElement.innerHTML = "";
  if (normalizedOptions.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = emptyLabel;
    selectElement.appendChild(option);
    return false;
  }
  for (const item of normalizedOptions) {
    const option = document.createElement("option");
    option.value = String(getValue(item));
    option.textContent = String(getLabel(item));
    selectElement.appendChild(option);
  }
  const normalizedSelectedValue = selectedValue !== null && selectedValue !== undefined ? String(selectedValue) : "";
  const hasSelectedValue = normalizedSelectedValue && normalizedOptions.some((item) => String(getValue(item)) === normalizedSelectedValue);
  if (hasSelectedValue) selectElement.value = normalizedSelectedValue;
  else if (selectElement.options.length > 0) selectElement.selectedIndex = 0;
  return true;
}
