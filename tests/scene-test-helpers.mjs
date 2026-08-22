import { createSceneRunner } from "../public/js/features/scene-runner.mjs";
import {
  createDefaultSceneDraft,
  normalizeSceneDraft,
  SCENE_WORKSPACE,
  SCENE_VIEW,
} from "../public/js/features/scene-state.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createScheduler() {
  let nowMs = 0;
  let nextId = 1;
  const timers = new Map();

  return {
    clearTimer(timerId) {
      timers.delete(timerId);
    },
    getTimerCount() {
      return timers.size;
    },
    now() {
      return nowMs;
    },
    setTimer(callback, delayMs) {
      const timerId = nextId++;
      timers.set(timerId, {
        callback,
        runAt: nowMs + delayMs,
      });
      return timerId;
    },
    async tick(ms) {
      const target = nowMs + ms;

      while (true) {
        const nextTimer = [...timers.entries()].sort(
          (left, right) => left[1].runAt - right[1].runAt,
        )[0];

        if (!nextTimer || nextTimer[1].runAt > target) {
          break;
        }

        const [timerId, timer] = nextTimer;
        timers.delete(timerId);
        nowMs = timer.runAt;
        timer.callback();
        await flushMicrotasks();
      }

      nowMs = target;
      await flushMicrotasks();
    },
  };
}

export function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

export async function flushMicrotasks(iterations = 12) {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}

export function createScene(overrides = {}) {
  return normalizeSceneDraft({
    ...createDefaultSceneDraft(),
    workspace: SCENE_WORKSPACE.SCENE,
    view: SCENE_VIEW.SETUP,
    exchangeCount: 2,
    cooldownSeconds: 2,
    globalInstruction: "Stay fully in character.",
    model: "scene-model",
    characters: {
      A: {
        name: "Alice",
        card: "Alice card",
      },
      B: {
        name: "Bob",
        card: "Bob card",
      },
    },
    ...overrides,
  });
}

export function createRunnerHarness(sceneOverrides = {}, options = {}) {
  const scheduler = createScheduler();
  const requests = [];
  const states = [];
  const pendingDeferreds = [];
  let stopCallCount = 0;
  let activeRequests = 0;
  let maxActiveRequests = 0;
  let callCount = 0;
  const scene = createScene(sceneOverrides);

  const runner = createSceneRunner({
    initialScene: scene,
    async generateReply(payload) {
      callCount += 1;
      requests.push(clone(payload));
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);

      try {
        if (options.generateReply) {
          return await options.generateReply(payload, { callCount, pendingDeferreds });
        }

        return `${payload.turn.speaker}-${payload.turn.pairNumber}`;
      } finally {
        activeRequests -= 1;
      }
    },
    async stopGeneration() {
      stopCallCount += 1;
    },
    onChange(nextScene) {
      states.push(clone(nextScene));
    },
    clearTimer: scheduler.clearTimer,
    now: scheduler.now,
    setTimer: scheduler.setTimer,
  });

  return {
    get maxActiveRequests() {
      return maxActiveRequests;
    },
    get requests() {
      return requests;
    },
    get scene() {
      return runner.getScene();
    },
    get states() {
      return states;
    },
    get stopCallCount() {
      return stopCallCount;
    },
    pendingDeferreds,
    runner,
    scheduler,
  };
}
