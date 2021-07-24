const logger = require('../logger');
const Pot = require('./pot');
const MentalDeck = require('./mental-deck');
const db = require('../db');
const queries = require('../db/queries');
const { redisGameCl } = require('../redis');
const { writeToLogFile } = require('../utils/customLog');
const { GAME_MODE_NLHE, GAME_MODE_PLO } = require('../utils/consts');

/*
 * All of the game phases
 */
const PHASE_MENTAL_SHUFFLE = 'mentalShuffle';
const PHASE_KEY_SUBMIT_PREFLOP = 'preflopKeySubmit';
const PHASE_KEY_SUBMIT_FLOP = 'flopKeySubmit';
const PHASE_KEY_SUBMIT_TURN = 'turnKeySubmit';
const PHASE_KEY_SUBMIT_RIVER = 'riverKeySubmit';
const PHASE_KEY_SUBMIT_SHOWDOWN = 'showdownKeySubmit';
const PHASE_SMALL_BLIND = 'smallBlind';
const PHASE_BIG_BLIND = 'bigBlind';
const PHASE_PREFLOP = 'preflop';
const PHASE_FLOP = 'flop';
const PHASE_TURN = 'turn';
const PHASE_RIVER = 'river';
const PHASE_SHOWDOWN = 'showdown';
const PHASE_PROTOCOL_FAILURE = 'protocolFailure';

// Reasons for penalty
const OFFEND_FOLD_BAD_KEYS = 'badkeys';
const OFFEND_DISCONNECT = 'disconnect';
const OFFEND_MALICIOUS_CALL = 'badcall'; // When a player calls protocol failure for no reason


/**
 * The table that players play poker on.
 */
class Table {
  /**
   * the table we will play poker on
   * @param {string} id - the table id
   * @param {string} name - the name of the table
   * @param {number} seatsCount - the total number of players that can play on the table
   * @param {number} bigBlind - the current big blind
   * @param {number} smallBlind - the current smallBlind
   * @param {number} maxBuyIn - the maximum amount of chips that one can bring to the table
   * @param {number} minBuyIn - the minimum amount of chips that one can bring to the table
   * @param {number} timeout - how much time is allowed for a move
   * @param {bool} showInLobby - flag that shows whether the table will be shown in the lobby
   * @param {bool} updateMode - whether the game is in update mode
   * @param {bool} isNoRake - if this is a promotional no rake table
   * @param {string} gameMode - NLHE or PLO
   */
  constructor(
    id,
    name,
    seatsCount,
    bigBlind,
    smallBlind,
    maxBuyIn,
    minBuyIn,
    timeout,
    showInLobby,
    updateMode = false,
    isNoRake = false,
    gameMode = GAME_MODE_NLHE,
    tablePassword = '',
  ) {
    // The password to sit on this table
    this.tablePassword = tablePassword;
    // The table is not displayed in the lobby
    this.showInLobby = showInLobby;
    // The number of players who receive cards at the begining of each round
    this.playersSittingInCount = 0;
    /* Reference to the last player that will act in the current phase
     * (originally the dealer, unless there are bets in the pot) */
    this.lastPlayerToAct = null;
    // The game has begun
    this.gameIsOn = false;
    // The game has only two players
    this.headsUp = false;
    // References to all the player objects in the table, indexed by seat number
    this.seats = [];
    /* The current game action. On every move, we increment it.
     * We keep track of the game action, as we tie our timeouts to the action and round.
     * This ensures that our timeouts won't trigger wrongly */
    this.action = 0;
    /* How many times a new round has started.
     * We keep track of this as timers on different containers
     * are tied to the round for safety */
    this.round = 0;
    // The last round & action urgent key submit was called. We can call it only only per action.
    this.askedForKeys = null;
    // Keeps a log of the players' moves
    this.actionLog = null;
    // The pot with its methods. Initialize it with the rake amount and the max buy in
    this.pot = new Pot(id, bigBlind, seatsCount, maxBuyIn, isNoRake);
    // The seat of the big blind. Needed to initialize preflop betting
    this.bigBlindSeat = null;
    // If protocol failure was initiated, this is the seat of the initiator
    this.protocolFailureInitiator = null;
    // The deck for playing mental poker
    this.mentalDeck = new MentalDeck();
    // The mental deck for the background shuffle phase
    this.nextMentalDeck = null;
    // The last player in the background shuffle phase
    this.nextShuffleLastPlayerToAct = null;
    // The seats which can participate in the background shuffle
    this.nextShuffleSeats = [];
    // We record the last known offence on the table - for testing purposees
    this.lastOffence = null;
    // Whether the game is on update mode. Not particular to this table!
    this.updateMode = updateMode;
    // How many players were dealt cards when the hand started
    this.playersInHandDealtCards = 0;
    // All the public table data
    this.public = {
      // The table id
      id,
      // The table name
      name,
      // The number of the seats of the table
      seatsCount,
      // The big blind amount
      bigBlind,
      // The small blind amount
      smallBlind,
      // The minimum allowed buy in
      minBuyIn,
      // The maximum allowed buy in
      maxBuyIn,
      // The time each player has to act
      timeout,
      // Whether this is PLO or Holdem
      gameMode,
      // The number of players that are currently seated
      playersSeatedCount: 0,
      // The amount of chips that are in the pot
      pot: this.pot.pots,
      // The biggest bet of the table in the current phase
      biggestBet: 0,
      // The bigest raise is = bet - oldBiggestBet
      biggestRaise: 0,
      // The seat of the dealer
      dealerSeat: null,
      // The seat of the active player
      activeSeat: null,
      // The public data of the players, indexed by their seats
      seats: [],
      // The phase of the game ('smallBlind', 'bigBlind', 'preflop'... etc)
      phase: null,
      // The cards on the board
      board: ['', '', '', '', ''],
      // Log of an action, displayed in the chat
      log: {
        message: '',
        seat: '',
        action: '',
      },
      // The players in the hand, needed to notify players if it is safe to disconnect from the game
      playersInHandCount: 0,
      // Whether background shuffle is currently running
      isBackgroundShuffling: false,
      // Whether backgorund shuffle has finished and a deck is available
      isNextDeckAvailabe: false,
      // The next player to perform a background shuffle
      nextShuffleActiveSeat: null,
      // The ID of the currently running hand
      handID: null,
      // Whether this table is password protected
      isPasswordProtected: tablePassword !== '',
    };

    // Initializing the empty seats
    for (let i = 0; i < this.public.seatsCount; i += 1) {
      this.seats[i] = null;
      this.public.seats[i] = null;
    }
  }

  /**
   * The function that emits the events of the table
   * @param {string} eventName The name of the event
   * @param {Object} eventData The event data
   */
  emitEvent(eventName, eventData) {
    // HACK: Maps cannot be converted to strings directly. Use transport array to transmit keys
    if (this.mentalDeck) {
      this.mentalDeck.transportKeys = Array.from(
        this.mentalDeck.keys,
      );
    }
    redisGameCl.publish(
      `table-events:${this.public.id}`,
      JSON.stringify({
        tableID: this.public.id,
        eventName,
        eventData,
      }),
    );
    this.log({
      message: '',
      action: '',
      seat: '',
      notification: '',
    });
  }

  /**
   * It will perform a case insensitive table password check
   * @param {string} password - the password to test
   * @return {bool} whether the password is correct
   */
  checkPassword(password) {
    return password.toLowerCase().trim() === this.tablePassword.toLowerCase().trim();
  }

  /**
   * It will publish data to a specific socket on the table
   * @return {function} Function that publishes player messages for players on redis channels
   */
  playerSocketEmitter(socketID, ...args) {
    redisGameCl.publish(
      `table-socket:${this.public.id}`,
      JSON.stringify({ socketID, args }),
    );
  }

  /**
   * Checks if the game phase is bigger than mentalShuffle
   * @return {bool} True if the phase is > mental shuffle
   */
  hasGameBegun() {
    return (
      this.public.phase
      && this.public.phase !== PHASE_MENTAL_SHUFFLE
      && this.public.phase !== PHASE_SMALL_BLIND
      && this.public.phase !== PHASE_BIG_BLIND
    );
  }

  /**
   * Finds the next player of a certain status on the table
   * @param  {number} offset (the seat where search begins)
   * @param  {string|array} status (the status of the player who should be found)
   * @return {number|null}
   */
  findNextPlayer(offset = this.public.activeSeat, status = 'inHand') {
    if (status instanceof Array) {
      let statusLength = status.length;
      if (offset !== this.public.seatsCount) {
        for (let i = offset + 1; i < this.public.seatsCount; i += 1) {
          if (this.seats[i] !== null) {
            let validStatus = true;
            for (let j = 0; j < statusLength; j += 1) {
              validStatus &= !!this.seats[i].public[status[j]];
            }
            if (validStatus) {
              return i;
            }
          }
        }
      }
      for (let i = 0; i <= offset; i += 1) {
        if (this.seats[i] !== null) {
          let validStatus = true;
          for (let j = 0; j < statusLength; j += 1) {
            validStatus &= !!this.seats[i].public[status[j]];
          }
          if (validStatus) {
            return i;
          }
        }
      }
    } else {
      if (offset !== this.public.seatsCount) {
        for (let i = offset + 1; i < this.public.seatsCount; i += 1) {
          if (this.seats[i] !== null && this.seats[i].public[status]) {
            return i;
          }
        }
      }
      for (let i = 0; i <= offset; i += 1) {
        if (this.seats[i] !== null && this.seats[i].public[status]) {
          return i;
        }
      }
    }

    return null;
  }

  /**
   * Finds the previous player of a certain status on the table
   * @param  {number} offset (the seat where search begins)
   * @param  {string|array} status (the status of the player who should be found)
   * @return {number|null}
   */
  findPreviousPlayer(offset = this.public.activeSeat, status = 'inHand') {
    if (status instanceof Array) {
      let statusLength = status.length;
      if (offset !== 0) {
        for (let i = offset - 1; i >= 0; i -= 1) {
          if (this.seats[i] !== null) {
            let validStatus = true;
            for (let j = 0; j < statusLength; j += 1) {
              validStatus &= !!this.seats[i].public[status[j]];
            }
            if (validStatus) {
              return i;
            }
          }
        }
      }
      for (let i = this.public.seatsCount - 1; i >= offset; i -= 1) {
        if (this.seats[i] !== null) {
          let validStatus = true;
          for (let j = 0; j < statusLength; j += 1) {
            validStatus &= !!this.seats[i].public[status[j]];
          }
          if (validStatus) {
            return i;
          }
        }
      }
    } else {
      if (offset !== 0) {
        for (let i = offset - 1; i >= 0; i -= 1) {
          if (this.seats[i] !== null && this.seats[i].public[status]) {
            return i;
          }
        }
      }
      for (let i = this.public.seatsCount - 1; i >= offset; i -= 1) {
        if (this.seats[i] !== null && this.seats[i].public[status]) {
          return i;
        }
      }
    }

    return null;
  }

