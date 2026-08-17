export const SCENE_WORKSPACE = {
  CHAT: "chat",
  SCENE: "scene",
};

export const SCENE_VIEW = {
  SETUP: "setup",
  RUN: "run",
};

export const SCENE_STATUS = {
  DRAFT: "draft",
  GENERATING: "generating",
  COOLING_DOWN: "coolingDown",
  PAUSED: "paused",
  WAITING_FOR_CONTINUE: "waitingForContinue",
  STOPPED: "stopped",
  COMPLETED: "completed",
  ERROR: "error",
};

export const SCENE_RUN_MODE = {
  AUTO: "auto",
  STEP: "step",
};

export const SCENE_BEAT_MOMENT = {
  BEFORE_A: "beforeA",
  BEFORE_B: "beforeB",
  PAIR: "pair",
};

export const SCENE_CHARACTER_IDS = ["A", "B"];
export const SCENE_COOLDOWN_OPTIONS = [2, 5, 10];
export const DEFAULT_EXCHANGE_COUNT = 10;
export const DEFAULT_COOLDOWN_SECONDS = 5;

const RUNNING_STATUSES = new Set([
  SCENE_STATUS.GENERATING,
  SCENE_STATUS.COOLING_DOWN,
  SCENE_STATUS.PAUSED,
  SCENE_STATUS.WAITING_FOR_CONTINUE,
]);

const MOMENT_ORDER = {
  [SCENE_BEAT_MOMENT.BEFORE_A]: 0,
  [SCENE_BEAT_MOMENT.BEFORE_B]: 1,
  [SCENE_BEAT_MOMENT.PAIR]: 2,
};

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
    model: "",
    card: "",
  };
}

function normalizeCharacter(value, characterId) {
  const source = value && typeof value === "object" ? value : {};

  return {
    name: asString(source.name, `Character ${characterId}`) || `Character ${characterId}`,
    model: asString(source.model).trim(),
    card: asString(source.card),
  };
}

