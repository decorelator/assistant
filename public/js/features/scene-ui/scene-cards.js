function createElement(tagName, className = "") {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

function getCardPreview(card) {
  return card.description?.trim() || card.text?.trim() || "No description.";
}

export function getSceneCardTypeLabel(type) {
  return type === "context" ? "context" : "instruction";
}

export function renderSelectedSceneCards(container, cards, type, { locked = false } = {}) {
  if (!container) {
    return;
  }

  container.replaceChildren();

  if (!Array.isArray(cards) || cards.length === 0) {
    const empty = createElement("p", "scene-library-empty");
    empty.textContent = `No ${getSceneCardTypeLabel(type)} cards selected.`;
    container.appendChild(empty);
    return;
  }

  for (const card of cards) {
    const item = createElement("div", "scene-selected-card");
    const content = createElement("div", "scene-selected-card-content");
    const title = createElement("div", "scene-library-card-name");
    const preview = createElement("p", "scene-library-card-preview");
    const removeButton = createElement("button", "button-secondary scene-compact-button");

    title.textContent = card.title || "Untitled card";
    preview.textContent = card.text || "";
    content.append(title, preview);

    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.disabled = locked;
    removeButton.setAttribute("data-scene-remove-card", String(card.sourceId ?? ""));
    removeButton.setAttribute("data-scene-card-type", type);

    item.append(content, removeButton);
    container.appendChild(item);
  }
}

export function renderSceneCardLibraryList(container, cards, selectedCards = []) {
  if (!container) {
    return;
  }

  container.replaceChildren();

  if (!Array.isArray(cards) || cards.length === 0) {
    const empty = createElement("p", "scene-library-empty");
    empty.textContent = "No scene cards found.";
    container.appendChild(empty);
    return;
  }

  const selectedIds = new Set(selectedCards.map((card) => card.sourceId));

  for (const card of cards) {
    const item = createElement("article", "scene-library-card");
    const button = createElement("button", "scene-library-card-button");
    const topline = createElement("div", "scene-library-card-topline");
    const title = createElement("div", "scene-library-card-name");
    const action = createElement("span", "scene-library-card-action");
    const description = createElement("p", "scene-library-card-preview");
    const controls = createElement("div", "scene-library-card-controls");
    const editButton = createElement("button", "button-secondary scene-compact-button");
    const deleteButton = createElement("button", "button-danger scene-compact-button");

    button.type = "button";
    button.setAttribute("data-scene-use-card", String(card.id));
    title.textContent = card.title || "Untitled card";
    action.textContent = selectedIds.has(card.id) ? "Selected" : "Use";
    topline.append(title, action);
    description.textContent = getCardPreview(card);
    button.append(topline, description);

    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.setAttribute("data-scene-edit-card", String(card.id));
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("data-scene-delete-card", String(card.id));
    controls.append(editButton, deleteButton);

    item.append(button, controls);
    container.appendChild(item);
  }
}