  /**
   * It starts a new game
   * @param {bool} changeDealer - If the dealer has to be changed
   */
  initializeRound(changeDealer = true) {
    logger.debug('initializing round');
    this.emitEvent('prepareForNewRound');

    // Sit out all player wih no chips
    for (let i = 0; i < this.public.seatsCount; i += 1) {
      // If a player is sitting on the current seat
      if (this.seats[i] && this.seats[i].public.sittingIn) {
        if (!this.seats[i].public.chipsInPlay) {
          this.playerSatOut(i);
        }
      }
    }

    if (this.playersSittingInCount > 1) {
      // The game is on now
      this.gameIsOn = true;
      this.public.board = ['', '', '', '', ''];
      this.headsUp = this.playersSittingInCount === 2;
      this.public.playersInHandCount = 0;
      this.playersInHandDealtCards = 0;
      /* Reset the biggest bet.
       * NOTE: This was a bug in the original game, where after bet,
       * then fold in preflop the next round starts with last bet amount. */
      this.public.biggestBet = 0;
      this.public.biggestRaise = 0;
      this.mentalDeck = new MentalDeck();
      this.protocolFailureInitiator = null; // Reset the protocol failure initiator
      this.clearTimeouts();
      this.action = 0; // Reset the game action
      this.round += 1; // Increment the game round
      this.askedForKeys = null;

      for (let i = 0; i < this.public.seatsCount; i += 1) {
        // If a player is sitting on the current seat
        if (this.seats[i] && this.seats[i].public.sittingIn) {
          this.public.playersInHandCount += 1;
          this.playersInHandDealtCards += 1;
          this.seats[i].prepareForNewRound();
        }
      }

      // Giving the dealer button to a random player
      if (this.public.dealerSeat === null) {
        const randomDealerSeat = Math.ceil(
          Math.random() * this.playersSittingInCount,
        );
        let playerCounter = 0;
        let i = -1;

        // Assinging the dealer button to the random player
        while (
          playerCounter !== randomDealerSeat &&
          i < this.public.seatsCount
        ) {
          i += 1;
          if (this.seats[i] !== null && this.seats[i].public.sittingIn) {
            playerCounter += 1;
          }
        }
        this.public.dealerSeat = i;
      } else if (
        changeDealer
        || this.seats[this.public.dealerSeat].public.sittingIn === false
      ) {
        // If the dealer should be changed because the game will start with a new player
        // or if the old dealer is sitting out, give the dealer button to the next player
        this.public.dealerSeat = this.findNextPlayer(this.public.dealerSeat);
      }

      // Begin the game from the small blind
      this.initializeSmallBlind();
    }
  }

  /**
   * It handles the shuffle stage of deck generation
   */
  initializeMentalShuffle() {
    this.mentalDeck = new MentalDeck();

    // Set the phase to shuffle
    this.public.phase = PHASE_MENTAL_SHUFFLE;

    this.public.activeSeat = this.findNextPlayer(this.public.dealerSeat);
    this.lastPlayerToAct = this.findPreviousPlayer(this.public.activeSeat);

    // Update everyone on the history
    this.emitEvent('table-data', this.public);

    // Time the active player
    this.timeActivePlayer();

    // Start asking players to submit the shuffles
    this.playerSocketEmitter(
      this.seats[this.public.activeSeat].socket,
      'shuffleCards',
      this.mentalDeck.history[this.mentalDeck.history.length - 1],
      true,
    );
  }

  /**
   * It starts the 'small blind' round
   */
  initializeSmallBlind() {
    // Set the table phase to 'smallBlind'
    this.public.phase = PHASE_SMALL_BLIND;

    // If it's a heads up match, the dealer posts the small blind
    if (this.headsUp) {
      this.public.activeSeat = this.public.dealerSeat;
    } else {
      this.public.activeSeat = this.findNextPlayer(this.public.dealerSeat);
    }
    this.lastPlayerToAct = 10;

    this.timeActivePlayer();

    logger.debug(`in table.js: active seat: ${this.seats[this.public.activeSeat].public.name}`);

    logger.debug(`sending post small blind request to ${this.seats[this.public.activeSeat].public.name} with socket ${this.seats[this.public.activeSeat].socket}`);
    // Start asking players to post the small blind
    this.playerSocketEmitter(
      this.seats[this.public.activeSeat].socket,
      'postSmallBlind',
    );
  }

  /**
   * It starts the 'big blind' round
   */
  initializeBigBlind() {
    // Set the table phase to 'bigBlind'
    this.public.phase = PHASE_BIG_BLIND;

    this.actionToNextPlayer();
  }

  /**
   * It initializes the a key submit stage after the previous stage is complete.
   * Should be called after:
   *  - Mental shuffle
   *  - Preflop
   *  - Flop
   *  - Turn
   *  - River
   */
  initializeKeySubmit() {
    this.public.activeSeat = this.findNextPlayer(this.public.dealerSeat);
    this.lastPlayerToAct = this.findPreviousPlayer(this.public.activeSeat);

    const { activeSeat, playersInHandCount } = this.public;

    switch (this.public.phase) {
      case PHASE_MENTAL_SHUFFLE:
        logger.debug('assignning mental cards and changing the phase to key submit preflop');
        this.public.phase = PHASE_KEY_SUBMIT_PREFLOP;
        let currentPlayer = activeSeat;
        for (let i = 0; i < playersInHandCount; i += 1) {
          // Assign the mental cards
          if (this.public.gameMode === GAME_MODE_PLO) {
            this.seats[currentPlayer].public.mentalCards = this.mentalDeck.drawCards(4);
          } else {
            this.seats[currentPlayer].public.mentalCards = this.mentalDeck.drawCards(2);
          }
          logger.debug(`sending mental card ${this.seats[currentPlayer].public.mentalCards} to ${this.seats[currentPlayer].public.name}:${this.seats[currentPlayer].socket}`);
          this.playerSocketEmitter(
            this.seats[currentPlayer].socket,
            'dealingMentalCards',
            this.seats[currentPlayer].public.mentalCards,
          ); // Tell the player which cards were drawn for him
          currentPlayer = this.findNextPlayer(currentPlayer);
        }
        break;
      case PHASE_PREFLOP: // Draw flop
        this.public.phase = PHASE_KEY_SUBMIT_FLOP;
        this.mentalDeck.communityCards = this.mentalDeck.communityCards.concat(
          this.mentalDeck.drawCards(3),
        );
        break;
      case PHASE_FLOP: // Draw turn
        this.public.phase = PHASE_KEY_SUBMIT_TURN;
        this.mentalDeck.communityCards = this.mentalDeck.communityCards.concat(
          this.mentalDeck.drawCards(1),
        );
        break;
      case PHASE_TURN: // Draw river
        this.public.phase = PHASE_KEY_SUBMIT_RIVER;
        this.mentalDeck.communityCards = this.mentalDeck.communityCards.concat(
          this.mentalDeck.drawCards(1),
        );
        break;
      case PHASE_RIVER:
        this.public.phase = PHASE_KEY_SUBMIT_SHOWDOWN;
        break;
      // no default
    }
    logger.debug(`init key submit ${this.seats[activeSeat].public.name}`);
    this.emitEvent('mental-deck-data', {
      dealt: this.mentalDeck.dealt,
      communityCards: this.mentalDeck.communityCards,
    });
    this.emitEvent('table-data', this.public); // Publish the drawn community cards indexes
    this.timeActivePlayer();


    // Tell all players to submit keys
    let currentPlayer = activeSeat;
    for (let i = 0; i < this.public.playersInHandCount; i += 1) {
      this.playerSocketEmitter(
        this.seats[currentPlayer].socket,
        'submitKeys',
        this.getKeysToSubmit(currentPlayer),
      );
      currentPlayer = this.findNextPlayer(currentPlayer);
    }
  }

  /**
   * It return the keys a player must submit on a key submit phase
   * Must be called during a key submit phase
   *
   * @param {number} seat - The seat of the of the player
   * @return {Array} - The keys active player has to submit
   */
  getKeysToSubmit(seat = this.public.activeSeat) {
    const cards = [];
    switch (this.public.phase) {
      case PHASE_KEY_SUBMIT_PREFLOP:
        // The assigned mental indexes to all players except this player's
        this.seats.forEach((s, i) => {
          if (s && i !== seat && s.public.inHand) {
            s.public.mentalCards.forEach(c => cards.push(c));
          }
        });
        return cards;
      case PHASE_KEY_SUBMIT_FLOP:
        return this.mentalDeck.communityCards;
      case PHASE_KEY_SUBMIT_TURN:
        return [this.mentalDeck.communityCards[3]];
      case PHASE_KEY_SUBMIT_RIVER:
        return [this.mentalDeck.communityCards[4]];
      case PHASE_KEY_SUBMIT_SHOWDOWN:
        return this.seats[seat].public.mentalCards;
      case PHASE_PROTOCOL_FAILURE:
        return [...Array(53).keys()];
      // no default
    }
    return [...Array(53).keys()];
  }

  /**
   * It starts the preflop round
   */
  initializePreflop() {
    logger.debug('init preflop');

    // Set the table phase to 'preflop'
    this.public.phase = PHASE_PREFLOP;
    // The player that placed the big blind is the last player to act for the round
    this.lastPlayerToAct = this.public.activeSeat;

    let currentPlayer = this.public.activeSeat;
    for (let i = 0; i < this.public.playersInHandCount; i += 1) {
      this.seats[currentPlayer].public.hasCards = true;
      // Indicates to the players to decrypt the face-down cards
      this.playerSocketEmitter(this.seats[currentPlayer].socket, 'openCards');

      // Increment hand count in player stats. No need for a new loop
      db.query(
        queries.UPDATE_INCREMENT_HANDS_PLAYED,
        [this.seats[currentPlayer].userID],
        (err) => {
          if (err) logger.error(`error updating hands played ${err}`);
        },
      );

      currentPlayer = this.findNextPlayer(currentPlayer);
    }

    // Set the active seat to big blind. Action to next player will up it
    this.public.activeSeat = this.bigBlindSeat;
    this.lastPlayerToAct = this.bigBlindSeat; // The last to act is the BB

    this.initializeNextMentalShuffle();
    this.actionToNextPlayer();
  }

