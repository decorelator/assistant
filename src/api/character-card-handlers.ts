const {
  createCharacterCard,
  deleteCharacterCard,
  getCharacterCardById,
  isUniqueCharacterCardTitleConstraintError,
  readCharacterCards,
  readCharacterTags,
  updateCharacterCard,
} = require("../db/character-cards");
const { readJsonBody, sendJson } = require("../lib/http");
const { readPositiveInteger, readTrimmedString } = require("./request-utils");

function readTagIds(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
}

function readCardInput(body: Record<string, unknown>) {
  const tags = Array.isArray(body.tags) ? body.tags : [];
  const age = typeof body.age === "number" ? body.age : Number.parseInt(String(body.age ?? ""), 10);

  return {
    title: readTrimmedString(body.title) || readTrimmedString(body.name),
    characterName:
      readTrimmedString(body.characterName) ||
      readTrimmedString(body.name) ||
      readTrimmedString(body.title),
    name: readTrimmedString(body.name),
    gender: readTrimmedString(body.gender),
    age: Number.isInteger(age) && age > 0 && age <= 999 ? age : null,
    cardText: typeof body.cardText === "string" ? body.cardText : "",
    notes: typeof body.notes === "string" ? body.notes : "",
    tags: tags
      .filter((tag): tag is Record<string, unknown> => Boolean(tag) && typeof tag === "object")
      .map((tag) => ({
        id: typeof tag.id === "number" ? tag.id : undefined,
        name: readTrimmedString(tag.name),
        kind: readTrimmedString(tag.kind) || "custom",
      })),
  };
}

function validateCardInput(
  response: import("node:http").ServerResponse,
  input: ReturnType<typeof readCardInput>,
) {
  if (!input.title) {
    sendJson(response, 400, { error: "Card title is required." });
    return false;
  }

  if (!input.characterName) {
    sendJson(response, 400, { error: "Character name is required." });
    return false;
  }

  if (!input.cardText.trim()) {
    sendJson(response, 400, { error: "Character card text is required." });
    return false;
  }

  return true;
}

function handleCharacterCardListRequest(
  response: import("node:http").ServerResponse,
  searchParams: URLSearchParams,
) {
  const q = searchParams.get("q") ?? "";
  const tagIds = readTagIds(searchParams.get("tags"));
  sendJson(response, 200, { cards: readCharacterCards({ q, tagIds }) });
}

function handleCharacterTagListRequest(response: import("node:http").ServerResponse) {
  sendJson(response, 200, { tags: readCharacterTags() });
}

async function handleCharacterCardCreateRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
) {
  try {
    const body = await readJsonBody(request);
    const input = readCardInput(body);

    if (!validateCardInput(response, input)) {
      return;
    }

    const card = createCharacterCard(input);
    sendJson(response, 201, { card });
  } catch (error) {
    if (isUniqueCharacterCardTitleConstraintError(error)) {
      sendJson(response, 409, { error: "A character card with this title already exists." });
      return;
    }

    const message = error instanceof Error ? error.message : "Could not save character card.";
    sendJson(response, 500, { error: message });
  }
}

async function handleCharacterCardUpdateRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  cardIdParam: string,
) {
  const cardId = readPositiveInteger(cardIdParam);

  if (!cardId) {
    sendJson(response, 400, { error: "Valid character card id is required." });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const input = readCardInput(body);

    if (!validateCardInput(response, input)) {
      return;
    }

    const card = updateCharacterCard(cardId, input);

    if (!card) {
      sendJson(response, 404, { error: "Character card not found." });
      return;
    }

    sendJson(response, 200, { card });
  } catch (error) {
    if (isUniqueCharacterCardTitleConstraintError(error)) {
      sendJson(response, 409, { error: "A character card with this title already exists." });
      return;
    }

    const message = error instanceof Error ? error.message : "Could not update character card.";
    sendJson(response, 500, { error: message });
  }
}

function handleCharacterCardReadRequest(
  response: import("node:http").ServerResponse,
  cardIdParam: string,
) {
  const cardId = readPositiveInteger(cardIdParam);

  if (!cardId) {
    sendJson(response, 400, { error: "Valid character card id is required." });
    return;
  }

  const card = getCharacterCardById(cardId);

  if (!card) {
    sendJson(response, 404, { error: "Character card not found." });
    return;
  }

  sendJson(response, 200, { card });
}

function handleCharacterCardDeleteRequest(
  response: import("node:http").ServerResponse,
  cardIdParam: string,
) {
  const cardId = readPositiveInteger(cardIdParam);

  if (!cardId) {
    sendJson(response, 400, { error: "Valid character card id is required." });
    return;
  }

  const deleted = deleteCharacterCard(cardId);

  if (!deleted) {
    sendJson(response, 404, { error: "Character card not found." });
    return;
  }

  sendJson(response, 200, { deletedId: cardId });
}

module.exports = {
  handleCharacterCardCreateRequest,
  handleCharacterCardDeleteRequest,
  handleCharacterCardListRequest,
  handleCharacterCardReadRequest,
  handleCharacterCardUpdateRequest,
  handleCharacterTagListRequest,
};
