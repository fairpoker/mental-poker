const { FIVE_ELEMENTS_ARRAY_COMBS } = require('./consts');

/**
 * Changes certain characters in a string to html entities
 * @param {string} str - The string to change
 * @return {string} Replaced string
 */
const htmlEntities = str => String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/'/g, '&quot;');

/**
 * It returns the maximum rake
 * @param {number} bigBlind - the big blind
 * @param {number} playersDealtCards - the number of players who were dealt cards
 */
const getMaxRake = (bigBlind, playersDealtCards) => {
  // More than two players on the table
  if (playersDealtCards > 2) {
    if (bigBlind <= 500) return 10000;
    if (bigBlind <= 2000) return 20000;
    return 30000;
  }

  // HU rake
  if (bigBlind <= 2000) return 2500;
  if (bigBlind <= 5000) return 3500;
  return 5000;
};

/**
 * It returns the rake for the table based on seats & bb
 * @param {number} bb - the big blid
 * @param {number} playersDealtCards - the number of players who were dealt cards
 */
const getRake = (bb, playersDealtCards) => {
  if (playersDealtCards > 2) {
    if (bb <= 500) return 0.04;
    if (bb <= 2000) return 0.025;

    // Default rake for 6 - 9 seats
    return 0.02;
  }

  // HU rake
  if (bb <= 5000) return 0.02;

  // Default rake for HU
  return 0.015;
};

/**
 * Returns a deterministic random number between 0 and max
 * @param {number} max - the upper bound
 */
const getRandomInt = max => Math.floor(Math.random() * Math.floor(max));

/**
 * It evaluates a poker hand from two player cards and five community cards
 * by finding the best five cards combination
 *
 * @param {Array} cards - The seven cards to evaluate
 * @returns {Object} - Evaluated hand
 */
