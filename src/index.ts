const { startServer } = require("./app/server");
const { initializeDatabase } = require("./db/init");
const { closeDatabase } = require("./db/sqlite");

initializeDatabase();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    closeDatabase();
    process.exit(0);
  });
}

startServer();
