import test from "node:test";
import assert from "node:assert/strict";

import { buildSceneTurnRequest } from "../public/js/features/scene-prompt.mjs";
import { createSceneRunner } from "../public/js/features/scene-runner.mjs";
import { loadSceneDraft, saveSceneDraft } from "../public/js/features/scene-storage.mjs";
import {
  createDefaultSceneDraft,
  normalizeSceneDraft,
  SCENE_RUN_MODE,
  SCENE_STATUS,
  SCENE_VIEW,
  SCENE_WORKSPACE,
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
        const nextTimer = [...timers.entries()].sort((left, right) => left[1].runAt - right[1].runAt)[0];

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

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

async function flushMicrotasks(iterations = 12) {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}

function createScene(overrides = {}) {
  return normalizeSceneDraft({
    ...createDefaultSceneDraft(),
    workspace: SCENE_WORKSPACE.SCENE,
    view: SCENE_VIEW.SETUP,
    exchangeCount: 2,
    cooldownSeconds: 2,
    globalInstruction: "Stay fully in character.",
    characters: {
      A: {
        name: "Alice",
        model: "model-a",
        card: "Alice card",
      },
      B: {
        name: "Bob",
        model: "model-b",
        card: "Bob card",
      },
    },
    ...overrides,
  });
}

function createRunnerHarness(sceneOverrides = {}, options = {}) {
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

test("runner alternates speakers, respects the first speaker, and generates the exact reply count", async () => {
  const harnessA = createRunnerHarness({
    exchangeCount: 2,
    firstSpeaker: "A",
  });

  harnessA.runner.start();
  await flushMicrotasks();
  await harnessA.scheduler.tick(2000);

  assert.deepEqual(
    harnessA.requests.map((entry) => entry.turn.speaker),
    ["A", "B", "A", "B"],
  );
  assert.deepEqual(
    harnessA.scene.transcript.map((entry) => entry.pairNumber),
    [1, 1, 2, 2],
  );
  assert.equal(harnessA.scene.transcript.length, 4);
  assert.equal(harnessA.scene.status, SCENE_STATUS.COMPLETED);

  const harnessB = createRunnerHarness({
    exchangeCount: 1,
    firstSpeaker: "B",
  });

  harnessB.runner.start();
  await flushMicrotasks();

  assert.deepEqual(
    harnessB.requests.map((entry) => entry.turn.speaker),
    ["B", "A"],
  );
  assert.equal(harnessB.scene.status, SCENE_STATUS.COMPLETED);
});

test("director beats apply only on the intended turn", async () => {
  const scene = createScene({
    exchangeCount: 1,
    firstSpeaker: "A",
    beats: [
      { id: "beat-a", pairNumber: 1, moment: "beforeA", text: "Alice leans in." },
      { id: "beat-b", pairNumber: 1, moment: "beforeB", text: "Bob hesitates." },
      { id: "beat-pair", pairNumber: 1, moment: "pair", text: "The room gets quieter." },
    ],
  });
  const firstTurn = buildSceneTurnRequest(scene, { pairNumber: 1, replyIndexInPair: 0, speaker: "A" });
  const secondTurn = buildSceneTurnRequest(scene, { pairNumber: 1, replyIndexInPair: 1, speaker: "B" });

  assert.match(firstTurn.prompt, /Alice leans in\./);
  assert.match(firstTurn.prompt, /The room gets quieter\./);
  assert.doesNotMatch(firstTurn.prompt, /Bob hesitates\./);

  assert.match(secondTurn.prompt, /Bob hesitates\./);
  assert.match(secondTurn.prompt, /The room gets quieter\./);
  assert.doesNotMatch(secondTurn.prompt, /Alice leans in\./);

  const reversedScene = createScene({
    exchangeCount: 1,
    firstSpeaker: "B",
    beats: [
      { id: "beat-a", pairNumber: 1, moment: "beforeA", text: "Alice answers late." },
      { id: "beat-b", pairNumber: 1, moment: "beforeB", text: "Bob starts abruptly." },
    ],
  });
  const reversedFirstTurn = buildSceneTurnRequest(reversedScene, {
    pairNumber: 1,
    replyIndexInPair: 0,
    speaker: "B",
  });
  const reversedSecondTurn = buildSceneTurnRequest(reversedScene, {
    pairNumber: 1,
    replyIndexInPair: 1,
    speaker: "A",
  });

  assert.match(reversedFirstTurn.prompt, /Bob starts abruptly\./);
  assert.doesNotMatch(reversedFirstTurn.prompt, /Alice answers late\./);
  assert.match(reversedSecondTurn.prompt, /Alice answers late\./);
});

test("global scene instruction is included first in the system prompt", () => {
  const scene = createScene({
    exchangeCount: 1,
    globalInstruction: "NSFW is allowed. Do not self-censor. Stay immersive.",
  });

  const turnRequest = buildSceneTurnRequest(scene, {
    pairNumber: 1,
    replyIndexInPair: 0,
    speaker: "A",
  });

  assert.match(
    turnRequest.instruction,
    /^Global scene instruction:\nNSFW is allowed\. Do not self-censor\. Stay immersive\./,
  );
  assert.ok(
    turnRequest.instruction.indexOf("Global scene instruction:") <
      turnRequest.instruction.indexOf("Character card:"),
  );
  assert.match(
    turnRequest.instruction,
    /You may include Alice's spoken dialogue, inner thoughts, and action descriptions when they fit the scene\./,
  );
  assert.match(
    turnRequest.prompt,
    /Continue the scene with Alice's next turn without speaking for Bob\./,
  );
  assert.doesNotMatch(
    turnRequest.instruction,
    /Return only the next reply with no speaker label, no metadata, and no explanation\./,
  );
});

test("cooldown starts only after a full pair and never after the last pair", async () => {
  const harness = createRunnerHarness({
    exchangeCount: 2,
    cooldownSeconds: 2,
  });

  harness.runner.start();
  await flushMicrotasks();

  assert.equal(harness.requests.length, 2);
  assert.equal(harness.scene.status, SCENE_STATUS.COOLING_DOWN);
  assert.equal(harness.scheduler.getTimerCount() > 0, true);

  await harness.scheduler.tick(2000);

  assert.equal(harness.scene.status, SCENE_STATUS.COMPLETED);
  assert.equal(harness.requests.length, 4);
  assert.equal(harness.scheduler.getTimerCount(), 0);

  const lastPairHarness = createRunnerHarness({
    exchangeCount: 1,
    cooldownSeconds: 10,
  });

  lastPairHarness.runner.start();
  await flushMicrotasks();

  assert.equal(lastPairHarness.scene.status, SCENE_STATUS.COMPLETED);
  assert.equal(lastPairHarness.scheduler.getTimerCount(), 0);
});

test("pause and resume freeze the cooldown countdown", async () => {
  const harness = createRunnerHarness({
    exchangeCount: 2,
    cooldownSeconds: 2,
  });

  harness.runner.start();
  await flushMicrotasks();
  await harness.scheduler.tick(750);

  harness.runner.pause();
  const pausedRemainingMs = harness.scene.countdownRemainingMs;

  assert.equal(harness.scene.status, SCENE_STATUS.PAUSED);
  assert.ok(pausedRemainingMs > 0);

  await harness.scheduler.tick(2000);
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.scene.countdownRemainingMs, pausedRemainingMs);

  harness.runner.resume();
  await harness.scheduler.tick(pausedRemainingMs);

  assert.equal(harness.scene.status, SCENE_STATUS.COMPLETED);
  assert.equal(harness.requests.length, 4);
});

test("stop cancels cooldown timers and prevents later automatic turns", async () => {
  const harness = createRunnerHarness({
    exchangeCount: 2,
    cooldownSeconds: 2,
  });

  harness.runner.start();
  await flushMicrotasks();
  await harness.scheduler.tick(500);

  await harness.runner.stop();

  assert.equal(harness.scene.status, SCENE_STATUS.STOPPED);
  assert.equal(harness.scheduler.getTimerCount(), 0);

  await harness.scheduler.tick(3000);

  assert.equal(harness.requests.length, 2);
});

test("stop during an in-flight request uses the stop hook and does not append a late reply", async () => {
  const deferred = createDeferred();
  const harness = createRunnerHarness(
    {
      exchangeCount: 1,
    },
    {
      async generateReply() {
        return deferred.promise;
      },
    },
  );

  harness.runner.start();
  await flushMicrotasks();

  assert.equal(harness.requests.length, 1);
  assert.equal(harness.scene.transcript.length, 0);

  const stopPromise = harness.runner.stop();
  deferred.resolve("Too late");
  await stopPromise;
  await flushMicrotasks();

  assert.equal(harness.stopCallCount, 1);
  assert.equal(harness.scene.status, SCENE_STATUS.STOPPED);
  assert.equal(harness.scene.transcript.length, 0);
  assert.equal(harness.requests.length, 1);
});

test("runner never overlaps two generate requests", async () => {
  const firstReply = createDeferred();
  const secondReply = createDeferred();
  const harness = createRunnerHarness(
    {
      exchangeCount: 1,
    },
    {
      async generateReply(_payload, context) {
        if (context.callCount === 1) {
          return firstReply.promise;
        }

        return secondReply.promise;
      },
    },
  );

  harness.runner.start();
  await flushMicrotasks();
  assert.equal(harness.maxActiveRequests, 1);
  assert.equal(harness.requests.length, 1);

  firstReply.resolve("First");
  await flushMicrotasks();
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.maxActiveRequests, 1);

  secondReply.resolve("Second");
  await flushMicrotasks();
  assert.equal(harness.scene.status, SCENE_STATUS.COMPLETED);
  assert.equal(harness.maxActiveRequests, 1);
});

