export function createSceneRunnerTimer({
  clearTimer,
  now,
  onComplete,
  onTick,
  setTimer,
  shouldContinue,
}) {
  let timerId = null;
  let deadline = 0;

  function stop() {
    if (timerId !== null) {
      clearTimer(timerId);
      timerId = null;
    }
  }

  function getRemainingMs() {
    return Math.max(0, deadline - now());
  }

  function tick() {
    if (!shouldContinue()) {
      stop();
      return;
    }

    const remainingMs = getRemainingMs();
    onTick(remainingMs);

    if (remainingMs <= 0) {
      stop();
      onComplete();
      return;
    }

    timerId = setTimer(tick, Math.min(250, remainingMs));
  }

  function start(durationMs) {
    stop();
    deadline = now() + durationMs;
    timerId = setTimer(tick, Math.min(250, durationMs));
  }

  return {
    getRemainingMs,
    start,
    stop,
  };
}
