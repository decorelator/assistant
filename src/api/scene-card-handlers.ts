const {
  createSceneCard,
  deleteSceneCard,
  getSceneCardById,
  getSceneCardType,
  isUniqueSceneCardTitleConstraintError,
  readSceneCards,
  updateSceneCard,
} = require("../db/scene-cards");
const { readJsonBody, sendJson } = require("../lib/http");
const { readPositiveInteger, readTrimmedString } = require("./request-utils");

function readSceneCardInput(body: Record<string, unknown>) {
  return {
    type: getSceneCardType(body.type),
    title: readTrimmedString(body.title),
    description: typeof body.description === "string" ? body.description : "",
    text: typeof body.text === "string" ? body.text : "",
  };
}

function validateSceneCardInput(
  response: import("node:http").ServerResponse,
  input: ReturnType<typeof readSceneCardInput>,
) {
  if (!input.type) {
    sendJson(response, 400, { error: "Scene card type must be instruction or context." });
    return false;
  }

  if (!input.title) {
    sendJson(response, 400, { error: "Scene card title is required." });
    return false;
  }

  if (!input.text.trim()) {
    sendJson(response, 400, { error: "Scene card text is required." });
    return false;
  }

  return true;
}

function handleSceneCardListRequest(
  response: import("node:http").ServerResponse,
  searchParams: URLSearchParams,
) {
  const type = getSceneCardType(searchParams.get("type"));
  const q = searchParams.get("q") ?? "";
  sendJson(response, 200, { cards: readSceneCards({ type, q }) });
}

async function handleSceneCardCreateRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
) {
  try {
    const body = await readJsonBody(request);
    const input = readSceneCardInput(body);

    if (!validateSceneCardInput(response, input)) {
      return;
    }

    const card = createSceneCard(input);
    sendJson(response, 201, { card });
  } catch (error) {
    if (isUniqueSceneCardTitleConstraintError(error)) {
      sendJson(response, 409, { error: "A scene card with this title already exists." });
      return;
    }

    const message = error instanceof Error ? error.message : "Could not save scene card.";
    sendJson(response, 500, { error: message });
  }
}

async function handleSceneCardUpdateRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  cardIdParam: string,
) {
  const cardId = readPositiveInteger(cardIdParam);

  if (!cardId) {
    sendJson(response, 400, { error: "Valid scene card id is required." });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const input = readSceneCardInput(body);

    if (!validateSceneCardInput(response, input)) {
      return;
    }

    const card = updateSceneCard(cardId, input);

    if (!card) {
      sendJson(response, 404, { error: "Scene card not found." });
      return;
    }

    sendJson(response, 200, { card });
  } catch (error) {
    if (isUniqueSceneCardTitleConstraintError(error)) {
      sendJson(response, 409, { error: "A scene card with this title already exists." });
      return;
    }

    const message = error instanceof Error ? error.message : "Could not update scene card.";
    sendJson(response, 500, { error: message });
  }
}

function handleSceneCardReadRequest(
  response: import("node:http").ServerResponse,
  cardIdParam: string,
) {
  const cardId = readPositiveInteger(cardIdParam);

  if (!cardId) {
    sendJson(response, 400, { error: "Valid scene card id is required." });
    return;
  }

  const card = getSceneCardById(cardId);

  if (!card) {
    sendJson(response, 404, { error: "Scene card not found." });
    return;
  }

  sendJson(response, 200, { card });
}

function handleSceneCardDeleteRequest(
  response: import("node:http").ServerResponse,
  cardIdParam: string,
) {
  const cardId = readPositiveInteger(cardIdParam);

  if (!cardId) {
    sendJson(response, 400, { error: "Valid scene card id is required." });
    return;
  }

  const deleted = deleteSceneCard(cardId);

  if (!deleted) {
    sendJson(response, 404, { error: "Scene card not found." });
    return;
  }

  sendJson(response, 200, { deletedId: cardId });
}

module.exports = {
  handleSceneCardCreateRequest,
  handleSceneCardDeleteRequest,
  handleSceneCardListRequest,
  handleSceneCardReadRequest,
  handleSceneCardUpdateRequest,
};
