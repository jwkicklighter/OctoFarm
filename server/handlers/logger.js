const winston = require("winston");

const dtFormat = new Intl.DateTimeFormat("en-GB", {
  timeStyle: "medium",
  dateStyle: "short",
  timeZone: "UTC"
});

const COLOURS = {
  RED: "\033[0;31m",
  YELLOW: "\033[1;33m",
  ORANGE: "\033[0;33m",
  BLUE: "\033[0;34m",
  PURPLE: "\033[0;35m",
  WHITE: "\033[1;37m",
  CYAN: "\033[0;32m"
};

const COLOUR_MAP = {
  info: COLOURS.BLUE,
  warn: COLOURS.ORANGE,
  debug: COLOURS.ORANGE,
  error: COLOURS.RED,
  silly: COLOURS.CYAN
};

dateFormat = () => {
  return dtFormat.format(new Date());
};
//TODO Log level filter should be set by environment variable
class LoggerService {
  constructor(route, enableFileLogs = true, logFilterLevel = undefined) {
    if (!logFilterLevel) {
      logFilterLevel = process.env.LOG_LEVEL;
    }

    this.log_data = null;
    this.route = route;

    let alignColorsAndTime = winston.format.combine(
      winston.format.printf((info) => {
        const level = info.level.toUpperCase();
        const date = dateFormat();
        let metaData = undefined;
        if (!!info?.meta) {
          if (typeof info.meta === "string" || typeof info.meta === "number") {
            metaData = info.meta;
          } else {
            metaData = Object.assign({}, info.meta);
            metaData = JSON.stringify(metaData);
          }
        }
        let message = `${COLOUR_MAP[info.level]}${date} ${COLOURS.WHITE}| ${
          COLOUR_MAP[info.level]
        }${level} ${COLOURS.WHITE}| ${COLOUR_MAP[info.level]}${route} ${COLOURS.WHITE} \n ${
          COLOUR_MAP[info.level]
        }MESSAGE: ${COLOURS.WHITE}${info.message} `;
        message = metaData
          ? message + `\n ${COLOUR_MAP[info.level]}DATA: ${COLOURS.WHITE}${metaData}`
          : message;
        return message;
      })
    );

    this.logger = winston.createLogger({
      transports: [
        new winston.transports.Console({
          level: logFilterLevel
        }),
        ...(enableFileLogs
          ? [
              new winston.transports.File({
                level: logFilterLevel,
                filename: `../logs/${route}.log`,
                maxsize: "5000000",
                maxFiles: 1
              })
            ]
          : [])
      ],
      format: alignColorsAndTime
    });
  }

  info(message, meta) {
    this.logger.log("info", message, {
      meta
    });
  }

  warning(message, meta) {
    this.logger.log("warn", message, {
      meta
    });
  }

  debug(message, meta) {
    this.logger.log("debug", message, {
      meta
    });
  }

  error(message, meta) {
    this.logger.log("error", message, { meta });
  }

  silly(message, meta) {
    this.logger.log("silly", message, { meta });
  }
}

module.exports = LoggerService;