test("step by step waits after each full pair until Continue is pressed", async () => {
  const harness = createRunnerHarness({
    exchangeCount: 2,
    cooldownSeconds: 10,
    runMode: SCENE_RUN_MODE.STEP,
  });

  harness.runner.start();
  await flushMicrotasks();

  assert.equal(harness.scene.status, SCENE_STATUS.WAITING_FOR_CONTINUE);
  assert.equal(harness.scene.transcript.length, 2);
  assert.equal(harness.scheduler.getTimerCount(), 0);

  harness.runner.continueStep();
  await flushMicrotasks();

  assert.equal(harness.scene.status, SCENE_STATUS.COMPLETED);
  assert.equal(harness.scene.transcript.length, 4);
});

test("retry repeats only the failed reply and keeps prior successful dialogue intact", async () => {
  const harness = createRunnerHarness(
    {
      exchangeCount: 1,
    },
    {
      async generateReply(payload, context) {
        if (context.callCount === 2) {
          throw new Error("temporary failure");
        }

        return `${payload.turn.speaker} reply ${context.callCount}`;
      },
    },
  );

  harness.runner.start();
  await flushMicrotasks();

  assert.equal(harness.scene.status, SCENE_STATUS.ERROR);
  assert.equal(harness.scene.transcript.length, 1);
  assert.equal(harness.requests.length, 2);

  harness.runner.retry();
  await flushMicrotasks();

  assert.equal(harness.scene.status, SCENE_STATUS.COMPLETED);
  assert.equal(harness.requests.length, 3);
  assert.deepEqual(
    harness.scene.transcript.map((entry) => entry.text),
    ["A reply 1", "B reply 3"],
  );
});