function normalizeTranscriptEntry(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const speaker = asSpeaker(value.speaker);
  const text = asString(value.text).trim();

  if (!text) {
    return null;
  }

  return {
    id: asString(value.id, createSceneId("line")),
    pairNumber: clampInteger(value.pairNumber, 1, 1, 999),
    speaker,
    characterName: asString(value.characterName, `Character ${speaker}`) || `Character ${speaker}`,
    model: asString(value.model).trim(),
    text,
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

export function sortSceneBeats(beats) {
  return [...beats].sort((left, right) => {
    if (left.pairNumber !== right.pairNumber) {
      return left.pairNumber - right.pairNumber;
    }

    const leftOrder = MOMENT_ORDER[left.moment] ?? 99;
    const rightOrder = MOMENT_ORDER[right.moment] ?? 99;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.id.localeCompare(right.id);
  });
}

export function createDefaultSceneDraft() {
  return {
    workspace: SCENE_WORKSPACE.CHAT,
    view: SCENE_VIEW.SETUP,
    title: "",
    globalInstruction: "",
    context: "",
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
    status:
      restoreStopped && RUNNING_STATUSES.has(status) ? SCENE_STATUS.STOPPED : status,
    countdownRemainingMs: clampInteger(source.countdownRemainingMs, 0, 0, 600000),
    failedTurn: normalizeFailedTurn(source.failedTurn),
    lastError: asString(source.lastError),
    pauseRequested: Boolean(source.pauseRequested),
  };
}

export function cloneSceneDraft(scene) {
  return JSON.parse(JSON.stringify(scene));
}

export function getSpeakerOrder(firstSpeaker) {
  return firstSpeaker === "B" ? ["B", "A"] : ["A", "B"];
}

export function getPairReplyCount(scene, pairNumber) {
  return scene.transcript.filter((entry) => entry.pairNumber === pairNumber).length;
}

export function getTotalReplyCount(scene) {
  return scene.exchangeCount * 2;
}

export function getNextTurn(scene) {
  const totalReplies = getTotalReplyCount(scene);

  if (scene.transcript.length >= totalReplies) {
    return null;
  }

  const replyIndex = scene.transcript.length % 2;
  const pairNumber = Math.floor(scene.transcript.length / 2) + 1;
  const speaker = getSpeakerOrder(scene.firstSpeaker)[replyIndex];

  return {
    pairNumber,
    replyIndexInPair: replyIndex,
    speaker,
  };
}

export function getTurnCharacter(scene, speaker) {
  return scene.characters[speaker] ?? createDefaultCharacter(speaker);
}

export function getApplicableBeats(scene, turn) {
  return scene.beats.filter((beat) => {
    if (beat.pairNumber !== turn.pairNumber) {
      return false;
    }

    if (beat.moment === SCENE_BEAT_MOMENT.PAIR) {
      return true;
    }

    return beat.moment === `before${turn.speaker}`;
  });
}

export function getCurrentPairNumber(scene) {
  const nextTurn = scene.failedTurn ?? getNextTurn(scene);

  if (nextTurn) {
    return nextTurn.pairNumber;
  }

  return scene.exchangeCount;
}

export function getCurrentSpeaker(scene) {
  const pendingTurn = scene.failedTurn ?? getNextTurn(scene);
  return pendingTurn?.speaker ?? null;
}

function getBeatCompletionThreshold(firstSpeaker, moment) {
  if (moment === SCENE_BEAT_MOMENT.PAIR) {
    return 2;
  }

  const speaker = moment === SCENE_BEAT_MOMENT.BEFORE_B ? "B" : "A";
  const replyIndex = getSpeakerOrder(firstSpeaker).indexOf(speaker);
  return replyIndex < 0 ? 2 : replyIndex + 1;
}

export function isBeatApplied(scene, beat) {
  const currentPairNumber = getCurrentPairNumber(scene);

  if (beat.pairNumber < currentPairNumber) {
    return true;
  }

  if (beat.pairNumber > currentPairNumber) {
    return false;
  }

  const repliesDone = getPairReplyCount(scene, beat.pairNumber);
  return repliesDone >= getBeatCompletionThreshold(scene.firstSpeaker, beat.moment);
}

export function getBeatProgressStatus(scene, beat) {
  const currentPairNumber = getCurrentPairNumber(scene);

  if (scene.status === SCENE_STATUS.COMPLETED) {
    return "completed";
  }

  if (beat.pairNumber < currentPairNumber) {
    return "completed";
  }

  if (beat.pairNumber > currentPairNumber) {
    return "upcoming";
  }

  if (isBeatApplied(scene, beat)) {
    return "completed";
  }

  return "current";
}

export function canEditBeatInRun(scene, beat) {
  if (
    scene.status !== SCENE_STATUS.PAUSED &&
    scene.status !== SCENE_STATUS.WAITING_FOR_CONTINUE &&
    scene.status !== SCENE_STATUS.ERROR
  ) {
    return scene.status === SCENE_STATUS.DRAFT || scene.status === SCENE_STATUS.STOPPED;
  }

  return !isBeatApplied(scene, beat);
}

export function getSceneRunPairLabel(scene) {
  const pairNumber =
    scene.status === SCENE_STATUS.COMPLETED
      ? scene.exchangeCount
      : Math.min(scene.exchangeCount, getCurrentPairNumber(scene));

  return `Pair ${pairNumber} / ${scene.exchangeCount}`;
}

export function isSceneChatLocked(scene) {
  return (
    scene.view === SCENE_VIEW.RUN &&
    [
      SCENE_STATUS.GENERATING,
      SCENE_STATUS.COOLING_DOWN,
      SCENE_STATUS.PAUSED,
      SCENE_STATUS.WAITING_FOR_CONTINUE,
      SCENE_STATUS.ERROR,
    ].includes(scene.status)
  );
}
