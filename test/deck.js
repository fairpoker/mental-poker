/* global describe, it */
const assert = require('assert');
const { sha256 } = require('js-sha256');
const mental = require('mental-poker');
const shuffle = require('lodash.shuffle');
const MentalDeck = require('../src/poker_modules/mental-deck');
const { cardCodes, cardCount } = require('../src/utils/consts');

const conf = mental.createConfig(52);

/**
 * It performs a correct mental shuffle with a given number of players
 * @param {number} numPlayers - How many players should be in the shuffle
 * @returns {array} - the deck and the mental players
 */
const correctMentalShuffle = (numPlayers) => {
  const deck = new MentalDeck();
  const players = [];
  [...Array(numPlayers)].forEach(() => players.push(mental.createPlayer(conf)));
  players.forEach((player, i) => {
    const shaKeys = player.keyPairs.map(key => sha256(key.privateKey));
    const reduced = shaKeys.reduce((accumulator, key) => accumulator + key);
    deck.commitments.push(sha256(reduced));

    const shuffled = shuffle(deck.history[deck.history.length - 1]);

    // Shuffle
    deck.history.push(
      mental.encryptDeck(
        shuffled,
        player.keyPairs[conf.cardCount].privateKey,
      ),
    );

    // Push the name of the player
    deck.historicPlayerOrder.push(`p_${i}`);
  });

  players.forEach((player, i) => {
    // Locking
    deck.history.push(
      mental.encryptDeck(
        mental.decryptDeck(
          deck.history[deck.history.length - 1],
          player.keyPairs[conf.cardCount].privateKey,
        ),
        player.keyPairs.map(keyPair => keyPair.privateKey),
      ),
    );

    // Push the name of the player
    deck.historicPlayerOrder.push(`p_${i}`);
  });

  assert.equal(
    deck.history.length,
    numPlayers * 2 + 1,
    'players not assigned correctly',
  );

  return [deck, players];
};

