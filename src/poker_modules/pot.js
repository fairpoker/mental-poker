/* eslint no-param-reassign: ['error', { 'props': false }] */
const db = require('../db');
const queries = require('../db/queries');
const logger = require('../logger');
const { getRake, getMaxRake } = require('../utils/helpers');

/**
 * The pot object
 */
class Pot {
  constructor(tableID, bigBlind, seatsCount, maxBuyIn, isNoRake = false) {
    // The pot may be split to several amounts, since not all players
    // have the same money on the table
    // Each portion of the pot has an amount and an array of the
    // contributors (players who have betted in the pot and can
    // win it in the showdown)
    this.pots = [
      {
        amount: 0,
        contributors: [],
      },
    ];

    this.tableID = tableID;
    this.bigBlind = bigBlind;
    this.seatsCount = seatsCount;
    this.maxBuyIn = maxBuyIn;
    this.isNoRake = isNoRake;
  }

  /**
   * Method that resets the pot to its initial state
   */
  reset() {
    this.pots.length = 1;
    this.pots[0].amount = 0;
    this.pots[0].contributors = [];
  }

  /**
   * It rakes the pot
   * @param {number} winnings - The pot value
   * @param {number} userID - The ID if the user
   * @param {number} playersDealtCards - How many players were dealt in the hand
   */
  takeRake(winnings, userID, playersDealtCards) {
    // If this is a no rake table just return all winnings as they are
    if (this.isNoRake) return winnings;

    const rakeAmount = getRake(this.bigBlind, playersDealtCards);
    const maxRake = getMaxRake(this.bigBlind, playersDealtCards);

    const rake = Math.min(
      Math.ceil(winnings * rakeAmount),
      maxRake,
    );
    const remain = winnings - rake;

    logger.debug(`user ${userID} won ${winnings} taking rake ${rakeAmount}: ${rake}. remaining: ${remain}, max rake ${maxRake}`);
    db.query(
      queries.INSERT_RAKE_HISTORY,
      [rake, this.bigBlind, userID],
      (err) => {
        if (err) logger.error(`error inserting into rake history ${err}`);
      },
    );

    return remain;
  }

  /**
   * Method that gets the bets of the players and adds them to the pot
   * @param {array} players - the array of the tables as it exists in the table
   */
  addTableBets(players) {
    // Getting the current pot (the one in which new bets should be added)
    const currentPot = this.pots.length - 1;

    // The smallest bet of the round
    let smallestBet = 0;
    // Flag that shows if all the bets have the same amount
    let allBetsAreEqual = true;
    // Flag that shows if at least one player is all-in
    let isPlayerAllIn = false;

    // Trying to find the smallest bet of the player
    // and if all the bets are equal
    players.forEach((p) => {
      if (p && p.public.bet > 0) {
        isPlayerAllIn = isPlayerAllIn || p.public.chipsInPlay === 0;

        // Compare the lowest bet only if the player is in the hand
        if (p.public.inHand) {
          if (smallestBet === 0) {
            smallestBet = p.public.bet;
          } else if (p.public.bet !== smallestBet) {
            allBetsAreEqual = false;

            if (p.public.bet < smallestBet) {
              smallestBet = p.public.bet;
            }
          }
        } else {
          // If the player has just folded, add his bet to the pot and remove him
          this.addPlayersBets(p);
          this.removePlayer(p.seat);
        }
      }
    });

    // If all the bets are equal, then remove the bets of the players and add
    // them to the pot as they are
    if (allBetsAreEqual) {
      players.forEach((p) => {
        if (p && p.public.bet > 0) {
          this.pots[currentPot].amount += p.public.bet;
          p.public.bet = 0;
          if (!this.pots[currentPot].contributors.includes(p.seat)) {
            this.pots[currentPot].contributors.push(p.seat);
          }
        }
      });

      if (isPlayerAllIn) {
        // Creating a new pot
        this.pots.push({
          amount: 0,
          contributors: [],
        });
      }
    } else {
      // If not all the bets are equal, remove from each player's bet the smallest bet
      // amount of the table, add these bets to the pot and then create a new empty pot
      // and recursively add the bets that remained, to the new pot
      players.forEach((p) => {
        if (p && p.public.bet > 0) {
          this.pots[currentPot].amount += smallestBet;
          p.public.bet -= smallestBet;
          if (!this.pots[currentPot].contributors.includes(p.seat)) {
            this.pots[currentPot].contributors.push(p.seat);
          }
        }
      });

      // Creating a new pot
      this.pots.push({
        amount: 0,
        contributors: [],
      });

      // Recursion
      this.addTableBets(players);
    }
  }

