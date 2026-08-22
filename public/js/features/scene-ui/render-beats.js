import {
  canEditBeatInRun,
  getBeatProgressStatus,
} from "../scene-state-beats.mjs";
import { SCENE_BEAT_MOMENT } from "../scene-state-constants.mjs";

const MOMENT_LABELS = {
  [SCENE_BEAT_MOMENT.BEFORE_A]: "Before A",
  [SCENE_BEAT_MOMENT.BEFORE_B]: "Before B",
  [SCENE_BEAT_MOMENT.PAIR]: "Whole pair",
};

export function renderBeatList(listElement, scene, options = {}) {
  if (!listElement) {
    return;
  }

  const { editable = false } = options;

  listElement.innerHTML = "";

  if (scene.beats.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "scene-beat-item scene-beat-item-empty";
    emptyItem.textContent = "No director beats yet.";
    listElement.appendChild(emptyItem);
    return;
  }

  for (const beat of scene.beats) {
    const item = document.createElement("li");
    const progressStatus = getBeatProgressStatus(scene, beat);
    item.className = `scene-beat-item scene-beat-item-${progressStatus}`;

    const heading = document.createElement("div");
    heading.className = "scene-beat-item-heading";

    const meta = document.createElement("div");
    meta.className = "scene-beat-item-meta";
    meta.textContent = `Pair ${beat.pairNumber} • ${MOMENT_LABELS[beat.moment]}`;

    const badge = document.createElement("span");
    badge.className = `scene-beat-status scene-beat-status-${progressStatus}`;
    badge.textContent = progressStatus;

    heading.appendChild(meta);
    heading.appendChild(badge);
    item.appendChild(heading);

    const text = document.createElement("p");
    text.className = "scene-beat-text";
    text.textContent = beat.text;
    item.appendChild(text);

    if (editable) {
      const actions = document.createElement("div");
      actions.className = "scene-beat-actions";
      const canEdit = canEditBeatInRun(scene, beat);

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "button-secondary scene-compact-button";
      editButton.textContent = "Edit";
      editButton.disabled = !canEdit;
      editButton.setAttribute("data-scene-edit-beat", beat.id);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "button-secondary scene-compact-button";
      deleteButton.textContent = "Delete";
      deleteButton.disabled = !canEdit;
      deleteButton.setAttribute("data-scene-delete-beat", beat.id);

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      item.appendChild(actions);
    }

    listElement.appendChild(item);
  }
}
