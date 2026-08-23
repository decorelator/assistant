const { getDatabase } = require("./sqlite");

function initializeCharacterCardTables() {
  const database = getDatabase();

  database.exec(`
    CREATE TABLE IF NOT EXISTS character_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE,
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
}

module.exports = { initializeCharacterCardTables };