const evaluateSevenCardsPokerHand = (cards) => {
  const cardNamess = [
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    'T',
    'J',
    'Q',
    'K',
    'A',
  ];
  const cardNames = {
    A: 'ace',
    K: 'king',
    Q: 'queen',
    J: 'jack',
    T: 'ten',
    9: 'nine',
    8: 'eight',
    7: 'seven',
    6: 'six',
    5: 'five',
    4: 'four',
    3: 'three',
    2: 'deuce',
  };

  // Returns the name of the card, in singular or in plural
  const getCardName = (cardValue, plural) => {
    if (typeof plural !== 'undefined' && plural === true) {
      return cardValue === '6'
        ? `${cardNames[cardValue]}es`
        : `${cardNames[cardValue]}s`;
    }

    return cardNames[cardValue];
  };

  const rateHand = hand => (
    cardNamess.indexOf(hand[0][0]) * 30941
        + cardNamess.indexOf(hand[1][0]) * 2380
        + cardNamess.indexOf(hand[2][0]) * 183
        + cardNamess.indexOf(hand[3][0]) * 14
        + cardNamess.indexOf(hand[4][0])
  );

  // Sorting the 7 cards
  cards.sort((a, b) => cardNamess.indexOf(b[0]) - cardNamess.indexOf(a[0]));

  let straight = [];
  const flushes = new Map();
  flushes.set('s', []);
  flushes.set('h', []);
  flushes.set('d', []);
  flushes.set('c', []);
  const pairs = {}; // COMBAK: Use Map, not object!
  let evaluatedHand = {};
  evaluatedHand = {
    rank: '',
    name: '',
    rating: 0,
    cards: [],
  };

  // Getting the suit of the first card
  flushes.get(cards[0][1]).push(cards[0]);
  // Pushing the first card in the array of the straight
  straight.push(cards[0]);

  // For the rest of the cards
  for (let i = 1; i < cards.length; i += 1) {
    // Get the suit information
    flushes.get(cards[i][1]).push(cards[i]);

    // Get the card value
    const currentCardValue = cardNamess.indexOf(cards[i][0]);
    const previousCardValue = cardNamess.indexOf(straight[straight.length - 1][0]);

    // If the current value is smaller than the value of the previous card by one,
    // push it to the straight array
    if (currentCardValue + 1 === previousCardValue) {
      straight.push(cards[i]);
    } else if (currentCardValue !== previousCardValue && straight.length < 5) {
      // If it's not smaller by one and it's not equal and a straight
      // hasn't been already completed, restart the array
      straight = [cards[i]];
    } else if (currentCardValue === previousCardValue) {
      // Else if the values are the same, there is a pair that will be pushed to the pairs array
      if (typeof pairs[cards[i][0]] === 'undefined') {
        pairs[cards[i][0]] = [cards[i - 1], cards[i]];
      } else {
        pairs[cards[i][0]].push(cards[i]);
      }
    }
  }

  // If there are four cards or more for a straight
  if (straight.length >= 4) {
    // If the last card calculated was a deuce and there is an ace in the hand,
    // append it to the end of the straight
    if (straight[straight.length - 1][0] === '2' && cards[0][0] === 'A') {
      straight.push(cards[0]);
    }

    // If there is a straight, change the evaluated hand to a straight
    if (straight.length >= 5) {
      evaluatedHand.rank = 'straight';
      evaluatedHand.cards = straight.slice(0, 5);
    }
  }

  // If there is a flush
  flushes.forEach((deck, suit) => {
    const flushLength = deck.length;
    if (flushLength >= 5) {
      // If there is also a straight, check for a straight flush
      if (evaluatedHand.rank === 'straight') {
        let straightFlush = [deck[0]];
        let j = 1;
        while (j < flushLength && straightFlush.length < 5) {
          const currentCardValue = cardNamess.indexOf(deck[j][0]);
          const previousCardValue = cardNamess.indexOf(deck[j - 1][0]);

          if (currentCardValue + 1 === previousCardValue) {
            straightFlush.push(deck[j]);
          } else if (
            currentCardValue !== previousCardValue
              && straightFlush.length < 5
          ) {
            straightFlush = [deck[j]];
          }
          j += 1;
        }
        if (
          straightFlush.length === 4
            && straightFlush[3][0] === '2'
            && cards.indexOf(`A${suit}`) >= 0
        ) {
          straightFlush.push(`A${suit}`);
        }
        if (straightFlush.length === 5) {
          evaluatedHand.cards = straightFlush;
          if (evaluatedHand.cards[0][0] === 'A') {
            evaluatedHand.rank = 'royal flush';
          } else {
            evaluatedHand.rank = 'straight flush';
          }
        }
      }
      // If the hand isn't a straight flush, change it to a flush
      if (
        evaluatedHand.rank !== 'straight flush'
          && evaluatedHand.rank !== 'royal flush'
      ) {
        evaluatedHand.rank = 'flush';
        evaluatedHand.cards = deck.slice(0, 5);
      }
    }
  });

  // If there isn't a flush or a straight, check for pairs
  if (!evaluatedHand.rank) {
    let numberOfPairs = 0;
    // Counting how many pairs were formed
    for (const i in pairs) {
      numberOfPairs += 1;
    }
    let kickers = 0;
    let i = 0;
    if (numberOfPairs) {
      // If there is one pair
      if (numberOfPairs === 1) {
        // Add the pair to the evaluated cards that will be returned
        evaluatedHand.cards = pairs[Object.keys(pairs)[0]];
        // If it is a pair
        if (evaluatedHand.cards.length === 2) {
          evaluatedHand.rank = 'pair';
          while (kickers < 3) {
            if (cards[i][0] !== evaluatedHand.cards[0][0]) {
              evaluatedHand.cards.push(cards[i]);
              kickers += 1;
            }
            i += 1;
          }
        } else if (evaluatedHand.cards.length === 3) { // If it is a three of a kind
          evaluatedHand.rank = 'three of a kind';
          while (kickers < 2) {
            if (cards[i][0] !== evaluatedHand.cards[0][0]) {
              evaluatedHand.cards.push(cards[i]);
              kickers += 1;
            }
            i += 1;
          }
        } else if (evaluatedHand.cards.length === 4) { // If it is a four of a kind
          evaluatedHand.rank = 'four of a kind';
          while (kickers < 1) {
            if (cards[i][0] !== evaluatedHand.cards[0][0]) {
              evaluatedHand.cards.push(cards[i]);
              kickers += 1;
            }
            i += 1;
          }
        }
      } else if (numberOfPairs === 2) { // If there are two pairs
        // Add to the evaluated hand, the pair with the greatest value
        if (
          pairs[Object.keys(pairs)[0]].length
              > pairs[Object.keys(pairs)[1]].length
            || (pairs[Object.keys(pairs)[0]].length === pairs[Object.keys(pairs)[1]].length
              && cardNamess.indexOf(Object.keys(pairs)[0])
                > cardNamess.indexOf(Object.keys(pairs)[1]))
        ) {
          evaluatedHand.cards = pairs[Object.keys(pairs)[0]];
          delete pairs[Object.keys(pairs)[0]];
        } else {
          evaluatedHand.cards = pairs[Object.keys(pairs)[1]];
          delete pairs[Object.keys(pairs)[1]];
        }

        // If the biggest pair has two cards
        if (evaluatedHand.cards.length === 2) {
          // Add the other two cards to the evaluated hand
          for (let j = 0; j < 2; j += 1) {
            evaluatedHand.cards.push(pairs[Object.keys(pairs)[0]][j]);
          }
          evaluatedHand.rank = 'two pair';
          // Add one kicker
          while (kickers < 1) {
            if (
              cards[i][0] !== evaluatedHand.cards[0][0]
                && cards[i][0] !== evaluatedHand.cards[2][0]
            ) {
              evaluatedHand.cards.push(cards[i]);
              kickers += 1;
            }
            i += 1;
          }
        } else if (evaluatedHand.cards.length === 3) { // If the biggest pair has three cards
          evaluatedHand.rank = 'full house';
          for (let j = 0; j < 2; j += 1) {
            evaluatedHand.cards.push(pairs[Object.keys(pairs)[0]][j]);
          }
          // If the biggest pair has four cards
        } else {
          evaluatedHand.rank = 'four of a kind';
          while (kickers < 1) {
            if (cards[i][0] !== evaluatedHand.cards[0][0]) {
              evaluatedHand.cards.push(cards[i]);
              kickers += 1;
            }
            i += 1;
          }
        }
        // If there are three pairs
      } else {
        const pairKeys = [
          Object.keys(pairs)[0],
          Object.keys(pairs)[1],
          Object.keys(pairs)[2],
        ];
          // If there is a pair with three cards, it's the biggest pair
        for (const j in pairs) {
          if (pairs[j].length === 3) {
            evaluatedHand.rank = 'full house';
            evaluatedHand.cards = pairs[j];
            delete pairs[j];
            break;
          }
        }
        // Else, there are three pairs of two cards, so find the biggest one
        if (!evaluatedHand.cards.length) {
          evaluatedHand.rank = 'two pair';
          if (
            cardNamess.indexOf(pairKeys[0]) > cardNamess.indexOf(pairKeys[1])
          ) {
            if (cardNamess.indexOf(pairKeys[0]) > cardNamess.indexOf(pairKeys[2])) {
              evaluatedHand.cards = pairs[pairKeys[0]];
              delete pairs[pairKeys[0]];
            } else {
              evaluatedHand.cards = pairs[pairKeys[2]];
              delete pairs[pairKeys[2]];
            }
          } else if (
            cardNamess.indexOf(pairKeys[1])
                > cardNamess.indexOf(pairKeys[2])
          ) {
            evaluatedHand.cards = pairs[pairKeys[1]];
            delete pairs[pairKeys[1]];
          } else {
            evaluatedHand.cards = pairs[pairKeys[2]];
            delete pairs[pairKeys[2]];
          }
        }
        // Adding the second biggest pair in the hand
        if (
          cardNamess.indexOf(Object.keys(pairs)[0])
            > cardNamess.indexOf(Object.keys(pairs)[1])
        ) {
          for (let j = 0; j < 2; j += 1) {
            evaluatedHand.cards.push(pairs[Object.keys(pairs)[0]][j]);
          }
        } else {
          for (let j = 0; j < 2; j += 1) {
            evaluatedHand.cards.push(pairs[Object.keys(pairs)[1]][j]);
          }
        }

        // If the biggest pair has two cards, add one kicker
        if (evaluatedHand.rank === 'two pair') {
          while (kickers < 1) {
            if (
              cards[i][0] !== evaluatedHand.cards[0][0]
                && cards[i][0] !== evaluatedHand.cards[2][0]
            ) {
              evaluatedHand.cards.push(cards[i]);
              kickers += 1;
            }
            i += 1;
          }
        }
      }
    }
  }

  if (!evaluatedHand.rank) {
    evaluatedHand.rank = 'high card';
    evaluatedHand.cards = cards.slice(0, 5);
  }

  switch (evaluatedHand.rank) {
    case 'high card':
      evaluatedHand.name = `${getCardName(evaluatedHand.cards[0][0])} high`;
      evaluatedHand.rating = rateHand(evaluatedHand.cards);
      break;
    case 'pair':
      evaluatedHand.name = `a pair of ${getCardName(evaluatedHand.cards[0][0], true)}`;
      evaluatedHand.rating = rateHand(evaluatedHand.cards) + 1000000;
      break;
    case 'two pair':
      evaluatedHand.name = `two pair, ${getCardName(evaluatedHand.cards[0][0], true)} and ${getCardName(evaluatedHand.cards[2][0], true)}`;
      evaluatedHand.rating = rateHand(evaluatedHand.cards) + 2000000;
      break;
    case 'three of a kind':
      evaluatedHand.name = `three of a kind, ${getCardName(evaluatedHand.cards[0][0], true)}`;
      evaluatedHand.rating = rateHand(evaluatedHand.cards) + 3000000;
      break;
    case 'straight':
      evaluatedHand.name = `a straight to ${getCardName(straight[0][0])}`;
      evaluatedHand.rating = rateHand(evaluatedHand.cards) + 4000000;
      break;
    case 'flush':
      evaluatedHand.name = `a flush, ${getCardName(evaluatedHand.cards[0][0])} high`;
      evaluatedHand.rating = rateHand(evaluatedHand.cards) + 5000000;
      break;
    case 'full house':
      evaluatedHand.name = `a full house, ${getCardName(evaluatedHand.cards[0][0], true)} full of ${getCardName(evaluatedHand.cards[3][0], true)}`;
      evaluatedHand.rating = rateHand(evaluatedHand.cards) + 6000000;
      break;
    case 'four of a kind':
      evaluatedHand.name = `four of a kind, ${getCardName(evaluatedHand.cards[0][0], true)}`;
      evaluatedHand.rating = rateHand(evaluatedHand.cards) + 7000000;
      break;
    case 'straight flush':
      evaluatedHand.name = `a straight flush, ${getCardName(evaluatedHand.cards[4][0])} to ${getCardName(evaluatedHand.cards[0][0])}`;
      evaluatedHand.rating = rateHand(evaluatedHand.cards) + 8000000;
      break;
    case 'royal flush':
      evaluatedHand.name = 'a royal flush';
      evaluatedHand.rating = rateHand(evaluatedHand.cards) + 8000000;
      break;
      // no default
  }
  return evaluatedHand;
};

