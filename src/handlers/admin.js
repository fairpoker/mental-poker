const shortid = require('shortid');
const validator = require('express-validator/check');
const logger = require('../logger');
const Table = require('../poker_modules/table');
const {
  redisMainCl,
  redisGameCl,
  redlock,
  ttl,
} = require('../redis');
const {
  constructTable,
  pubTableUpdate,
} = require('../utils/tableActions');
const { GAME_MODE_PLO, GAME_MODE_NLHE } = require('../utils/consts');

const deleteTableHandler = async (req, res) => {
  const errors = validator.validationResult(req);
  if (!errors.isEmpty()) {
    logger.debug(`error deleting table: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({ error: 'please fill all fields' });
  }

  const updateModeOn = await redisMainCl.existsAsync('game:mode:update');
  if (!updateModeOn) {
    return res.status(400).json({ error: 'update mode is off' });
  }

  const { tableID } = req.body;
  logger.debug(`request to delete table ${tableID}`);

  const doesExist = await redisGameCl.sismemberAsync('tableids', tableID);
  if (doesExist !== 1) {
    logger.debug(`delete table request table ${tableID} does not exist`);
    return res.status(400).json({ success: false, error: 'table does not exist' });
  }

  redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
    const table = await constructTable(tableID);

    // If the game is on players will be kicked in the end of the round
    logger.warn(`force kick players on table  ${tableID}. forgo pot`);
    table.kickAllPlayers();

    await redisGameCl.srem('tableids', tableID);
    await redisGameCl.del(`table:${tableID}`);
    return lock.unlock().catch(err => logger.error(err));
  });

  return res.status(200).json({ success: true });
};

const deleteAllTablesHandler = async (_req, res) => {
  const updateModeOn = await redisMainCl.existsAsync('game:mode:update');
  if (!updateModeOn) {
    return res.status(400).json({ error: 'update mode is off' });
  }

  logger.debug('deleting all tables');

  const ids = await redisGameCl.smembersAsync('tableids');
  logger.debug(ids);
  ids.forEach((tableID) => {
    redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
      const table = await constructTable(tableID);

      // If the game is on players will be kicked in the end of the round
      logger.warn(`force kick players on table  ${tableID}. forgo pot`);
      table.kickAllPlayers();

      await redisGameCl.srem('tableids', tableID);
      await redisGameCl.del(`table:${tableID}`);
      return lock.unlock().catch(err => logger.error(err));
    });
  });

  return res.status(200).json({ success: true });
};

const clearTablesHandler = async (_req, res) => {
  const updateModeOn = await redisMainCl.existsAsync('game:mode:update');
  if (!updateModeOn) {
    return res.status(400).json({ error: 'update mode is off' });
  }

  const ids = await redisGameCl.smembersAsync('tableids');
  logger.debug(ids);
  ids.forEach((tableID) => {
    redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
      const table = await constructTable(tableID);

      // If the game is on players will be kicked in the end of the round
      if (!table.gameIsOn && table.public.playersSeatedCount > 0) {
        logger.debug(`kick players on table ${tableID}`);
        table.kickAllPlayers();
        await pubTableUpdate(table);
      }
      return lock.unlock().catch(err => logger.error(err));
    });
  });

  return res.status(200).json({ message: 'ok' });
};

const newTableValidator = [
  validator.check('seats').isNumeric(),
  validator.check('sb').isNumeric(),
  validator.check('bb').isNumeric(),
  validator.check('maxBuyIn').isNumeric(),
  validator.check('minBuyIn').isNumeric(),
  validator.check('tableName').isString(),
  validator.check('gameMode').isString(),
  validator.check('timeout').isNumeric(),
  validator.check('password').isString(),
];

const newTableHandler = (req, res) => {
  const errors = validator.validationResult(req);
  if (!errors.isEmpty()) {
    logger.debug(`error adding table: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({ error: errors.array() });
  }

  const {
    seats,
    sb,
    bb,
    minBuyIn,
    maxBuyIn,
    timeout,
    tableName,
    gameMode,
    password,
  } = req.body;

  if ((seats === 2 // Seats are the correct number
      || seats === 6
      || seats === 9)
      && sb >= 10 // SB bigger than 10 sats
      && sb <= bb // SB can == BB
      && minBuyIn >= 20 * bb // At least this much BBs
      && maxBuyIn >= minBuyIn
      && timeout > 10000) {
    const id = shortid.generate();
    // Promotional tables could be no rake, specified in table name
    const isNoRake = tableName.toLowerCase().includes('no rake');
    let valdatedGameMode = gameMode;
    if (gameMode.toUpperCase() !== GAME_MODE_PLO && gameMode.toUpperCase() !== GAME_MODE_NLHE) {
      valdatedGameMode = GAME_MODE_NLHE;
    }

    // Create a native table object from the definitions in the request
    const table = new Table(
      id,
      tableName,
      seats,
      bb,
      sb,
      maxBuyIn,
      minBuyIn,
      timeout,
      false,
      false,
      isNoRake,
      valdatedGameMode,
      password,
    );

    // Make the table available in redis
    logger.debug(`creading table ${tableName}, BB: ${bb}, is no rake: ${isNoRake}`);
    redisGameCl.sadd('tableids', id);
    redisGameCl.hset(`table:${id}`, 'data', JSON.stringify(table));

    return res.status(200).json({ id });
  }

  return res.status(400).json({ error: 'bad table config' });
};

module.exports = {
  clearTablesHandler,
  newTableHandler,
  deleteAllTablesHandler,
  deleteTableHandler,
  newTableValidator,
};
