const { getDatabase } = require("./sqlite");

type CharacterTagInput = {
  id?: number;
  name?: string;
  kind?: string;
};

type CharacterCardInput = {
  title?: string;
  characterName?: string;
  name?: string;
  gender?: string;
  age?: number | null;
  cardText?: string;
  notes?: string;
  tags?: CharacterTagInput[];
};

type CharacterTag = {
  id: number;
  name: string;
  kind: string;
  createdAt: string;
};

type CharacterCard = {
  id: number;
  title: string;
  characterName: string;
  name: string;
  gender: string;
  age: number | null;
  cardText: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  tags: CharacterTag[];
};

function initializeCharacterCardTables() {
  const database = getDatabase();

  database.exec(`
    CREATE TABLE IF NOT EXISTS character_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL COLLATE NOCASE UNIQUE,
      character_name TEXT NOT NULL COLLATE NOCASE,
      name TEXT NOT NULL COLLATE NOCASE,
      gender TEXT NOT NULL DEFAULT '',
      age INTEGER,
      card_text TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS character_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE,
      kind TEXT NOT NULL DEFAULT 'custom' COLLATE NOCASE,
      created_at TEXT NOT NULL,
      UNIQUE (kind, name)
    );

    CREATE TABLE IF NOT EXISTS character_card_tags (
      card_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (card_id, tag_id),
      FOREIGN KEY (card_id) REFERENCES character_cards(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES character_tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_character_cards_name
      ON character_cards(name);

    CREATE INDEX IF NOT EXISTS idx_character_cards_updated_at
      ON character_cards(updated_at);

    CREATE INDEX IF NOT EXISTS idx_character_tags_kind_name
      ON character_tags(kind, name);

    CREATE INDEX IF NOT EXISTS idx_character_card_tags_tag_id
      ON character_card_tags(tag_id);
  `);

  migrateCharacterCardTitleColumns();
}

function getCharacterCardColumnNames() {
  const database = getDatabase();
  const rows = database.prepare("PRAGMA table_info(character_cards)").all() as Array<{
    name: string;
  }>;

  return new Set(rows.map((row) => row.name));
}

