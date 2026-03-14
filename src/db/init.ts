const { initializeInstructionPresetTable } = require("./instruction-presets");
const { getDatabase, resolveDatabasePath } = require("./sqlite");

function initializeDatabase() {
  getDatabase();
  initializeInstructionPresetTable();
  return { path: resolveDatabasePath() };
}

module.exports = { initializeDatabase };