  /**
   * It will initialize the background shuffling phase
   */
  initializeNextMentalShuffle() {
    this.public.isBackgroundShuffling = true;
    this.public.isNextDeckAvailabe = false;
    this.nextMentalDeck = new MentalDeck();

    // The shuffle originally begins on the small blind, so find the player after that
    this.public.nextShuffleActiveSeat = this.findNextPlayer(
      this.findNextPlayer(this.public.dealerSeat), // The SB
    );
    this.nextShuffleLastPlayerToAct = this.findPreviousPlayer(this.nextShuffleActiveSeat);

    // Only these seats may participate in the background mental shuffle
    const nextMentalShuffleSeats = [];
    let currentPlayer = this.public.nextShuffleActiveSeat;
    for (let i = 0; i < this.playersSittingInCount; i += 1) {
      nextMentalShuffleSeats.push(currentPlayer);
      // Only players that will play in the next hand. Sitting out players will not be counted
      currentPlayer = this.findNextPlayer(currentPlayer, 'sittingIn');
    }
    this.nextShuffleSeats = nextMentalShuffleSeats;

    logger.debug(`initializing next shuffle, next shuffle seats: ${nextMentalShuffleSeats}, next shuffle active seat ${this.public.nextShuffleActiveSeat}`);

    this.emitEvent('table-data', this.public);
    this.emitEvent('prepareNextMentalDeck');

    this.playerSocketEmitter(
      this.seats[this.public.nextShuffleActiveSeat].socket,
      'shuffleNextCards',
      this.nextMentalDeck.history[this.nextMentalDeck.history.length - 1],
      true,
    );
  }

  /**
   * Logs all the pots to DB.
   */
  logPots() {
    this.pot.pots.forEach((pot) => {
      const playersInPot = pot.contributors.map(c => this.seats[c].public.name);
      this.logHandHistory(`Pot (${pot.amount}) ${playersInPot.join(', ')}`);
    });
  }

  /**
   * It starts the next phase of the round
   */
  initializeNextPhase() {
    switch (this.public.phase) {
      case PHASE_KEY_SUBMIT_FLOP: // Triggered after the preflop has ended
        this.public.phase = PHASE_FLOP;
        // Set the table cards to equal the decrypted community cards
        this.public.board = this.mentalDeck.decryptedCommunityCards;
        break;
      case PHASE_KEY_SUBMIT_TURN: // Triggered after the flop has ended
        this.public.phase = PHASE_TURN;
        // Set the table cards to equal the decrypted community cards
        this.public.board[3] = this.mentalDeck.decryptedCommunityCards[3];
        break;
      case PHASE_KEY_SUBMIT_RIVER: // Triggered after the turn has ended
        this.public.phase = PHASE_RIVER;
        // Set the table cards to equal the decrypted community cards
        this.public.board[4] = this.mentalDeck.decryptedCommunityCards[4];
        break;
      // no default
    }

    this.pot.addTableBets(this.seats);
    this.public.biggestBet = 0;
    this.public.biggestRaise = 0;
    this.public.activeSeat = this.findNextPlayer(this.public.dealerSeat);
    this.lastPlayerToAct = this.findPreviousPlayer(this.public.activeSeat);
    this.timeActivePlayer(); // Start the timer on the currently active player
    this.emitEvent('table-data', this.public);

    const {
      activeSeat,
      playersInHandCount,
      phase,
      board,
    } = this.public;

    this.logHandHistory(`${phase.charAt(0).toUpperCase() + phase.slice(1)} [${board.join(', ')}]`);
    this.logPots();

    // Tell players to decrypt community cards
    if ([PHASE_FLOP, PHASE_TURN, PHASE_RIVER].includes(phase)) {
      let currentPlayer = activeSeat;
      for (let i = 0; i < playersInHandCount; i += 1) {
        this.playerSocketEmitter(this.seats[currentPlayer].socket, 'openBoard', phase);
        currentPlayer = this.findNextPlayer(currentPlayer);
      }
    }

    // If all other players are all in, there should be no actions. Move to the next round.
    if (this.otherPlayersAreAllIn()) {
      const that = this;
      setTimeout(() => {
        redisGameCl.publish(`table-actions:${this.public.id}`, JSON.stringify({
          do: 'endPhase',
          action: that.action,
          round: that.round,
        }));
      }, 1000);
    } else if (this.seats[activeSeat].public.chipsInPlay === 0) {
      // If the player is all in
      // The player is all in. Make him check
      logger.debug(`Next phase init and active seat (${this.seats[activeSeat].public.name}) is all in. Check`);
      this.playerChecked();
    } else {
      this.playerSocketEmitter(
        this.seats[activeSeat].socket,
        'actNotBettedPot',
      );
    }
  }

  /**
   * It clears the current timeout
   */
  clearTimeouts() {
    // Cancel the current timeouts
    redisGameCl.publish(`cancel-timers:${this.public.id}`, JSON.stringify({
      round: this.round,
      do: 'cancel',
      action: this.action, // The last action
    }));

    // Increment the game action not to trigger timeouts.
    this.action += 1;

    logger.debug('timeouts cleared');
  }

  /**
   * It will append the provided string into the hand's history log.
   * It will automatically nicely format the active seat we're logging
   * @param {string} log - The string to log
   * @param {number} seat - The seat we're logging
   */
  logHandHistory(log, seat) {
    if (!this.gameIsOn) {
      return;
    }

    const logString = seat !== undefined ? `${this.action}. ${this.seats[seat].public.name} (${this.seats[seat].public.chipsInPlay}): ${log}` : `${this.action}. ${log}`;

    db.query(
      queries.UPDATE_HAND_HISTORY_LOG,
      [logString, this.public.handID],
      (err) => {
        if (err) logger.error(`could not update hand history: ${err}`);
      },
    );
  }

  /**
   * It sets a timer on the active player
   */
  timeActivePlayer() {
    const {
      action,
      round,
      public: {
        activeSeat,
        id,
        timeout,
        phase,
      },
    } = this;

    // If phase is shuffle/submit key, log how much time it takes for players to act on average
    if (this.actionLog) {
      // Get the last move
      const {
        name,
        timeStarted,
        phase: actionPhase,
        seat,
      } = this.actionLog;

      if (
        actionPhase === PHASE_MENTAL_SHUFFLE
      || actionPhase === PHASE_KEY_SUBMIT_FLOP
      || actionPhase === PHASE_KEY_SUBMIT_TURN
      || actionPhase === PHASE_KEY_SUBMIT_RIVER
      || actionPhase === PHASE_KEY_SUBMIT_SHOWDOWN) {
        /* Calculate how much time on average it
         * takes for this player to make a shuffle/submit key move */
        const timeElapsed = Date.now() - timeStarted;
        this.seats[seat].totalShuffles += 1;
        this.seats[seat].avgTimeShuffle += Math.round(
          (timeElapsed - this.seats[seat].avgTimeShuffle) / this.seats[seat].totalShuffles,
        );

        // COMBAK: Show frontend warning if timeElapsed is too big. It means a slow connection
        if (timeElapsed > 10000) {
          logger.warn(`it took ${name} ${timeElapsed}ms (more than 10secs) to make a move in ${actionPhase}. His average time to move is ${this.seats[seat].avgTimeShuffle}`);
        } else if (timeElapsed > 5000) {
          logger.info(`it took ${name} ${timeElapsed}ms to make a move in ${actionPhase}. His average time to move is ${this.seats[seat].avgTimeShuffle}`);
        }

        logger.silly(`it takes ${name} ${this.seats[seat].avgTimeShuffle}ms on average to make an auto move.`);
      }
    }
    this.actionLog = {
      action,
      round,
      phase,
      name: this.seats[activeSeat].public.name,
      seat: activeSeat,
      timeStarted: Date.now(),
      timeElapsed: null,
    };

    // Cancel the old timeout
    redisGameCl.publish(
      `cancel-timers:${id}`, JSON.stringify({
        round,
        action,
      }),
    );

    // Increment the action
    this.action += 1;

    // Sets a timeout for the active player in container memory
    // setActionTimers(id, this.action, round, timeout);
    redisGameCl.publish(`set-timers:${this.public.id}`, JSON.stringify({
      round: this.round,
      do: 'set',
      socketID: this.seats[activeSeat].socket,
      action: this.action, // The last action
      duration: this.public.timeout,
    }));
  }

  /**
   * It will ask for the keys of the active player.
   * It must be called before the main timeout function,
   * which is going to restart the game in certain phases.
   * If the action has passed we will not ask for keys.
   *
   * @param {number} action - The action on which the timeout occured
   * @param {number} round - The round on which the timeout occured
   * @return {bool} If the function call was succesfull
   */
  keySubmitTimeout(action = -1, round = -1) {
    // Stop executing the timeout if we are not on the correct action or round
    if (this.action !== action || this.round !== round) return false;
    if (this.askedForKeys !== null
      && this.askedForKeys.action === action
      && this.askedForKeys.round === round) {
      return false;
    }

    logger.debug(`first player timeout called, asking for keys ${this.seats[this.public.activeSeat].public.name}`);
    if (this.public.phase !== PHASE_SMALL_BLIND && this.public.phase !== PHASE_BIG_BLIND) {
      logger.debug(`requesting for ${this.seats[this.public.activeSeat].public.name}'s keys'`);
      // TODO: There will be multiple keys submits.
      this.playerSocketEmitter(this.seats[this.public.activeSeat].socket, 'urgentKeySubmit');
    }

    // Remeber that we already asked for keys on this action & round
    this.askedForKeys = {
      action,
      round,
    };

    return true;
  }

