const { existsSync, readFileSync, statSync } = require("node:fs");
const { extname, relative, resolve } = require("node:path");
const { sendText } = require("./http");

const publicRoot = resolve(process.cwd(), "public");

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

function getPublicFilePath(urlPath: string) {
  const relativePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = resolve(publicRoot, relativePath);
  const publicRelativePath = relative(publicRoot, filePath);

  if (publicRelativePath.startsWith("..")) {
    return null;
  }

  return filePath;
}

function servePublicAsset(
  response: import("node:http").ServerResponse,
  urlPath: string,
) {
  const filePath = getPublicFilePath(urlPath);

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return false;
  }

  const contentType = contentTypes[extname(filePath)] ?? "application/octet-stream";
  const file = readFileSync(filePath, "utf8");
  sendText(response, 200, file, contentType);
  return true;
}

module.exports = { servePublicAsset };
