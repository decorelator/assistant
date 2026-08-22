import { SCENE_BEAT_MOMENT, SCENE_STATUS } from "./scene-state-constants.mjs";
import {
  getCurrentPairNumber,
  getPairReplyCount,
  getSpeakerOrder,
} from "./scene-state-selectors.mjs";

const MOMENT_ORDER = {
  [SCENE_BEAT_MOMENT.BEFORE_A]: 0,
  [SCENE_BEAT_MOMENT.BEFORE_B]: 1,
  [SCENE_BEAT_MOMENT.PAIR]: 2,
};

function getBeatCompletionThreshold(firstSpeaker, moment) {
  if (moment === SCENE_BEAT_MOMENT.PAIR) {
    return 2;
  }

  const speaker = moment === SCENE_BEAT_MOMENT.BEFORE_B ? "B" : "A";
  const replyIndex = getSpeakerOrder(firstSpeaker).indexOf(speaker);
  return replyIndex < 0 ? 2 : replyIndex + 1;
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
    return (
      scene.status === SCENE_STATUS.DRAFT ||
      scene.status === SCENE_STATUS.STOPPED ||
      scene.status === SCENE_STATUS.COMPLETED
    );
  }

  return !isBeatApplied(scene, beat);
}
