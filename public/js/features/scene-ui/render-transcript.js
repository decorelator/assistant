import { renderMessageMarkdown } from "../../message-markdown.mjs";
import {
  getSceneReplyBlockTag,
  normalizeSceneReplyBlocks,
  SCENE_REPLY_BLOCK_TYPE,
} from "../scene-blocks.mjs";

function renderTranscriptBlockContent(block) {
  const body = document.createElement("div");
  body.className = "scene-transcript-block-body";
  body.innerHTML = renderMessageMarkdown(block.text);
  return body;
}

function renderTranscriptBlock(block) {
  const item = document.createElement("div");
  item.className = `scene-transcript-block scene-transcript-block-${block.type}`;

  const label = document.createElement("div");
  label.className = "scene-transcript-block-label";
  label.textContent = getSceneReplyBlockTag(block.type);

  if (block.type === SCENE_REPLY_BLOCK_TYPE.THOUGHT) {
    label.setAttribute("aria-label", "Private thought");
  }

  item.appendChild(label);
  item.appendChild(renderTranscriptBlockContent(block));

  return item;
}

export function renderSceneTranscript(transcriptList, scene) {
  if (!transcriptList) {
    return;
  }

  transcriptList.innerHTML = "";

  for (const line of scene.transcript) {
    const item = document.createElement("li");
    item.className = `scene-transcript-item scene-transcript-item-${line.speaker.toLowerCase()}`;

    const header = document.createElement("div");
    header.className = "scene-transcript-header";
    header.textContent = `${line.characterName} • Pair ${line.pairNumber}${line.model ? ` • ${line.model}` : ""}`;

    const text = document.createElement("div");
    text.className = "scene-transcript-text";

    const blocks = normalizeSceneReplyBlocks(line.blocks, line.text);

    for (const block of blocks) {
      text.appendChild(renderTranscriptBlock(block));
    }

    item.appendChild(header);
    item.appendChild(text);
    transcriptList.appendChild(item);
  }
}
