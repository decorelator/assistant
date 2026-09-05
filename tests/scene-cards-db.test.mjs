import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("ts-node/register/transpile-only");

const testDatabasePath = join(process.cwd(), "tests", "tmp", "scene-cards.sqlite");
process.env.SQLITE_PATH = testDatabasePath;

const { initializeSceneCardTables } = require("../src/db/scene-cards");
const { closeDatabase } = require("../src/db/sqlite");
const {
  createSceneCard,
  deleteSceneCard,
  readSceneCards,
  updateSceneCard,
} = require("../src/db/scene-cards");

afterEach(() => {
  closeDatabase();

  if (existsSync(testDatabasePath)) {
    rmSync(testDatabasePath, { force: true });
  }
});

test("scene cards store instruction and context cards separately", () => {
  mkdirSync(dirname(testDatabasePath), { recursive: true });
  initializeSceneCardTables();

  const instruction = createSceneCard({
    type: "instruction",
    title: "Slow burn",
    description: "Dialogue style.",
    text: "Keep emotional escalation gradual.",
  });
  const context = createSceneCard({
    type: "context",
    title: "Slow burn",
    description: "Scene setup.",
    text: "They meet again after a long silence.",
  });

  assert.equal(instruction.title, "Slow burn");
  assert.equal(context.title, "Slow burn");
  assert.equal(readSceneCards({ type: "instruction" }).length, 1);
  assert.equal(readSceneCards({ type: "context" }).length, 1);
  assert.equal(readSceneCards({ q: "silence" })[0].id, context.id);
});

test("scene cards can be updated and deleted", () => {
  mkdirSync(dirname(testDatabasePath), { recursive: true });
  initializeSceneCardTables();

  const card = createSceneCard({
    type: "context",
    title: "Kitchen",
    text: "They are in a quiet kitchen.",
  });
  const updated = updateSceneCard(card.id, {
    type: "context",
    title: "Kitchen at midnight",
    text: "They are in a quiet kitchen at midnight.",
  });

  assert.equal(updated.title, "Kitchen at midnight");
  assert.equal(readSceneCards({ q: "midnight" }).length, 1);
  assert.equal(deleteSceneCard(card.id), true);
  assert.equal(readSceneCards().length, 0);
});
