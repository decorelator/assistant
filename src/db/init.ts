const { initializeCharacterCardTables } = require("./character-cards");
const { initializeInstructionPresetTable } = require("./instruction-presets");
const { getDatabase, resolveDatabasePath } = require("./sqlite");

function initializeDatabase() {
  getDatabase();
  initializeInstructionPresetTable();
  initializeCharacterCardTables();
  return { path: resolveDatabasePath() };
}

module.exports = { initializeDatabase };
