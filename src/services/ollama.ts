// Compatibility entry point. API handlers keep their existing import path while
// the implementation lives in focused Ollama modules.
module.exports = require("./ollama/index");
