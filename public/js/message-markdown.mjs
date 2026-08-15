function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isWhitespace(char) {
  return /\s/.test(char);
}

function isWordChar(char) {
  return /[\p{L}\p{N}]/u.test(char);
}

function canOpenDelimiter(text, index, markerLength) {
  const previous = index > 0 ? text[index - 1] : "";
  const next = text[index + markerLength] ?? "";

  return !next || (!isWhitespace(next) && !isWordChar(previous));
}

function canCloseDelimiter(text, index) {
  const previous = index > 0 ? text[index - 1] : "";
  const next = text[index] ?? "";

  return !previous || (!isWhitespace(previous) && !isWordChar(next));
}

function findClosingMarker(text, marker, startIndex) {
  let searchIndex = startIndex;

  while (searchIndex < text.length) {
    const markerIndex = text.indexOf(marker, searchIndex);

    if (markerIndex === -1) {
      return -1;
    }

    const beforeMarker = markerIndex > 0 ? text[markerIndex - 1] : "";
    const afterMarker = text[markerIndex + marker.length] ?? "";

    if (
      beforeMarker &&
      !isWhitespace(beforeMarker) &&
      (!afterMarker || !isWordChar(afterMarker))
    ) {
      return markerIndex;
    }

    searchIndex = markerIndex + marker.length;
  }

  return -1;
}

function renderInline(text) {
  let html = "";
  let index = 0;

  while (index < text.length) {
    const boldMarker = text.startsWith("**", index) || text.startsWith("__", index)
      ? text.slice(index, index + 2)
      : null;

    if (boldMarker && canOpenDelimiter(text, index, 2)) {
      const closingIndex = findClosingMarker(text, boldMarker, index + 2);

      if (closingIndex !== -1) {
        const inner = text.slice(index + 2, closingIndex);
        html += `<strong>${renderInline(inner)}</strong>`;
        index = closingIndex + 2;
        continue;
      }
    }

    const italicMarker =
      (text[index] === "*" || text[index] === "_") &&
      !text.startsWith(text[index] + text[index], index)
        ? text[index]
        : null;

    if (italicMarker && canOpenDelimiter(text, index, 1)) {
      const closingIndex = findClosingMarker(text, italicMarker, index + 1);

      if (closingIndex !== -1 && canCloseDelimiter(text, closingIndex)) {
        const inner = text.slice(index + 1, closingIndex);
        html += `<em>${renderInline(inner)}</em>`;
        index = closingIndex + 1;
        continue;
      }
    }

    if (text[index] === "\n") {
      html += "<br />";
      index += 1;
      continue;
    }

    html += escapeHtml(text[index]);
    index += 1;
  }

  return html;
}

function isHorizontalRule(line) {
  return /^\s{0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})\s*$/.test(line);
}

function getListMatch(line) {
  return line.match(/^\s{0,3}(([-+*])|(\d+[.)]))\s+(.*)$/);
}

function getListType(line) {
  return /^\s{0,3}\d+[.)]\s+/.test(line) ? "ol" : "ul";
}

function isIncompleteListMarker(line) {
  return /^\s{0,3}(?:[-+*]|\d+[.)]?)\s*$/.test(line);
}

function flushParagraph(paragraphLines, blocks) {
  if (paragraphLines.length === 0) {
    return;
  }

  blocks.push(`<p>${renderInline(paragraphLines.join("\n"))}</p>`);
  paragraphLines.length = 0;
}

function flushList(listType, listItems, blocks) {
  if (!listType || listItems.length === 0) {
    return;
  }

  const itemsHtml = listItems.map((item) => `<li>${renderInline(item)}</li>`).join("");
  blocks.push(`<${listType}>${itemsHtml}</${listType}>`);
  listItems.length = 0;
}

export function renderMessageMarkdown(text) {
  const source = typeof text === "string" ? text.replaceAll("\r\n", "\n") : "";
  const lines = source.split("\n");
  const blocks = [];
  const paragraphLines = [];
  const listItems = [];
  let activeListType = "";
  let pendingBlankLine = false;

  const closeList = () => {
    flushList(activeListType, listItems, blocks);
    activeListType = "";
    pendingBlankLine = false;
  };

  const appendListContinuation = (line) => {
    let currentItem = listItems[listItems.length - 1];

    if (currentItem === undefined) {
      return false;
    }

    currentItem += `\n${line.trim()}`;
    listItems[listItems.length - 1] = currentItem;
    pendingBlankLine = false;
    return true;
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushParagraph(paragraphLines, blocks);
      pendingBlankLine = Boolean(activeListType);
      continue;
    }

    const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);

    if (headingMatch) {
      flushParagraph(paragraphLines, blocks);
      closeList();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (isHorizontalRule(line)) {
      flushParagraph(paragraphLines, blocks);
      closeList();
      blocks.push("<hr />");
      continue;
    }

    const listMatch = getListMatch(line);

    if (listMatch) {
      flushParagraph(paragraphLines, blocks);
      const nextListType = getListType(line);

      if (activeListType && activeListType !== nextListType) {
        closeList();
      }

      activeListType = nextListType;
      listItems.push(listMatch[4]);
      pendingBlankLine = false;
      continue;
    }

    if (
      activeListType &&
      !isIncompleteListMarker(line) &&
      (!pendingBlankLine || /^\s{2,}/.test(line))
    ) {
      if (appendListContinuation(line)) {
        continue;
      }
    }

    closeList();
    paragraphLines.push(line);
  }

  flushParagraph(paragraphLines, blocks);
  flushList(activeListType, listItems, blocks);

  if (blocks.length === 0) {
    return `<p>${renderInline(source)}</p>`;
  }

  return blocks.join("");
}
