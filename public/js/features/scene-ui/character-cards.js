function escapeAttribute(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function getTagLabel(tag) {
  return typeof tag?.name === "string" ? tag.name.trim() : "";
}

function getTagDisplay(tag, { showKind = false } = {}) {
  const name = getTagLabel(tag);
  const kind = typeof tag?.kind === "string" ? tag.kind.trim() : "";

  if (!name) {
    return "";
  }

  return showKind && kind && kind !== "custom" ? `${kind}: ${name}` : name;
}

export const CHARACTER_TAG_EDITOR_KINDS = ["trait", "role", "setting", "custom"];

function getCharacterFallbackName(characterId) {
  return `Character ${characterId}`;
}

function getCardStats(text) {
  const trimmedText = typeof text === "string" ? text.trim() : "";

  if (!trimmedText) {
    return "Empty";
  }

  const wordCount = trimmedText.split(/\s+/).filter(Boolean).length;
  return wordCount === 1 ? "1 word" : `${wordCount} words`;
}

export function getCharacterPreview(card, characterId) {
  const text = typeof card === "string" ? card.trim() : "";

  if (text) {
    return text;
  }

  return characterId === "A"
    ? "Add a card to define this speaker. (Reminder: Character A is the male character.)"
    : "Add a card to define this speaker. (Reminder: Character B is the female character.)";
}

export function formatCharacterTags(tags = []) {
  return tags
    .filter((tag) => tag?.kind !== "gender")
    .map((tag) => getTagDisplay(tag, { showKind: tag?.kind && tag.kind !== "custom" }))
    .filter(Boolean)
    .join(", ");
}

export function normalizeCharacterTag(tag, fallbackKind = "custom") {
  if (!tag || typeof tag !== "object") {
    return null;
  }

  const name = getTagLabel(tag);
  const kind =
    typeof tag.kind === "string" && tag.kind.trim()
      ? tag.kind.trim().toLowerCase()
      : fallbackKind;

  return name ? { id: tag.id ?? null, name, kind } : null;
}

export function parseCharacterTags(value) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => {
      const separatorIndex = tag.indexOf(":");

      if (separatorIndex === -1) {
        return { name: tag, kind: "custom" };
      }

      const kind = tag.slice(0, separatorIndex).trim().toLowerCase() || "custom";
      const name = tag.slice(separatorIndex + 1).trim();
      return name ? { name, kind } : null;
    })
    .filter(Boolean);
}

export function buildCharacterTags(value, gender) {
  const tags = parseCharacterTags(value).filter((tag) => tag.kind !== "gender");
  const genderName = typeof gender === "string" ? gender.trim() : "";

  return genderName ? [{ kind: "gender", name: genderName }, ...tags] : tags;
}

export function groupCharacterTags(tags = []) {
  const groupedTags = Object.fromEntries(
    CHARACTER_TAG_EDITOR_KINDS.map((kind) => [kind, []]),
  );

  for (const tag of tags) {
    const normalizedTag = normalizeCharacterTag(tag);

    if (!normalizedTag || normalizedTag.kind === "gender" || normalizedTag.kind === "age") {
      continue;
    }

    const kind = CHARACTER_TAG_EDITOR_KINDS.includes(normalizedTag.kind)
      ? normalizedTag.kind
      : "custom";

    if (!groupedTags[kind].some((entry) => entry.name.toLowerCase() === normalizedTag.name.toLowerCase())) {
      groupedTags[kind].push({ ...normalizedTag, kind });
    }
  }

  return groupedTags;
}

export function flattenCharacterTagGroups(tagGroups) {
  const tags = [];

  for (const kind of CHARACTER_TAG_EDITOR_KINDS) {
    for (const tag of tagGroups?.[kind] ?? []) {
      const normalizedTag = normalizeCharacterTag(tag, kind);

      if (normalizedTag) {
        tags.push({ ...normalizedTag, kind });
      }
    }
  }

  return tags;
}

export function renderCharacterTagEditor(dom, tagGroups, suggestions = []) {
  const suggestionMap = groupCharacterTags(suggestions);

  for (const chipContainer of dom.characterTagEditorChips ?? []) {
    const kind = chipContainer.getAttribute("data-scene-tag-editor-chips");
    const tags = tagGroups?.[kind] ?? [];
    chipContainer.innerHTML = "";

    for (const tag of tags) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "scene-tag-chip scene-tag-editor-chip";
      chip.dataset.sceneTagRemove = kind;
      chip.dataset.sceneTagName = tag.name;
      chip.textContent = `${tag.name} x`;
      chipContainer.append(chip);
    }
  }

  for (const suggestionContainer of dom.characterTagEditorSuggestions ?? []) {
    const kind = suggestionContainer.getAttribute("data-scene-tag-editor-suggestions");
    const input = dom.characterTagEditorInputs?.find(
      (entry) => entry.getAttribute("data-scene-tag-editor-input") === kind,
    );
    const query = input?.value.trim().toLowerCase() ?? "";
    const selectedNames = new Set((tagGroups?.[kind] ?? []).map((tag) => tag.name.toLowerCase()));
    const matchingSuggestions = (suggestionMap[kind] ?? [])
      .filter((tag) => !selectedNames.has(tag.name.toLowerCase()))
      .filter((tag) => !query || tag.name.toLowerCase().includes(query))
      .slice(0, 6);

    suggestionContainer.innerHTML = "";

    for (const tag of matchingSuggestions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scene-tag-chip scene-tag-suggestion";
      button.dataset.sceneTagSuggestion = kind;
      button.dataset.sceneTagName = tag.name;
      button.textContent = tag.name;
      suggestionContainer.append(button);
    }

    if (query && !matchingSuggestions.some((tag) => tag.name.toLowerCase() === query)) {
      const createButton = document.createElement("button");
      createButton.type = "button";
      createButton.className = "scene-tag-chip scene-tag-suggestion scene-tag-create";
      createButton.dataset.sceneTagSuggestion = kind;
      createButton.dataset.sceneTagName = input.value.trim();
      createButton.textContent = `Create "${input.value.trim()}"`;
      suggestionContainer.append(createButton);
    }
  }
}

