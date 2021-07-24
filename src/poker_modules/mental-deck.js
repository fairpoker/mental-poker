const mental = require('mental-poker');
const { sha256 } = require('js-sha256');
const logger = require('../logger');
const {
  cardCount,
  cardCodes,
} = require('../utils/consts');
const {
  getRandomInt,
} = require('../utils/helpers');


class MentalDeck {
  constructor() {
    // All the dealt indexes of cards
    this.dealt = [];
    // The mental deck submission during shuffle and locking made by players
    this.history = [];
    // The name players in the order they submitted shuffles and lockings
    this.historicPlayerOrder = ['']; // At the 0th index is the starting deck
    // The commitments to the private keys
    this.commitments = ['']; // At the 0th index is the starting deck
    // All the keys submitted by the players. map[player][key1, key2, ..., key52]
    this.keys = new Map();
    // HACK: Use this array to transport Maps via redis pub/sub
    this.transportKeys = []; // Keep the keys map in array form
    // Keys submitted by the players but they are not sent publicly.
    // Used for 9-handed tables and when someone submits key urgently
    // map[player][key1, key2, ..., key52]
    this.keysNotSharedPublicly = new Map();
    // HACK: Use this array to transport Maps via redis pub/sub
    this.transportKeysNotSharedPublicly = [];
    // The indexes of the community cards on the table
    this.communityCards = [];
    // The decrypted community cards
    this.decryptedCommunityCards = [];

    /* Generate the starting deck in the server
     * TODO: Players should be able to generate the cards themselves */
    this.conf = mental.createConfig(cardCount);
    const p1 = mental.createPlayer(this.conf);
    this.history.push(p1.cardCodewordFragments);
  }

  /**
   * It picks random indexes of cards.
   * Using this technique we don't have to ask for players to choose indexes by themselves.
   */
  drawCards(numberOfCards) {
    const c = [];
    for (let i = 0; i < numberOfCards; i += 1) {
      let j = getRandomInt(cardCount); // NOTE: This is deterministic
      while (this.dealt.includes(j)) {
        j = getRandomInt(cardCount);
      }
      c.push(j);
      this.dealt.push(j);
    }
    return c;
  }

  /**
   * It will convert the deck to buffer and
   * will try to multiply the cards by an example scalar to check if they are valid
   * Also, it will perform other checks on the deck to see if all is okay
   * If any operation throws, the function will return an error.
   *
   * @param {string[]} rawDeck - The deck of cards
   * @return {error, buffer[]} - Returs valid deck of buffers.
   */
  getValidDeck(rawDeck) {
    // Check if the deck contains the right amount of cards
    if (!Array.isArray(rawDeck) || rawDeck.length !== cardCount) {
      return { error: 'bad deck length', deck: null };
    }

    /* Manually count the items in the array to prevent array object manipulation attack,
     * where an attacker can create a JS array with say 10 elements, then assing the
     * value of the length parameter to equal 52 */
    let count = 0;
    for (let i = 0; i < cardCount; i += 1) {
      if (rawDeck[i] !== undefined && rawDeck[i] !== null) {
        count += 1;
      }
    }
    if (count !== cardCount) {
      return { error: 'bad deck length', deck: null };
    }

    // NOTE: This is a very costly way of validating that the deck is correct
    const p1 = mental.createPlayer(this.conf);
    try {
      // Convert the deck to buffer
      const deck = rawDeck.map(x => Buffer.from(x));

      // Attemt to multiply the deck by a valid scalar to check if it throws
      mental.encryptDeck(deck, p1.keyPairs[0].privateKey);

      return { deck, error: null };
    } catch (error) {
      return { error, deck: null };
    }
  }

  /**
   * It will convert the keys to a buffer array if possible and check whether the key is valid
   * @param {string[]} keys The raw key array
   * @param {int[]} indexes The indexes of keys we are interested in
   * @return {error, buffer[]} Error if any and the valid keys
   */
  getValidKeys(keys, indexes) {
    const finKeys = [...keys];
    const p = mental.createPlayer(this.conf);
    try {
      indexes.forEach((i) => {
        // Convert the key to buff
        finKeys[i] = Buffer.from(keys[i]);

        // Attempt to multiply valid points by the submitted keys
        mental.encryptDeck(p.cardCodewordFragments, finKeys[i]);
      });
    } catch (e) {
      // If there is any error during the above operation return an error
      return { error: e, keys: null };
    }

    return { error: null, keys: finKeys };
  }

