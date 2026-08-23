import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("ts-node/register/transpile-only");

const testDatabasePath = join(process.cwd(), "tests", "tmp", "character-cards.sqlite");
process.env.SQLITE_PATH = testDatabasePath;

const { initializeCharacterCardTables } = require("../src/db/character-cards");
const { closeDatabase, getDatabase } = require("../src/db/sqlite");
const {
  createCharacterCard,
  deleteCharacterCard,
  readCharacterCards,
  readCharacterTags,
} = require("../src/db/character-cards");

afterEach(() => {
  closeDatabase();

  if (existsSync(testDatabasePath)) {
    rmSync(testDatabasePath, { force: true });
  }
});

test("character cards store reusable tags and can be filtered by tag", () => {
  mkdirSync(dirname(testDatabasePath), { recursive: true });
  initializeCharacterCardTables();

  const card = createCharacterCard({
    title: "Anna strict investigator",
    characterName: "Anna",
    gender: "female",
    age: 34,
    cardText: "Strict and perceptive investigator.",
    tags: [
      { kind: "trait", name: "строгая" },
    ],
  });

  assert.equal(card.title, "Anna strict investigator");
  assert.equal(card.characterName, "Anna");
  assert.equal(card.gender, "female");
  assert.equal(card.age, 34);
  assert.deepEqual(
    card.tags.map((tag) => `${tag.kind}:${tag.name}`),
    ["trait:строгая"],
  );

  const strictTag = readCharacterTags().find((tag) => tag.name === "строгая");
  assert.ok(strictTag);

  const filteredCards = readCharacterCards({ tagIds: [strictTag.id] });
  assert.deepEqual(filteredCards.map((entry) => entry.id), [card.id]);

  assert.equal(deleteCharacterCard(card.id), true);
  assert.equal(readCharacterCards({ tagIds: [strictTag.id] }).length, 0);

  const relationCount = getDatabase()
    .prepare("SELECT COUNT(*) AS count FROM character_card_tags")
    .get().count;
  assert.equal(relationCount, 0);
});

test("character card titles are unique separately from character names", () => {
  mkdirSync(dirname(testDatabasePath), { recursive: true });
  initializeCharacterCardTables();

  createCharacterCard({
    title: "Default Anna",
    characterName: "Anna",
    cardText: "First version.",
  });

  createCharacterCard({
    title: "Detective Anna",
    characterName: "Anna",
    cardText: "Second version.",
  });

  assert.throws(() => {
    createCharacterCard({
      title: "Default Anna",
      characterName: "Another Anna",
      cardText: "Duplicate title.",
    });
  }, /UNIQUE|constraint/i);

  assert.deepEqual(
    readCharacterCards().map((card) => `${card.title}:${card.characterName}`).sort(),
    ["Default Anna:Anna", "Detective Anna:Anna"],
  );
});
