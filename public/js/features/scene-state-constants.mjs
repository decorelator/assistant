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

export const RUNNING_STATUSES = new Set([
  SCENE_STATUS.GENERATING,
  SCENE_STATUS.COOLING_DOWN,
  SCENE_STATUS.PAUSED,
  SCENE_STATUS.WAITING_FOR_CONTINUE,
]);
