import {
  SCENE_STATUS,
  SCENE_VIEW,
} from "./scene-state-constants.mjs";

function createFallbackCharacter(characterId) {
  return {
    name: `Character ${characterId}`,
    card: "",
  };
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
  return scene.characters[speaker] ?? createFallbackCharacter(speaker);
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
