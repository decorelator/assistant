import { parseSceneReplyBlocks } from "./scene-blocks.mjs";
import { buildSceneTurnRequest } from "./scene-prompt.mjs";
import { createSceneRunnerTimer } from "./scene-runner-timer.mjs";
import {
  SCENE_RUN_MODE,
  SCENE_STATUS,
  SCENE_VIEW,
} from "./scene-state-constants.mjs";
import { cloneSceneDraft, createSceneId, normalizeSceneDraft } from "./scene-state-schema.mjs";
import {
  getNextTurn,
  getPairReplyCount,
  getTotalReplyCount,
  getTurnCharacter,
} from "./scene-state-selectors.mjs";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Scene generation failed.";
}

export function createSceneRunner({
  initialScene,
  generateReply,
  stopGeneration,
  onChange = () => {},
  setTimer = globalThis.setTimeout.bind(globalThis),
  clearTimer = globalThis.clearTimeout.bind(globalThis),
  now = () => Date.now(),
}) {
  let scene = normalizeSceneDraft(initialScene);
  let activeTurnPromise = null;
  let stopRequested = false;

  const cooldownTimer = createSceneRunnerTimer({
    clearTimer,
    now,
    onComplete() {
      void executeTurn();
    },
    onTick(remainingMs) {
      updateScene({
        ...scene,
        countdownRemainingMs: remainingMs,
      });
    },
    setTimer,
    shouldContinue() {
      return scene.status === SCENE_STATUS.COOLING_DOWN;
    },
  });

  function emitChange() {
    onChange(cloneSceneDraft(scene));
  }

  function updateScene(nextScene) {
    scene = normalizeSceneDraft(nextScene);
    emitChange();
    return scene;
  }

  function setStoppedState() {
    updateScene({
      ...scene,
      status: SCENE_STATUS.STOPPED,
      countdownRemainingMs: 0,
      pauseRequested: false,
    });
  }

  async function executeTurn(turnOverride = null) {
    if (activeTurnPromise) {
      return false;
    }

    const turn = turnOverride ?? scene.failedTurn ?? getNextTurn(scene);

    if (!turn) {
      updateScene({
        ...scene,
        status: SCENE_STATUS.COMPLETED,
        countdownRemainingMs: 0,
        failedTurn: null,
        lastError: "",
        pauseRequested: false,
      });
      return true;
    }

    const request = buildSceneTurnRequest(scene, turn);

    updateScene({
      ...scene,
      view: SCENE_VIEW.RUN,
      status: SCENE_STATUS.GENERATING,
      failedTurn: null,
      lastError: "",
    });

    activeTurnPromise = Promise.resolve().then(() =>
      generateReply({
        scene: cloneSceneDraft(scene),
        turn,
        request,
      }),
    );

    try {
      const replyText = String(await activeTurnPromise).trim();
      activeTurnPromise = null;

      if (stopRequested) {
        setStoppedState();
        return false;
      }

      const normalizedReplyText = replyText || "No response from model.";
      const character = getTurnCharacter(scene, turn.speaker);
      const nextTranscript = [
        ...scene.transcript,
        {
          id: createSceneId("line"),
          pairNumber: turn.pairNumber,
          speaker: turn.speaker,
          characterName: character.name,
          model: request.model,
          text: normalizedReplyText,
          blocks: parseSceneReplyBlocks(normalizedReplyText),
        },
      ];

      updateScene({
        ...scene,
        transcript: nextTranscript,
        failedTurn: null,
        lastError: "",
      });

      if (scene.pauseRequested) {
        updateScene({
          ...scene,
          status: SCENE_STATUS.PAUSED,
          pauseRequested: false,
          countdownRemainingMs: 0,
        });
        return true;
      }

      return continueAfterSuccessfulTurn();
    } catch (error) {
      activeTurnPromise = null;

      if (stopRequested || getErrorMessage(error) === "Generation stopped.") {
        setStoppedState();
        return false;
      }

      updateScene({
        ...scene,
        status: SCENE_STATUS.ERROR,
        failedTurn: turn,
        lastError: getErrorMessage(error),
        countdownRemainingMs: 0,
        pauseRequested: false,
      });
      return false;
    }
  }

  function scheduleCooldown() {
    cooldownTimer.stop();

    if (scene.cooldownSeconds <= 0) {
      void executeTurn();
      return;
    }

    updateScene({
      ...scene,
      status: SCENE_STATUS.COOLING_DOWN,
      countdownRemainingMs: scene.cooldownSeconds * 1000,
    });

    cooldownTimer.start(scene.cooldownSeconds * 1000);
  }

  function continueAfterSuccessfulTurn() {
    if (scene.transcript.length >= getTotalReplyCount(scene)) {
      updateScene({
        ...scene,
        status: SCENE_STATUS.COMPLETED,
        countdownRemainingMs: 0,
      });
      return true;
    }

    const currentPairNumber = Math.floor((scene.transcript.length - 1) / 2) + 1;
    const pairReplyCount = getPairReplyCount(scene, currentPairNumber);

    if (pairReplyCount < 2) {
      void executeTurn();
      return true;
    }

    if (scene.runMode === SCENE_RUN_MODE.STEP) {
      updateScene({
        ...scene,
        status: SCENE_STATUS.WAITING_FOR_CONTINUE,
        countdownRemainingMs: 0,
      });
      return true;
    }

    scheduleCooldown();
    return true;
  }

  function replaceScene(nextScene) {
    updateScene(nextScene);
  }

  function start() {
    cooldownTimer.stop();
    stopRequested = false;

    updateScene({
      ...scene,
      view: SCENE_VIEW.RUN,
      status: SCENE_STATUS.GENERATING,
      transcript: [],
      failedTurn: null,
      lastError: "",
      countdownRemainingMs: 0,
      pauseRequested: false,
    });

    void executeTurn();
  }

  function pause() {
    if (scene.status === SCENE_STATUS.GENERATING) {
      updateScene({
        ...scene,
        pauseRequested: true,
      });
      return true;
    }

    if (scene.status !== SCENE_STATUS.COOLING_DOWN) {
      return false;
    }

    const remainingMs = cooldownTimer.getRemainingMs();
    cooldownTimer.stop();
    updateScene({
      ...scene,
      status: SCENE_STATUS.PAUSED,
      countdownRemainingMs: remainingMs,
      pauseRequested: false,
    });
    return true;
  }

  function resume() {
    if (scene.status !== SCENE_STATUS.PAUSED) {
      return false;
    }

    if (scene.countdownRemainingMs > 0) {
      cooldownTimer.stop();
      updateScene({
        ...scene,
        status: SCENE_STATUS.COOLING_DOWN,
      });
      cooldownTimer.start(scene.countdownRemainingMs);
      return true;
    }

    void executeTurn();
    return true;
  }

  function continueStep() {
    if (scene.status !== SCENE_STATUS.WAITING_FOR_CONTINUE) {
      return false;
    }

    void executeTurn();
    return true;
  }

  function retry() {
    if (scene.status !== SCENE_STATUS.ERROR || !scene.failedTurn) {
      return false;
    }

    void executeTurn(scene.failedTurn);
    return true;
  }

  async function stop() {
    stopRequested = true;
    cooldownTimer.stop();

    if (!activeTurnPromise) {
      setStoppedState();
      return true;
    }

    setStoppedState();
    await stopGeneration();
    return true;
  }

  function dispose() {
    cooldownTimer.stop();
  }

  return {
    continueStep,
    dispose,
    getScene: () => cloneSceneDraft(scene),
    pause,
    replaceScene,
    resume,
    retry,
    start,
    stop,
  };
}