/**
 * It will find the best NLHE/PLO poker hand given the player's hole cards and the board.
 * @param {array} cards - The hole cards of the player
 * @param {array} board - The community cards
 */
const findBestPokerHandOnBoard = (cards, board) => {
  if (cards.length > 2) {
    // This is PLO. Find all combs of 4 cards
    let bestRating = 0;
    let bestEvaluatedHand;

    for (let i = 0; i < cards.length; i += 1) {
      for (let j = i + 1; j < cards.length; j += 1) {
        // The hand cards combinations are cards[i] and cards[j]

        // We now test all possible community cards combinations
        for (let k = 0; k < FIVE_ELEMENTS_ARRAY_COMBS.length; k += 1) {
          // The community cards combination we are testing is 'comb'
          // and the hands cards are cards[i] and cards[j]
          const comb = FIVE_ELEMENTS_ARRAY_COMBS[k];
          const fiveCardCombo = [
            cards[i],
            cards[j],
            board[comb[0]],
            board[comb[1]],
            board[comb[2]],
          ];

          if (fiveCardCombo.every(val => val !== undefined)) {
            const eh = evaluateSevenCardsPokerHand(fiveCardCombo);

            if (eh.rating > bestRating) {
              bestRating = eh.rating;
              bestEvaluatedHand = eh;
            }
          }
        }
      }
    }

    return bestEvaluatedHand;
  }

  return evaluateSevenCardsPokerHand(cards.concat(board));
};

module.exports = {
  htmlEntities,
  getRandomInt,
  getRake,
  getMaxRake,
  evaluateSevenCardsPokerHand,
  findBestPokerHandOnBoard,
};