  /**
   * It will kick the active player from the game.
   * If the action has passed, player will not be kicked.
   *
   * @param {number} action - The action on which the timeout occured
   * @param {number} round - The round on which the timeout occured
   * @return {bool} If the function call was succesfull
   */
  playerTimeout(action = -1, round = -1) {
    // Stop executing the timeout if we are not on the correct action
    if (this.action !== action || this.round !== round) return false;

    logger.info(`${this.seats[this.public.activeSeat].public.name} timed out`);

    const { activeSeat } = this.public;

    this.playerSocketEmitter(
      this.seats[activeSeat].socket,
      'kicked',
      JSON.stringify({
        title: 'You have been removed from the table.',
        body: 'You timed out.',
      }),
    );

    // Force the player to leave the table if timer is up
    this.playerLeft(activeSeat);

    return true;
  }

  /**
   * It tells the active player to act.
   */
  requestActionFromActivePlayer() {
    const { activeSeat, playersInHandCount } = this.public;

    switch (this.public.phase) {
      case PHASE_SMALL_BLIND:
        this.playerSocketEmitter(
          this.seats[activeSeat].socket,
          'postSmallBlind',
        );
        break;
      case PHASE_BIG_BLIND:
        this.playerSocketEmitter(
          this.seats[activeSeat].socket,
          'postBigBlind',
        );
        break;
      case PHASE_MENTAL_SHUFFLE:
        /* Set last parameter to initicate shuffle or locking.
         * If true, the player should shuffle, if false he should lock */
        this.playerSocketEmitter(
          this.seats[activeSeat].socket,
          'shuffleCards',
          this.mentalDeck.history[this.mentalDeck.history.length - 1],
          this.mentalDeck.history.length - 1 < playersInHandCount,
        );
        break;
      case PHASE_KEY_SUBMIT_PREFLOP:
      case PHASE_KEY_SUBMIT_FLOP:
      case PHASE_KEY_SUBMIT_TURN:
      case PHASE_KEY_SUBMIT_RIVER:
      case PHASE_KEY_SUBMIT_SHOWDOWN:
      case PHASE_PROTOCOL_FAILURE:
        this.playerSocketEmitter(
          this.seats[activeSeat].socket,
          'submitKeys',
          this.getKeysToSubmit(),
        );
        break;
      case PHASE_PREFLOP:
        if (this.seats[activeSeat].public.chipsInPlay === 0) {
          logger.debug(`${this.seats[activeSeat].public.name} is all in.`);
          this.skipPlayer();
        } else if (this.otherPlayersAreAllIn()) {
          this.playerSocketEmitter(
            this.seats[activeSeat].socket,
            'actOthersAllIn',
          );
        } else {
          this.playerSocketEmitter(
            this.seats[activeSeat].socket,
            'actBettedPot',
          );
        }
        break;
      case PHASE_FLOP:
      case PHASE_TURN:
      case PHASE_RIVER:
        // Check if this seat is all in
        if (this.seats[activeSeat].public.chipsInPlay === 0) {
          logger.debug(`${this.seats[activeSeat].public.name} is all in.`);
          this.skipPlayer();
        } else if (this.public.biggestBet) { // If someone has betted
          if (this.otherPlayersAreAllIn()) {
            this.playerSocketEmitter(
              this.seats[activeSeat].socket,
              'actOthersAllIn',
            );
          } else {
            this.playerSocketEmitter(
              this.seats[activeSeat].socket,
              'actBettedPot',
            );
          }
        } else {
          this.playerSocketEmitter(
            this.seats[activeSeat].socket,
            'actNotBettedPot',
          );
        }
        break;
      default:
        logger.warn(`actionToNextPlayer called with unknown phase ${this.public.phase}`);
    }
  }

  /**
   * It makes the next player the active one
   */
  actionToNextPlayer() {
    this.public.activeSeat = this.findNextPlayer(this.public.activeSeat, [
      'inHand',
    ]);

    // Start the timer on the active player
    this.timeActivePlayer();

    this.requestActionFromActivePlayer();

    this.emitEvent('table-data', this.public);
  }

  /**
   * It adds the shuffled or locked deck to the history of the deck and saves the commitment.
   * It should be called when the active player submits a deck both on the shuffle
   * and locking stages of the game.
   *
   * @param {buffer[]} deck The shuffled deck of cards
   * @param {string} commit The commitment to the player's active keys
   */
  playerSubmittedShuffle(deck, commit) {
    logger.debug(`history lenght: ${this.mentalDeck.history.length}, historic player order: ${this.mentalDeck.historicPlayerOrder}`);

    const { activeSeat, playersInHandCount } = this.public;

    // Push the historic deck and the name of the player who submitted it
    this.mentalDeck.pushHistoricDeck(deck, this.seats[activeSeat].public.name);

    if (this.mentalDeck.commitments.length <= playersInHandCount) {
      // One commitment per player only
      this.mentalDeck.commitments.push(commit); // Push the commitment of this player
    }

    // End the phase if this is the last player and everybody has submitted deck twice
    if (this.mentalDeck.history.length === playersInHandCount * 2 + 1) {
      logger.debug('end shuffle phase');
      // Update everyone on the history
      this.emitEvent('mental-deck-data', {
        history: this.mentalDeck.history,
      });

      this.endPhase();
    } else {
      this.actionToNextPlayer();
    }
  }

  /**
   * When the player submits the backound shuffle deck.
   * It adds the shuffled/locked deck to the history and pushes the commitment.
   *
   * @param {array} deck - The deck of encrypted cards
   * @param {string} commit - The commitment to keys
   */
  playerSubmittedNextShuffle(deck, commit) {
    logger.debug(`player submitted next shuffle, commtiment ${commit}`);

    const {
      nextShuffleSeats,
      public: {
        nextShuffleActiveSeat,
      },
    } = this;

    this.nextMentalDeck.pushHistoricDeck(deck, this.seats[nextShuffleActiveSeat].public.name);

    if (this.nextMentalDeck.commitments.length <= nextShuffleSeats.length) {
      this.nextMentalDeck.commitments.push(commit);
    }

    if (this.nextMentalDeck.history.length === nextShuffleSeats.length * 2 + 1) {
      logger.debug('next mental deck finished shuffling');
      this.public.isNextDeckAvailabe = true;
      this.public.isBackgroundShuffling = false;
      this.emitEvent('table-data', this.public);

      // Update everyone on the final history of the pre-shuffled deck
      this.emitEvent('next-mental-deck-data', {
        history: this.nextMentalDeck.history,
      });
    } else {
      let nextSeat = nextShuffleActiveSeat;
      do {
        nextSeat = this.findNextPlayer(nextSeat, 'sittingIn');
      } while (!nextShuffleSeats.includes(nextSeat));
      logger.debug(`next seat to do background shuffle is ${nextSeat}`);
      this.public.nextShuffleActiveSeat = nextSeat;

      this.playerSocketEmitter(
        this.seats[this.public.nextShuffleActiveSeat].socket,
        'shuffleNextCards',
        this.nextMentalDeck.history[this.nextMentalDeck.history.length - 1],
        this.nextMentalDeck.history.length - 1 < nextShuffleSeats.length,
      );
    }
  }

  /**
   * It organizes the keys submitted by the players in a non-public data structure
   * and runs the blame function on each call.
   * It will penalize the first player who is to be blamed by the blame function.
   * It should be called when the active player submits ALL of their keys on the failure phase.
   *
   * Note, we don't show the keys submitted during protocol failure publicly,
   * as we don't want to incentivize parties to break the protocol on purpose,
   * so that they can see other player's hole cards.
   *
   * @param {buffer[]} keys The full set of keys of the active player
   */
  playerSubmittedKeysFailure(keys, seat) {
    const player = this.seats[seat];
    logger.debug(`${player.public.name} is submitting failure keys, last player to act ${this.seats[this.lastPlayerToAct].public.name}`);
    // Assume this is not undefined
    const publicKeyArr = this.mentalDeck.keys.get(player.public.name);
    // We add all the keys which were not known here to get all the 53 keys
    const recoveryKeyArr = [];

    keys.forEach((k, i) => {
      if (publicKeyArr[i] === undefined || publicKeyArr[i] === null) {
        recoveryKeyArr[i] = k;
      } else {
        recoveryKeyArr[i] = publicKeyArr[i];
      }
    });

    if (this.mentalDeck.blame(player.public.name, recoveryKeyArr)) {
      this.playerOffended(seat);
    } else if (this.lastPlayerToAct === this.public.activeSeat && seat === this.public.activeSeat) {
      logger.info(
        `could not find offending player. Penalize initiator of the protocol failure ${this.seats[this.protocolFailureInitiator]}`,
      );

      this.playerOffended(this.protocolFailureInitiator, OFFEND_MALICIOUS_CALL);
    } else {
      this.actionToNextPlayer();
    }
  }