  /**
   * It will check if this player has submitted all keys. O(n)
   * @param {string} player The player's name
   * @param {int[]} mentalCards The cards to ignore
   * @return {bool} If this player submitted all keys necessary
   */
  hasSubmittedAllKeys(player, mentalCards = []) {
    const k = this.keys.get(player);
    if (k === undefined) {
      return false;
    }

    for (let i = 0; i < cardCount + 1; i += 1) {
      if (!mentalCards.includes(i) && !Buffer.isBuffer(k[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * It will append only new keys to the key map.
   * @param {string} player The player's name.
   * @param {Buffer[]} keys The map of keys. Must be a buffer.
   * @param {number[]} overwrite Keys which we allow to be overwritten (mental cards)
   */
  appendNewKeys(player, keys, overwrite = []) {
    // If this player doesn't have a key map, set up one
    if (this.keys.get(player) === undefined) {
      this.keys.set(player, []);
    }

    // Get a reference to his keymap and populate it with the new keys
    const keyArr = this.keys.get(player);
    keys.forEach((k, i) => {
      // Make sure that the player isn't overwriting existing keys
      if (((keyArr[i] === undefined || keyArr[i] === null) && k !== null)
        || overwrite.includes(i)
      ) {
        keyArr[i] = k;
      }
    });
  }

  /**
   * Append keys to a key map which will not be shared publicly
   * @param {string} player The player's username
   * @param {Buffer[]} keys The map of keys
   */
  appendNewKeysNotPublic(player, keys) {
    if (this.keysNotSharedPublicly.get(player) === undefined) {
      this.keysNotSharedPublicly.set(player, []);
    }

    const keyArr = this.keysNotSharedPublicly.get(player);
    keys.forEach((k, i) => {
      if ((keyArr[i] === undefined || keyArr[i] === null) && k !== null) {
        keyArr[i] = k;
      }
    });
  }

  /**
   * Retreives the key map with all known keys
   */
  getKeyMapWithNonSharedKeys() {
    const res = new Map();
    this.keys.forEach((publiclySubmittedKeys, player) => {
      const nonSharedKeys = this.keysNotSharedPublicly.get(player);
      if (nonSharedKeys) {
        const fullKeyArray = [...nonSharedKeys];
        publiclySubmittedKeys.forEach((key, index) => {
          if (key !== null) fullKeyArray[index] = key;
        });

        res.set(player, fullKeyArray);
      } else {
        res.set(player, publiclySubmittedKeys);
      }
    });

    return res;
  }

  /**
   * @param {number[]} c - The indexs of cards to decrypt
   * @returns {bool, string[]}  Returns success check and decrypted cards
   */
  decryptCards(c) {
    let cards = c;
    if (!Array.isArray(cards)) cards = [cards];
    const finCards = [];

    const ok = cards.every((card) => {
      const cardKeys = [];
      const fullKeyMap = this.getKeyMapWithNonSharedKeys();
      fullKeyMap.forEach(k => cardKeys.push(k[card]));

      const decrCodeW = mental.decryptCard(
        this.history[this.history.length - 1][card],
        cardKeys,
      );
      const idx = this.history[0].findIndex(cardCodeW => cardCodeW.equals(decrCodeW));
      if (idx >= 0) finCards.push(cardCodes[idx]);
      return idx !== -1;
    });

    return { ok, cards: finCards };
  }

  /**
   * It adds a new historic deck and records the player who submitted it
   * @param {Array} deck - the deck of cards
   * @param {string} player - the player name
   */
  pushHistoricDeck(deck, player) {
    this.history.push(deck);
    this.historicPlayerOrder.push(player);
  }

  /**
   * Check if this player executed to protocol correctly as per his commitment
   * @param {string} player The name of the player to check
   * @param {Buffer[]} keys Array of all the keys submitted by this player
   * @param {number[]} ignore The locking indexes to ignore. The hash will not be taken
   * @return True if the player violated the protocol. False otherwise
   */
  blame(player, keys, ignore = []) {
    // This should contain two indexes: shuffle is idx[0] and locking is idx[1]
    const shuffAndLockIdx = []; // The indexes of this player's shuffle and locking
    this.historicPlayerOrder.forEach((p, i) => {
      if (p === player) shuffAndLockIdx.push(i);
    });

    // TODO: Check the key legth
    // First, check if the hash of the keys matches the commitment
    let keyStr = ''; // The string of keys
    keys.forEach((k, i) => {
      keyStr = ignore.includes(i)
        ? keyStr.concat(k)
        : keyStr.concat(sha256(k));
    });
    if (sha256(keyStr) !== this.commitments[shuffAndLockIdx[0]]) {
      // TODO: Send all other players the non-matching commitment
      logger.debug(`Commitment does not match: ${this.commitments[shuffAndLockIdx[0]]} != ${sha256(keyStr)}`);
      return true;
    }

    /* Here we check the shuffle.
     *
     * It derives a shuffle by multiplying the previous historic deck by the shuffle key
     * and it checks if every card from the derived shuffle exists in the submitted shuffle. */

    // TODO: Shuffle check is vulnerable to attcks. Include only check can be manipulated
    const shuffle = mental.encryptDeck(this.history[shuffAndLockIdx[0] - 1], keys[cardCount]);
    // eslint-disable-next-line max-len
    const isShuffleCorrect = shuffle.every(c => this.history[shuffAndLockIdx[0]].findIndex(cardCodeword => cardCodeword.equals(c)) >= 0);
    if (!isShuffleCorrect) {
      return true;
    }

    // NOTE: mental.decryptDeck could throw because the previous deck was invalid!
    // TODO: the blame function should be called starting from the first player to shuffle
    // In this way the decryptDeck func can fail ONLY IF the current player is offending

    /*
     * Check locking
     */
    // Make the key at ignore location something random. We'll ignore the result
    // Copy the keys, not to affect the passed ones
    const lockingKeys = keys.map((key, i) => (ignore.includes(i) ? keys[cardCount] : key));
    const locking = mental.encryptDeck(
      // Decrypt previus deck with given key
      mental.decryptDeck(this.history[shuffAndLockIdx[1] - 1], lockingKeys[cardCount]),
      lockingKeys,
    );
    for (let i = 0; i < locking.length; i += 1) {
      // Use for loop to return on failure correctly
      if (!this.history[shuffAndLockIdx[1]][i].equals(locking[i]) && !ignore.includes(i)) {
        logger.debug('Locking mismatch');
        return true;
      }
    }

    return false;
  }
}
module.exports = MentalDeck;
