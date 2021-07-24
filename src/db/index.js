const { Pool } = require('pg');
const logger = require('../logger');

let query = (text, params) => logger.debug(`Mock DB: querying db with ${text}, ${params}`);

if (process.env.PGHOST) {
  const pool = new Pool();

  // the pool with emit an error on behalf of any idle clients
  // it contains if a backend error or network partition happens
  pool.on('error', (err) => {
    logger.error(`Unexpected error on idle client ${err}`);
    process.exit(-1);
  });

  // callback - checkout a client
  pool.connect((err) => {
    if (err) throw err;
  });

  query = (text, params, callback) => pool.query(text, params, callback);
}

module.exports = {
  query,
};
