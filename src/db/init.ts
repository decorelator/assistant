const { getDatabase, resolveDatabasePath } = require("./sqlite");

function initializeDatabase() {
  getDatabase();
  return { path: resolveDatabasePath() };
}

module.exports = { initializeDatabase };