  /**
   * Penalizes the player and ends the current round
   * @param {number} seat The player who offended
   * @param {string} reason Why this player offended
   */
  playerOffended(seat, reason) {
    const offender = this.seats[seat];
    this.lastOffence = {
      seat,
      reason,
      name: offender.public.name,
      penaltyChips: 0,
    };
    logger.info(`${offender.public.name} violated the protocol on phase ${this.public.phase} with reason ${reason}. Ending round...`);

    // Sum the player bets to get the total amt of money in the pot
    const sumBets = this.seats
      .filter(s => s !== null)
      .map(p => p.public.bet)
      .reduce((total, bet) => total + bet);
    // Offender will pay everybody in the hand the total pot amount, as if they had won
    const totalPot = this.pot.getTotalAmount() + sumBets;
    // basePenalty is how much the player must be penalized
    const basePenalty = totalPot * (this.public.playersInHandCount - 1);
    /* If the total penalty is higher than the chips in play,
     * we take from the locked up chips of this player */
    const penaltyChips = basePenalty < offender.public.chipsInPlay
      ? basePenalty
      : offender.public.chipsInPlay;
    let penaltyLocked = penaltyChips < basePenalty
      ? basePenalty - penaltyChips
      : 0;

    logger.debug(`Total pot is ${totalPot}, players in hand ${this.public.playersInHandCount}. The penalty for offender ${offender.public.name} is ${basePenalty} = chips ${penaltyChips} + locked ${penaltyLocked}`);

    // TODO: Check the locked up funds of the player!
    penaltyLocked = 0; // NOTE: THERE IS NO LOCKED UP CAPITAL YET
    logger.warn('setting the locked up capital to zero');

    let message = '';
    // TODO: Add reason bad shuffle/locking
    switch (reason) {
      case OFFEND_FOLD_BAD_KEYS:
        message = 'Player submitted bad keys on fold.';
        break;
      case OFFEND_DISCONNECT:
        message = 'Player forcibly disconnected.';
        break;
      case OFFEND_MALICIOUS_CALL:
        message = 'Player triggered protocol failure for no reason.';
        break;
      default:
        logger.debug(`playerOffended called with unknown reason: ${reason}`);
    }

    this.log({
      message: `Hand canceled. ${offender.public.name} violated the protocol. ${message}`,
      action: '',
      seat: this.public.activeSeat,
      notification: '',
    });
    this.emitEvent('table-data', this.public);
    this.logHandHistory(`Hand canceled. ${offender.public.name} violated the protocol. ${message}`);

    // Creates an array of the players in hand without the offender
    let currentPlayer = this.findNextPlayer(this.public.dealerSeat);
    const others = [];
    for (let i = 0; i < this.public.playersInHandCount; i += 1) {
      if (currentPlayer !== offender.seat) {
        others.push(this.seats[currentPlayer]);
      }
      currentPlayer = this.findNextPlayer(currentPlayer);
    }

    let log = [];
    switch (this.public.phase) {
      case PHASE_SMALL_BLIND:
      case PHASE_BIG_BLIND:
      case PHASE_MENTAL_SHUFFLE:
      case PHASE_KEY_SUBMIT_PREFLOP:
      case PHASE_PREFLOP:
      case PHASE_PROTOCOL_FAILURE:
        logger.info('violation occured during bb/sb/shuff/preflop. no penalty');
        log = this.pot.returnBetsToPlayers(this.seats);
        break;
      default:
        logger.info(`violation during ${this.public.phase}. penalize ${offender.public.name} chips in play ${offender.public.chipsInPlay}`);
        this.pot.addTableBets(this.seats);
        log = this.pot.enforcePenalty(
          offender,
          others,
          penaltyChips,
          penaltyLocked,
        );
        this.lastOffence.penaltyChips = penaltyChips;
    }

    log.forEach((l) => {
      this.log({
        message: l,
        action: '',
        seat: '',
        notification: '',
      });
      this.emitEvent('table-data', this.public);
      this.logHandHistory(l);
    });

    logger.debug(`offender ${offender.public.name}, seat ${offender.seat}`);
    offender.public.inHand = false;
    this.removePlayerFromTable(offender.seat);

    this.endRound();
  }

  // TODO: Test this function. It's really tricky with key submission out of turn
  /**
   * It organizes the keys received from the active player in a public structure.
   * It should be called when the active player submits card keys during a key submit phase.
   * @param {buffer[]} keys The card keys submitted by the active player
   */
  playerSubmittedKeys(keys, seat) {
    logger.debug(`${this.seats[seat].public.name} submitted keys`);
    /* We allow players to overwite their mental card keys.
     * This can happen if he chose to submit all his keys before SD,
     * but decided to go to showdown anyways. */
    this.mentalDeck.appendNewKeys(
      this.seats[seat].public.name,
      keys,
      this.seats[seat].public.mentalCards, // Keys allowed to overwrite
    );

    if (seat === this.public.activeSeat && this.lastPlayerToAct === this.public.activeSeat) {
      // Notify the players of the submitted keys, after phase completes
      this.emitEvent('mental-deck-data', {
        transportKeys: Array.from(this.mentalDeck.keys),
      });

      /* Before calling end phase on flop, turn and river check if cards decrypt.
       * If cards don't decrypt, enter failure phase */
      let res = {};
      switch (this.public.phase) {
        case PHASE_KEY_SUBMIT_FLOP:
          res = this.mentalDeck.decryptCards(this.mentalDeck.communityCards);
          if (res.ok) {
            this.mentalDeck.decryptedCommunityCards = res.cards;
          } else {
            logger.info('flop: community cards do not decrypt. entering protocol failure');
            this.enterProtocolFailure();
          }
          break;
        case PHASE_KEY_SUBMIT_TURN:
          res = this.mentalDeck.decryptCards(this.mentalDeck.communityCards[3]);
          if (res.ok) {
            this.mentalDeck.decryptedCommunityCards.push(res.cards[0]);
          } else {
            logger.info('turn: community cards do not decrypt. entering protocol failure');
            this.enterProtocolFailure();
          }
          break;
        case PHASE_KEY_SUBMIT_RIVER:
          res = this.mentalDeck.decryptCards(
            this.mentalDeck.communityCards[4],
          );
          if (res.ok) {
            this.mentalDeck.decryptedCommunityCards.push(res.cards[0]);
          } else {
            logger.info('river: community cards do not decrypt. entering protocol failure');
            this.enterProtocolFailure();
          }
          break;
        // no default
      }

      logger.debug(`community cards ${this.mentalDeck.decryptedCommunityCards}`);
      this.endPhase();
    } else if (seat === this.public.activeSeat) {
      /* NOTE: We don't call actionToNextPlayer() as on initializeKeySubmit() we
       * have already asked all players to submit all necessary card keys */

      /* Only if the active seat has submitted keys, proceed to next player
       * If it is not the active player that submitted keys - do nothing */
      this.public.activeSeat = this.findNextPlayer(this.public.activeSeat, [
        'inHand',
      ]);

      const { activeSeat } = this.public;

      const nextKeys = this.mentalDeck.keys.get(this.seats[activeSeat].public.name);
      const toSubmit = this.getKeysToSubmit();
      // If all indexes contain a valid key, move to the next player
      if (toSubmit.every(idx => nextKeys && Buffer.isBuffer(nextKeys[idx]))) {
        // Move on with the submitKeys function
        logger.debug(`active player ${this.seats[activeSeat].public.name} has submitted all keys, move on`);
        this.playerSubmittedKeys([], activeSeat);
      } else {
        // The player has not submitted the keys of interest yet, so we time him
        this.timeActivePlayer();
        this.emitEvent('table-data', this.public);
      }
    }
  }

  /**
   * It initializes the protocol failure phase.
   * It should be called when the active player complains, as he cannot decrypt his hand cards.
   *
   * In the protocol failure phase we will ask all players to submit
   * ALL of their card keys and we will redo every move they have made during the shuffle phase.
   * We will run the blame function on each player's full set of keys.
   *
   * @param {keys[]} keys The full set of keys of the initiator of protocol failure
   */
  initializeProtocolFailure(keys, seat) {
    // The player who triggered the protocol failure procedure
    logger.info(`${this.seats[seat].public.name} initiated protocol failure`);
    // Save the seat of the failure initiator
    this.protocolFailureInitiator = seat;
    this.public.phase = PHASE_PROTOCOL_FAILURE;

    this.public.activeSeat = seat;
    this.lastPlayerToAct = this.findPreviousPlayer(seat);

    this.emitEvent('table-data', this.public);

    this.playerSubmittedKeysFailure(keys, seat);
  }

  /**
   * It should be called when a community card does not decrypt.
   * Only the server can call this function.
   */
  enterProtocolFailure() {
    logger.info(`entering protocol failure on phase ${this.public.phase}`);
    this.public.phase = PHASE_PROTOCOL_FAILURE;
    this.lastPlayerToAct = this.public.activeSeat;

    this.emitEvent('table-data', this.public);

    this.actionToNextPlayer();
  }

  /**
   * It sends a WebSocket message to all players in the hand
   * @param  {...any} data - The aguments to send
   */
  emitToPlayersInHand(...data) {
    const { activeSeat, playersInHandCount } = this.public;
    // Tell all players to submit keys
    let currentPlayer = activeSeat;
    for (let i = 0; i < playersInHandCount; i += 1) {
      this.playerSocketEmitter(
        this.seats[currentPlayer].socket,
        ...data,
      );
      currentPlayer = this.findNextPlayer(currentPlayer);
    }
  }

  /**
   * It starts the showdown phase when the players show their hands until a winner is found
   */
  showdown() {
    this.public.phase = PHASE_SHOWDOWN;

    this.pot.addTableBets(this.seats);

    this.logHandHistory(`Showdown [${this.public.board.join(', ')}]`);
    this.logPots();

    let currentPlayer = this.findNextPlayer(this.public.dealerSeat);
    const bestHandRating = 0;
    for (let i = 0; i < this.public.playersInHandCount; i += 1) {
      // Decrypt each player's hand cards, set them at the right place and evaluate the hands.
      const res = this.mentalDeck.decryptCards(
        this.seats[currentPlayer].public.mentalCards,
      );
      if (res.ok) {
        this.emitToPlayersInHand('openShowdownCards', currentPlayer);

        this.logHandHistory(`Shows [${res.cards.join(', ')}]`, currentPlayer);

        this.seats[currentPlayer].cards = res.cards;
        this.seats[currentPlayer].evaluateHand(this.public.board);

        /* If the hand of the current player is the best one yet,
         * he has to show it to the others in order to prove it */
        if (this.seats[currentPlayer].evaluatedHand.rating > bestHandRating) {
          this.seats[currentPlayer].public.cards = this.seats[
            currentPlayer
          ].cards;
        }
      } else {
        logger.warn(`cant decrypt card. ${this.seats[currentPlayer].public.name} submitted bad card keys`);
        this.seats[currentPlayer].fold();
        this.log({
          message:
            `${this.seats[currentPlayer].public.name} submitted bad hand card keys. Removing from hand...`,
          action: '',
          seat: currentPlayer,
          notification: '',
        });
        this.emitEvent('table-data', this.public);
        this.pot.removePlayer(currentPlayer);
        this.logHandHistory('Submitted bad card keys on showdown', currentPlayer);
      }
      currentPlayer = this.findNextPlayer(currentPlayer);
    }

    const messages = this.pot.distributeToWinners(
      this.seats,
      currentPlayer,
      this.playersInHandDealtCards,
    );

    const messagesCount = messages.length;
    for (let i = 0; i < messagesCount; i += 1) {
      this.log({
        message: messages[i],
        action: '',
        seat: '',
        notification: '',
      });
      this.emitEvent('table-data', this.public);
      this.logHandHistory(messages[i]);
    }

    // It will trigger a round restart trough the controller after 2.5 seconds.
    const that = this;
    setTimeout(() => {
      redisGameCl.publish(`table-actions:${this.public.id}`, JSON.stringify({
        do: 'endRound',
        action: that.action,
        round: that.round,
      }));
    }, 7500);
  }