export function renderCharacterSlots(container, scene, characterIds, { locked = false } = {}) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  for (const characterId of characterIds) {
    const character = scene.characters[characterId] ?? {};
    const article = document.createElement("article");
    article.className = "scene-card scene-character-card";
    article.dataset.sceneCharacterCard = characterId;

    const tags = Array.isArray(character.tags) ? character.tags : [];
    const tagLabels = tags.map((tag) => getTagDisplay(tag)).filter(Boolean).slice(0, 5);
    const tagMarkup = tagLabels.length
      ? `<div class="scene-character-tags">${tagLabels
          .map((tag) => `<span class="scene-tag-chip">${escapeAttribute(tag)}</span>`)
          .join("")}</div>`
      : "";
    const sourceLabel = character.sourceCardId
      ? `Library: ${character.sourceCardTitle || "Untitled card"}`
      : "Scene copy";
    const cardStats = getCardStats(character.card);
    const details = [
      character.gender ? `Gender: ${character.gender}` : "",
      character.age ? `Age: ${character.age}` : "",
    ].filter(Boolean);
    const detailMarkup = details.length
      ? `<div class="scene-character-details">${details
          .map((detail) => `<span>${escapeAttribute(detail)}</span>`)
          .join("")}</div>`
      : "";

    article.innerHTML = `
      <div class="scene-character-card-header">
        <div>
          <p class="scene-character-label">Character ${escapeAttribute(characterId)}</p>
          <h4 class="scene-character-name">${escapeAttribute(
            character.name || getCharacterFallbackName(characterId),
          )}</h4>
        </div>
        <div class="scene-character-card-actions">
          <button
            type="button"
            class="button-secondary scene-compact-button"
            data-scene-load-character="${escapeAttribute(characterId)}"
            ${locked ? "disabled" : ""}
          >
            Library
          </button>
          <button
            type="button"
            class="button-secondary scene-compact-button"
            data-scene-edit-character="${escapeAttribute(characterId)}"
            ${locked ? "disabled" : ""}
          >
            Edit
          </button>
        </div>
      </div>
      <div class="scene-character-meta">
        <span class="scene-character-source">${escapeAttribute(sourceLabel)}</span>
        <span class="scene-character-stat">${escapeAttribute(cardStats)}</span>
      </div>
      ${detailMarkup}
      ${tagMarkup}
      <p class="scene-character-preview">${escapeAttribute(
        getCharacterPreview(character.card, characterId),
      )}</p>
    `;

    container.append(article);
  }
}

export function renderCharacterLibraryTags(container, tags = [], activeTagIds = []) {
  if (!container) {
    return;
  }

  const activeSet = new Set(activeTagIds);
  container.innerHTML = "";

  for (const tag of tags) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scene-tag-chip scene-tag-filter";
    button.classList.toggle("is-active", activeSet.has(tag.id));
    button.dataset.sceneCharacterLibraryTag = String(tag.id);
    button.textContent = getTagDisplay(tag, { showKind: true });
    container.append(button);
  }
}

export function renderCharacterLibraryList(container, cards = []) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (cards.length === 0) {
    const empty = document.createElement("p");
    empty.className = "scene-library-empty";
    empty.textContent = "No saved characters yet.";
    container.append(empty);
    return;
  }

  for (const card of cards) {
    const tags = Array.isArray(card.tags) ? card.tags : [];
    const tagLabels = tags.map((tag) => getTagDisplay(tag)).filter(Boolean).slice(0, 6);
    const cardStats = getCardStats(card.cardText);
    const characterName = card.characterName || card.name || card.title;
    const details = [
      card.gender ? `Gender: ${card.gender}` : "",
      card.age ? `Age: ${card.age}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const item = document.createElement("article");
    item.className = "scene-library-card";

    item.innerHTML = `
      <button
        type="button"
        class="scene-library-card-button"
        data-scene-use-character-card="${escapeAttribute(card.id)}"
      >
        <span class="scene-library-card-topline">
          <span class="scene-library-card-name">${escapeAttribute(card.title || card.name)}</span>
          <span class="scene-library-card-action">Use copy</span>
        </span>
        <span class="scene-library-card-character">${escapeAttribute(characterName)}</span>
        ${details ? `<span class="scene-library-card-details">${escapeAttribute(details)}</span>` : ""}
        <span class="scene-character-tags">
          ${tagLabels.map((tag) => `<span class="scene-tag-chip">${escapeAttribute(tag)}</span>`).join("")}
        </span>
        <span class="scene-library-card-preview">${escapeAttribute(card.cardText)}</span>
        <span class="scene-library-card-meta">${escapeAttribute(cardStats)}</span>
      </button>
    `;

    container.append(item);
  }
}
