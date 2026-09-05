const { getDatabase } = require("./sqlite");

const SCENE_CARD_TYPES = new Set(["instruction", "context"]);

type SceneCardInput = {
  type?: string;
  title?: string;
  description?: string;
  text?: string;
};

type SceneCard = {
  id: number;
  type: string;
  title: string;
  description: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

function initializeSceneCardTables() {
  const database = getDatabase();

  database.exec(`
    CREATE TABLE IF NOT EXISTS scene_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL COLLATE NOCASE,
      title TEXT NOT NULL COLLATE NOCASE,
      description TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (type, title)
    );

    CREATE INDEX IF NOT EXISTS idx_scene_cards_type_updated_at
      ON scene_cards(type, updated_at);
  `);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getSceneCardType(value: unknown) {
  const type = readString(value).toLowerCase();
  return SCENE_CARD_TYPES.has(type) ? type : "";
}

function mapSceneCard(row: Record<string, unknown>): SceneCard {
  return {
    id: Number(row.id),
    type: String(row.type ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    text: String(row.text ?? ""),
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
  };
}

function readSceneCards({ type = "", q = "" }: { type?: string; q?: string } = {}) {
  const database = getDatabase();
  const cardType = getSceneCardType(type);
  const search = q.trim();
  const whereParts: string[] = [];
  const params: string[] = [];

  if (cardType) {
    whereParts.push("type = ?");
    params.push(cardType);
  }

  if (search) {
    whereParts.push("(title LIKE ? OR description LIKE ? OR text LIKE ?)");
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  const where = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
  const rows = database
    .prepare(
      `
        SELECT
          id,
          type,
          title,
          description,
          text,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM scene_cards
        ${where}
        ORDER BY type ASC, datetime(updated_at) DESC, id DESC
      `,
    )
    .all(...params) as Array<Record<string, unknown>>;

  return rows.map(mapSceneCard);
}

function getSceneCardById(id: number) {
  const database = getDatabase();
  const row = database
    .prepare(
      `
        SELECT
          id,
          type,
          title,
          description,
          text,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM scene_cards
        WHERE id = ?
      `,
    )
    .get(id) as Record<string, unknown> | undefined;

  return row ? mapSceneCard(row) : null;
}

function createSceneCard(input: SceneCardInput) {
  const database = getDatabase();
  const now = new Date().toISOString();
  const type = getSceneCardType(input.type);
  const title = readString(input.title);
  const description = typeof input.description === "string" ? input.description : "";
  const text = typeof input.text === "string" ? input.text : "";

  const result = database
    .prepare(
      `
        INSERT INTO scene_cards (
          type,
          title,
          description,
          text,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(type, title, description, text, now, now);

  return getSceneCardById(Number(result.lastInsertRowid));
}

function updateSceneCard(id: number, input: SceneCardInput) {
  const database = getDatabase();
  const now = new Date().toISOString();
  const type = getSceneCardType(input.type);
  const title = readString(input.title);
  const description = typeof input.description === "string" ? input.description : "";
  const text = typeof input.text === "string" ? input.text : "";

  const result = database
    .prepare(
      `
        UPDATE scene_cards
        SET type = ?,
          title = ?,
          description = ?,
          text = ?,
          updated_at = ?
        WHERE id = ?
      `,
    )
    .run(type, title, description, text, now, id);

  return result.changes > 0 ? getSceneCardById(id) : null;
}

function deleteSceneCard(id: number) {
  const database = getDatabase();
  const result = database.prepare("DELETE FROM scene_cards WHERE id = ?").run(id);
  return result.changes > 0;
}

function isUniqueSceneCardTitleConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("SQLITE_CONSTRAINT")
  );
}

module.exports = {
  createSceneCard,
  deleteSceneCard,
  getSceneCardById,
  getSceneCardType,
  initializeSceneCardTables,
  isUniqueSceneCardTitleConstraintError,
  readSceneCards,
  updateSceneCard,
};