  /**
   * It ends the current phase of the round and starts the next phase
   */
  endPhase() {
    switch (this.public.phase) {
      case PHASE_MENTAL_SHUFFLE:
        this.initializeKeySubmit(); // Start the round
        break;
      case PHASE_KEY_SUBMIT_PREFLOP:
        // The key submit will end on the SB, so advance one seat to the BB
        this.public.activeSeat = this.findNextPlayer(this.public.activeSeat);
        this.initializePreflop();
        break;
      case PHASE_PREFLOP:
      case PHASE_FLOP:
      case PHASE_TURN:
      case PHASE_RIVER:
        this.initializeKeySubmit();
        break;
      case PHASE_KEY_SUBMIT_FLOP:
      case PHASE_KEY_SUBMIT_TURN:
      case PHASE_KEY_SUBMIT_RIVER:
        this.initializeNextPhase();
        break;
      case PHASE_KEY_SUBMIT_SHOWDOWN:
        this.showdown();
        break;
      // no default
    }
  }

  /**
   * When the active player posts the small blind
   * @param {number} handID - The ID of the hand
   */
  playerPostedSmallBlind(handID) {
    this.public.handID = handID;
    this.logHandHistory(`Hand #${handID} started`);
    let currentPlayer = this.public.activeSeat;
    for (let i = 0; i < this.public.playersInHandCount; i += 1) {
      db.query(
        queries.INSERT_PLAYER_INTO_HAND_HISTORY,
        [this.seats[currentPlayer].userID, handID],
        (err) => {
          if (err) logger.error(`error updating hands played ${err}`);
        },
      );
      this.logHandHistory('Sitting in', currentPlayer);
      currentPlayer = this.findNextPlayer(currentPlayer);
    }

    const { activeSeat, smallBlind } = this.public;
    const bet = this.seats[activeSeat].public.chipsInPlay
      >= smallBlind
      ? smallBlind
      : this.seats[activeSeat].public.chipsInPlay;
    this.seats[activeSeat].bet(bet);

    this.log({
      message: `Hand #${handID} started`,
      action: '',
      seat: '',
      notification: '',
    });
    this.emitEvent('table-data', this.public);

    this.log({
      message:
        `${this.seats[activeSeat].public.name} posted the small blind`,
      action: 'bet',
      seat: activeSeat,
      notification: 'Posted blind',
    });
    this.public.biggestBet = this.public.biggestBet < bet ? bet : this.public.biggestBet;
    this.public.biggestRaise = this.public.bigBlind;
    this.emitEvent('table-data', this.public);

    this.logHandHistory(`Posted the small blind ${bet}`, activeSeat);

    this.initializeBigBlind();
  }

  /**
   * When the active player posts the big blind
   */
  playerPostedBigBlind() {
    const { activeSeat, bigBlind } = this.public;
    const bet = this.seats[activeSeat].public.chipsInPlay >= bigBlind
      ? bigBlind
      : this.seats[activeSeat].public.chipsInPlay;

    this.seats[activeSeat].bet(bet);
    this.public.biggestBet = this.public.biggestBet < bet ? bet : this.public.biggestBet;

    // Calculate the biggest raise
    this.public.biggestRaise = this.public.bigBlind;

    this.bigBlindSeat = activeSeat;

    this.log({
      message: `${this.seats[activeSeat].public.name} posted the big blind`,
      action: 'bet',
      seat: activeSeat,
      notification: 'Posted blind',
    });
    this.emitEvent('table-data', this.public);

    this.logHandHistory(`Posted the big blind ${bet}`, activeSeat);

    // Skip the shuffle phase to save time if we have a pre-shuffled deck
    if (this.public.isNextDeckAvailabe) {
      // TODO: Find a better way to skip mental shuffle phase
      this.public.phase = PHASE_MENTAL_SHUFFLE;
      this.mentalDeck = this.nextMentalDeck;
      this.isNextDeckAvailabe = false;
      this.emitToPlayersInHand('useNextMentalDeck');
      this.endPhase();
    } else {
      this.initializeMentalShuffle();
    }
  }

  /**
   * When a player submits all keys.
   * It will check if the submitted keys are correct.
   * If the keys fail to pass the blame function, the player will be penalized.
   * @param {buffer[]} keys The player's full set of keys
   * @param {number} seat The player's seat
   * @return {bool} True is keys are correct, false otherwise
   */
  playerSubmittedAllKeys(keys, seat) {
    // Append the keys to the public keymap
    this.mentalDeck.appendNewKeys(this.seats[seat].public.name, keys);

    // Run the blame func on the full set of keys
    if (
      this.mentalDeck.blame(
        this.seats[seat].public.name,
        this.mentalDeck.keys.get(this.seats[seat].public.name),
        this.seats[seat].public.mentalCards,
      )
    ) {
      // Penalize the player
      this.playerOffended(seat, OFFEND_FOLD_BAD_KEYS);
      return false;
    }

    /* Blame on all keys passes, so we can mark
     * that this player has submitted all keys we care about */
    this.seats[seat].hasSubmittedAllKeys = true;

    return true;
  }

  /**
   * When a player submits his whole key set
   * @param {Buffer[]} keys
   * @param {number} seat
   */
  playerSubmittedAllKeysNotPublic(keys, seat) {
    this.mentalDeck.appendNewKeysNotPublic(this.seats[seat].public.name, keys);

    // TODO: Replace urgent key submit here
  }

  /**
   * Should be call when the active player folds.
   * It will append all the active keys of this player to the public key data structure.
   * Also, it checks if the round should continue after a player has folded.
   * @param {Buffer[]} keys - The keys of the active player
   */
  playerFolded(keys) {
    const { activeSeat } = this.public;
    if (this.playerSubmittedAllKeys(keys, activeSeat)) {
      this.seats[activeSeat].fold();
      this.log({
        message: `${this.seats[activeSeat].public.name} folded`,
        action: 'fold',
        seat: activeSeat,
        notification: 'Fold',
      });
      this.emitEvent('table-data', this.public);
      this.logHandHistory('Folded', activeSeat);

      this.public.playersInHandCount -= 1;
      this.pot.removePlayer(activeSeat);

      if (this.seats[activeSeat].sitOutNextHand) {
        this.playerSatOut(activeSeat);
      }

      if (this.public.playersInHandCount <= 1) {
        this.pot.addTableBets(this.seats);
        const winnersSeat = this.findNextPlayer();
        // Give the pot to the winner and log the event
        const message = this.pot.giveToWinner(
          this.seats[winnersSeat],
          this.public.phase,
          this.playersInHandDealtCards,
        );
        this.log({
          message,
          action: '',
          seat: '',
          notification: '',
        });
        this.emitEvent('table-data', this.public);
        this.logHandHistory(message);

        this.endRound();
      } else if (this.lastPlayerToAct === this.public.activeSeat) {
        this.endPhase();
      } else {
        this.actionToNextPlayer();
      }
    }
  }

  /**
   * When a player checks
   */
  playerChecked() {
    const { activeSeat } = this.public;
    this.log({
      message: `${this.seats[activeSeat].public.name} checked`,
      action: 'check',
      seat: activeSeat,
      notification: 'Check',
    });
    this.emitEvent('table-data', this.public);
    this.logHandHistory('Checked', activeSeat);

    if (this.lastPlayerToAct === activeSeat) {
      this.endPhase();
    } else {
      this.actionToNextPlayer();
    }
  }

  /**
   * When a player is all-in and we skip his turn
   */
  skipPlayer() {
    const { activeSeat } = this.public;

    logger.debug(`skipping ${this.seats[activeSeat].public.name}'s turn`);

    if (this.lastPlayerToAct === activeSeat) {
      this.endPhase();
    } else {
      this.actionToNextPlayer();
    }
  }

  /**
   * When a player calls
   */
  playerCalled() {
    const { activeSeat } = this.public;
    const calledAmount = this.public.biggestBet - this.seats[this.public.activeSeat].public.bet;
    this.seats[activeSeat].bet(calledAmount);

    this.log({
      message: `${this.seats[activeSeat].public.name} called`,
      action: 'call',
      seat: activeSeat,
      notification: 'Call',
    });
    this.emitEvent('table-data', this.public);

    this.logHandHistory(`Called ${calledAmount}`, activeSeat);

    if (this.lastPlayerToAct === activeSeat) {
      logger.debug(
        `Player called all other are all in: ${this.otherPlayersAreAllIn()}. Last to act: ${this
          .lastPlayerToAct === activeSeat}. Ending phase`,
      );
      this.endPhase();
    } else {
      this.actionToNextPlayer();
    }
  }

  /**
   * It checks if the bet/raise amount is valid
   * @param {number} amount - The bet/raise amount
   * @returns {bool} True if the amount is valid. False otherwise
   */
  isValidBet(amount) {
    const { chipsInPlay, bet } = this.seats[this.public.activeSeat].public;
    const { biggestBet, bigBlind, biggestRaise } = this.public;
    if (amount
      && isFinite(amount)
      && amount > 0
      && amount <= chipsInPlay + bet
    ) {
      // If the pot is betted/raised
      if (biggestBet > 0) {
        // If the bet is too big, the player's only option is to call all-in, he can't raise
        if (biggestBet >= chipsInPlay + bet) {
          return false;
        }

        const minRaise = biggestBet + biggestRaise;
        // Min raise
        if (chipsInPlay + bet >= minRaise) {
          // Max raise in PLO is the pot size
          if (this.public.gameMode === GAME_MODE_PLO) {
            // Find the size of the pot
            const inMiddleOfTable = this.pot.getTotalAmount();
            const inFrontOfPlayers = this.seats
              .filter(s => s !== null)
              .map(s => s.public.bet)
              .reduce((sum, current) => sum + current);

            // active seat call amount
            const callAmount = biggestBet === 0 ? 0 : biggestBet - bet;

            // pot = inFrontOfPlayers + inMiddleOfTable
            return amount >= minRaise
            && amount <= inFrontOfPlayers + inMiddleOfTable + callAmount + biggestBet;
          }

          return amount >= minRaise; // Amount must be higher than the minim raise amt
        }

        // If player doesn't have enough chips, the only raise is all in
        return (amount === chipsInPlay + bet);
      }
      // The min bet amount is the BB
      if (chipsInPlay >= bigBlind) {
        // The max bet amount is the pot
        if (this.public.gameMode === GAME_MODE_PLO) {
          // Find the size of the pot
          const inMiddleOfTable = this.pot.getTotalAmount();
          const inFrontOfPlayers = this.seats
            .filter(s => s !== null)
            .map(s => s.public.bet)
            .reduce((sum, current) => sum + current);

          // pot = inFrontOfPlayers + inMiddleOfTable
          return amount >= bigBlind && amount <= inMiddleOfTable + inFrontOfPlayers;
        }
        return amount >= bigBlind;
      }


      // If the player has chips < BB, the only move is all in
      return (amount === chipsInPlay);
    }

    return false;
  }

