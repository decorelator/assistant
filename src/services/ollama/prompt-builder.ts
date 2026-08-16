import type { SelectedMessage } from "./types";

function buildPrompt(prompt: string, selectedMessages: SelectedMessage[], director = "", context = "") {
  const contextInstruction = context ? `[CONTEXT: ${context}]` : "";
  const directorInstruction = director ? `[DIRECTOR: ${director}]` : "";
  const currentRequest = [directorInstruction, prompt].filter(Boolean).join("\n\n");

  if (selectedMessages.length === 0) {
    return [contextInstruction, currentRequest].filter(Boolean).join("\n\n");
  }

  const conversationContext = selectedMessages
    .map(({ role, text }) => `${role === "user" ? "User" : "Assistant"}:\n${text}`)
    .join("\n\n");

  return [
    contextInstruction,
    "Use the selected conversation context below when it helps answer the current user message.",
    `Selected conversation context:\n${conversationContext}`,
    `Current user message:\n${currentRequest}`,
  ].filter(Boolean).join("\n\n");
}

module.exports = { buildPrompt };