  /**
   * Adds the player's bets to the pot
   * @param {Player} player - The player whose bet to add
   */
  addPlayersBets(player) {
    // Getting the current pot (the one in which new bets should be added)
    const currentPot = this.pots.length - 1;

    this.pots[currentPot].amount += player.public.bet;
    player.public.bet = 0;
    // If the player is not in the list of contributors, add them
    if (!this.pots[currentPot].contributors.includes(player.seat)) {
      this.pots[currentPot].contributors.push(player.seat);
    }
  }

  /**
   * It will distribute the pot to the winning players on showdown
   *
   * @param {array} players - The player objects
   * @param {number} firstPlayerToAct - The first player to act seat
   * @param {number} playersDealtCards - The number of players dealt cards
   */
  distributeToWinners(players, firstPlayerToAct, playersDealtCards) {
    const potsCount = this.pots.length;
    const messages = [];

    // For each one of the pots, starting from the last one
    for (let i = potsCount - 1; i >= 0; i -= 1) {
      let winners = [];
      let bestRating = 0;
      const playersCount = players.length;
      for (let j = 0; j < playersCount; j += 1) {
        if (
          players[j]
          && players[j].public.inHand
          && this.pots[i].contributors.indexOf(players[j].seat) >= 0
        ) {
          if (players[j].evaluatedHand.rating > bestRating) {
            bestRating = players[j].evaluatedHand.rating;
            winners = [players[j].seat];
          } else if (players[j].evaluatedHand.rating === bestRating) {
            winners.push(players[j].seat);
          }
        }
      }
      if (winners.length === 1) {
        // Take the rake from the pot
        this.pots[i].amount = this.takeRake(
          this.pots[i].amount,
          players[winners[0]].userID,
          playersDealtCards,
        );

        // Update the public balance in the ng app and in the db
        players[winners[0]].public.chipsInPlay += this.pots[i].amount;
        db.query(
          queries.UPDATE_BALANCES_INCREMENT_INGAME,
          [this.pots[i].amount, players[winners[0]].userID],
          (err) => {
            if (err) logger.error(`error updating balances ${err}`);
          },
        );

        let htmlHand = `[ ${players[winners[0]].evaluatedHand.cards.join(', ')}]`;
        htmlHand = htmlHand
          .replace(/s/g, '&#9824;')
          .replace(/c/g, '&#9827;')
          .replace(/h/g, '&#9829;')
          .replace(/d/g, '&#9830;');
        messages.push(`${players[winners[0]].public.name} wins the pot (${this.pots[i].amount}) with ${players[winners[0]].evaluatedHand.name} ${htmlHand}`);
      } else {
        const winnersCount = winners.length;

        const winnings = Math.floor(this.pots[i].amount / winnersCount);
        const oddChip = winnings * winnersCount !== this.pots[i].amount;

        winners.forEach((winner) => {
          let playersWinnings = 0;
          if (oddChip && players[winner].seat === firstPlayerToAct) {
            playersWinnings = winnings + 1;
          } else {
            playersWinnings = winnings;
          }

          // Take the rake
          logger.debug(`playersWinnings before rake ${playersWinnings}`);
          playersWinnings = this.takeRake(
            playersWinnings,
            players[winner].userID,
            playersDealtCards,
          );
          logger.debug(`playersWinnings after rake ${playersWinnings}`);

          // Update the ng app balance and the DB balance
          logger.debug(`winner ${players[winner].public.name} wins ${playersWinnings}`);
          players[winner].public.chipsInPlay += playersWinnings;
          db.query(
            queries.UPDATE_BALANCES_INCREMENT_INGAME,
            [playersWinnings, players[winner].userID],
            (err) => {
              if (err) logger.error(`error updating balances ${err}`);
            },
          );

          let htmlHand = `[${players[winner].evaluatedHand.cards.join(', ')}]`;
          htmlHand = htmlHand
            .replace(/s/g, '&#9824;')
            .replace(/c/g, '&#9827;')
            .replace(/h/g, '&#9829;')
            .replace(/d/g, '&#9830;');
          messages.push(`${players[winner].public.name} ties the pot (${playersWinnings}) with ${players[winner].evaluatedHand.name} ${htmlHand}`);
        });
      }
    }

    this.reset();

    return messages;
  }

