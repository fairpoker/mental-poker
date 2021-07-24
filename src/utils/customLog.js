const fs = require('fs');
const logger = require('../logger');

/**
 * Write the log to a file, creating the file if it does not exists
 * @param {string} log
 * @param {string} filePath
 */
const writeToLogFile = (log, filePath) => {
  fs.appendFile(filePath, `${log}\n`, (err) => {
    if (err) logger.error(`error writing to log file ${err}`);
  });
};

module.exports = {
  writeToLogFile,
};
