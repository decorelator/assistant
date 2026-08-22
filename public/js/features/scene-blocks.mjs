export const SCENE_REPLY_BLOCK_TYPE = {
  SAY: "say",
  ACTION: "action",
  THOUGHT: "thought",
};

const BLOCK_TAG_NAMES = {
  [SCENE_REPLY_BLOCK_TYPE.SAY]: "SAY",
  [SCENE_REPLY_BLOCK_TYPE.ACTION]: "ACTION",
  [SCENE_REPLY_BLOCK_TYPE.THOUGHT]: "THOUGHT",
};

const TAG_TO_BLOCK_TYPE = {
  SAY: SCENE_REPLY_BLOCK_TYPE.SAY,
  ACTION: SCENE_REPLY_BLOCK_TYPE.ACTION,
  THOUGHT: SCENE_REPLY_BLOCK_TYPE.THOUGHT,
};

const TAG_PATTERN = /\[(SAY|ACTION|THOUGHT)\][ \t]*/gim;
const PUBLIC_BLOCK_TYPES = new Set([
  SCENE_REPLY_BLOCK_TYPE.SAY,
  SCENE_REPLY_BLOCK_TYPE.ACTION,
]);

function asString(value) {
  return typeof value === "string" ? value : "";
}

function asBlockType(value) {
  if (value === SCENE_REPLY_BLOCK_TYPE.ACTION || value === SCENE_REPLY_BLOCK_TYPE.THOUGHT) {
    return value;
  }

  return SCENE_REPLY_BLOCK_TYPE.SAY;
}

export function normalizeSceneReplyBlock(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const text = asString(value.text).trim();

  if (!text) {
    return null;
  }

  return {
    type: asBlockType(value.type),
    text,
  };
}

export function parseSceneReplyBlocks(text) {
  const source = asString(text).replace(/\r\n?/g, "\n").trim();

  if (!source) {
    return [];
  }

  TAG_PATTERN.lastIndex = 0;

  const matches = [];
  let match = TAG_PATTERN.exec(source);

  while (match) {
    matches.push({
      index: match.index,
      tag: match[1],
      textStart: TAG_PATTERN.lastIndex,
    });
    match = TAG_PATTERN.exec(source);
  }

  if (matches.length === 0) {
    return [
      {
        type: SCENE_REPLY_BLOCK_TYPE.SAY,
        text: source,
      },
    ];
  }

  const blocks = [];
  const leadingText = source.slice(0, matches[0].index).trim();

  if (leadingText) {
    blocks.push({
      type: SCENE_REPLY_BLOCK_TYPE.SAY,
      text: leadingText,
    });
  }

  for (let index = 0; index < matches.length; index += 1) {
    const currentMatch = matches[index];
    const nextMatch = matches[index + 1];
    const textEnd = nextMatch ? nextMatch.index : source.length;
    const blockText = source.slice(currentMatch.textStart, textEnd).trim();

    if (!blockText) {
      continue;
    }

    blocks.push({
      type: TAG_TO_BLOCK_TYPE[currentMatch.tag] ?? SCENE_REPLY_BLOCK_TYPE.SAY,
      text: blockText,
    });
  }

  if (blocks.length === 0) {
    return [
      {
        type: SCENE_REPLY_BLOCK_TYPE.SAY,
        text: source,
      },
    ];
  }

  return blocks;
}

export function normalizeSceneReplyBlocks(blocks, fallbackText = "") {
  const fallbackSource = asString(fallbackText).trim();

  if (fallbackSource) {
    return parseSceneReplyBlocks(fallbackSource);
  }

  const normalizedBlocks = Array.isArray(blocks)
    ? blocks.map(normalizeSceneReplyBlock).filter(Boolean)
    : [];

  if (normalizedBlocks.length > 0) {
    return normalizedBlocks;
  }

  return parseSceneReplyBlocks(fallbackText);
}

export function serializeSceneReplyBlocks(blocks, options = {}) {
  const { includePrivate = true } = options;
  const normalizedBlocks = normalizeSceneReplyBlocks(blocks).filter(
    (block) => includePrivate || PUBLIC_BLOCK_TYPES.has(block.type),
  );

  return normalizedBlocks
    .map((block) => `[${BLOCK_TAG_NAMES[block.type] ?? BLOCK_TAG_NAMES.say}] ${block.text}`)
    .join("\n\n");
}

export function getSceneReplyBlocksForViewer(blocks, speaker, viewerSpeaker, fallbackText = "") {
  const normalizedBlocks = normalizeSceneReplyBlocks(blocks, fallbackText);

  if (!viewerSpeaker || speaker === viewerSpeaker) {
    return normalizedBlocks;
  }

  return normalizedBlocks.filter((block) => PUBLIC_BLOCK_TYPES.has(block.type));
}

export function getSceneReplyBlocksForModelContext(blocks, fallbackText = "") {
  return normalizeSceneReplyBlocks(blocks, fallbackText).filter((block) =>
    PUBLIC_BLOCK_TYPES.has(block.type),
  );
}

export function getSceneReplyBlockTag(type) {
  return `[${BLOCK_TAG_NAMES[asBlockType(type)]}]`;
}
