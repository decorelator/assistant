const STORAGE_KEY = "ollama-assistant.chat-history.v1";
const MAX_STORED_MESSAGES = 100;

function normalizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  const normalized = {};

  for (const key of ["modelName", "instructionName"]) {
    if (typeof metadata[key] === "string" && metadata[key].trim()) {
      normalized[key] = metadata[key];
    }
  }

  if (typeof metadata.included === "boolean") {
    normalized.included = metadata.included;
  }

  return normalized;
}

function normalizeMessage(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  if ((message.role !== "user" && message.role !== "assistant") || typeof message.text !== "string") {
    return null;
  }

  return {
    role: message.role,
    text: message.text,
    metadata: normalizeMetadata(message.metadata),
  };
}

export function loadChatHistory() {
  try {
    const storedHistory = localStorage.getItem(STORAGE_KEY);
    const parsedHistory = storedHistory ? JSON.parse(storedHistory) : [];

    if (!Array.isArray(parsedHistory)) {
      return [];
    }

    return parsedHistory.map(normalizeMessage).filter(Boolean).slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

export function saveChatHistory(messages) {
  try {
    const history = Array.isArray(messages)
      ? messages.map(normalizeMessage).filter(Boolean).slice(-MAX_STORED_MESSAGES)
      : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Saving chat history is optional; the current conversation should still work.
  }
}

export function clearChatHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Some browser privacy modes can deny access to localStorage.
  }
}
