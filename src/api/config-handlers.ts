const { getClientConfig } = require("../config/env");
const { sendJson } = require("../lib/http");

function handleConfigRequest(response: import("node:http").ServerResponse) {
  sendJson(response, 200, getClientConfig());
}

module.exports = {
  handleConfigRequest,
};
