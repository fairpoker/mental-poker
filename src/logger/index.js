const winston = require('winston');

// Using env vars we can choose not to log the timestamp. It's good for development
const myFormat = process.env.LOG_NO_TIME
  ? winston.format.printf(({ level, message }) => `${level}: ${message}`)
  : winston.format.printf(({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`);

const getLogLevel = () => {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }
  if (process.env.ENV) {
    // default behaviour
    return 'info';
  }
  // Behaviuor on tests
  return 'error';
};

// We use this logger for logging. We don't use console.log()!
const logger = winston.createLogger({
  level: getLogLevel(),
  format: winston.format.combine(
    winston.format.timestamp(),
    myFormat,
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
