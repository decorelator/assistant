const { existsSync, mkdirSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const Database = require("better-sqlite3");
const { getSqlitePath } = require("../config/env");

let database: import("better-sqlite3").Database | null = null;

function resolveDatabasePath() {
  return resolve(process.cwd(), getSqlitePath());
}

function ensureDatabaseDirectory(filePath: string) {
  const directoryPath = dirname(filePath);

  if (!existsSync(directoryPath)) {
    mkdirSync(directoryPath, { recursive: true });
  }
}

function openDatabase() {
  if (database) {
    return database;
  }

  const filePath = resolveDatabasePath();
  ensureDatabaseDirectory(filePath);

  const openedDatabase = new Database(filePath);
  openedDatabase.pragma("journal_mode = WAL");
  openedDatabase.pragma("foreign_keys = ON");
  database = openedDatabase;

  return openedDatabase;
}

function getDatabase() {
  return database ?? openDatabase();
}

function closeDatabase() {
  if (!database) {
    return;
  }

  database.close();
  database = null;
}

module.exports = { closeDatabase, getDatabase, openDatabase, resolveDatabasePath };
