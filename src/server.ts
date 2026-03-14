const { createServer } = require("node:http");
const { handleRequest } = require("./router");

function startServer() {
  createServer(handleRequest).listen(Number(process.env.PORT ?? 3000));
}

module.exports = { startServer };
