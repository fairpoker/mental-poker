import secureRandomInRange from 'random-number-csprng';
import {
  encryptDeck,
  decryptDeck,
  decryptCard,
  createConfig,
  createPlayer,
} from 'mental-poker';
import { cardCodes, cardCount } from './const';

/**
 * Shuffles the provided array using the Durstenfeld algorithm with a
 * cryptographically secure pseudo random number generator.
 * This produces an unbiased random permutation of the original array.
 *
 * @param {arrayIn} The array to shuffle.
 * @returns A promise which resolves to the shuffled array.
 */
const cryptoShuffle = async (arrayIn) => {
  const promises = [];

  // asynchronously generate an array of random numbers using a CSPRNG
  for (let i = arrayIn.length - 1; i > 0; i -= 1) {
    promises.push(secureRandomInRange(0, i));
  }

  const randomNumbers = await Promise.all(promises);

  const result = [...arrayIn];
  // apply durstenfeld shuffle with previously generated random numbers
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomNumbers[result.length - i - 1];
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result;
};

/**
 * Performs a mental shuffle or locking.
 *
 * @param {Array} keyPairs - All public and private keys of thie mental player
 * @param {Array} deck - The raw deck of cards, as received by the API
 * @param {Boolean} shouldShuffle - Whether this is a shuffle or locking
 * @returns {Array} The shuffled deck of cards
 */
export const mentalShuffle = async (keyPairs, deck, shouldShuffle) => {
  const buffDeck = deck.map(c => Buffer.from(c));
  if (shouldShuffle) {
    const shuff = await cryptoShuffle(buffDeck);
    // Shuffle and encrypt deck with single key
    return encryptDeck(shuff, keyPairs[cardCount].privateKey);
  }
  // Decrypt the shuffle key and encrypt each card with unqiue key
  return encryptDeck(
    decryptDeck(buffDeck, keyPairs[cardCount].privateKey),
    keyPairs.map(k => k.privateKey),
  );
};

/**
 * Decrypts a card from the final deck given a map of keys.
 *
 * @param {Array} startingDeck - The deck we search indexes from
 * @param {Array} finalDeck - The deck from which we decrypt cards
 * @param {Array} transportKeys - Map of keys in Array form
 * @param {Array} ownKeys - Optional. If not null it will add these keys for decryption
 * @param {Array} cards - The card indexes to decrypt from the final deck
 * @returns {Object} Error and the decrypted cards
 */
export const decryptCards = (startingDeck, finalDeck, transportKeys, ownKeys, cards) => {
  const keyMap = new Map(transportKeys);
  const decryptedCards = [];
  let error = false;

  cards.forEach((card) => {
    const keys = [];
    keyMap.forEach((keyArray) => {
      if (keyArray[card]) {
        keys.push(Buffer.from(keyArray[card]));
      }
    });
    if (ownKeys) {
      keys.push(ownKeys[card].privateKey);
    }

    const decryptedCard = decryptCard(finalDeck[card], keys);
    const index = startingDeck.findIndex(c => c.equals(decryptedCard));

    if (index === -1) {
      error = true;
    } else {
      decryptedCards.push(cardCodes[index]);
    }
  });

  return {
    error,
    decryptedCards,
  };
};

/**
 * Performs a scalar multiplication with secp256k1 on 52 points
 * and prints out the time the operation took.
 */
export const testShuffleSpeed = () => {
  const conf = createConfig(52);
  const player = createPlayer(conf);
  const keys = player.keyPairs.map(k => k.privateKey);
  console.time('secp256k1-multi');
  encryptDeck(player.cardCodewordFragments, keys);
  console.timeEnd('secp256k1-multi');
};