  /**
   * When a player bets
   */
  playerBetted(amount) {
    const { activeSeat } = this.public;
    this.seats[activeSeat].bet(amount);
    this.public.biggestBet =
      this.public.biggestBet < this.seats[activeSeat].public.bet
        ? this.seats[activeSeat].public.bet
        : this.public.biggestBet;

    this.public.biggestRaise = this.public.biggestBet;

    this.log({
      message: `${this.seats[activeSeat].public.name} bet ${amount}`,
      action: 'bet',
      seat: activeSeat,
      notification: `Bet ${amount}`,
    });
    this.emitEvent('table-data', this.public);

    this.logHandHistory(`Betted ${amount}`, activeSeat);

    const previousPlayerSeat = this.findPreviousPlayer();
    if (previousPlayerSeat === activeSeat) {
      this.endPhase();
    } else {
      this.lastPlayerToAct = previousPlayerSeat;
      logger.debug(
        `Player betted. Setting last player to act ${
          this.seats[this.lastPlayerToAct].public.name
        }`,
      );
      this.actionToNextPlayer();
    }
  }

  /**
   * When a player raises
   */
  playerRaised(raiseToAmount) {
    const { activeSeat } = this.public;
    const amount = raiseToAmount - this.seats[activeSeat].public.bet;

    this.seats[activeSeat].raise(amount);
    const oldBiggestBet = this.public.biggestBet;
    this.public.biggestBet = this.public.biggestBet < this.seats[activeSeat].public.bet
      ? this.seats[activeSeat].public.bet
      : this.public.biggestBet;

    const raiseTableAmount = this.public.biggestBet - oldBiggestBet;
    if (this.public.biggestRaise < raiseTableAmount) this.public.biggestRaise = raiseTableAmount;
    this.log({
      message:
        `${this.seats[activeSeat].public.name} raised to ${this.public.biggestBet}`,
      action: 'raise',
      seat: activeSeat,
      notification: `Raise ${raiseTableAmount}`,
    });
    this.emitEvent('table-data', this.public);

    this.logHandHistory(`Raised to ${raiseToAmount}, (${amount} more)`, activeSeat);

    const previousPlayerSeat = this.findPreviousPlayer();
    if (previousPlayerSeat === activeSeat) {
      this.endPhase();
    } else {
      this.lastPlayerToAct = previousPlayerSeat;
      logger.debug(
        `Player raised. Setting last player to act ${this.seats[this.lastPlayerToAct].public.name}`,
      );
      this.actionToNextPlayer();
    }
  }

  /**
   * Adds the player to the table
   * @param {Object} player - The player object
   * @param {number} seat - The seat where the player sat
   * @param {number} chips - How many chips the player sat in with
   */
  playerSatOnTheTable(player, seat, chips) {
    this.seats[seat] = player;
    this.public.seats[seat] = player.public;

    this.seats[seat].sitOnTable(this.public.id, seat, chips);

    // Increase the counters of the table
    this.public.playersSeatedCount += 1;

    // Log the event in database
    db.query(
      queries.INSERT_SIT_IN_INTO_TABLE_HISTORY,
      [player.userID, this.public.bigBlind, this.public.smallBlind, chips],
      (err) => {
        if (err) logger.error(`error inserting user into table history ${err}`);
      },
    );

    this.playerSatIn(seat);
  }

  /**
   * When a player re-buys
   * @param {number} seat - The seat which re-buys
   * @param {number} amount - The amount which it re-buys with
   */
  playerReBuys(seat, amount) {
    const chipsToAdd = amount - this.seats[seat].public.chipsInPlay;
    if (this.seats[seat].public.inHand || chipsToAdd <= 0) {
      return;
    }

    this.seats[seat].addChips(chipsToAdd);
    this.log({
      message: `${this.seats[seat].public.name} re-buys with ${amount}`,
      action: '',
      seat: '',
      notification: '',
    });
    this.emitEvent('table-data', this.public);
  }

  /**
   * Adds a player who is sitting on the table, to the game
   * @param {number} seat
   */
  playerSatIn(seat) {
    if (this.seats[seat] && this.seats[seat].public.chipsInPlay > 0) {
      // The player is sitting in
      this.seats[seat].public.sittingIn = true;
      this.playersSittingInCount += 1;
      this.seats[seat].sittingOutRounds = 0;

      // Invalidate pre-shuffled deck when a new player joins, as he hasn't shuffled
      if (this.public.isNextDeckAvailabe || this.public.isBackgroundShuffling) {
        logger.debug(`${this.seats[seat].public.name} joined table during/after background shuffle, invalidating next deck.`);
        this.invalidateNextMentalDeck();
      }

      this.log({
        message: `${this.seats[seat].public.name} sat in`,
        action: '',
        seat: '',
        notification: '',
      });
      this.emitEvent('table-data', this.public);

      this.logHandHistory('Sat in', seat);

      // If there are no players playing right now, try to initialize a game with the new player
      if (!this.gameIsOn && this.playersSittingInCount > 1) {
      // Initialize the game
        this.initializeRound(false);
      }
    }
  }

  /**
   * When a player forcibly disconnects from the game.
   *
   * @param {number} seat - The seat this player is sitting on
   */
  playerDisconnected(seat) {
    const { activeSeat } = this.public;

    // If the player is in the hand, don't leave him
    if (this.seats[seat] && !this.seats[seat].public.inHand) {
      // The player is not in the hand so he can leave
      this.playerLeft(seat);
    } else {
      this.log({
        message: `${this.seats[seat].public.name} disconnected`,
        action: '',
        seat: '',
        notification: '',
      });
      this.emitEvent('table-data', this.public);
      this.logHandHistory('Disconnected', seat);
    }

    if (this.seats[seat]
      && this.seats[seat].public.inHand
      && this.public.activeSeat === seat
      && this.public.phase !== PHASE_SMALL_BLIND
      && this.public.phase !== PHASE_BIG_BLIND
      && this.public.phase !== PHASE_MENTAL_SHUFFLE) {
      // The player is in the hand and it's his turn so we give him more time to reconnect
      // NOTE: This timer culd be extended potentially forever- should we limit it to only 1 extension?
      this.timeActivePlayer();

      this.log({
        message: `Waiting for ${this.seats[activeSeat].public.name} to reconnect...`,
        action: '',
        seat: '',
        notification: '',
      });
      this.emitEvent('table-data', this.public);
    }
  }

  /**
   * When a player reconnects with a new socket ID
   * @param {number} seat - The seat which reconnected
   * @param {string} socketID - The new socket ID
   */
  playerReconnected(seat, socketID) {
    logger.debug(`${this.seats[seat].public.name} is reconnected with socket ${socketID}`);
    this.seats[seat].socket = socketID;

    this.log({
      message: `${this.seats[seat].public.name} reconnected`,
      action: '',
      seat: '',
      notification: '',
    });
    this.emitEvent('table-data', this.public);
    this.logHandHistory('Reconnected', seat);

    if (this.public.phase === PHASE_BIG_BLIND
      || this.public.phase === PHASE_SMALL_BLIND) {
      this.playerSocketEmitter(this.seats[seat].socket, 'prepareForNewRound');
    } else {
      if (this.public.phase === PHASE_KEY_SUBMIT_PREFLOP) {
        // If the player reconnects on this phase,
        // it is likely that he has missed the mental cards dealing
        this.playerSocketEmitter(
          this.seats[seat].socket,
          'dealingMentalCards',
          this.seats[seat].public.mentalCards,
        );
      }

      // Send the latest mental deck data to the player
      this.playerSocketEmitter(
        this.seats[seat].socket,
        'mental-deck-data',
        {
          history: this.mentalDeck.history,
          dealt: this.mentalDeck.dealt,
          communityCards: this.mentalDeck.communityCards,
          transportKeys: Array.from(this.mentalDeck.keys),
        },
      );
    }

    // Helps us prevent penalties in some cases
    if (this.askedForKeys
      && this.askedForKeys.action === this.action
      && this.askedForKeys.round === this.round) {
      this.playerSocketEmitter(this.seats[seat].socket, 'urgentKeySubmit');
    }

    // NOTE: We could also ask for urgent key submit here

    // If the active seat reconnects we resend the action request
    if (seat === this.public.activeSeat) {
      this.requestActionFromActivePlayer();
    }

    /* If a player disconnects it is possible that he has not received the next mental deck full
     * history. And if the next mental deck is not available for him
     * this will lead to errors */
    if (this.public.isNextDeckAvailabe) {
      this.playerSocketEmitter(this.seats[seat].socket,
        'next-mental-deck-data',
        {
          history: this.nextMentalDeck.history,
        });
    }

    this.emitEvent('table-data', this.public);
  }

  /**
   * It will return true if the player must be penalized if he leaves now
   * @param {number} seat - The seat of the leaving player
   */
  shouldPenalizeLeave(seat) {
    return this.public.phase !== null
      && this.public.phase !== PHASE_SHOWDOWN
      && this.public.phase !== PHASE_SMALL_BLIND
      && this.public.phase !== PHASE_BIG_BLIND
      && this.public.phase !== PHASE_RIVER
      && this.public.phase !== PHASE_KEY_SUBMIT_SHOWDOWN
      && this.seats[seat].public.inHand // This guy is in a hand
      && this.public.playersInHandCount > 2 // Don't penalize disconnection if that's heads up
      && !this.mentalDeck.hasSubmittedAllKeys(
        this.seats[seat].public.name,
        this.seats[seat].public.mentalCards,
      );
  }