function migrateCharacterCardTitleColumns() {
  const database = getDatabase();
  const columns = getCharacterCardColumnNames();

  if (!columns.has("title")) {
    database.exec("ALTER TABLE character_cards ADD COLUMN title TEXT COLLATE NOCASE");
    database.exec(`
      UPDATE character_cards
      SET title = CASE
        WHEN (
          SELECT COUNT(*)
          FROM character_cards duplicate
          WHERE duplicate.name = character_cards.name
            AND duplicate.id <= character_cards.id
        ) = 1 THEN name
        ELSE name || ' #' || id
      END
      WHERE title IS NULL OR trim(title) = ''
    `);
  }

  if (!columns.has("character_name")) {
    database.exec("ALTER TABLE character_cards ADD COLUMN character_name TEXT COLLATE NOCASE");
    database.exec(`
      UPDATE character_cards
      SET character_name = name
      WHERE character_name IS NULL OR trim(character_name) = ''
    `);
  }

  if (!columns.has("gender")) {
    database.exec("ALTER TABLE character_cards ADD COLUMN gender TEXT NOT NULL DEFAULT ''");
    database.exec(`
      UPDATE character_cards
      SET gender = COALESCE((
        SELECT t.name
        FROM character_card_tags ct
        JOIN character_tags t ON t.id = ct.tag_id
        WHERE ct.card_id = character_cards.id
          AND t.kind = 'gender'
        ORDER BY t.name
        LIMIT 1
      ), '')
      WHERE gender = ''
    `);
  }

  if (!columns.has("age")) {
    database.exec("ALTER TABLE character_cards ADD COLUMN age INTEGER");
    database.exec(`
      UPDATE character_cards
      SET age = (
        SELECT CAST(t.name AS INTEGER)
        FROM character_card_tags ct
        JOIN character_tags t ON t.id = ct.tag_id
        WHERE ct.card_id = character_cards.id
          AND t.kind = 'age'
          AND t.name GLOB '[0-9]*'
        ORDER BY t.name
        LIMIT 1
      )
      WHERE age IS NULL
    `);
  }

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_character_cards_title
      ON character_cards(title);
  `);
}

function normalizeTagName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTagKind(value: unknown) {
  const kind = typeof value === "string" ? value.trim().toLowerCase() : "";
  return kind || "custom";
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getCharacterCardTitle(input: CharacterCardInput) {
  return readString(input.title) || readString(input.name);
}

function getCharacterName(input: CharacterCardInput) {
  return readString(input.characterName) || readString(input.name) || getCharacterCardTitle(input);
}

function getCharacterAge(input: CharacterCardInput) {
  const value = typeof input.age === "number" ? input.age : Number.NaN;
  return Number.isInteger(value) && value > 0 && value <= 999 ? value : null;
}

function mapCharacterCards(rows: Array<Record<string, unknown>>) {
  const cards = new Map<number, CharacterCard>();

  for (const row of rows) {
    const id = Number(row.id);
    let card = cards.get(id);

    if (!card) {
      card = {
        id,
        title: String(row.title ?? row.name ?? ""),
        characterName: String(row.characterName ?? row.name ?? ""),
        name: String(row.name ?? ""),
        gender: String(row.gender ?? ""),
        age: typeof row.age === "number" ? row.age : row.age ? Number(row.age) : null,
        cardText: String(row.cardText ?? ""),
        notes: String(row.notes ?? ""),
        createdAt: String(row.createdAt ?? ""),
        updatedAt: String(row.updatedAt ?? ""),
        tags: [],
      };
      cards.set(id, card);
    }

    if (row.tagId) {
      card.tags.push({
        id: Number(row.tagId),
        name: String(row.tagName ?? ""),
        kind: String(row.tagKind ?? "custom"),
        createdAt: String(row.tagCreatedAt ?? ""),
      });
    }
  }

  return Array.from(cards.values());
}

function readCharacterCards({ q = "", tagIds = [] }: { q?: string; tagIds?: number[] } = {}) {
  const database = getDatabase();
  const search = q.trim();
  const params: string[] = [];
  const where = search
    ? `
      WHERE c.title LIKE ?
        OR c.character_name LIKE ?
        OR c.name LIKE ?
        OR c.card_text LIKE ?
        OR c.notes LIKE ?
    `
    : "";

  if (search) {
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
  }

  const rows = database
    .prepare(
      `
        SELECT
          c.id,
          c.title,
          c.character_name AS characterName,
          c.name,
          c.gender,
          c.age,
          c.card_text AS cardText,
          c.notes,
          c.created_at AS createdAt,
          c.updated_at AS updatedAt,
          t.id AS tagId,
          t.name AS tagName,
          t.kind AS tagKind,
          t.created_at AS tagCreatedAt
        FROM character_cards c
        LEFT JOIN character_card_tags ct ON ct.card_id = c.id
        LEFT JOIN character_tags t ON t.id = ct.tag_id
        ${where}
        ORDER BY datetime(c.updated_at) DESC, c.id DESC, t.kind ASC, t.name ASC
      `,
    )
    .all(...params) as Array<Record<string, unknown>>;

  const cards = mapCharacterCards(rows);
  const filterTagIds = tagIds.filter((tagId) => Number.isInteger(tagId) && tagId > 0);

  if (filterTagIds.length === 0) {
    return cards;
  }

  return cards.filter((card) => {
    const cardTagIds = new Set(card.tags.map((tag) => tag.id));
    return filterTagIds.every((tagId) => cardTagIds.has(tagId));
  });
}

function readCharacterTags() {
  const database = getDatabase();
  const rows = database
    .prepare(
      `
        SELECT
          id,
          name,
          kind,
          created_at AS createdAt
        FROM character_tags
        ORDER BY kind ASC, name ASC
      `,
    )
    .all() as CharacterTag[];

  return rows;
}

function getCharacterCardById(id: number) {
  return readCharacterCards().find((card) => card.id === id) ?? null;
}

function ensureCharacterTag(tagInput: CharacterTagInput) {
  const database = getDatabase();
  const name = normalizeTagName(tagInput.name);
  const kind = normalizeTagKind(tagInput.kind);

  if (!name) {
    return null;
  }

  const createdAt = new Date().toISOString();
  database
    .prepare(
      `
        INSERT OR IGNORE INTO character_tags (name, kind, created_at)
        VALUES (?, ?, ?)
      `,
    )
    .run(name, kind, createdAt);

  return database
    .prepare(
      `
        SELECT
          id,
          name,
          kind,
          created_at AS createdAt
        FROM character_tags
        WHERE kind = ? AND name = ?
      `,
    )
    .get(kind, name) as CharacterTag | undefined;
}

function replaceCharacterCardTags(cardId: number, tags: CharacterTagInput[] = []) {
  const database = getDatabase();
  const createdAt = new Date().toISOString();

  database.prepare("DELETE FROM character_card_tags WHERE card_id = ?").run(cardId);

  for (const tagInput of tags) {
    const tag = tagInput.id
      ? ({ id: tagInput.id } as CharacterTag)
      : ensureCharacterTag(tagInput);

    if (!tag) {
      continue;
    }

    database
      .prepare(
        `
          INSERT OR IGNORE INTO character_card_tags (card_id, tag_id, created_at)
          VALUES (?, ?, ?)
        `,
      )
      .run(cardId, tag.id, createdAt);
  }
}

function createCharacterCard(input: CharacterCardInput) {
  const database = getDatabase();
  const now = new Date().toISOString();
  const title = getCharacterCardTitle(input);
  const characterName = getCharacterName(input);
  const gender = readString(input.gender);
  const age = getCharacterAge(input);
  const cardText = typeof input.cardText === "string" ? input.cardText : "";
  const notes = typeof input.notes === "string" ? input.notes : "";

  const createCard = database.transaction(() => {
    const result = database
      .prepare(
        `
          INSERT INTO character_cards (
            title,
            character_name,
            name,
            gender,
            age,
            card_text,
            notes,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(title, characterName, characterName, gender, age, cardText, notes, now, now);
    const cardId = Number(result.lastInsertRowid);
    replaceCharacterCardTags(cardId, input.tags);
    return getCharacterCardById(cardId);
  });

  return createCard();
}

