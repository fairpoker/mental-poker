const logger = require('../logger');
const db = require('../db');
const queries = require('../db/queries');
const Player = require('../poker_modules/player');
const {
  redisGameCl,
  redisGameSub,
  redisMainCl,
  redlock,
  ttl,
} = require('../redis');
const {
  constructTable,
  pubTableUpdate,
} = require('../utils/tableActions');
const {
  htmlEntities,
} = require('../utils/helpers');

// Game logic variables
const connected = []; // The connected players to this container
const subTables = []; // Here we keep the table IDs that this container is subscribed to.

/**
 * Must be called when a player connected to this container has joined a table.
 * It maps the table ID and seat in this container's memory to the player's socket ID
 * and updates in redis.
 *
 * @param {string} socketID - The socket connection ID
 * @param {string} tableID - The table ID this player has joined
 * @param {number} seat - This player's seat
 */
const connJoinedTable = function playerWithSocketHasJoinedTableFromThisContainer(
  socketID,
  tableID,
  seat,
) {
  connected[socketID].sittingOnTable = tableID;
  connected[socketID].seat = seat;
  redisGameCl.sadd('ingame', connected[socketID].userID);
};

/**
 * Must be called when the websocket connection has left a table.
 * It removes the table ID and seat from this conainer's memory and updates in redis
 *
 * @param {string} socketID - The socket connection ID
 */
const connLeftTable = function playerWithSocketToThisContainerHasLeftTable(socketID) {
  if (connected[socketID]) {
    connected[socketID].sittingOnTable = false;
    connected[socketID].seat = null;
    redisGameCl.srem('ingame', connected[socketID].userID);
  }
};

// eslint-disable-next-line max-len
const isUserConnected = socketID => socketID in connected && connected[socketID].sittingOnTable !== false;

/**
 * It wil execute an action on the table
 * like ending the phase or ending the round
 * @param {string} tableID - The ID of the table
 * @param {number} action - The current table action
 * @param {number} round - The current table round
 * @param {string} do - The function to execute
 */
const executeTableFunction = (tableID, action, round, func) => {
  redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
    const table = await constructTable(tableID);

    if (table.action === action && table.round === round) {
      if (func === 'endPhase') {
        logger.debug('ending phase from channel');
        table.endPhase();
      } else if (func === 'endRound') {
        logger.debug('ending round from channel');
        table.endRound();
      }

      await pubTableUpdate(table);
    }

    return lock.unlock().catch(err => logger.error('error unlocking endPhase', err));
  });
};

