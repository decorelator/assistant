import test from "node:test";
import assert from "node:assert/strict";

import {
  createDeferred,
  createRunnerHarness,
  flushMicrotasks,
} from "./scene-test-helpers.mjs";
import { SCENE_RUN_MODE, SCENE_STATUS } from "../public/js/features/scene-state.mjs";

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

test("runner stores parsed scene blocks on transcript entries", async () => {
  const harness = createRunnerHarness(
    {
      exchangeCount: 1,
    },
    {
      async generateReply(_payload, context) {
        return context.callCount === 1
          ? [
              "[ACTION] Alice folds her arms.",
              "",
              '[SAY] "I am fine."',
              "",
              "[THOUGHT] I am not fine.",
            ].join("\n")
          : "Plain fallback reply";
      },
    },
  );

  harness.runner.start();
  await flushMicrotasks();

  assert.deepEqual(
    harness.scene.transcript[0].blocks,
    [
      { type: "action", text: "Alice folds her arms." },
      { type: "say", text: '"I am fine."' },
      { type: "thought", text: "I am not fine." },
    ],
  );
  assert.deepEqual(harness.scene.transcript[1].blocks, [{ type: "say", text: "Plain fallback reply" }]);
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
