/* eslint-disable max-len */
const CircularJSON = require('circular-json');
const Table = require('../poker_modules/table');
const Pot = require('../poker_modules/pot');
const Player = require('../poker_modules/player');
const MentalDeck = require('../poker_modules/mental-deck');
const {
  redisGameCl,
  redisMainCl,
} = require('../redis');

/**
 * HACK: O(n^2). Do the transformation to Buffer
 * @param {Map} keys
 */
const convertKeymapToBuffer = (keys) => {
  const res = new Map();
  keys.forEach((k, pl) => res.set(pl, k.map(x => (x ? Buffer.from(x) : null))));
  return res;
};

/**
 * Converts a JSON string to Table object
 * @param {string} str - The table data string
 * @return {Table} - The constructed table
 */
const JSONToTable = (str) => {
  // Prepare the object
  const raw = CircularJSON.parse(str);
  const table = new Table();
  const pot = new Pot();
  const deck = new MentalDeck();
  const nextDeck = new MentalDeck();
  const keys = convertKeymapToBuffer(new Map(raw.mentalDeck.transportKeys));
  const keysNotSharedPublicly = convertKeymapToBuffer(new Map(raw.mentalDeck.transportKeysNotSharedPublicly));

  // Make the assignements
  Object.assign(table, raw);
  Object.assign(pot, raw.pot);
  Object.assign(deck, raw.mentalDeck);
  Object.assign(nextDeck, raw.nextMentalDeck);

  // Reconstruct each seat
  raw.seats.forEach((seat, i) => {
    if (seat) {
      const pl = new Player();
      Object.assign(pl, seat);
      table.seats[i] = pl;
    } else {
      table.seats[i] = null;
    }
  });

  // HACK: : O(n^2)
  deck.history.forEach((d, i) => {
    deck.history[i] = d.map(x => Buffer.from(x));
  });

  nextDeck.history.forEach((d, i) => {
    nextDeck.history[i] = d.map(x => Buffer.from(x));
  });

  // Wire it together
  table.pot = pot;
  table.public.pot = pot.pots;
  table.mentalDeck = deck;
  table.mentalDeck.keys = keys;
  table.mentalDeck.keysNotSharedPublicly = keysNotSharedPublicly;
  table.nextMentalDeck = nextDeck;
  return table;
};

/**
 * It fullt constructs a table
 * @param {string} tableID - The table ID
 * @returns - Promise to the constructed table
 */
const constructTable = async (tableID) => {
  const updateMode = await redisMainCl.existsAsync('game:mode:update');
  const table = JSONToTable(await redisGameCl.hgetAsync(`table:${tableID}`, 'data'));
  table.updateMode = updateMode === 1;

  return table;
};

/**
 * Updates table data in redis.
 * Also, it will convert keys map to the transport key array before update.
 * This is needed as maps cannot be stringified into JSON.
 *
 * @param {Table} tD - The table data
 * @return {Promise} - A promise to the data setter in redis
 */
const pubTableUpdate = function publishTableUpdateToRedisAndChannels(tD) {
  const tableData = tD;
  // HACK: Maps cannot be converted to strings directly. Use transport array to transmit keys
  if (tableData.mentalDeck) {
    tableData.mentalDeck.transportKeys = Array.from(
      tableData.mentalDeck.keys,
    );

    tableData.mentalDeck.transportKeysNotSharedPublicly = Array.from(
      tableData.mentalDeck.keysNotSharedPublicly,
    );
  }
  const t = CircularJSON.stringify(tableData);
  return redisGameCl.hsetAsync(`table:${tableData.public.id}`, 'data', t);
};

const test = () => {
  console.log('haha');
};

module.exports = {
  constructTable,
  pubTableUpdate,
  test,
};
