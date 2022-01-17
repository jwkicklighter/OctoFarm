const morgan = require("morgan");

const Logger = require("../handlers/logger");

const logger = new Logger("OctoFarm-API");

const morganMiddleware = morgan(
  function (tokens, req, res) {
    return [
      tokens.method(req, res),
      tokens.url(req, res),
      tokens.status(req, res),
      tokens.res(req, res, "content-length"),
      "-",
      tokens["response-time"](req, res),
      "ms"
    ].join(" ");
  },
  {
    // specify a function for skipping requests without errors
    skip: (req, res) => res.statusCode < 400,
    stream: {
      write: (msg) => logger.http(msg)
    }
  }
);

module.exports = morganMiddleware;
