import test from "node:test";
import assert from "node:assert/strict";

import { renderMessageMarkdown } from "../public/js/message-markdown.mjs";

test("renders headings, paragraphs, emphasis, lists, and separators", () => {
  const input = [
    "### Demo Title",
    "",
    "Hello, **world** and *team*.",
    "",
    "- one",
    "- two with **bold**",
    "",
    "---",
    "",
    "1. alpha",
    "2. beta",
  ].join("\n");

  assert.equal(
    renderMessageMarkdown(input),
    "<h3>Demo Title</h3><p>Hello, <strong>world</strong> and <em>team</em>.</p><ul><li>one</li><li>two with <strong>bold</strong></li></ul><hr /><ol><li>alpha</li><li>beta</li></ol>",
  );
});

test("preserves unicode, emoji, and unmatched markers as plain text", () => {
  const input = "Привет, мир 🌍\n\nЭто **не закрыто и *это тоже.";

  assert.equal(
    renderMessageMarkdown(input),
    "<p>Привет, мир 🌍</p><p>Это **не закрыто и *это тоже.</p>",
  );
});

test("keeps ordinary text safe while supporting nested emphasis", () => {
  const input = "Use 2 * 3 literally, but **make *this* loud**.";

  assert.equal(
    renderMessageMarkdown(input),
    "<p>Use 2 * 3 literally, but <strong>make <em>this</em> loud</strong>.</p>",
  );
});

test("keeps single newlines inside a paragraph as line breaks", () => {
  const input = "Line one\nLine two\nLine three";

  assert.equal(
    renderMessageMarkdown(input),
    "<p>Line one<br />Line two<br />Line three</p>",
  );
});

test("joins same-type list items across blank lines", () => {
  const input = [
    "1. Первый пункт",
    "",
    "1. Второй пункт",
    "",
    "1. Третий пункт",
  ].join("\n");

  assert.equal(
    renderMessageMarkdown(input),
    "<ol><li>Первый пункт</li><li>Второй пункт</li><li>Третий пункт</li></ol>",
  );
});

test("keeps bullet markers and multiline item text", () => {
  const input = [
    "- Первый пункт",
    "  продолжение первого пункта",
    "",
    "* Второй пункт",
  ].join("\n");

  assert.equal(
    renderMessageMarkdown(input),
    "<ul><li>Первый пункт<br />продолжение первого пункта</li><li>Второй пункт</li></ul>",
  );
});

test("ends a list before a real following paragraph", () => {
  const input = ["1. пункт", "", "Обычный абзац"].join("\n");

  assert.equal(
    renderMessageMarkdown(input),
    "<ol><li>пункт</li></ol><p>Обычный абзац</p>",
  );
});

test("keeps a partial list item stable while streaming", () => {
  assert.equal(
    renderMessageMarkdown("1. Первый пункт\n1."),
    "<ol><li>Первый пункт</li></ol><p>1.</p>",
  );

  assert.equal(
    renderMessageMarkdown("- Незавершённый пункт\n  продолжение"),
    "<ul><li>Незавершённый пункт<br />продолжение</li></ul>",
  );
});