  /**
   * It will return the bets that are in front of the players.
   * It is used when a player violates the protocol and there is no penalty.
   *
   * @param {Player[]} players - All the player objects on the table
   */
  returnBetsToPlayers(players) {
    const messages = [];

    players.filter(p => p !== null && p.public.bet > 0).forEach((p) => {
      const { bet, name } = p.public;
      const { userID } = p;
      p.public.chipsInPlay += bet;
      p.public.bet = 0;
      messages.push(`returning bet to ${name} (${bet})`);
      logger.debug(`returning bet to ${name} (${bet})`);
      db.query(
        queries.UPDATE_BALANCES_INCREMENT_INGAME,
        [bet, userID],
        (err) => {
          if (err) logger.error(`error returning player bets ${err}`);
        },
      );
    });

    this.reset();

    return messages;
  }

  /**
   * It penalizes an offender and distributes the pot to the rest of the players
   * @param {player} offender The offender
   * @param {player[]} restOfPlayers The rest of the players in the hand who will be compensated
   */
  enforcePenalty(
    offender,
    restOfPlayers,
    penaltyChipsInPlay,
    penaltyLocked = 0,
  ) {
    // We'll log the messages in the chat
    const messages = [];

    // Calculate the total amount in the pot
    const totalAmount = this.getTotalAmount();
    const totalPenalty = penaltyChipsInPlay + penaltyLocked;

    offender.public.chipsInPlay -= penaltyChipsInPlay;
    db.query(
      queries.UPDATE_BALANCES_DECREMENT_INGAME_AND_LOCKED,
      [penaltyChipsInPlay, penaltyLocked, offender.userID],
      (err) => {
        if (err) logger.error(`error updating balances ${err}`);
      },
    );
    messages.push(`${offender.public.name} was penalized (${totalPenalty})`); // Log the penalty

    const compensation = Math.ceil(
      (totalAmount + totalPenalty) / restOfPlayers.length,
    );
    logger.debug(`comensation:${compensation} = totalAmt:${totalAmount} + totalPenalty:${totalPenalty} / restOfPlayers.len:${restOfPlayers.length}`);
    logger.info(`Offender ${offender.public.name} is penalized ${totalPenalty}. Compesation to each player in hand ${compensation}`);

    // We are not going to take rake from the compensations
    restOfPlayers.forEach((p) => {
      p.public.chipsInPlay += compensation;
      db.query(
        queries.UPDATE_BALANCES_INCREMENT_INGAME,
        [compensation, p.userID],
        (err) => {
          if (err) logger.error(`error updating balances ${err}`);
        },
      );
      logger.debug(`compensating ${p.public.name} with ${compensation}`);
      messages.push(`${p.public.name} was compensated (${compensation})`); // Log the compensation
    });

    this.reset();

    return messages;
  }

  /**
   * Method that gives the pot to the winner, if the winner is already known
   * (e.g. everyone has folded)
   * It will not rake the pot on preflop
   *
   * @param {Object} winner - The winner
   * @param {string} phase - The phase of the game
   * @param {number} playersDealtCards - The number of players who were dealt in the hand
   */
  giveToWinner(winner, phase, playersDealtCards) {
    let totalAmount = this.getTotalAmount();

    // Rake the pot only after the flop
    if (phase !== 'bigBlind'
    && phase !== 'smallBlind'
    && phase !== 'mentalShuffle'
    && phase !== 'preflopKeySubmit'
    && phase !== 'preflop') {
      logger.debug(`taking rake from winnings on phase ${phase}`);
      totalAmount = this.takeRake(
        totalAmount,
        winner.userID,
        playersDealtCards,
      );
    } else {
      logger.debug(`not taking rake on phase ${phase}, total amt ${totalAmount}`);
    }

    // Update in db
    db.query(
      queries.UPDATE_BALANCES_INCREMENT_INGAME,
      [totalAmount, winner.userID], (err) => {
        if (err) logger.error(`error updating balances ${err}`);
      },
    );
    winner.public.chipsInPlay += totalAmount;

    this.reset();
    return `${winner.public.name} wins the pot (${totalAmount})`;
  }

  /**
   * @return The total amount of money in the pot, including sidepots
   */
  getTotalAmount() {
    return this.pots.reduce((total, pot) => ({ amount: total.amount + pot.amount })).amount;
  }

  /**
   * Removes a player from all the pots
   * @param {number} seat - The seat to remove
   */
  removePlayer(seat) {
    this.pots.forEach((p) => {
      p.contributors = p.contributors.filter(contrib => contrib !== seat);
    });
  }

  isEmpty() {
    return !this.pots[0].amount;
  }
}

module.exports = Pot;