describe('MentalDeck', () => {
  it('should initialize deck correctly', () => {
    const d = new MentalDeck();
    assert.equal(d.historicPlayerOrder[0], '', 'the initial name in the historic player order must be a string which is not a valid username');
  });

  describe('#drawCards()', () => {
    it('should draw unique random card numbers', () => {
      const d = new MentalDeck();
      const drn = d.drawCards(5);
      assert.equal(drn.length, 5, 'should draw correct number of cards');
      let drn1 = d.drawCards(15);
      drn1 = drn1.concat(drn);
      const drn2 = d.drawCards(15);
      assert.equal(drn2.length, 15, 'should draw correct number of cards');
      assert.ok(new Set(drn1).size === drn1.length, 'indexes are not unique');
      assert.ok(!drn1.some(r => drn2.includes(r)), 'indexes are not unique');
    });
  });

  describe('#decryptCards()', () => {
    it('should decrypt cards', () => {
      const [deck, players] = correctMentalShuffle(2);

      deck.appendNewKeys('p_0', players[0].keyPairs.map(k => k.privateKey));
      deck.appendNewKeys('p_1', players[1].keyPairs.map(k => k.privateKey));
      const res = deck.decryptCards([1, 2]);

      assert.ok(res.ok);
    });

    it('should decrypt cards with non public key map', () => {
      const [deck, players] = correctMentalShuffle(2);

      deck.appendNewKeys('p_0', []);
      deck.appendNewKeysNotPublic('p_0', players[0].keyPairs.map(k => k.privateKey));
      deck.appendNewKeys('p_1', players[1].keyPairs.map(k => k.privateKey));
      const res = deck.decryptCards([1, 2, 3]);

      assert.ok(res.ok);
    });
  });

  describe('#appendNewKeysNotPublic()', () => {
    it('should append keys', () => {
      const deck = new MentalDeck();

      deck.appendNewKeysNotPublic('a', [1, 2, 3]);

      assert.notStrictEqual(deck.keysNotSharedPublicly.get('a'), [1, 2, 3]);
    });

    it('should not overwrite keys', () => {
      const deck = new MentalDeck();

      deck.appendNewKeysNotPublic('a', [1, 2, 3]);
      deck.appendNewKeysNotPublic('a', [4, 4, 4]);

      assert.notStrictEqual(deck.keysNotSharedPublicly.get('a'), [1, 2, 3]);
    });
  });

  describe('#getKeyMapWithNonSharedKeys()', () => {
    it('should return full key map', () => {
      const deck = new MentalDeck();

      deck.appendNewKeys('a', [null, Buffer.from([2]), null, Buffer.from([4])]);
      deck.appendNewKeysNotPublic('a', [Buffer.from([1]), Buffer.from([2]), Buffer.from([3]), Buffer.from([4]), Buffer.from([5]), Buffer.from([6])]);
      const res = deck.getKeyMapWithNonSharedKeys();

      assert.notStrictEqual(res.get('a'), [Buffer.from([1]), Buffer.from([2]), Buffer.from([3]), Buffer.from([4]), Buffer.from([5]), Buffer.from([6])]);
    });

    it('keys are not overwridden', () => {
      const deck = new MentalDeck();

      deck.keys.set('a', [1, null, null, 4]);
      deck.keysNotSharedPublicly.set('a', [2, 2, null, null]);
      const res = deck.getKeyMapWithNonSharedKeys();

      assert.notStrictEqual(res.get('a'), [1, 2, null, 4]);
    });

    it('should work when no non-public keys are shared', () => {
      const deck = new MentalDeck();

      deck.keys.set('a', [1, null, null, 4]);
      const res = deck.getKeyMapWithNonSharedKeys();

      assert.notStrictEqual(res.get('a'), [1, null, null, 4]);
    });
  });

  describe('#hasSubmittedAllKeys()', () => {
    it('should be ok when all keys are submitted', () => {
      const d = new MentalDeck();
      const p1 = mental.createPlayer(conf);
      const p2 = mental.createPlayer(conf);

      const p1MentalHand = [1, 2];

      d.appendNewKeys(
        'p1',
        p1.keyPairs.map((k, i) => (p1MentalHand.includes(i) ? null : k.privateKey)),
      );
      d.appendNewKeys('p2', p2.keyPairs.map(k => k.privateKey));

      assert.ok(d.hasSubmittedAllKeys('p1', p1MentalHand));
      assert.ok(d.hasSubmittedAllKeys('p2'));
    });

    it('should be false when keys are not submitted', () => {
      const d = new MentalDeck();
      const p1 = mental.createPlayer(conf);
      const p2 = mental.createPlayer(conf);

      const river = 5;

      d.appendNewKeys('p1', p1.keyPairs.map((k, i) => (i === river ? null : k.privateKey)));
      d.appendNewKeys('p2', p2.keyPairs.map(k => k.privateKey));

      assert.ok(!d.hasSubmittedAllKeys('p1', [1, 2]));
      assert.ok(d.hasSubmittedAllKeys('p2'));
    });
  });

  describe('#appendNewKeys()', () => {
    it('should set keys correctly', () => {
      const d = new MentalDeck();
      const p1 = mental.createPlayer(conf);
      const p3 = mental.createPlayer(conf);

      const p1K = [];
      let p3K = [];
      // Submit every second key
      p1.keyPairs.forEach((k, i) => (i % 2 === 0 ? (p1K[i] = k.privateKey) : null));
      p3K = p3.keyPairs.map(k => k.privateKey);

      d.appendNewKeys('p1', p1K);
      d.appendNewKeys('p3', p3K);

      d.keys
        .get('p1')
        .forEach(
          (k, i) => assert.ok(k.compare(p1K[i]) === 0),
          'wrong keys on p1',
        );
      d.keys
        .get('p3')
        .forEach(
          (k, i) => assert.ok(k.compare(p3K[i]) === 0),
          'wrong keys on p3',
        );
      d.keys
        .get('p3')
        .forEach((k, i) => (i % 2 === 0 ? assert.ok(k.compare(p1K[i]) !== 0, 'wrong keys on p1 or p3') : assert.ok(true)));
    });

    it('should not overwrite keys', () => {
      const d = new MentalDeck();
      const p1 = mental.createPlayer(conf);
      const p2 = mental.createPlayer(conf);
      const p3 = mental.createPlayer(conf);

      const p1K = [];
      // Submit every second key
      p1.keyPairs.forEach((k, i) => (i % 2 === 0 ? (p1K[i] = k.privateKey) : null));
      const p2K = p2.keyPairs.map(k => k.privateKey);
      const p3K = p3.keyPairs.map(k => k.privateKey);

      d.appendNewKeys('p1', p1K);
      d.appendNewKeys('p1', p2K); // Attempt to overwrite p1K
      d.appendNewKeys('p3', p3K); // Attemt to overwrite all keys

      d.keys
        .get('p1')
        .forEach(
          (k, i) => (i % 2 === 0 ? assert.ok(k.compare(p1K[i]) === 0, 'keys set first time overwritten') : assert.ok(k.compare(p2K[i]) === 0, 'updated keys incorrect')),
        );
      d.keys
        .get('p1')
        .forEach((k, i) => assert.ok(k.compare(p3K[i]) !== 0, 'keys are overwritten the third time'));
    });

    it('should overwrite mental card keys', () => {
      const d = new MentalDeck();
      const p1 = mental.createPlayer(conf);
      const p2 = mental.createPlayer(conf);
      const p3 = mental.createPlayer(conf);

      const p1K = [];
      let p2K = [];
      const handIdxs = [5, 12];
      p1.keyPairs.forEach((k, i) => p1K[i] = handIdxs.includes(i) ? 'commitment' :  k.privateKey); // 11-53 commitments
      p2K = p2.keyPairs.map(k => k.privateKey);

      d.appendNewKeys('p1', p1K);
      assert.equal(d.keys.get('p1').length, 53);
      d.keys
        .get('p1')
        .forEach((k, i) => (
          handIdxs.includes(i)
            ? assert.equal(k, 'commitment', 'commitment should be present')
            : assert.ok(k.compare(p1K[i]) === 0, `key at ${i} incorrect`)));
      d.appendNewKeys('p1', p2K, handIdxs); // Attempt to overwrite p1K

      assert.equal(d.keys.get('p1').length, 53);
      d.keys
        .get('p1')
        .forEach((k, i) => (handIdxs.includes(i)
          ? assert.ok(k.compare(p2K[i]) === 0, 'updated keys incorrect')
          : assert.ok(k.compare(p1K[i]) === 0, 'keys set first time overwritten')));
    });
  });

  describe('#getValidKeys()', () => {
    it('should get selected valid keys from JSON', () => {
      const d = new MentalDeck();
      const p1 = mental.createPlayer(conf);
      const p2 = mental.createPlayer(conf);
      const json1 = p1.keyPairs.map(k => JSON.parse(JSON.stringify(k.privateKey)));
      const sel = [2, 5, 9, 10, 20, 22, 33, 47];
      const json2 = p2.keyPairs.map((k, i) => sel.includes(i) ? JSON.parse(JSON.stringify(k.privateKey)) : null);

      const k1 = d.getValidKeys(json1, [...Array(53).keys()]); // All 53 keys
      const k2 = d.getValidKeys(json2, sel); // Selected keys

      assert.ok(k1.error === null, `ERR: ${k1.error}. Should have no error on valid keys`);
      assert.equal(k1.keys.length, 53, 'not all keys were processed');
      p1.keyPairs
        .map(k => k.privateKey)
        .forEach((k, i) => assert.ok(k.compare(k1.keys[i]) === 0, 'error in key conversion'));

      assert.ok(k2.error === null, `ERR: ${k2.error}. Should have no error on valid keys`);

      // assert.equal(k2.keys.length, 48, 'not all keys were processed');
      p2.keyPairs
        .map(k => k.privateKey)
        .forEach((k, i) => sel.includes(i) ? assert.ok(k.compare(k2.keys[i]) === 0, 'error in key conversion') : assert.ok(true));
    });

    it('should return keys that were not checked for validity', () => {
      const d = new MentalDeck();
      const p = mental.createPlayer(conf);
      const sel = [1, 2, 3];
      const json = p.keyPairs.map(k => JSON.parse(JSON.stringify(k.privateKey)));

      const r = d.getValidKeys(json, sel);
      assert.equal(r.keys.length, json.length, 'the output must not modify keys that were not selected for conversion');
      assert.ok(r.keys.every((k, i) => (!sel.includes(i) ? k === json[i] : true)), 'item that is not checked must be returned from the get valid key array');
    });

    it('should return error on invalid keys', () => {
      const d = new MentalDeck();
      const p1 = mental.createPlayer(conf);
      const p2 = mental.createPlayer(conf);
      const sel = [2, 5, 9, 10, 20, 22, 33, 47];
      const json1 = p1.keyPairs.map(k => JSON.parse(JSON.stringify(k.privateKey)));
      const json2 = p2.keyPairs.map((k, i) => sel.includes(i) ? JSON.parse(JSON.stringify(k.privateKey)) : null);
      json1[20] = 'lolo'; // invalid key
      json2[22] = null; // miss a key
      const json3 = [null, null, null, p2.keyPairs[10].privateKey, null]; // bad array len

      const r1 = d.getValidKeys(json1, sel);
      const r2 = d.getValidKeys(json2, sel);
      const r3 = d.getValidKeys(json3, [50]);

      assert.ok(r1.error !== null && r1.keys === null, 'should return error on invalid key');
      assert.ok(r2.error !== null && r2.keys === null, 'shoudl return error on missed key');
      assert.ok(r3.error !== null && r3.keys === null, 'the array does not contain the index');
    });
  });

  describe('#getValidDeck()', () => {
    it('should not return error when deck is valid', () => {
      const mentalDeck = new MentalDeck();
      const player = mental.createPlayer(conf);
      const [deck] = correctMentalShuffle(2);
      const [deck0] = deck.history;

      assert.equal(
        mentalDeck.getValidDeck(player.cardCodewordFragments).error,
        null,
        'should have no err when deck is valid',
      );

      const res = mentalDeck.getValidDeck(deck0);
      assert.equal(res.error, null);

      const deckString = JSON.parse(JSON.stringify(deck0));
      const resString = mentalDeck.getValidDeck(deckString);
      assert.equal(resString.error, null);
      assert.equal(resString.deck.length, 52);
      resString.deck.forEach((c, i) => assert.equal(Buffer.compare(c, deck0[i]), 0));
    });

    it('should return error on invalid deck', () => {
      const mentalDeck = new MentalDeck();
      const p = mental.createPlayer(conf);

      const badDeck1 = [];
      [...Array(52)].forEach(() => badDeck1.push('blabla'));

      assert.ok(
        mentalDeck.getValidDeck(p.cardCodewordFragments.slice(0, 10)).error !== null,
        'should have error on wrong deck size',
      );
      assert.ok(
        mentalDeck.getValidDeck(badDeck1).error !== null,
        'should return error when the passed deck is bad',
      );

      const badDeck2 = {
        length: 52,
      };
      const res2 = mentalDeck.getValidDeck(badDeck2);
      assert.equal(res2.error, 'bad deck length');
      assert.equal(res2.deck, null);

      const [deck3] = correctMentalShuffle(2);
      const badDeck3 = deck3.history[0].slice(10, 20);
      badDeck3.length = 52; // Manually alter the length parameter

      const res3 = mentalDeck.getValidDeck(badDeck3);
      assert.ok(res3.error);
      assert.equal(res3.deck, null);
    });
  });

  describe('#decryptCards()', () => {
    it('should decrypt cards and return UI codes', () => {
      const ms = correctMentalShuffle(4);
      const deck = ms[0];
      const players = ms[1];
      deck.drawCards(10);

      players.forEach((p, i) => deck.keys.set('p_'.concat(i), p.keyPairs.map(k => k.privateKey)));

      let res = deck.decryptCards(deck.dealt);
      assert.ok(res.ok, 'error in card decryption');
      assert.equal(res.cards.length, 10);
      res.cards.forEach(c => assert.ok(cardCodes.includes(c), 'decrypted card not found in UI codes'));

      deck.keys.set(
        'p_1',
        mental.createPlayer(conf).keyPairs.map(k => k.privateKey),
      );
      res = deck.decryptCards(deck.dealt);
      assert.ok(!res.ok, 'should fail, wrong keys in key map');
    });
  });

  describe('#pushHistoricDeck()', () => {
    it('should add deck to array and record player correctly', () => {
      const deck = new MentalDeck();
      const players = [
        mental.createPlayer(conf),
        mental.createPlayer(conf),
        mental.createPlayer(conf),
        mental.createPlayer(conf),
        mental.createPlayer(conf),
      ];

      assert.equal(deck.history.length, 1);
      assert.equal(deck.historicPlayerOrder.length, 1);

      players.forEach((player, idx) => {
        deck.pushHistoricDeck(player.cardCodewordFragments, `p_${idx}`);
        assert.equal(deck.historicPlayerOrder[idx + 1], `p_${idx}`);
        assert.equal(deck.history[idx + 1].length, 52);
        deck.history[idx + 1].forEach((c, i) => assert.equal(Buffer.compare(c, player.cardCodewordFragments[i]), 0));
      });

      assert.equal(deck.history.length, 6);
      assert.equal(deck.historicPlayerOrder.length, 6);
    });
  });

  describe('#blame()', () => {
    it('should not blame anyone when the protocol executes correctly', () => {
      const ms = correctMentalShuffle(4);
      const d = ms[0];
      const players = ms[1];

      players.forEach((p, i) => {
        assert.ok(
          !d.blame(
            'p_'.concat(i),
            p.keyPairs.map(keyPair => keyPair.privateKey),
          ),
          `p_${i} has not violated the protocol`,
        );
      });
    });

    it('should not blame anyone when cards are ignored and the protocol executes correctly', () => {
      const ms = correctMentalShuffle(4);
      const d = ms[0];
      const players = ms[1];
      const ignore = [4, 9];

      players.forEach((p, i) => {
        assert.ok(
          !d.blame(
            `p_${i}`,
            p.keyPairs.map((keyPair, j) => ignore.includes(j) ? sha256(keyPair.privateKey) : keyPair.privateKey),
            ignore,
          ),
          `p_${i} has not violated the protocol`,
        );
      });
    });

    it('should not affect the passed key array', () => {
      let ms = correctMentalShuffle(4);
      let d = ms[0];
      let player = ms[1][0];
      let ignore = [4, 9];

      let keys = player.keyPairs.map(
        (keyPair, j) =>
          ignore.includes(j) ? sha256(keyPair.privateKey) : keyPair.privateKey
      );
      let keysCopy = [...keys];

      keys.forEach(
        (k, i) =>
          Buffer.isBuffer(k)
            ? assert.ok(
              Buffer.compare(k, keysCopy[i]) === 0,
              'Buffers should be the same before blame'
            )
            : assert.ok(
              k === keysCopy[i],
              'strings should be the same before blame'
            )
      );
      assert.ok(
        !d.blame('p_0', keys, ignore),
        'player has not violated the protocol',
      ); // The blame function used to affect to initial set of keys

      keys.forEach((k, i) => {
        if (Buffer.isBuffer(k)) {
          assert.ok(Buffer.isBuffer(keysCopy[i]), `invalid buffer at ${i}`);
          assert.ok(
            Buffer.compare(k, keysCopy[i]) === 0,
            'buffers should be equal after blame',
          );
        } else {
          assert.equal(k, keysCopy[i]);
        }
      });
      assert.ok(
        !d.blame('p_0', keys, ignore),
        'The keys have not changed. Player has not violated the protocol'
      );
    });

    it('should detect invalid ignore commitments', () => {
      let ms = correctMentalShuffle(4);
      let d = ms[0];
      let players = ms[1];
      let ignore = [4, 9];

      players.forEach((p, i) => {
        assert.ok(
          d.blame(
            'p_'.concat(i),
            p.keyPairs.map(
              (keyPair, j) =>
                ignore.includes(j)
                  ? sha256('invalidCommitment')
                  : keyPair.privateKey
            ),
            ignore
          ),
          'p_'.concat(i) + ' has not violated the protocol'
        );
      });
    });

    it('should detect invalid keys', () => {
      let ms = correctMentalShuffle(10);
      let d = ms[0];
      let players = ms[1];
      // player 1 and 4 will submit invalid keys
      players[1] = mental.createPlayer(conf);
      players[4] = mental.createPlayer(conf);

      players.forEach((p, i) => {
        if (i !== 1 && i !== 4) {
          assert.ok(
            !d.blame(
              'p_'.concat(i),
              p.keyPairs.map(keyPair => keyPair.privateKey),
            ),
            'p_'.concat(i) + ' has not violated the protocol'
          );
        } else {
          assert.ok(
            d.blame(
              'p_'.concat(i),
              p.keyPairs.map(keyPair => keyPair.privateKey),
            ),
            'p_'.concat(i) + ' has violated the protocol'
          );
        }
      });
    });

    it('should detect invalid keys 2', () => {
      const [deck, players] = correctMentalShuffle(9);
      assert.equal(deck.history.length, 19);

      let blames = 0;
      players.forEach((player, idx) => {
        let keys = player.keyPairs.map(k => k.privateKey);
        if (idx === 1) {
          keys[1] = Buffer.from('10');
          const blame = deck.blame(`p_${idx}`, keys);
          assert.ok(blame);
          blames += 1;
        } else if (idx === 2) {
          keys[1] = 'asdasdsadasddsa';
          const blame = deck.blame(`p_${idx}`, keys);
          assert.ok(blame);
          blames += 1;
        } else if (idx === 3) {
          keys[52] = Buffer.from([1, 2, 3, 4]);
          const blame = deck.blame(`p_${idx}`, keys);
          assert.ok(blame);
          blames += 1;
        } else {
          const blame = deck.blame(`p_${idx}`, keys);
          assert.ok(!blame);
        }
      });

      assert.equal(blames, 3);
    });

    it('should detect invalid locking', () => {
      const [deck, players] = correctMentalShuffle(4);

      // Last player (4) will submit invalid locking
      deck.history[8] = mental.createPlayer(conf).cardCodewordFragments;
      players.forEach((p, i) => {
        if (i !== 3) {
          assert.ok(
            !deck.blame(
              'p_'.concat(i),
              p.keyPairs.map(keyPair => keyPair.privateKey)
            ),
            'p_'.concat(i) + ' has not violated the protocol'
          );
        } else {
          assert.ok(
            deck.blame(
              'p_'.concat(i),
              p.keyPairs.map(keyPair => keyPair.privateKey)
            ),
            'p_'.concat(i) + ' has violated the protocol'
          );
        }
      });
    });

    it('should detect invalid shuffle when card is duplicated', () => {
      const deck = new MentalDeck();
      const players = [
        mental.createPlayer(conf),
        mental.createPlayer(conf),
        mental.createPlayer(conf),
        mental.createPlayer(conf),
        mental.createPlayer(conf),
        mental.createPlayer(conf),
      ];
      const offender = 3;

      players.forEach((player, idx) => {
        const shaKeys = player.keyPairs.map(k => sha256(k.privateKey));
        const concat = shaKeys.reduce((acc, key) => acc + key);
        const commitment = sha256(concat);
        deck.commitments.push(commitment);

        if (offender === idx) {
          // const { cardCodewordFragments } = mental.createPlayer(conf);
          const shuffDeck = mental.encryptDeck(
            shuffle(deck.history[deck.history.length - 1]),
            player.keyPairs[cardCount].privateKey,
          );

          const copyDeck = [...shuffDeck];

          // Repeat a card
          shuffDeck[1] = copyDeck[7];

          deck.pushHistoricDeck(shuffDeck, `p_${idx}`);
        } else {
          deck.pushHistoricDeck(
            mental.encryptDeck(
              shuffle(deck.history[deck.history.length - 1]),
              player.keyPairs[cardCount].privateKey,
            ),
            `p_${idx}`,
          );
        }
      });

      players.forEach((player, idx) => {
        const keys = player.keyPairs.map(k => k.privateKey);
        const locking = mental.encryptDeck(
          mental.decryptDeck(
            deck.history[deck.history.length - 1],
            player.keyPairs[cardCount].privateKey,
          ),
          keys,
        );
        deck.pushHistoricDeck(locking, `p_${idx}`);
      });

      players.forEach((player, idx) => {
        const keys = player.keyPairs.map(k => k.privateKey);
        if (idx === offender) {
          assert.ok(deck.blame(`p_${idx}`, keys));
        } else {
          assert.ok(!deck.blame(`p_${idx}`, keys));
        }
      });
    });

    it('should detect invalid shuffle', () => {
      let deck = new MentalDeck();
      let players = [];
      let commits = [];
      let offender = 2;
      [...Array(4)].forEach(_ => players.push(mental.createPlayer(conf)));
      players.forEach((p, i) => {
        // Generate the commitment and push it
        let keys = '';
        p.keyPairs.forEach(k => (keys = keys.concat(sha256(k.privateKey))));
        deck.commitments.push(sha256(keys));

        if (i !== offender) {
          // Shuffle
          deck.history.push(
            mental.encryptDeck(
              shuffle(deck.history.slice(-1)[0]),
              p.keyPairs[conf.cardCount].privateKey,
            ),
          );
        } else {
          // Submit invalid shuffle
          deck.history.push(mental.createPlayer(conf).cardCodewordFragments);
        }

        // Push the name of the player
        deck.historicPlayerOrder.push('p_'.concat(i));
      });

      players.forEach((p, i) => {
        // Locking
        deck.history.push(
          mental.encryptDeck(
            mental.decryptDeck(
              deck.history.slice(-1)[0],
              p.keyPairs[conf.cardCount].privateKey,
            ),
            p.keyPairs.map(keyPair => keyPair.privateKey),
          ),
        );

        // Push the name of the player
        deck.historicPlayerOrder.push('p_'.concat(i));
      });

      players.forEach((p, i) => {
        if (i !== offender) {
          assert.ok(
            !deck.blame(
              'p_'.concat(i),
              p.keyPairs.map(keyPair => keyPair.privateKey)
            ),
            'p_'.concat(i) + ' has not violated the protocol'
          );
        } else {
          assert.ok(
            deck.blame(
              'p_'.concat(i),
              p.keyPairs.map(keyPair => keyPair.privateKey)
            ),
            'p_'.concat(i) + ' has violated the protocol'
          );
        }
      });
    });
  });
});

module.exports = {
  correctMentalShuffle,
};
