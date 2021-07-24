const db = require('../db');
const queries = require('../db/queries');
const logger = require('../logger');
const { findBestPokerHandOnBoard } = require('../utils/helpers');

/**
 * The player "class"
 * @param {string} id - The player's id, never changes
 * @param {string} socket - The current socket of the player
 * @param {string} name - The user's screen name
 * @param {number} chips - The total amount of chip the user has
 * @param {string} session - The secret session token of the user
 */
class Player {
  constructor(socket, userID, username, chips, session) {
    this.public = {
      // The name of the user
      name: username,
      // The chips that the player plays on the table
      chipsInPlay: 0,
      // Flag that shows whether a player who is sitting on the table, wants to be dealt cards
      sittingIn: false,
      // Flag that shows if the player is playing in the current round
      inHand: false,
      // Flag that shows if the player is holding cards
      hasCards: false,
      // The cards the player is holding, made public at the showdown
      cards: [],
      // The indexes of mental cards this player is holding
      mentalCards: [],
      // The amount the player has betted in the current round
      bet: 0,
    };
    // The userID of the player
    this.userID = userID;
    // The socket ID of this player
    this.socket = socket;
    // The secret session token of the player
    this.session = session;
    // The chips that are available in the user's account
    this.chips = chips;
    // The room that send the table events to the player
    this.room = null;
    // Set to false if the player is not sitting on any tables, otherwise it's set to the table id
    this.sittingOnTable = false;
    // The number of the seat of the table that the player is sitting
    this.seat = null;
    // The cards that the player is holding
    this.cards = [];
    // The hand that the player has in the current poker round and its rating
    this.evaluatedHand = {};
    // True if this player has submitted all his shuffle keys
    this.hasSubmittedAllKeys = false;
    // How much time it takes on average for this player to shuffle cards and submit keys
    this.avgTimeShuffle = 0;
    // The total shuffles and key submissions done by this player
    this.totalShuffles = 0;
    // Whether the player should be seated out on the next dealing
    this.sitOutNextHand = false;
    // For how many rounds has this player been sitting out. If too many we kick him
    this.sittingOutRounds = 0;
  }

  /**
   * Updates the player data when they leave the table
   */
  leaveTable() {
    if (this.sittingOnTable !== false) {
      this.sitOut();

      const uID = this.userID;
      const { chipsInPlay } = this.public;

      logger.debug(`${this.public.name} is leaving with balance ${chipsInPlay}`);

      // Update the db balances
      db.query(
        queries.UPDATE_BALANCES_INCREMENT_ACCOUNT_DECREMENT_INGAME,
        [chipsInPlay, uID],
        (err) => {
          if (err) {
            // What to do when this fails? Balance will be stuck ingame.
            logger.error(`error updating player balance. leaving player ${this.public.name} was leaving with chips ${chipsInPlay}. err :${err}`);
          }
        },
      );

      // Remove the chips from play
      this.chips += this.public.chipsInPlay;
      this.public.chipsInPlay = 0;

      // Remove the player from the table
      this.sittingOnTable = false;
      this.seat = null;
    }
  }

  /**
   * Sits the player on the table
   * @param string - tableID
   * @param number - seat
   * @param number - chips
   */
  sitOnTable(tableID, seat, chips) {
    // Remove the chips that player will have on the table, from the player object
    this.chips -= chips;
    this.public.chipsInPlay = chips;
    this.seat = seat;
    this.sittingOnTable = tableID;
  }

  addChips(chips) {
    this.public.chipsInPlay += chips;
  }

  /**
   * Updates the player data when they sit out
   */
  sitOut() {
    if (this.sittingOnTable !== false) {
      this.public.sittingIn = false;
      this.public.inHand = false;
      this.public.hasCards = false;
      this.public.cards = [];
      this.public.mentalCards = [];
      this.sitOutNextHand = false;
    }
  }

  /**
   * The action of folding the hand
   */
  fold() {
    // The player has no cards now
    this.cards = [];
    this.public.hasCards = false;
    this.public.inHand = false;
  }

  /**
   * The action of betting
   * @param {number} amount
   */
  bet(amt) {
    let amount = parseInt(amt, 10);
    if (amount > this.public.chipsInPlay) {
      amount = this.public.chipsInPlay;
    }
    this.public.chipsInPlay -= amount;
    this.public.bet += amount;

    logger.silly(
      `user ${this.public.name}, uid: ${
        this.userID
      }; bets ${amount}; current balance: ${this.public.chipsInPlay}`
    );

    db.query(
      queries.UPDATE_BALANCES_DECREMENT_INGAME,
      [amount, this.userID],
      (err) => {
        if (err) logger.error(`error updating balances when betting ${err}`);
      },
    );
  }

  /**
   * The action of raising
   * @param {number} amount - The additional amount player raises
   */
  raise(amount) {
    amount = parseInt(amount);
    if (amount > this.public.chipsInPlay) {
      amount = this.public.chipsInPlay;
    }
    // TODO: Update chips in play in PG
    this.public.chipsInPlay -= amount;
    this.public.bet += +amount;

    logger.debug(`user ${this.public.name}, uid: ${this.userID}; bets ${amount}; current balance: ${this.public.chipsInPlay}`);

    db.query(
      queries.UPDATE_BALANCES_DECREMENT_INGAME,
      [amount, this.userID],
      (err) => {
        if (err) logger.error(`error updating balances when raising ${err}`);
      },
    );
  }

  /**
   * Resets the player's round data
   */
  prepareForNewRound() {
    this.cards = [];
    this.public.cards = [];
    this.public.mentalCards = [];
    this.public.hasCards = false;
    this.public.bet = 0;
    this.public.inHand = true;
    this.evaluatedHand = {};
    this.hasSubmittedAllKeys = false;
    this.sittingOutRounds = 0;
  }

  /**
   * Returns the player's hand and its rating
   * @param {array} - board (the cards that are on the board in the current round)
   * @return object this (for chaining)
   */
  evaluateHand(board) {
    this.evaluatedHand = findBestPokerHandOnBoard(this.cards, board);
  }
}
module.exports = Player;
