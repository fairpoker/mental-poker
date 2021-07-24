const logger = require('../logger');
const {
  redlock,
  ttl,
} = require('../redis');
const {
  constructTable,
  pubTableUpdate,
} = require('../utils/tableActions');

// The timeouts we know of. It holds two timeouts per table
const timers = [];

/**
 * Sets two timeouts for the given table.
 * These are the main timeouts which are shown on the UI.
 *
 * @param {string} tableID - The table ID
 * @param {number} action - The curent action
 * @param {number} round - The currect round
 * @param {number} duration - The timeout duration
 */
const setActionTimers = (tableID, action, round, duration) => {
  if (timers[tableID]) {
    // If there's a timer for this table, cancel it
    clearTimeout(timers[tableID].keySubmit);
    clearTimeout(timers[tableID].leaveTable);
  }

  // Set new timeouts
  timers[tableID] = {
    action, // The action of this timer
    round, // The round of this timer

    // When key submit will be triggered
    keySubmit: setTimeout(() => {
      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        const table = await constructTable(tableID);
        logger.debug(`urgentKeySubmit on action ${action} (current action ${table.action}), round ${round} (current round ${table.round}), table ${tableID}`);
        table.keySubmitTimeout(action, round);

        await pubTableUpdate(table);
        return lock.unlock().catch(err => logger.error('error unlocking keySubmitTimeout', err));
      });
    }, duration + 3500), // Key submit after 3.5 secs in timeout

    // When leave table will be triggered
    leaveTable: setTimeout(() => {
      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        const table = await constructTable(tableID);
        logger.debug(`player timed out on action ${action} - current action ${table.action} -, round ${round}, table ${tableID}, kick him`);
        table.playerTimeout(action, round);

        await pubTableUpdate(table);
        return lock.unlock().catch(err => logger.error('error unlocking leaveTableTImeout', err));
      });
    }, duration + 10000), // Force leave table in 10 secs
  };
};

/**
 * It cancels the action timer on this table if it exsits
 * @param {string} tableID - The table ID
 * @param {number} action - The action the timer is on
 * @param {number} round - The round this timer in on
 */
const cancelActionTimers = (tableID, action, round) => {
  if (timers[tableID]
    && timers[tableID].action === action
    && timers[tableID].round === round) {
    // If we have a timer for this action and round, cancel it
    clearTimeout(timers[tableID].keySubmit);
    clearTimeout(timers[tableID].leaveTable);
    delete timers[tableID];
  }
};

module.exports = {
  setActionTimers,
  cancelActionTimers,
};
