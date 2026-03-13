const { readFileSync } = require("node:fs");
const { createServer } = require("node:http");
const { join } = require("node:path");

const html = readFileSync(join(process.cwd(), "public", "index.html"), "utf8");

function startServer() {
  createServer((_: unknown, response: import("node:http").ServerResponse) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
  }).listen(Number(process.env.PORT ?? 3000));
}

module.exports = { startServer };