function updateCharacterCard(id: number, input: CharacterCardInput) {
  const database = getDatabase();
  const now = new Date().toISOString();
  const title = getCharacterCardTitle(input);
  const characterName = getCharacterName(input);
  const gender = readString(input.gender);
  const age = getCharacterAge(input);
  const cardText = typeof input.cardText === "string" ? input.cardText : "";
  const notes = typeof input.notes === "string" ? input.notes : "";

  const updateCard = database.transaction(() => {
    const result = database
      .prepare(
        `
          UPDATE character_cards
          SET title = ?,
            character_name = ?,
            name = ?,
            gender = ?,
            age = ?,
            card_text = ?,
            notes = ?,
            updated_at = ?
          WHERE id = ?
        `,
      )
      .run(title, characterName, characterName, gender, age, cardText, notes, now, id);

    if (result.changes === 0) {
      return null;
    }

    replaceCharacterCardTags(id, input.tags);
    return getCharacterCardById(id);
  });

  return updateCard();
}

function deleteCharacterCard(id: number) {
  const database = getDatabase();
  const result = database.prepare("DELETE FROM character_cards WHERE id = ?").run(id);
  return result.changes > 0;
}

function isUniqueCharacterCardTitleConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("SQLITE_CONSTRAINT")
  );
}

module.exports = {
  createCharacterCard,
  deleteCharacterCard,
  getCharacterCardById,
  initializeCharacterCardTables,
  isUniqueCharacterCardTitleConstraintError,
  readCharacterCards,
  readCharacterTags,
  updateCharacterCard,
};