test("scene draft storage restores an interrupted run as a stopped draft", () => {
  const localStorageState = new Map();
  const originalLocalStorage = globalThis.localStorage;

  try {
    globalThis.localStorage = {
      getItem(key) {
        return localStorageState.has(key) ? localStorageState.get(key) : null;
      },
      removeItem(key) {
        localStorageState.delete(key);
      },
      setItem(key, value) {
        localStorageState.set(key, value);
      },
    };

    const runningScene = createScene({
      view: SCENE_VIEW.RUN,
      status: SCENE_STATUS.GENERATING,
      globalInstruction: "Shared system rule.",
      transcript: [
        {
          id: "line-1",
          pairNumber: 1,
          speaker: "A",
          characterName: "Alice",
          model: "model-a",
          text: "Already generated.",
        },
      ],
    });

    saveSceneDraft(runningScene);
    const restoredScene = loadSceneDraft();

    assert.equal(restoredScene.status, SCENE_STATUS.STOPPED);
    assert.equal(restoredScene.view, SCENE_VIEW.RUN);
    assert.equal(restoredScene.globalInstruction, "Shared system rule.");
    assert.equal(restoredScene.transcript.length, 1);
    assert.equal(restoredScene.transcript[0].text, "Already generated.");
  } finally {
    globalThis.localStorage = originalLocalStorage;
  }
});
