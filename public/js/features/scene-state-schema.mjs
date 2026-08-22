import {
  normalizeSceneReplyBlocks,
  serializeSceneReplyBlocks,
} from "./scene-blocks.mjs";
import {
  DEFAULT_COOLDOWN_SECONDS,
  DEFAULT_EXCHANGE_COUNT,
  RUNNING_STATUSES,
  SCENE_BEAT_MOMENT,
  SCENE_CHARACTER_IDS,
  SCENE_COOLDOWN_OPTIONS,
  SCENE_RUN_MODE,
  SCENE_STATUS,
  SCENE_VIEW,
  SCENE_WORKSPACE,
} from "./scene-state-constants.mjs";
import { sortSceneBeats } from "./scene-state-beats.mjs";

function clampInteger(value, fallback, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isInteger(numericValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, numericValue));
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asWorkspace(value) {
  return value === SCENE_WORKSPACE.SCENE ? SCENE_WORKSPACE.SCENE : SCENE_WORKSPACE.CHAT;
}

function asView(value) {
  return value === SCENE_VIEW.RUN ? SCENE_VIEW.RUN : SCENE_VIEW.SETUP;
}

function asStatus(value, fallback = SCENE_STATUS.DRAFT) {
  return Object.values(SCENE_STATUS).includes(value) ? value : fallback;
}

function asRunMode(value) {
  return value === SCENE_RUN_MODE.STEP ? SCENE_RUN_MODE.STEP : SCENE_RUN_MODE.AUTO;
}

function asSpeaker(value) {
  return value === "B" ? "B" : "A";
}

function asBeatMoment(value) {
  if (value === SCENE_BEAT_MOMENT.BEFORE_A || value === SCENE_BEAT_MOMENT.BEFORE_B) {
    return value;
  }

  return SCENE_BEAT_MOMENT.PAIR;
}

function createDefaultCharacter(characterId) {
  return {
    name: `Character ${characterId}`,
    card: "",
  };
}

function normalizeCharacter(value, characterId) {
  const source = value && typeof value === "object" ? value : {};

  return {
    name: asString(source.name, `Character ${characterId}`) || `Character ${characterId}`,
    card: asString(source.card),
  };
}

function getLegacySceneModel(source) {
  if (typeof source?.model === "string" && source.model.trim()) {
    return source.model.trim();
  }

  for (const characterId of SCENE_CHARACTER_IDS) {
    const model = source?.characters?.[characterId]?.model;

    if (typeof model === "string" && model.trim()) {
      return model.trim();
    }
  }

  return "";
}

function normalizeTranscriptEntry(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const speaker = asSpeaker(value.speaker);
  const text = asString(value.text).trim();
  const blocks = normalizeSceneReplyBlocks(value.blocks, text);
  const normalizedText = text || serializeSceneReplyBlocks(blocks);

  if (!normalizedText) {
    return null;
  }

  return {
    id: asString(value.id, createSceneId("line")),
    pairNumber: clampInteger(value.pairNumber, 1, 1, 999),
    speaker,
    characterName: asString(value.characterName, `Character ${speaker}`) || `Character ${speaker}`,
    model: asString(value.model).trim(),
    text: normalizedText,
    blocks,
  };
}

function normalizeFailedTurn(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    pairNumber: clampInteger(value.pairNumber, 1, 1, 999),
    replyIndexInPair: value.replyIndexInPair === 1 ? 1 : 0,
    speaker: asSpeaker(value.speaker),
  };
}

function normalizeBeat(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const text = asString(value.text).trim();

  if (!text) {
    return null;
  }

  return {
    id: asString(value.id, createSceneId("beat")),
    pairNumber: clampInteger(value.pairNumber, 1, 1, 999),
    moment: asBeatMoment(value.moment),
    text,
  };
}

export function createSceneId(prefix = "scene") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultSceneDraft() {
  return {
    workspace: SCENE_WORKSPACE.CHAT,
    view: SCENE_VIEW.SETUP,
    title: "",
    globalInstruction: "",
    context: "",
    model: "",
    exchangeCount: DEFAULT_EXCHANGE_COUNT,
    firstSpeaker: "A",
    runMode: SCENE_RUN_MODE.AUTO,
    cooldownSeconds: DEFAULT_COOLDOWN_SECONDS,
    characters: {
      A: createDefaultCharacter("A"),
      B: createDefaultCharacter("B"),
    },
    beats: [],
    transcript: [],
    status: SCENE_STATUS.DRAFT,
    countdownRemainingMs: 0,
    failedTurn: null,
    lastError: "",
    pauseRequested: false,
  };
}

export function normalizeSceneDraft(value, options = {}) {
  const { restoreStopped = false } = options;
  const source = value && typeof value === "object" ? value : {};
  const baseDraft = createDefaultSceneDraft();
  const status = asStatus(source.status, baseDraft.status);

  return {
    workspace: asWorkspace(source.workspace),
    view: asView(source.view),
    title: asString(source.title),
    globalInstruction: asString(source.globalInstruction),
    context: asString(source.context),
    model: getLegacySceneModel(source),
    exchangeCount: clampInteger(source.exchangeCount, baseDraft.exchangeCount, 1, 50),
    firstSpeaker: asSpeaker(source.firstSpeaker),
    runMode: asRunMode(source.runMode),
    cooldownSeconds: SCENE_COOLDOWN_OPTIONS.includes(Number(source.cooldownSeconds))
      ? Number(source.cooldownSeconds)
      : baseDraft.cooldownSeconds,
    characters: {
      A: normalizeCharacter(source.characters?.A, "A"),
      B: normalizeCharacter(source.characters?.B, "B"),
    },
    beats: sortSceneBeats(
      Array.isArray(source.beats) ? source.beats.map(normalizeBeat).filter(Boolean) : [],
    ),
    transcript: Array.isArray(source.transcript)
      ? source.transcript.map(normalizeTranscriptEntry).filter(Boolean)
      : [],
    status: restoreStopped && RUNNING_STATUSES.has(status) ? SCENE_STATUS.STOPPED : status,
    countdownRemainingMs: clampInteger(source.countdownRemainingMs, 0, 0, 600000),
    failedTurn: normalizeFailedTurn(source.failedTurn),
    lastError: asString(source.lastError),
    pauseRequested: Boolean(source.pauseRequested),
  };
}

export function cloneSceneDraft(scene) {
  return JSON.parse(JSON.stringify(scene));
}
