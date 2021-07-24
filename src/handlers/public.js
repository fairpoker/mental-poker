const os = require('os');
const CircularJSON = require('circular-json');
const logger = require('../logger');
const {
  redisGameCl,
} = require('../redis');
const {
  mainURL,
} = require('../utils/consts');

const getLobbyDataHandler = async (req, res) => {
  const lobbyTables = [];
  const tableIDs = await redisGameCl.smembersAsync('tableids');

  /* Map to promises and await Promise.all() as per:
   * https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop */
  await Promise.all(tableIDs.map(async (id) => {
    const table = JSON.parse(await redisGameCl.hgetAsync(`table:${id}`, 'data'));
    if (!table.showInLobby) {
      lobbyTables.push({
        id: table.public.id,
        name: table.public.name,
        gameMode: table.public.gameMode,
        seatsCount: table.public.seatsCount,
        playersSeatedCount: table.public.playersSeatedCount,
        bigBlind: table.public.bigBlind,
        smallBlind: table.public.smallBlind,
        minBuyIn: table.public.minBuyIn,
        maxBuyIn: table.public.maxBuyIn,
        timeout: table.public.timeout,
        isPasswordProtected: table.public.isPasswordProtected,
      });
    }
  }));

  const whiteLabel = process.env.WHITE_LABEL === undefined ? '' : process.env.WHITE_LABEL.toLowerCase();

  res.send({
    whiteLabel,
    tables: lobbyTables,
    accURL: `${mainURL}/me/account`,
    hostname: os.hostname(),
  });
};

const getTableDataHandler = (req, res) => {
  if (typeof req.params.tableID !== 'undefined') {
    // Get the table data from redis and send it to the client
    redisGameCl.hget(`table:${req.params.tableID}`, 'data', (err, data) => {
      logger.debug(`getting table data for table ${req.params.tableID}`);
      if (data) {
        const d = CircularJSON.parse(data);
        logger.debug(`sending table data for table ${req.params.tableID}`);
        logger.debug(`hostname: ${os.hostname()}`);
        res.send({ table: d.public, hostname: os.hostname() });
      }
    });
  }
};

module.exports = {
  getLobbyDataHandler,
  getTableDataHandler,
};