  /**
   * Changes the data of the table when a player leaves
   * @param {number} seat
   */
  playerLeft(seat) {
    // If someone is really sitting on that seat
    if (this.seats[seat] && this.seats[seat].public.name) {
      logger.debug(
        `${this.seats[seat].public.name} is leaving. Seat in hand: ${
          this.seats[seat].public.inHand
        }. Players in hand: ${this.public.playersInHandCount}`,
      );
      logger.debug(
        `leaving player submitted all keys? ${this.mentalDeck.hasSubmittedAllKeys(
          this.seats[seat].public.name,
          this.seats[seat].public.mentalCards,
        )}`,
      );
      // If there are players, check if the player has submitted his keys
      if (this.shouldPenalizeLeave(seat)) {
        this.playerOffended(seat, OFFEND_DISCONNECT);
        /* If the player disconnected without submitting all keys,
         * we don't want to continue execution so stop here and penalize him.
         * After penalty is made, we'll call this func again */
        return;
      } // TODO: Make an else statement instead of returning here

      this.removePlayerFromTable(seat);

      logger.debug(`emptying seats, players seated count: ${this.public.playersSeatedCount}, players in hand count: ${this.public.playersInHandCount}`);

      // If a player left a heads-up match and there are people waiting to play, start a new round
      if (this.public.playersInHandCount < 2 && this.gameIsOn) {
        logger.debug('players in hand count are less than 2, endng round');
        this.endRound();
      } else if ( // Else if the player was the last to act in this phase, end the phase
        this.lastPlayerToAct === seat
        && this.public.activeSeat === seat
      ) {
        logger.debug('the player that left was last to act, ending phase');
        // Progress to the next player active, as this one is now null
        this.public.activeSeat = this.findNextPlayer(this.public.activeSeat);
        this.endPhase();
      }
    }
  }

  /**
   * Removes the selected player from the table
   */
  removePlayerFromTable(seat) {
    // Log the event in database
    db.query(
      queries.INSERT_SIT_OUT_INTO_TABLE_HISTORY,
      [
        this.seats[seat].userID,
        this.public.bigBlind,
        this.public.smallBlind,
        this.seats[seat].public.chipsInPlay,
      ],
      (err) => {
        if (err) logger.error(`error inserting user leaving into table history ${err}`);
      },
    );

    // Remember the stack of this player for 2 hours
    redisGameCl.set(`minstack:${this.public.id}:${this.seats[seat].userID}`, this.seats[seat].public.chipsInPlay, 'EX', 60 * 60 * 2);

    this.log({
      message: `${this.seats[seat].public.name} left`,
      action: '',
      seat: '',
      notification: '',
    });

    this.logHandHistory('Left', seat);

    // If the player is sitting in, make them sit out first
    if (this.seats[seat].public.sittingIn) {
      logger.debug('leaving player is being seated out');
      this.playerSatOut(seat, true);
    }

    this.seats[seat].fold();
    this.seats[seat].leaveTable();

    /* Tell other containers that a player has left.
     * This is how we update the player sittingOnTable data
     * once a player is kicked or has left the game */
    redisGameCl.publish(`kick-player:${this.public.id}`, JSON.stringify({
      username: this.seats[seat].public.name,
      socketID: this.seats[seat].socket,
    }));

    // Empty the seat
    this.public.seats[seat] = null;
    this.public.playersSeatedCount -= 1;

    // If there are not enough players to continue the game
    if (this.public.playersSeatedCount < 2) {
      this.public.dealerSeat = null;
    }

    this.seats[seat] = null;

    this.emitEvent('table-data', this.public);
  }

  /**
   * It will signal to the table that this player intends to stand up
   * @param {number} seat - The seat to unsit when possible
   */
  sitOutNextHand(seat) {
    this.seats[seat].sitOutNextHand = true;
  }

  /**
   * It will invalidate the pre-shuffled deck
   */
  invalidateNextMentalDeck() {
    this.public.isBackgroundShuffling = false;
    this.public.isNextDeckAvailabe = false;
    this.nextMentalDeck = new MentalDeck();
    this.nextShuffleActiveSeat = null;
  }

  /**
   * Changes the data of the table when a player sits out
   * @param {number} seat - the numeber of the seat
   * @param {bool} playerLeft - flag that shows that the player actually left the table
   */
  playerSatOut(seat, playerLeft = false) {
    // If the player didn't leave, log the action as 'player sat out'
    if (!playerLeft) {
      this.log({
        message: `${this.seats[seat].public.name} sat out`,
        action: '',
        seat: '',
        notification: '',
      });
      this.emitEvent('table-data', this.public);

      this.logHandHistory('Sat out', seat);
    }

    // If the player had betted, add the bets to the pot
    if (this.seats[seat].public.bet) {
      this.pot.addPlayersBets(this.seats[seat]);
    }
    this.pot.removePlayer(seat);

    // If the player was in the pre-shuffle invalidate the deck
    if ((this.public.isBackgroundShuffling || this.public.isNextDeckAvailabe)
      && this.nextShuffleSeats.includes(seat)) {
      logger.debug(`${this.seats[seat].public.name} left during/after background shuffle, invalidating next deck.`);
      this.invalidateNextMentalDeck();
    }

    this.playersSittingInCount -= 1;

    if (this.seats[seat].public.inHand) {
      this.seats[seat].sitOut();
      this.public.playersInHandCount -= 1;

      if (this.public.playersInHandCount < 2) {
        if (!playerLeft) {
          this.endRound();
        }
      } else {
        // If the player was not the last player to act but they were the player who should act in this round
        if (this.public.activeSeat === seat && this.lastPlayerToAct !== seat) {
          this.actionToNextPlayer();
        } else if ( this.lastPlayerToAct === seat && this.public.activeSeat === seat) {
          // If the player was the last player to act and they left when they had to act
          if (!playerLeft) {
            this.endPhase();
          }
        } else if (this.lastPlayerToAct === seat) { // If the player was the last to act but not the player who should act
          this.lastPlayerToAct = this.findPreviousPlayer(this.lastPlayerToAct);
        }
      }
    } else {
      this.seats[seat].sitOut();
    }

    this.emitEvent('table-data', this.public);
  }

  /**
   * @return {bool} True if all players are all in
   */
  otherPlayersAreAllIn() {
    // Check if the players are all in
    let currentPlayer = this.public.activeSeat;
    let playersAllIn = 0;
    for (let i = 0; i < this.public.playersInHandCount; i += 1) {
      if (this.seats[currentPlayer].public.chipsInPlay === 0) {
        playersAllIn += 1;
      }
      currentPlayer = this.findNextPlayer(currentPlayer);
    }

    // In this case, all the players are all in. There should be no actions. Move to the next round.
    return playersAllIn >= this.public.playersInHandCount - 1;
  }

  /**
   * Removes all player's hole cards from table data
   */
  removeAllCardsFromPlay() {
    // For each seat
    for (let i = 0; i < this.public.seatsCount; i += 1) {
      // If a player is sitting on the current seat
      if (this.seats[i] !== null) {
        this.seats[i].cards = [];
        this.seats[i].public.hasCards = false;
        this.seats[i].public.inHand = false;
      }
    }
  }

  /**
   * Kicks all player from the table and sends a socket notification
   */
  kickAllPlayers() {
    for (let i = 0; i < this.public.seatsCount; i += 1) {
      if (this.seats[i]) {
        this.playerSocketEmitter(
          this.seats[i].socket,
          'kicked',
          JSON.stringify({
            title: 'You have been removed from the table.',
            body: 'The game entered maintance mode.',
          }),
        );

        this.removePlayerFromTable(i);
      }
    }
    this.public.dealerSeat = null;
  }

  /**
   * Actions that should be taken when the round has ended
   */
  endRound() {
    logger.debug('endig round');

    this.log({
      message: `Hand #${this.public.handID} ended.`,
      action: '',
      seat: '',
      notification: '',
    });
    this.emitEvent('table-data', this.public);

    this.logHandHistory(`Hand #${this.public.handID} ended.`);

    this.clearTimeouts();
    this.actionLog = null; // Clear the actions log

    // If the hand ended before the next deck was shuffled
    // Update the variables to hide the shuffling messages in the UI
    if (this.public.isBackgroundShuffling) {
      this.public.isBackgroundShuffling = false;
      this.public.isNextDeckAvailabe = false;
    }

    this.public.handID = null;

    // If there were any bets, they are added to the pot
    this.pot.addTableBets(this.seats);
    if (!this.pot.isEmpty()) {
      const winnersSeat = this.findNextPlayer(0);
      this.pot.giveToWinner(
        this.seats[winnersSeat],
        this.public.phase,
        this.playersInHandDealtCards,
      );
    }

    this.public.playersInHandCount = 0;
    this.playersInHandDealtCards = 0;
    for (let seat = 0; seat < this.public.seatsCount; seat += 1) {
      if (this.seats[seat]) {
        // Mark inHand to false since we may unseat some players
        // not to trigger actions from playerSatOut func
        this.seats[seat].public.inHand = false;

        // Sitting out the players who don't have chips
        if ((this.seats[seat].public.chipsInPlay <= 0
          && this.seats[seat].public.sittingIn) || this.seats[seat].sitOutNextHand) {
          this.playerSatOut(seat);
        }

        // Increment rounds for sitted out players and kick if sitting out for too long
        if (!this.seats[seat].public.sittingIn) {
          this.seats[seat].sittingOutRounds += 1;

          if (this.seats[seat].sittingOutRounds === 11) {
            this.playerSocketEmitter(
              this.seats[seat].socket,
              'kicked',
              JSON.stringify({
                title: 'You have been removed from the table.',
                body: 'You have been sitting out for more than ten rounds.',
              }),
            );

            this.removePlayerFromTable(seat);
          }
        }
      }
    }

    // If we're in update mode, make all players leave
    if (this.updateMode) {
      this.kickAllPlayers();
    }

    // If there are not enough players to continue the game, stop it
    if (this.playersSittingInCount < 2) {
      this.stopGame();
    } else {
      this.initializeRound();
    }
  }

  /**
   * It stops the game
   */
  stopGame() {
    this.public.dealerSeat = null;
    this.public.phase = null;
    this.pot.reset();
    this.public.activeSeat = null;
    this.public.board = ['', '', '', '', ''];
    this.lastPlayerToAct = null;
    this.removeAllCardsFromPlay();
    this.gameIsOn = false;
    this.clearTimeouts();
    this.public.playersInHandCount = 0;
    this.playersInHandDealtCards = 0;
    this.emitEvent('gameStopped', this.public);
  }

  /**
   * Logs the last event
   */
  log(log) {
    this.public.log = null;
    this.public.log = log;
  }
}

module.exports = Table;
