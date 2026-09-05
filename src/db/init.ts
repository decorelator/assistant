const { initializeCharacterCardTables } = require("./character-cards");
const { initializeInstructionPresetTable } = require("./instruction-presets");
const { initializeSceneCardTables } = require("./scene-cards");
const { getDatabase, resolveDatabasePath } = require("./sqlite");

function initializeDatabase() {
  getDatabase();
  initializeInstructionPresetTable();
  initializeCharacterCardTables();
  initializeSceneCardTables();
  return { path: resolveDatabasePath() };
}

module.exports = { initializeDatabase };
