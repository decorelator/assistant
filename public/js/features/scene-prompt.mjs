import {
  getSceneReplyBlocksForModelContext,
  serializeSceneReplyBlocks,
} from "./scene-blocks.mjs";
import {
  getApplicableBeats,
  getSpeakerOrder,
  getTurnCharacter,
} from "./scene-state.mjs";

function formatSection(title, value, fallback = "None.") {
  return `${title}:\n${value?.trim() ? value.trim() : fallback}`;
}

export function formatSceneTranscript(scene) {
  if (scene.transcript.length === 0) {
    return "No dialogue yet.";
  }

  const transcript = scene.transcript
    .map((entry) => {
      const visibleBlocks = getSceneReplyBlocksForModelContext(entry.blocks, entry.text);
      const visibleText = serializeSceneReplyBlocks(visibleBlocks);

      if (!visibleText) {
        return null;
      }

      return `${entry.characterName || `Character ${entry.speaker}`}:\n${visibleText}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return transcript || "No dialogue yet.";
}

export function buildSceneTurnRequest(scene, turn) {
  const character = getTurnCharacter(scene, turn.speaker);
  const otherSpeaker = turn.speaker === "A" ? "B" : "A";
  const otherCharacter = getTurnCharacter(scene, otherSpeaker);
  const speakerOrder = getSpeakerOrder(scene.firstSpeaker)
    .map((speaker) => getTurnCharacter(scene, speaker).name)
    .join(" then ");
  const appliedBeats = getApplicableBeats(scene, turn);
  const directionText =
    appliedBeats.length > 0
      ? appliedBeats
          .map((beat, index) => `${index + 1}. ${beat.text}`)
          .join("\n")
      : "No director beat for this reply.";

  const instruction = [
    formatSection(
      "Global scene instruction",
      scene.globalInstruction,
      "No extra global scene instruction.",
    ),
    `You are ${character.name}.`,
    `Stay fully in ${character.name}'s point of view and voice.`,
    `You may include ${character.name}'s spoken dialogue, inner thoughts, and action descriptions when they fit the scene.`,
    `${character.name}'s [THOUGHT] blocks are private notes. They are not visible to ${otherCharacter.name} and they are not included in later dialogue history for either character.`,
    `Do not write dialogue, thoughts, or actions for ${otherCharacter.name}.`,
    "Return only the next turn as one or more tagged blocks.",
    "Allowed tags: [SAY] for spoken dialogue, [ACTION] for visible actions/gestures/expressions/behavior, [THOUGHT] for private inner thoughts.",
    "Keep the block order chronological. You may repeat the same tag multiple times. Do not use any other tags or speaker labels.",
    formatSection("Character card", character.card, "No extra character card."),
  ].join("\n\n");

  const prompt = [
    formatSection("Scene title", scene.title, "Untitled scene"),
    formatSection("Scene context", scene.context, "No extra scene context."),
    `Exchange ${turn.pairNumber} of ${scene.exchangeCount}. Each exchange always contains two replies.`,
    `Speaker order in every exchange: ${speakerOrder}.`,
    `Current speaker: ${character.name}.`,
    formatSection("Director beat for this reply", directionText),
    formatSection("Dialogue so far", formatSceneTranscript(scene)),
    `Continue the scene with ${character.name}'s next turn without speaking for ${otherCharacter.name}.`,
  ].join("\n\n");

  return {
    model: scene.model,
    instruction,
    prompt,
    appliedBeatIds: appliedBeats.map((beat) => beat.id),
  };
}
