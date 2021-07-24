const redis = require('redis');
const Promise = require('bluebird');
const Redlock = require('redlock');
const logger = require('../logger');

/* Promisify the redis package with bluebird.
 * We use promises whenever we have to chain multiple requests to redis */
Promise.promisifyAll(redis);

/**
 * The maximum amount of time we want the resource locked by the mutex in milliseconds,
 * keeping in mind that we can extend the lock up until
 * the point when it expires */
const ttl = 2000;

// Mock the clients
const mock = {
  publish: () => {},
  set: () => {},
};

let redisGameSub = mock;
let redisGameCl = mock;
let redisMainCl = mock;
let redlock = mock;


// The redis client reconnect strategy
// eslint-disable-next-line camelcase
const retry_strategy = (options) => {
  if (options.error && options.error.code === 'ECONNREFUSED') {
    // End reconnecting on a specific error and flush all commands with
    // a individual error
    throw new Error('The server refused the connection');
  }
  if (options.total_retry_time > 1000 * 60 * 60) {
    // End reconnecting after a specific timeout and flush all commands
    // with a individual error
    throw new Error('Retry time exhausted');
  }
  if (options.attempt > 10) {
    // End reconnecting with built in error
    throw new Error('Retry attempts exhausted');
  }
  // reconnect after
  return Math.min(options.attempt * 100, 3000);
};

if (process.env.PGHOST) {
  /* The client to the redis instance that is unique to the game service
   * One client is needed for listening on the pub/sub channels */
  redisGameSub = redis.createClient({
    host: 'redis-game',
    retry_strategy,
  });
  redisGameSub.on('error', (err) => {
    logger.error(`error with redis game subscriber client ${err}`);
  });

  // Another client is needed for reading/writing data to the channels and the DB
  redisGameCl = redis.createClient({
    host: 'redis-game',
    retry_strategy,
  });
  redisGameCl.on('error', (err) => {
    logger.error(`error with redis ${err}`);
  });

  // The client to the shared redis instance
  redisMainCl = redis.createClient({
    host: 'redis',
    retry_strategy,
  });
  redisMainCl.on('error', (err) => {
    logger.error(`error with redis main ${err}`);
  });

  /**
   * Redlock is a mutex for the game data in redis.
   * NOTE, Every time table data is modified in redis we must use this mutex!
   * This gurantees that at most one node is modifying table data at any time.
   * This is how we avoid race conditions and concurrency issues in the distributed game system.
   */
  redlock = new Redlock([redisGameCl], {
    /* the max number of times Redlock will attempt
    * to lock a resource before erroring */
    retryCount: 10,
    // the time in ms between attempts
    retryDelay: 200, // time in ms
  });
}

module.exports = {
  redisGameCl,
  redisGameSub,
  redisMainCl,
  redlock,
  ttl,
};
