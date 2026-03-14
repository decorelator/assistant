const { getDatabase } = require("./sqlite");

function initializeInstructionPresetTable() {
  const database = getDatabase();
  database.exec(`
    CREATE TABLE IF NOT EXISTS instruction_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL COLLATE NOCASE UNIQUE,
      instruction_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

function mapInstructionPreset(row: {
  id: number;
  title: string;
  instructionText: string;
  createdAt: string;
}) {
  return {
    id: row.id,
    title: row.title,
    instructionText: row.instructionText,
    createdAt: row.createdAt,
  };
}

function listInstructionPresets() {
  const database = getDatabase();
  const rows = database
    .prepare(
      `
        SELECT
          id,
          title,
          instruction_text AS instructionText,
          created_at AS createdAt
        FROM instruction_presets
        ORDER BY datetime(created_at) DESC, id DESC
      `,
    )
    .all();

  return rows.map(mapInstructionPreset);
}

function getInstructionPresetById(id: number) {
  const database = getDatabase();
  const row = database
    .prepare(
      `
        SELECT
          id,
          title,
          instruction_text AS instructionText,
          created_at AS createdAt
        FROM instruction_presets
        WHERE id = ?
      `,
    )
    .get(id);

  return row ? mapInstructionPreset(row) : null;
}

function createInstructionPreset(title: string, instructionText: string) {
  const database = getDatabase();
  const createdAt = new Date().toISOString();
  const result = database
    .prepare(
      `
        INSERT INTO instruction_presets (title, instruction_text, created_at)
        VALUES (?, ?, ?)
      `,
    )
    .run(title, instructionText, createdAt);

  return getInstructionPresetById(Number(result.lastInsertRowid));
}

function updateInstructionPreset(id: number, instructionText: string) {
  const database = getDatabase();
  const result = database
    .prepare(
      `
        UPDATE instruction_presets
        SET instruction_text = ?
        WHERE id = ?
      `,
    )
    .run(instructionText, id);

  if (result.changes === 0) {
    return null;
  }

  return getInstructionPresetById(id);
}

function touchInstructionPreset(id: number) {
  const database = getDatabase();
  const touchedAt = new Date().toISOString();
  const result = database
    .prepare(
      `
        UPDATE instruction_presets
        SET created_at = ?
        WHERE id = ?
      `,
    )
    .run(touchedAt, id);

  if (result.changes === 0) {
    return null;
  }

  return getInstructionPresetById(id);
}

function deleteInstructionPreset(id: number) {
  const database = getDatabase();
  const result = database
    .prepare(
      `
        DELETE FROM instruction_presets
        WHERE id = ?
      `,
    )
    .run(id);

  return result.changes > 0;
}

function isUniqueTitleConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("SQLITE_CONSTRAINT")
  );
}

module.exports = {
  createInstructionPreset,
  deleteInstructionPreset,
  getInstructionPresetById,
  initializeInstructionPresetTable,
  isUniqueTitleConstraintError,
  listInstructionPresets,
  touchInstructionPreset,
  updateInstructionPreset,
};