const webSocketAPIHandler = (socket) => {
  /**
   * It authenticates the WebSocket connection using a session token.
   *
   * @param {string} session - The session token
   * @param {function} callback - Success callback
   */
  socket.on('auth', async (session, callback = () => {}) => {
    logger.debug(`auth called with sess: ${session}`);
    if (typeof session !== 'undefined') {
      const userID = await redisMainCl.getAsync(`session:game:${session}`);
      if (userID && !connected[socket.id]) {
        const res = await db.query(queries.SELECT_BALANCE_USERNAME, [userID]);
        const { username, balance } = res.rows[0];

        // The user might reconnect before attempting auth, so write only if this is empty
        if (!connected[socket.id]) {
          // The WebSocket connection is authenticated and the session is new
          connected[socket.id] = {
            socket,
            userID,
            username,
            session,
            room: null,
            seat: null,
            sittingOnTable: false,
          };
        }

        logger.debug(`user ${username} is authenticated with balance ${balance}`);

        callback({
          success: true,
          screenName: username,
          totalChips: balance,
        });
      } else {
        callback({ success: false });
      }
    } else {
      callback({ success: false });
    }
  });

  /**
   * It allows for a disconnected player to reconnect to the game with a new socket
   *
   * @param {string} session - The secret session token
   */
  socket.on('reconnectTable', async (session, tableID, seatRaw, callback = () => {}) => {
    const seat = parseInt(seatRaw, 10);
    logger.debug(`session ${session} is attempting to reconnect to tableID ${tableID} on seat: ${seat}`);

    const countIDs = await redisGameCl.sismemberAsync('tableids', tableID);
    if (!session || countIDs !== 1) {
      logger.info('table does not exist, return');
      callback({ success: false });
      return;
    }

    if (isNaN(seat)) {
      logger.debug(`nan seat ${seatRaw}`);
      callback({ success: false });
      return;
    }

    redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
      const table = await constructTable(tableID);

      if (table.seats[seat] && table.seats[seat].session === session) {
        const { userID } = table.seats[seat];
        const { name: username } = table.seats[seat].public;

        logger.debug(`player ${username} reconnecting.`);

        // The WebSocket connection is authenticated
        connected[socket.id] = {
          socket,
          userID,
          username,
          session,
          seat,
          room: tableID,
          sittingOnTable: tableID,
        };

        // Add the player to the socket room
        socket.join(`table-${tableID}`);

        // It might be the case that the server restarted.
        // In this situation we need to re-subscribe to the redis channels
        if (!subTables.includes(tableID)) {
          subTables.push(tableID);

          redisGameSub.subscribe(`table-socket:${tableID}`);
          redisGameSub.subscribe(`table-events:${tableID}`);
          redisGameSub.subscribe(`kick-player:${tableID}`);
          redisGameSub.subscribe(`cancel-timers:${tableID}`);
          redisGameSub.subscribe(`set-timers:${tableID}`);
          redisGameSub.subscribe(`table-actions:${tableID}`);
        }

        callback({ success: true });

        // Remove the player from the seat
        table.playerReconnected(seat, socket.id);
        await pubTableUpdate(table);
      } else {
        callback({ success: false });
      }

      return lock.unlock().catch(err => logger.error('error unlocking ', err));
    });
  });

  /**
   * It will get the user available balance & min buy in for the provided
   */
  socket.on('getBuyInInfo', async (tableID, callback = () => {}) => {
    if (socket.id in connected) {
      const { userID } = connected[socket.id];
      const res = await db.query(queries.SELECT_BALANCE, [userID]);
      const { balance } = res.rows[0];

      const minStack = await redisGameCl.getAsync(`minstack:${tableID}:${userID}`);

      callback({
        success: true,
        balance,
        minStack,
      });
    } else {
      callback({
        success: false,
      });
    }
  });

  /**
   * When a player enters a room
   *
   * @param {Object} tableID - The table ID
   */
  socket.on('enterRoom', async (tableID) => {
    // When the player eneters a room, we get the room data from redis and subscribe to this table
    const table = await constructTable(tableID);
    if (table) {
      if (!subTables.includes(tableID)) {
        subTables.push(tableID);

        redisGameSub.subscribe(`table-socket:${tableID}`);
        redisGameSub.subscribe(`table-events:${tableID}`);
        redisGameSub.subscribe(`kick-player:${tableID}`);
        redisGameSub.subscribe(`cancel-timers:${tableID}`);
        redisGameSub.subscribe(`set-timers:${tableID}`);
        redisGameSub.subscribe(`table-actions:${tableID}`);
      }

      // Add the player to the socket room
      socket.join(`table-${tableID}`);

      // Only add the room data if this user is authenticated, else he is a guest
      if (socket.id in connected && connected[socket.id].room === null) {
        // Add the room to the player's data
        connected[socket.id].room = tableID;
      }

      logger.debug(`enter room socket id: ${socket.id}`);
    }
  });

  /**
   * When a player leaves a room
   */
  socket.on('leaveRoom', () => {
    if (
      socket.id in connected
        && connected[socket.id].room !== null
        && connected[socket.id].sittingOnTable === false
    ) {
      // Remove the player from the socket room
      socket.leave(`table-${connected[socket.id].room}`);
      // Remove the room from the connection data
      connected[socket.id].room = null;
    }
  });

  /**
   * When a player disconnects
   */
  socket.on('disconnect', () => {
    // If the socket points to a player object & if the player was sitting on a table
    if (isUserConnected(socket.id)) {
      // The seat on which the player was sitting
      const { seat, username } = connected[socket.id];
      // The table on which the player was sitting
      const tableID = connected[socket.id].sittingOnTable;
      // If player suddenly disconnected, make him leave the table
      connLeftTable(socket.id);
      // Remove the connection object from the connected array
      delete connected[socket.id];

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        const table = await constructTable(tableID);
        logger.debug(`player ${username} disconnecting.`);

        table.playerDisconnected(seat);

        await pubTableUpdate(table);
        return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
      });
    }
  });

  /**
   * When a player leaves the table
   *
   * @param {function} callback - The callback
   */
  socket.on('leaveTable', (callback = () => {}) => {
    logger.debug('leave table request received');
    // If the player was sitting on a table
    if (isUserConnected(socket.id)) {
      logger.debug('leave table lock obtained');

      // The seat on which the player was sitting
      const { seat } = connected[socket.id];
      // The table on which the player was sitting
      const tableID = connected[socket.id].sittingOnTable;

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        const table = await constructTable(tableID);

        const { chipsInPlay } = table.seats[seat].public;

        // Get the latest balance from DB
        const res = await db.query(queries.SELECT_BALANCE, [connected[socket.id].userID]);

        // Remove the player from the seat
        table.playerLeft(seat);

        // Send the number of total chips back to the user
        callback({
          success: true,
          totalChips: Number(res.rows[0].balance) + chipsInPlay,
        });

        connLeftTable(socket.id);

        await pubTableUpdate(table);
        return lock.unlock().catch(err => logger.error('error unlocking ', err));
      });
    }
  });

  /**
   * When a player requests to sit on a table
   *
   * @param {Object} data - The table ID, seat, amount etc.
   * @param {function} callback - The callback
   */
  socket.on('sitOnTheTable', async (data, callback = () => {}) => {
    // Check if the table ID exists
    const countIDs = await redisGameCl.sismemberAsync('tableids', data.tableID);
    if (countIDs !== 1) {
      logger.info('table does not exist, return');
      return;
    }

    const {
      tableID,
      seat,
      chips,
      password,
    } = data;

    redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
      if (!(socket.id in connected)) {
        return lock.unlock().catch(err => logger.error('error unlocking sitOnTheTable', err));
      }

      const table = await constructTable(tableID);
      const {
        sittingOnTable,
        room,
        userID,
        username,
        session,
      } = connected[socket.id];

      if (
      // A seat has been specified
        typeof seat !== 'undefined'
          // A table id is specified
          && typeof tableID === 'string'
          // The seat number is an integer and less than the total number of seats
          && typeof seat === 'number'
          && seat >= 0
          && seat < table.public.seatsCount
          && socket.id in connected
          // The seat is empty
          && table.seats[seat] == null
          // The player isn't sitting on any other tables
          && sittingOnTable === false
          // The player had joined the room of the table
          && room === tableID
          // The chips number chosen is a number
          && typeof chips === 'number'
          && !isNaN(parseInt(chips, 10))
          && isFinite(chips)
          // The chips number is an integer
          && chips % 1 === 0
          && typeof password === 'string'
      ) {
        const playersOnTable = table.seats.filter(s => s !== null).map(s => s.public.name);
        // const isPlayingOnOtherTable = await redisGameCl.sismemberAsync('ingame', userID);
        const updateModeOn = await redisMainCl.existsAsync('game:mode:update');
        logger.debug(`updateMode ${updateModeOn}`);

        // Needed to check if the user has been given a bonus
        // and bonus conditions are met for sitting on the table
        const tableUnlockRake = await db.query(queries.SELECT_UNLOCK_RAKE, [userID]);
        const totalRake = await db.query(queries.SELECT_TOTAL_RAKE, [userID]);
        const depositCount = await db.query(queries.SELECT_DEPOSIT_COUNT, [userID]);
        const isAccountFrozen = await db.query(queries.SELECT_FROZEN_ACCOUNT, [userID]);
        logger.debug(`deposit count ${depositCount.rows[0].count} ${JSON.stringify(depositCount.rows[0])}`);

        // This player is not already playing on this table. NOTE: O(n^2)
        if (updateModeOn) {
          callback({
            success: false,
            error: 'We\'re currently updating the game. Please come back in a moment!',
          });
        } else if (playersOnTable.includes(username)) {
          callback({
            success: false,
            error: 'You are already playing on this table',
          });
        } else if (isAccountFrozen.rows[0].is_frozen === true) {
          callback({
            success: false,
            error: 'Your account has been frozen, please contact support.',
          });
        } else if (tableUnlockRake.rows.length === 1
          && tableUnlockRake.rows[0].tables_unlock_after_rake > totalRake.rows[0].sum
          && Number(depositCount.rows[0].count) === 0
          && table.public.bigBlind > 200) {
          callback({
            success: false,
            error: `As per the conditions of your bonus you cannot sit on a table higher than 1/2 bits until you have raked ${tableUnlockRake.rows[0].tables_unlock_after_rake / 100} bits or make a deposit. Your current rake is ${totalRake.rows[0].sum / 100} bits`,
          });
        } else {
          const res = await db.query(queries.SELECT_BALANCE_INGAME_LOCKED, [userID]);
          const { balance, ingame } = res.rows[0];

          const minStack = Number(await redisGameCl.getAsync(`minstack:${tableID}:${userID}`));

          if (ingame < 0 || balance < 0) {
            callback({
              success: false,
              error: "Internal server error. You can't buy-in right now. Please contact support@fair.poker to resolve this problem. ERR: 433",
            });
          } else if (chips > balance) {
            // The chips the player chose are less than the total chips the player has
            callback({
              success: false,
              error: "You don't have that many chips",
            });
          } else if (!minStack
            && (chips > table.public.maxBuyIn || chips < table.public.minBuyIn)) {
            logger.debug(`no min stack ${minStack}`);
            // There's no min stack and the chips are in the acceptable range
            callback({
              success: false,
              error: 'The amount of chips should be between the maximum and the minimum amount of allowed buy in',
            });
          } else if (minStack
            && minStack > table.public.maxBuyIn && chips !== minStack) {
            // There's a min stack and it is bigger than the max buy-in
            callback({
              success: false,
              error: 'The amount of chips should be between the maximum and the minimum amount of allowed buy in',
            });
          } else if (minStack
            && minStack < table.public.maxBuyIn
            && (chips > table.maxBuyIn || chips < minStack || chips < table.public.minBuyIn)) {
            callback({
              success: false,
              error: 'The amount of chips should be between the maximum and the minimum amount of allowed buy in',
            });
          } else if (table.public.isPasswordProtected && !table.checkPassword(password)) {
            callback({
              success: false,
              error: 'Wrong table password',
            });
          } else {
            try {
              // Subtract balances here, check for errors and for negative balances
              await db.query(
                queries.UPDATE_BALANCES_DECREMENT_ACCOUNT_INCREMENT_INGAME,
                [chips, userID],
              );

              // Give the response to the user
              callback({
                success: true,
              });

              // Create a new player that will be passed to the table
              const player = new Player(
                socket.id,
                userID,
                username,
                balance,
                session,
              );

              // Add the player to the table
              table.playerSatOnTheTable(
                player,
                seat,
                parseInt(chips, 10),
              );
              logger.debug('player sat on the table');

              // Save the seat and tableID in the memory of this container
              connJoinedTable(socket.id, tableID, seat);

              // Update the table in redis
              await pubTableUpdate(table);
            } catch (err1) {
              callback({
                success: false,
                error: 'Internal server error, please try to join later',
              });
              logger.error(`error joining table ${err1}`);
              return lock.unlock().catch(err => logger.error(`error unlocking sitOnTheTable ${err}`));
            }
          }
        }
      } else {
        callback({
          success: false,
        });
      }
      return lock.unlock().catch(err => logger.error(`error unlocking sitOnTheTable ${err}`));
    });
  });

  socket.on('reBuy', (amount, callback = () => {}) => {
    if (isUserConnected(socket.id)) {
      const tableID = connected[socket.id].sittingOnTable;

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        // Double check if the user did not disconnect
        if (!isUserConnected(socket.id)) {
          return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
        }
        const { seat, userID } = connected[socket.id];

        const table = await constructTable(tableID);
        const res = await db.query(queries.SELECT_BALANCE, [userID]);
        const { balance } = res.rows[0];

        if (table.seats[seat].public.inHand) {
          callback({ success: false, error: 'You cannot re-buy while in hand' });
          return lock.unlock().catch(err => logger.error(`error unlocking reBuy: ${err}`));
        }

        const { chipsInPlay } = table.seats[seat].public;
        logger.debug(`${table.seats[seat].public.name} is re-buying amt:${amount}, diff: ${amount - chipsInPlay}, balance: ${balance}`);

        if (
          Number.isInteger(amount)
          && amount <= table.public.maxBuyIn
          && amount >= table.public.minBuyIn
          && amount > chipsInPlay
          && amount - chipsInPlay > 0
          && amount - chipsInPlay <= balance
        ) {
          try {
            // That's how much chips will be added to ingame balance after the rebuy
            const chipsToAdd = amount - chipsInPlay;

            // Update the db balances, check for errors
            const balances = await db.query(
              queries.UPDATE_BALANCES_DECREMENT_ACCOUNT_INCREMENT_INGAME,
              [chipsToAdd, userID],
            );
            logger.debug(`player ${table.seats[seat].public.name} rebuys. his balances are account:${balances.rows[0].balance} ingame:${balances.rows[0].ingame}`);

            callback({ success: true });
            table.playerReBuys(seat, amount);
            await pubTableUpdate(table);
          } catch (err1) {
            callback({
              success: false,
              error: 'Internal error. Cannot rebuy now.',
            });
            logger.error(`rebuy to table ${err1}`);
            return lock.unlock().catch(err => logger.error(`error unlocking reBuy: ${err}`));
          }
        } else {
          callback({ success: false, error: 'Cannot re-buy' });
        }

        return lock.unlock().catch(err => logger.error(`error unlocking reBuy: ${err}`));
      });
    }
  });

  /**
   * When a player who sits on the table but is not sitting in, requests to sit in
   *
   * @param {function} callback
   */
  socket.on('sitIn', (callback = () => {}) => {
    if (
      socket.id in connected
        && connected[socket.id].sittingOnTable !== false
        && connected[socket.id].seat !== null
    ) {
      // Getting the table id from the player object
      const tableID = connected[socket.id].sittingOnTable;

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        const table = await constructTable(tableID);
        const { seat } = connected[socket.id];

        if (!table.seats[seat].public.sittingIn
          && table.seats[seat].public.chipsInPlay > 0) {
          callback({ success: true });
          table.playerSatIn(seat);

          await pubTableUpdate(table);
        } else {
          callback({ success: false });
        }

        return lock.unlock().catch(err => logger.error('error unlocking sitIn', err));
      });
    }
  });

  socket.on('sitOut', () => {
    if (isUserConnected(socket.id)) {
      const tableID = connected[socket.id].sittingOnTable;

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        // Double check if the user did not disconnect
        if (!isUserConnected(socket.id)) {
          return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
        }
        const { seat } = connected[socket.id];

        const table = await constructTable(tableID);

        if (table.seats[seat].public.inHand) {
          table.sitOutNextHand(seat);
        } else if (table.seats[seat].public.sittingIn) {
          table.playerSatOut(seat);
        }

        await pubTableUpdate(table);
        return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
      });
    }
  });

  /**
   * When a player posts a blind
   *
   * @param {bool} postedBlind - Shows if the user posted the blind or not
   * @param {function} callback
   */
  socket.on('postBlind', (postedBlind, callback = () => {}) => {
    if (isUserConnected(socket.id)) {
      const tableID = connected[socket.id].sittingOnTable;

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        // Double check if the user did not disconnect
        if (!isUserConnected(socket.id)) {
          logger.debug('user not connected, return');
          return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
        }

        const table = await constructTable(tableID);
        const { activeSeat } = table.public;
        logger.debug(`postBlind received from ${connected[socket.id].username}, game on:${table.gameIsOn}`);

        if (
          table.gameIsOn
            && typeof table.seats[activeSeat].public !== 'undefined'
            && table.seats[activeSeat].socket === socket.id
            && (table.public.phase === 'smallBlind' || table.public.phase === 'bigBlind')
        ) {
          if (postedBlind) {
            callback({
              success: true,
            });
            if (table.public.phase === 'smallBlind') {
              logger.debug('The player posted the small blind');
              // As the hand now begins, logs it into hand history
              // and return the hand ID to the table so that it can log it in DB

              const handID = await db.query(
                queries.INSERT_NEW_HAND_INTO_HAND_HISTORY,
                [
                  table.public.gameMode,
                  table.public.bigBlind,
                  table.public.seatsCount,
                  table.public.playersSeatedCount,
                  table.playersSittingInCount,
                ],
              );

              logger.debug(`starting hand id #${handID.rows[0].id}`);
              // The player posted the small blind
              table.playerPostedSmallBlind(handID.rows[0].id);
            } else {
              logger.debug('The player posted the big blind');

              // The player posted the big blind
              table.playerPostedBigBlind();
            }
          } else {
            table.playerSatOut(connected[socket.id].seat);
            callback({
              success: true,
            });
          }
        }

        await pubTableUpdate(table);
        return lock.unlock().catch(err => logger.error('error unlocking postBlind', err));
      });
    }
  });

  socket.on('shuffleNextCards', (rawDeck, commit, callback = () => {}) => {
    if (isUserConnected(socket.id)) {
      const tableID = connected[socket.id].sittingOnTable;
      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        // Double check if the user did not disconnect
        if (!isUserConnected(socket.id)) {
          return lock.unlock().catch(err => logger.error(`error unlocking shuffle next cards ${err}`));
        }

        const table = await constructTable(tableID);

        const { nextShuffleActiveSeat } = table.public;

        if (table.gameIsOn
          && table.seats[nextShuffleActiveSeat]
          && table.seats[nextShuffleActiveSeat].socket === socket.id
          && table.public.isBackgroundShuffling) {
          const deck = table.mentalDeck.getValidDeck(rawDeck);
          if (deck.error) {
            logger.info(`error in deck submission ${deck.error}`);
            callback({ success: false });
            return lock.unlock().catch(err => logger.error(`error unlocking shuffleCards ${err}`));
          }

          // If we are in the shuffle phase, check for the existence of a commitment
          if (table.nextMentalDeck.commitments.length <= table.nextShuffleSeats.length
            && typeof commit !== 'string') {
            logger.info('player did not submit a committment on backround shuffle');
            return lock.unlock().catch(err => logger.error(`error unlocking shuffleCards ${err}`));
          }

          callback({ success: true });
          logger.debug(`${table.seats[nextShuffleActiveSeat].public.name} submitted next shuffle`);
          table.playerSubmittedNextShuffle(deck.deck, commit);
          await pubTableUpdate(table);
        }

        return lock.unlock().catch(err => logger.error(`error unlocking shuffleNextCards ${err}`));
      });
    }
  });

  /**
   * When a player submits cards during the shuffle or locking stages
   *
   * @param {buffer[]} rawDeck - The shuffled/locked deck
   * @param {string} commit - The commitment to the deck
   * @param {function} callback - Success callback
   */
  socket.on('shuffleCards', (rawDeck, commit, callback = () => {}) => {
    if (isUserConnected(socket.id)) {
      const tableID = connected[socket.id].sittingOnTable;
      logger.debug('deck received');

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        // Double check if the user did not disconnect
        if (!isUserConnected(socket.id)) {
          return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
        }

        const table = await constructTable(tableID);
        const { activeSeat } = table.public;

        if (table.gameIsOn
            && table.seats[activeSeat].socket === socket.id
            && table.public.phase === 'mentalShuffle') {
          /* Get a valid deck of cards.
           * If the received deck is invalid, the object will contain an error */
          const deck = table.mentalDeck.getValidDeck(rawDeck);
          if (deck.error) {
            logger.info('error in deck submission', deck.error);
            return lock.unlock().catch(err => logger.error(`error unlocking shuffleCards ${err}`));
          }

          // If we are in the shuffle phase, check for the existence of a commitment
          if (table.mentalDeck.commitments.length <= table.public.playersInHandCount
              && typeof commit !== 'string') {
            logger.info('player did not submit a committment');
            return lock.unlock().catch(err => logger.error(`error unlocking shuffleCards ${err}`));
          }

          logger.debug(`${table.seats[activeSeat].public.name} submitted cards succesfully. commitment: ${commit}`);
          callback({ success: true });
          table.playerSubmittedShuffle(deck.deck, commit);
          await pubTableUpdate(table);
        }

        return lock.unlock().catch(err => logger.error(`error unlocking shuffleCards ${err}`));
      });
    }
  });

  /**
   * When a player submits keys.
   * Players submit keys on preflop, flop, turn, river, showdown phases.
   *
   * @param {Buffer[]} rawKeys - Array of the keys this player has to submit
   * @param {function} callback - The success callback
   */
  socket.on('submitKeys', (rawKeys, callback = () => {}) => {
    if (isUserConnected(socket.id)) {
      const tableID = connected[socket.id].sittingOnTable;

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        // Double check if the user did not disconnect
        if (!isUserConnected(socket.id)) {
          return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
        }

        const table = await constructTable(tableID);
        const { activeSeat } = table.public;

        if (
          table.gameIsOn
            && [
              'preflopKeySubmit',
              'flopKeySubmit',
              'turnKeySubmit',
              'riverKeySubmit',
              'showdownKeySubmit',
              'protocolFailure',
            ].includes(table.public.phase)
        ) {
          const { seat } = connected[socket.id];
          logger.debug(`keys received from ${connected[socket.id].username}, he must submit ${table.getKeysToSubmit(seat)}`);

          // Check the indexes submitted
          // COMBAK: Heavy. Check if the player has submitted these indexes
          // before running getValidKeys
          const keys = table.mentalDeck.getValidKeys(
            rawKeys,
            table.getKeysToSubmit(seat),
          );
          if (keys.error) {
            callback({ success: false });
            logger.info(`${table.seats[seat].public.name}, seat ${seat} submitted invalid keys for indexes ${table.getKeysToSubmit(seat)}: ${keys.error}: ${rawKeys}`);
            return lock.unlock().catch(err => logger.error(`error unlocking submitKeys ${err}`));
          }

          // There must be no error with the keys
          callback({
            success: true,
          });

          // On protocol failure we still make players to submit keys by active seat turn
          // TODO: Write test for key submit func and disable the turns in protocol failure also
          if (table.public.phase === 'protocolFailure'
              && table.seats[activeSeat].socket === socket.id) {
            table.playerSubmittedKeysFailure(keys.keys, seat);
          } else if (table.public.phase !== 'protocolFailure') {
            /* On key submit phase we allow for players to submit keys
               * without needing them to be in the active seat */
            table.playerSubmittedKeys(keys.keys, seat);
          }

          await pubTableUpdate(table);
        }

        return lock.unlock().catch(err => logger.error('error unlocking submitKeys', err));
      });
    }
  });

  /**
   * This allowed only before betting has started for players,
   * only when players decrypt their face down cards.
   * For the community cards, the server can automatically check if the data is invalid
   * and trigger the failure procedure.
   *
   * @param {buffer[]} rawKeys - The full set of keys of the initiator
   * @param {function} callback - A success callback
   */
  socket.on('protocolFailure', (rawKeys, callback = () => {}) => {
    if (isUserConnected(socket.id)) {
      const tableID = connected[socket.id].sittingOnTable;

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        // Double check if the user did not disconnect
        if (!isUserConnected(socket.id)) {
          return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
        }

        const table = await constructTable(tableID);

        if (table.public.phase === 'preflop') {
          // A player can report failure only on preflop
          const keys = table.mentalDeck.getValidKeys(rawKeys, [
            ...Array(53).keys(),
          ]);

          if (keys.error) {
            logger.info(`${table.seats[connected[socket.id].seat].public.name} submitted invalid keys: ${keys.error}`);
            return lock.unlock().catch(err => logger.error('error unlocking protocolFailure', err));
          }

          callback({
            success: true,
          });

          table.initializeProtocolFailure(keys.keys, connected[socket.id].seat);
          await pubTableUpdate(table);
        }

        return lock.unlock().catch(err => logger.error('error unlocking protocolFailure', err));
      });
    }
  });

  /**
   * When a player checks
   * @param {function} callback - Success callback
   */
  socket.on('check', (callback = () => {}) => {
    if (isUserConnected(socket.id)) {
      const tableID = connected[socket.id].sittingOnTable;

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        // Double check if the user did not disconnect
        if (!isUserConnected(socket.id)) {
          return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
        }

        const table = await constructTable(tableID);
        const { activeSeat } = table.public;

        if ((table
              && table.seats[activeSeat].socket === socket.id
              && !table.public.biggestBet
              && ['preflop', 'flop', 'turn', 'river'].includes(table.public.phase))
              || (table.public.phase === 'preflop'
              && table.public.biggestBet === table.seats[activeSeat].public.bet)
        ) {
          /* Sending the callback first, because the next functions may need
           * to send data to the same player, that shouldn't be overwritten */
          callback({
            success: true,
          });
          table.playerChecked();
          await pubTableUpdate(table);
        }

        return lock.unlock().catch(err => logger.error('error unlocking check', err));
      });
    }
  });

  /**
   * When a player folds.
   * The player keeps his hand private by not submitting his face down card keys.
   * For this to work the player needs to have a commitment to each card (or build a merkle tree).
   * He then reveals all keys except his face down locking keys.
   * The blame function will just ignore the locking of his face down indexes.
   *
   * @param {Buffer[]} keys - The full set of keys of this player. Hand cards - commitments
   * @param {function} callback - The success callback
   */
  socket.on('fold', (rawKeys, callback = () => {}) => {
    if (isUserConnected(socket.id)) {
      const tableID = connected[socket.id].sittingOnTable;

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        // Double check if the user did not disconnect
        if (!isUserConnected(socket.id)) {
          return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
        }

        const table = await constructTable(tableID);
        const { username, seat } = connected[socket.id];
        const { activeSeat } = table.public;

        if (
          table.seats[seat]
            // The player must be in the hand to submit any keys
            && table.seats[seat].public.inHand
            && activeSeat in table.seats
            && table.seats[activeSeat].socket === socket.id
            && ['preflop', 'flop', 'turn', 'river'].includes(table.public.phase)
        ) {
          // Expect all keys except his face down cards
          const indexes = [...Array(53).keys()]
            .filter(i => !table.seats[seat].public.mentalCards.includes(i));

          const startTime = Date.now();
          logger.silly('starting to convert fold keys');
          const keys = table.mentalDeck.getValidKeys(
            rawKeys,
            indexes,
          );
          logger.silly(`fold keys converted. Operation took ${Date.now() - startTime}ms`);

          if (keys.error) {
            logger.info(`${username} submitted invalid keys on fold: ${keys.error}`);
            return lock.unlock().catch(err => logger.error('error unlocking fold', err));
          }

          logger.debug(`${username} is folding`);
          /* Sending the callback first,
             * because the next functions may need to send data to the same player,
             * that shouldn't be overwritten */
          callback({
            success: true,
          });

          table.playerFolded(keys.keys);
          await pubTableUpdate(table);
        }

        return lock.unlock().catch(err => logger.error('error unlocking fold', err));
      });
    }
  });

  /**
   * It allows for a player to urgently submit his keys to the public key map.
   * When a player urgently submits keys which are correct,
   * he won't get penalized if he disconnects.
   *
   * @param {Buffer[]} rawKeys - The full set of keys
   * @param {function} callback - The success callback
   */
  socket.on('urgentKeySubmit', (rawKeys, callback = () => {}) => {
    logger.silly('urgent key submit request received');
    if (isUserConnected(socket.id)) {
      // The player must be in the hand to submit any keys
      const tableID = connected[socket.id].sittingOnTable;

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        // Double check if the user did not disconnect
        if (!isUserConnected(socket.id)) {
          return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
        }

        const table = await constructTable(tableID);
        const { username, seat } = connected[socket.id];

        if (
          table.seats[seat]
            && table.seats[seat].public.inHand
            && table.gameIsOn
            && ![
              'bigBlind',
              'smallBlind',
              'showdown',
            ].includes(table.public.phase)
            && table.hasGameBegun()
        ) {
          // If this player has already submitted all keys, no need to do anything and waste CPU
          if (table.seats[seat].hasSubmittedAllKeys) {
            callback({ success: true });
            return lock.unlock().catch(err => logger.error(`error unlocking urgentKeySubmit ${err}`));
          }

          const startTime = Date.now();

          // Expect all keys except his face down cards
          const indexes = [...Array(53).keys()].filter(
            i => !table.seats[seat].public.mentalCards.includes(i),
          );
          const keys = table.mentalDeck.getValidKeys(rawKeys, indexes);
          if (keys.error) {
            logger.info(`${username} submitted invalid keys on urgent key submit: ${keys.error}`);
            return lock.unlock().catch(err => logger.error(`error unlocking urgentKeySubmit ${err}`));
          }
          logger.debug(`${username} is urgently submitting keys`);

          callback({ success: true });
          table.playerSubmittedAllKeys(keys.keys, seat);

          logger.silly(`urgent key submit table keys submitted, operation took ${Date.now() - startTime}ms`);
          await pubTableUpdate(table, 'urgent key submit from pub table');
        }

        return lock.unlock().catch(err => logger.error('error unlocking urgentKeySubmit', err));
      });
    }
  });

  /**
   * TODO: Replace urgent key submit with this!
   * 
   * It allows for a player to all his keys to a private key map.
   * When a player urgently submits keys which are correct,
   * he won't get penalized if he disconnects.
   *
   * @param {Buffer[]} rawKeys - The full set of keys
   * @param {function} callback - The success callback
   */
  socket.on('allKeySubmit', (rawKeys, callback = () => {}) => {
    if (isUserConnected(socket.id)) {
      // The player must be in the hand to submit any keys
      const tableID = connected[socket.id].sittingOnTable;

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        // Double check if the user did not disconnect
        if (!isUserConnected(socket.id)) {
          return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
        }

        const table = await constructTable(tableID);
        const { username, seat } = connected[socket.id];

        logger.debug(`${table.seats[seat].public.name} is submitting all keys`);

        if (
          table.seats[seat]
            && table.seats[seat].public.inHand
            && table.gameIsOn
            && ![
              'bigBlind',
              'smallBlind',
              'showdown',
            ].includes(table.public.phase)
            && table.hasGameBegun()
        ) {
          // Expect all keys
          const indexes = [...Array(53).keys()];
          const keys = table.mentalDeck.getValidKeys(rawKeys, indexes);
          if (keys.error) {
            logger.info(`${username} submitted invalid keys on all key submit: ${keys.error}`);
            return lock.unlock().catch(err => logger.error(`error unlocking allKeySubmit ${err}`));
          }
          logger.debug(`${username} is urgently submitting keys`);

          callback({ success: true });
          table.playerSubmittedAllKeysNotPublic(keys.keys, seat);

          await pubTableUpdate(table, 'urgent key submit from pub table');
        }

        return lock.unlock().catch(err => logger.error('error unlocking urgentKeySubmit', err));
      });
    }
  });

  /**
   * When a player calls
   * @param {function} callback
   */
  socket.on('call', (callback = () => {}) => {
    if (isUserConnected(socket.id)) {
      const tableID = connected[socket.id].sittingOnTable;

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        // Double check if the user did not disconnect
        if (!isUserConnected(socket.id)) {
          return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
        }

        const table = await constructTable(tableID);
        const { activeSeat } = table.public;

        if (table.gameIsOn
              && table.seats[activeSeat].socket === socket.id
              && table.public.biggestBet
              && ['preflop', 'flop', 'turn', 'river'].includes(table.public.phase)
        ) {
          /* Sending the callback first, because the next functions may
           * need to send data to the same player, that shouldn't be overwritten */
          callback({ success: true });
          table.playerCalled();

          await pubTableUpdate(table);
        }
        return lock.unlock().catch(err => logger.error('error unlocking call', err));
      });
    }
  });

  /**
   * When a player bets
   * @param {number} amount - The bet amount
   * @param {function} callback
   */
  socket.on('bet', (amt, callback = () => {}) => {
    if (isUserConnected(socket.id)) {
      const tableID = connected[socket.id].sittingOnTable;

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        // Double check if the user did not disconnect
        if (!isUserConnected(socket.id)) {
          return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
        }

        const table = await constructTable(tableID);
        const { activeSeat } = table.public;
        const amount = parseInt(amt, 10);
        if (
          table.seats[activeSeat].socket === socket.id
            && !table.public.biggestBet
            && ['preflop', 'flop', 'turn', 'river'].includes(table.public.phase)
            && table.isValidBet(amount)
        ) {
          // Validating the bet amount
          /* Sending the callback first, because the next functions may need
           * to send data to the same player, that shouldn't be overwritten */
          callback({ success: true });
          table.playerBetted(amount);
          await pubTableUpdate(table);
        }

        return lock.unlock().catch(err => logger.error('error unlocking bet', err));
      });
    }
  });

  /**
   * When a player raises
   * @param {number} amt - The amount to raise
   * @param {function} callback - The callback
   */
  socket.on('raise', (amt, callback = () => {}) => {
    if (isUserConnected(socket.id)) {
      const tableID = connected[socket.id].sittingOnTable;

      redlock.lock(`locks:table:${tableID}`, ttl).then(async (lock) => {
        // Double check if the user did not disconnect
        if (!isUserConnected(socket.id)) {
          return lock.unlock().catch(err => logger.error(`error unlocking ${err}`));
        }

        const table = await constructTable(tableID);
        const { activeSeat } = table.public;
        const amount = parseInt(amt, 10);
        if (
        // The player who should act is the player who raised
          table.seats[activeSeat].socket === socket.id
            // The pot was betted
            && table.public.biggestBet
            // It's not a round of blinds
            && ['preflop', 'flop', 'turn', 'river'].includes(table.public.phase)
            // Not every other player is all in (in which case the only move is 'call')
            && !table.otherPlayersAreAllIn()
            && isFinite(amount)
            && table.isValidBet(amount)
        ) {
          /* Sending the callback first, because the next
           * functions may need to send data to the same player, that shouldn't be overwritten */
          callback({ success: true });
          // The amount should not include amounts previously betted
          table.playerRaised(amount);
          await pubTableUpdate(table);
        }

        return lock.unlock().catch(err => logger.error('error unlocking raise', err));
      });
    }
  });

  /**
   * When a message from a player is sent
   * @param {string} m - The message
   */
  socket.on('sendMessage', (m) => {
    const message = m.trim();
    if (socket.id in connected && message && connected[socket.id].room) {
      const { room } = connected[socket.id];
      const eventData = {
        message: htmlEntities(message),
        sender: connected[socket.id].username,
      };

      redisGameCl.publish(`table-events:${room}`, JSON.stringify({
        eventData,
        tableID: room,
        eventName: 'receiveMessage',
      }));
    }
  });
};

module.exports = {
  connLeftTable,
  webSocketAPIHandler,
  connected,
  executeTableFunction,
};
