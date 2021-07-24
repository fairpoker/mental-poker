/* global describe, it */
const assert = require('assert');
const { sha256 } = require('js-sha256');
const { correctMentalShuffle } = require('./deck');
const Table = require('../src/poker_modules/table');
const Player = require('../src/poker_modules/player');
const { GAME_MODE_NLHE, GAME_MODE_PLO } = require('../src/utils/consts');

const fakeFunc = () => {};

const socket = {
  emit: () => {},
};

const initializeTestTable = (gameMode = GAME_MODE_NLHE) => {
  const players = [];
  const table = new Table(
    0, // id
    'Sample Table', // name
    6, // seats
    20, // bb
    10, // sb
    2000, // max buy in
    400, // min buy in
    15000, // Timeout
    false, // private?
    false,
    false,
    gameMode,
  );

  assert.equal(table.public.bigBlind, 20);
  assert.equal(table.public.minBuyIn, 400);
  assert.equal(table.public.timeout, 15000);
  assert.equal(table.public.seats.length, 6);
  assert.equal(table.seats.length, 6);
  assert.ok(!table.showInLobby);
  table.public.seats.forEach(s => assert.equal(s, null));

  for (let i = 0; i < 5; i += 1) {
    const player = new Player(socket, i, `p_${i}`, 1000);
    player.socket = `socket_p_${i}`;
    players[i] = player;
  }

  table.playerSatOnTheTable(players[0], 1, 1000);
  table.playerSatOnTheTable(players[1], 2, 1000);
  table.playerSatOnTheTable(players[2], 3, 1000);
  table.playerSatOnTheTable(players[3], 4, 1000);
  table.endRound();

  assert.equal(table.seats.filter(s => s !== null).length, 4);

  return table;
};

const initializeTestTableHeadsUp = () => {
  const players = [];
  const table = new Table(
    0, // id
    'Sample Table', // name
    2, // seats
    20, // bb
    10, // sb
    2000, // max buy in
    400, // min buy in
    1000000, // Timeout
    false, // private?
    false, // update mode
  );

  for (let i = 0; i < 2; i += 1) {
    const player = new Player(socket, i, `p_${i}`, 1000);
    player.socket = `socket_p_${i}`;
    players[i] = player;
  }

  table.playerSatOnTheTable(players[0], 0, 1000);
  table.playerSatOnTheTable(players[1], 1, 1000);

  assert.equal(table.seats.filter(s => s !== null).length, 2);

  return table;
};

describe('Table', () => {
  describe('Initialize table', () => {
    it('should run init function', () => {
      initializeTestTable();
    });

    it('should initialize table with password', () => {
      const table = new Table(
        0, // id
        'Sample Table', // name
        6, // seats
        20, // bb
        10, // sb
        2000, // max buy in
        400, // min buy in
        15000, // Timeout
        false, // private?
        false,
        false,
        'NLHE',
        '',
      );

      assert.ok(!table.public.isPasswordProtected);

      const table2 = new Table(
        0, // id
        'Sample Table', // name
        6, // seats
        20, // bb
        10, // sb
        2000, // max buy in
        400, // min buy in
        15000, // Timeout
        false, // private?
        false,
        false,
        'NLHE',
        'passw@rd',
      );

      assert.ok(table2.public.isPasswordProtected);
      assert.equal(table2.tablePassword, 'passw@rd');
    });
  });

  describe('Game situations', () => {
    it('should run a sample game from beginning to showdown', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      assert.equal(table.public.playersInHandCount, 4);
      assert.equal(table.public.phase, 'smallBlind');
      assert.ok(!table.shouldPenalizeLeave(2));
      table.playerPostedSmallBlind();
      assert.ok(!table.shouldPenalizeLeave(2));
      assert.equal(table.public.phase, 'bigBlind');
      table.playerPostedBigBlind();
      assert.equal(table.bigBlindSeat, 2);
      assert.equal(table.public.activeSeat, 1);
      // Set initial deck to equal the one we generated
      table.mentalDeck.history[0] = deck.history[0];
      assert.equal(table.public.phase, 'mentalShuffle');
      assert.ok(table.shouldPenalizeLeave(2));
      table.playerSubmittedShuffle(deck.history[1], deck.commitments[1]);
      table.playerSubmittedShuffle(deck.history[2], deck.commitments[2]);
      table.playerSubmittedShuffle(deck.history[3], deck.commitments[3]);
      assert.ok(table.shouldPenalizeLeave(3)); // It must restart the game if disconnect during shuffle
      table.playerSubmittedShuffle(deck.history[4], deck.commitments[4]);
      assert.equal(table.mentalDeck.commitments.length, 5);
      assert.equal(table.mentalDeck.history.length, 5);
      table.playerSubmittedShuffle(deck.history[5], 'should-ignore');
      table.playerSubmittedShuffle(deck.history[6]);
      table.playerSubmittedShuffle(deck.history[7]);
      table.playerSubmittedShuffle(deck.history[8], null);
      assert.equal(table.mentalDeck.commitments.length, 5);
      assert.equal(table.mentalDeck.history.length, 9);
      table.mentalDeck.history.forEach((d, deckIdx) => {
        assert.equal(d.length, 52);
        assert.ok(
          d.every((card, cardIdx) => Buffer.compare(card, deck.history[deckIdx][cardIdx]) === 0),
          `in deck ${deckIdx} card does not match card from valid deck`,
        );
      });
      assert.ok(table.shouldPenalizeLeave(2));
      assert.equal(table.public.phase, 'preflopKeySubmit');
      table.seats
        .filter(s => s !== null)
        .forEach((p) => {
          assert.equal(p.public.mentalCards.length, 2, 'cards are not dealt');
          assert.ok(p.public.mentalCards.every(c => c >= 0 && c <= 52));
        });

      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.getKeysToSubmit(s.seat).forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      assert.equal(table.public.phase, 'preflop');
      assert.ok(table.shouldPenalizeLeave(2));
      assert.equal(table.public.activeSeat, 3);
      table.playerCalled();
      table.playerCalled();
      table.playerCalled();
      assert.equal(table.public.phase, 'preflop');
      assert.equal(table.mentalDeck.communityCards.length, 0);
      table.playerCalled();
      assert.equal(table.public.phase, 'flopKeySubmit');
      assert.ok(table.shouldPenalizeLeave(2));
      assert.equal(table.mentalDeck.communityCards.length, 3);

      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.mentalDeck.communityCards.forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      assert.equal(table.mentalDeck.decryptedCommunityCards.length, 3);
      assert.equal(table.public.phase, 'flop');
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      assert.equal(table.public.phase, 'flop');
      table.playerChecked();
      assert.equal(table.public.phase, 'turnKeySubmit');
      assert.ok(table.shouldPenalizeLeave(2));
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        sentKeys[table.mentalDeck.communityCards[3]] = keys[table.mentalDeck.communityCards[3]];
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      assert.equal(table.mentalDeck.decryptedCommunityCards.length, 4);
      assert.equal(table.public.phase, 'turn');
      assert.ok(table.shouldPenalizeLeave(2));
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      assert.equal(table.public.phase, 'turn');
      table.playerChecked();
      assert.equal(table.public.phase, 'riverKeySubmit');
      assert.ok(table.shouldPenalizeLeave(2));

      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        sentKeys[table.mentalDeck.communityCards[4]] = keys[table.mentalDeck.communityCards[4]];
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      assert.equal(table.mentalDeck.decryptedCommunityCards.length, 5);
      assert.equal(table.public.phase, 'river');
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      assert.equal(table.public.phase, 'river');
      assert.ok(!table.shouldPenalizeLeave(2));
      table.playerChecked();
      assert.equal(table.public.phase, 'showdownKeySubmit');
      assert.ok(!table.shouldPenalizeLeave(2));

      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        s.public.mentalCards.forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      assert.equal(table.public.phase, 'showdown');
      assert.ok(!table.shouldPenalizeLeave(2));
      table.seats.filter(s => s !== null).forEach((s) => {
        assert.equal(s.public.cards.length, 2);
        assert.ok(s.evaluatedHand.rating > 0);
        assert.ok(s.evaluatedHand.rank !== '');
      });
    });

    it('should catch offender when one invalid locking card was submitted by player and was drawn on flop', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      const [badDeck, badPlayers] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      // Set initial deck to equal the one we generated
      table.mentalDeck.history[0] = deck.history[0];
      table.playerSubmittedShuffle(deck.history[1], deck.commitments[1]);
      table.playerSubmittedShuffle(deck.history[2], deck.commitments[2]);
      table.playerSubmittedShuffle(deck.history[3], deck.commitments[3]);
      table.playerSubmittedShuffle(deck.history[4], deck.commitments[4]);
      table.playerSubmittedShuffle(deck.history[5]);
      table.playerSubmittedShuffle(deck.history[6]);
      table.playerSubmittedShuffle(deck.history[7]);
      table.playerSubmittedShuffle(deck.history[8]);
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.getKeysToSubmit(s.seat).forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      table.playerCalled();
      table.playerCalled();
      table.playerCalled();
      table.playerCalled();
      assert.equal(table.public.phase, 'flopKeySubmit');
      /* Imitate a situation where a player has submitted
       * only one invalid card and that card turns out to be a community card */
      const [flopCard1] = table.mentalDeck.communityCards;
      // Player at seat 4 has offended
      table.mentalDeck.history[8][flopCard1] = badDeck.history[8][flopCard1];

      // Everyone submits correct keys
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.mentalDeck.communityCards.forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      assert.equal(table.public.phase, 'protocolFailure');

      assert.equal(table.lastOffence, null);
      // Everyone submits their keys
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        let keyStr = ''; // The string of keys
        keys.forEach((k) => {
          keyStr = keyStr.concat(sha256(k));
        });

        [...Array(53).keys()].forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeysFailure(sentKeys, table.public.activeSeat);
      });
      assert.equal(table.lastOffence.name, 'p_3');
      assert.equal(table.lastOffence.seat, 4);
    });

    it('should catch offender when invalid keys are submitted on flop', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      const [badDeck, badPlayers] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      // Set initial deck to equal the one we generated
      table.mentalDeck.history[0] = deck.history[0];
      table.playerSubmittedShuffle(deck.history[1], deck.commitments[1]);
      table.playerSubmittedShuffle(deck.history[2], deck.commitments[2]);
      table.playerSubmittedShuffle(deck.history[3], deck.commitments[3]);
      table.playerSubmittedShuffle(deck.history[4], deck.commitments[4]);
      table.playerSubmittedShuffle(deck.history[5]);
      table.playerSubmittedShuffle(deck.history[6]);
      table.playerSubmittedShuffle(deck.history[7]);
      table.playerSubmittedShuffle(deck.history[8]);
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.getKeysToSubmit(s.seat).forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      table.playerCalled();
      table.playerCalled();
      table.playerCalled();
      table.playerCalled();
      assert.equal(table.public.phase, 'flopKeySubmit');

      // Everyone submits correct keys but seat 4
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = s.seat === 4
          ? badPlayers[idx].keyPairs.map(k => k.privateKey)
          : players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.mentalDeck.communityCards.forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      assert.equal(table.public.phase, 'protocolFailure');

      assert.equal(table.lastOffence, null);
      // Everyone submits their keys
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        let keyStr = ''; // The string of keys
        keys.forEach((k) => {
          keyStr = keyStr.concat(sha256(k));
        });

        [...Array(53).keys()].forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeysFailure(sentKeys, table.public.activeSeat);
      });
      assert.equal(table.lastOffence.name, 'p_3');
      assert.equal(table.lastOffence.seat, 4);
    });

    it('should catch offender when invalid keys are submitted on turn', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      const [badDeck, badPlayers] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      // Set initial deck to equal the one we generated
      table.mentalDeck.history[0] = deck.history[0];
      table.playerSubmittedShuffle(deck.history[1], deck.commitments[1]);
      table.playerSubmittedShuffle(deck.history[2], deck.commitments[2]);
      table.playerSubmittedShuffle(deck.history[3], deck.commitments[3]);
      table.playerSubmittedShuffle(deck.history[4], deck.commitments[4]);
      table.playerSubmittedShuffle(deck.history[5]);
      table.playerSubmittedShuffle(deck.history[6]);
      table.playerSubmittedShuffle(deck.history[7]);
      table.playerSubmittedShuffle(deck.history[8]);
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.getKeysToSubmit(s.seat).forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      table.playerCalled();
      table.playerCalled();
      table.playerCalled();
      table.playerCalled();
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.mentalDeck.communityCards.forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      assert.equal(table.public.phase, 'turnKeySubmit');
      // Everyone submits correct keys but seat 4
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = s.seat === 4
          ? badPlayers[idx].keyPairs.map(k => k.privateKey)
          : players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        sentKeys[table.mentalDeck.communityCards[3]] = keys[table.mentalDeck.communityCards[3]];
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      assert.equal(table.public.phase, 'protocolFailure');
      assert.equal(table.lastOffence, null);
      // Everyone submits their keys
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        let keyStr = ''; // The string of keys
        keys.forEach((k) => {
          keyStr = keyStr.concat(sha256(k));
        });

        [...Array(53).keys()].forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeysFailure(sentKeys, table.public.activeSeat);
      });
      assert.equal(table.lastOffence.name, 'p_3');
      assert.equal(table.lastOffence.seat, 4);
    });

    it('should catch offender when invalid keys are submitted on river', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      const [badDeck, badPlayers] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      // Set initial deck to equal the one we generated
      table.mentalDeck.history[0] = deck.history[0];
      table.playerSubmittedShuffle(deck.history[1], deck.commitments[1]);
      table.playerSubmittedShuffle(deck.history[2], deck.commitments[2]);
      table.playerSubmittedShuffle(deck.history[3], deck.commitments[3]);
      table.playerSubmittedShuffle(deck.history[4], deck.commitments[4]);
      table.playerSubmittedShuffle(deck.history[5]);
      table.playerSubmittedShuffle(deck.history[6]);
      table.playerSubmittedShuffle(deck.history[7]);
      table.playerSubmittedShuffle(deck.history[8]);
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.getKeysToSubmit(s.seat).forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      table.playerCalled();
      table.playerCalled();
      table.playerCalled();
      table.playerCalled();
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.mentalDeck.communityCards.forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        sentKeys[table.mentalDeck.communityCards[3]] = keys[table.mentalDeck.communityCards[3]];
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      assert.equal(table.public.phase, 'riverKeySubmit');
      // Everyone submits correct keys but seat 4
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = s.seat === 4
          ? badPlayers[idx].keyPairs.map(k => k.privateKey)
          : players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        sentKeys[table.mentalDeck.communityCards[4]] = keys[table.mentalDeck.communityCards[4]];
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      assert.equal(table.public.phase, 'protocolFailure');
      assert.equal(table.lastOffence, null);
      // Everyone submits their keys
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        let keyStr = ''; // The string of keys
        keys.forEach((k) => {
          keyStr = keyStr.concat(sha256(k));
        });

        [...Array(53).keys()].forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeysFailure(sentKeys, table.public.activeSeat);
      });
      assert.equal(table.lastOffence.name, 'p_3');
      assert.equal(table.lastOffence.seat, 4);
    });

    it('should ignore invalid keys submitted on showdown', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      const [badDeck, badPlayers] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      // Set initial deck to equal the one we generated
      table.mentalDeck.history[0] = deck.history[0];
      table.playerSubmittedShuffle(deck.history[1], deck.commitments[1]);
      table.playerSubmittedShuffle(deck.history[2], deck.commitments[2]);
      table.playerSubmittedShuffle(deck.history[3], deck.commitments[3]);
      table.playerSubmittedShuffle(deck.history[4], deck.commitments[4]);
      table.playerSubmittedShuffle(deck.history[5]);
      table.playerSubmittedShuffle(deck.history[6]);
      table.playerSubmittedShuffle(deck.history[7]);
      table.playerSubmittedShuffle(deck.history[8]);
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.getKeysToSubmit(s.seat).forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      table.playerCalled();
      table.playerCalled();
      table.playerCalled();
      table.playerCalled();
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.mentalDeck.communityCards.forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        sentKeys[table.mentalDeck.communityCards[3]] = keys[table.mentalDeck.communityCards[3]];
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        sentKeys[table.mentalDeck.communityCards[4]] = keys[table.mentalDeck.communityCards[4]];
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      table.playerChecked();
      assert.equal(table.public.phase, 'showdownKeySubmit');
      // Everyone submits correct keys but seat 3
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = s.seat === 3
          ? badPlayers[idx].keyPairs.map(k => k.privateKey)
          : players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        s.public.mentalCards.forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      assert.equal(table.public.phase, 'showdown');
      table.seats.filter(s => s !== null).forEach((s) => {
        if (s.seat === 3) {
          assert.ok(!s.public.inHand);
          assert.equal(s.public.cards.length, 0);
        } else {
          assert.ok(s.public.inHand);
          assert.equal(s.public.cards.length, 2);
          assert.ok(s.evaluatedHand.rating > 0);
          assert.ok(s.evaluatedHand.rank !== '');
        }
      });
    });

    it('should catch offender when someone complains on preflop when invalid shuffle/locking is submitted', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      const [badDeck, badPlayers] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      // Set initial deck to equal the one we generated
      table.mentalDeck.history[0] = deck.history[0];
      table.playerSubmittedShuffle(deck.history[1], deck.commitments[1]);
      table.playerSubmittedShuffle(deck.history[2], deck.commitments[2]);
      table.playerSubmittedShuffle(deck.history[3], deck.commitments[3]);
      table.playerSubmittedShuffle(deck.history[4], deck.commitments[4]);
      table.playerSubmittedShuffle(deck.history[5]);
      table.playerSubmittedShuffle(deck.history[6]);
      table.playerSubmittedShuffle(deck.history[7]);
      table.playerSubmittedShuffle(badDeck.history[8]); // Player at seat 4 submits invalid locking
      // Everyone submits valid keys
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.getKeysToSubmit(s.seat).forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      assert.equal(table.public.phase, 'preflop');
      assert.equal(table.bigBlindSeat, 2);
      assert.equal(table.public.activeSeat, 3);
      // Seat 1 triggers protocol failure
      table.initializeProtocolFailure(players[2].keyPairs.map(k => k.privateKey), 3);
      assert.equal(table.public.phase, 'protocolFailure');
      assert.equal(table.lastOffence, null);
      assert.equal(table.public.activeSeat, 4);
      table.playerSubmittedKeysFailure(players[3].keyPairs.map(k => k.privateKey), 4);
      assert.equal(table.lastOffence.name, 'p_3');
      assert.equal(table.lastOffence.seat, 4);
      assert.equal(table.public.phase, 'smallBlind');
    });

    it('should catch offender when someone complains on preflop when invalid keys are sent', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      const [badDeck, badPlayers] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      // Set initial deck to equal the one we generated
      table.mentalDeck.history[0] = deck.history[0];
      table.playerSubmittedShuffle(deck.history[1], deck.commitments[1]);
      table.playerSubmittedShuffle(deck.history[2], deck.commitments[2]);
      table.playerSubmittedShuffle(deck.history[3], deck.commitments[3]);
      table.playerSubmittedShuffle(deck.history[4], deck.commitments[4]);
      table.playerSubmittedShuffle(deck.history[5]);
      table.playerSubmittedShuffle(deck.history[6]);
      table.playerSubmittedShuffle(deck.history[7]);
      table.playerSubmittedShuffle(deck.history[8]);
      // Everyone submits valid keys but seat 4
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = s.seat === 4
          ? badPlayers[idx].keyPairs.map(k => k.privateKey)
          : players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.getKeysToSubmit(s.seat).forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      assert.equal(table.public.phase, 'preflop');
      assert.equal(table.bigBlindSeat, 2);
      assert.equal(table.public.activeSeat, 3);
      // Seat 3 triggers protocol failure
      table.initializeProtocolFailure(players[2].keyPairs.map(k => k.privateKey), 3);
      assert.equal(table.public.phase, 'protocolFailure');
      assert.equal(table.lastOffence, null);
      assert.equal(table.public.activeSeat, 4);
      table.playerSubmittedKeysFailure(players[3].keyPairs.map(k => k.privateKey), 4);
      assert.equal(table.lastOffence.name, 'p_3');
      assert.equal(table.lastOffence.seat, 4);
    });

    it('should catch offender when someone complains on preflop when invalid keys are sent, case 2', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      const [badDeck, badPlayers] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      // Set initial deck to equal the one we generated
      table.mentalDeck.history[0] = deck.history[0];
      table.playerSubmittedShuffle(deck.history[1], deck.commitments[1]);
      table.playerSubmittedShuffle(deck.history[2], deck.commitments[2]);
      table.playerSubmittedShuffle(deck.history[3], deck.commitments[3]);
      table.playerSubmittedShuffle(deck.history[4], deck.commitments[4]);
      table.playerSubmittedShuffle(deck.history[5]);
      table.playerSubmittedShuffle(deck.history[6]);
      table.playerSubmittedShuffle(deck.history[7]);
      table.playerSubmittedShuffle(deck.history[8]);
      // Everyone submits valid keys but seat 4
      table.seats.filter(s => s !== null).forEach((s, idx) => {
        const keys = s.seat === 4
          ? badPlayers[idx].keyPairs.map(k => k.privateKey)
          : players[idx].keyPairs.map(k => k.privateKey);
        const sentKeys = [];
        table.getKeysToSubmit(s.seat).forEach(c => sentKeys[c] = keys[c]);
        table.playerSubmittedKeys(sentKeys, s.seat);
      });
      assert.equal(table.public.phase, 'preflop');
      assert.equal(table.bigBlindSeat, 2);
      assert.equal(table.public.activeSeat, 3);
      // Seat 1 triggers protocol failure
      table.initializeProtocolFailure(players[2].keyPairs.map(k => k.privateKey), 3);
      assert.equal(table.public.phase, 'protocolFailure');
      assert.equal(table.lastOffence, null);
      // Send same keys as in key submit phase
      assert.equal(table.public.activeSeat, 4);
      table.playerSubmittedKeysFailure(badPlayers[3].keyPairs.map(k => k.privateKey), 4);
      assert.equal(table.lastOffence.name, 'p_3');
      assert.equal(table.lastOffence.seat, 4);
    });
  });

  describe('#isValidBet()', () => {
    it('should accept a positive bet, reject negative and reject bet over chips in play', () => {
      const t = initializeTestTable();
      t.public.activeSeat = 1;

      assert.ok(t.isValidBet(100));
      assert.ok(!t.isValidBet(2000));
      assert.ok(!t.isValidBet(-100));
    });

    it('should reject a bet lower than the BB & accept an all in if chips < bb', () => {
      const t = initializeTestTable();
      t.public.activeSeat = 1;

      assert.ok(!t.isValidBet(10), 'bet is below the BB and player has chips');
      assert.ok(t.isValidBet(30), 'bet is > BB');

      t.seats[1].public.chipsInPlay = 10;
      assert.ok(!t.isValidBet(5), 'only move must be all in');
      assert.ok(t.isValidBet(10), 'bet is below the BB and player has not enough chips');
    });

    it('should run a correct betting round when game is PLO', () => {
      const t = initializeTestTable(GAME_MODE_PLO);
      assert.equal(t.public.gameMode, GAME_MODE_PLO);
      t.public.dealerSeat = 1;
      t.initializeRound(false);
      t.playerPostedSmallBlind();
      t.playerPostedBigBlind();
      t.endPhase();
      t.endPhase();
      assert.equal(t.public.activeSeat, 4);
      assert.equal(t.public.phase, 'preflop');
      assert.equal(t.public.biggestRaise, 20);
      assert.equal(t.public.biggestBet, 20);


      // Preflop, pot 30, UTG player bet sizing:
      assert.ok(!t.isValidBet(10));
      assert.ok(!t.isValidBet(25));
      assert.ok(t.isValidBet(40));
      assert.ok(t.isValidBet(50));
      assert.ok(t.isValidBet(60));
      assert.ok(t.isValidBet(70));
      assert.ok(!t.isValidBet(71));
      assert.ok(!t.isValidBet(80));
      assert.ok(!t.isValidBet(1200));

      t.playerRaised(50);

      // Preflop, pot 80, dealer bet sizing
      assert.ok(!t.isValidBet(75));
      assert.ok(t.isValidBet(80));
      assert.ok(t.isValidBet(120));
      assert.ok(t.isValidBet(180));
      assert.ok(!t.isValidBet(!190));

      t.playerRaised(180);

      // Preflop, pot 260, sb bet sizing
      assert.ok(!t.isValidBet(300));
      assert.ok(t.isValidBet(310));
      assert.ok(t.isValidBet(600));
      assert.ok(t.isValidBet(610));
      assert.ok(!t.isValidBet(620));

      t.playerRaised(600);

      // Preflop, pot 860, bb bet sizing:
      assert.ok(!t.isValidBet(990));
      // The only possible raise here is all-in
      assert.ok(t.isValidBet(1000));
      assert.ok(!t.isValidBet(1010));
    });

    it('should run a correct betting round when game is PLO 2', () => {
      const t = initializeTestTable(GAME_MODE_PLO);
      assert.equal(t.public.gameMode, GAME_MODE_PLO);
      t.public.dealerSeat = 1;
      t.initializeRound(false);
      t.playerPostedSmallBlind();
      t.playerPostedBigBlind();
      t.endPhase();
      t.endPhase();
      assert.equal(t.public.activeSeat, 4);
      assert.equal(t.public.phase, 'preflop');
      assert.equal(t.public.biggestRaise, 20);
      assert.equal(t.public.biggestBet, 20);


      assert.ok(!t.isValidBet(10));
      assert.ok(!t.isValidBet(25));
      assert.ok(t.isValidBet(40));
      assert.ok(t.isValidBet(50));
      assert.ok(t.isValidBet(60));
      assert.ok(t.isValidBet(70));
      assert.ok(!t.isValidBet(71));
      assert.ok(!t.isValidBet(80));

      t.playerRaised(70);

      // Preflop, pot 100, dealer bet sizing
      assert.ok(!t.isValidBet(110));
      assert.ok(t.isValidBet(120));
      assert.ok(t.isValidBet(150));
      assert.ok(t.isValidBet(240));
      assert.ok(!t.isValidBet(!250));

      t.playerRaised(240);

      // Preflop, pot 340, sb bet sizing
      assert.ok(!t.isValidBet(400));
      assert.ok(t.isValidBet(410));
      assert.ok(t.isValidBet(810));
      assert.ok(!t.isValidBet(820));
      // assert.ok(!t.isValidBet(610));

      t.playerRaised(810);

      // Preflop, pot 1,150, bb bet sizing:
      assert.ok(!t.isValidBet(990));
      // The only possible raise here is all-in
      assert.ok(t.isValidBet(1000));
      assert.ok(!t.isValidBet(1010));
    });

    it('should accept valid raise', () => {
      const t = initializeTestTable();
      t.public.activeSeat = 1;

      t.playerBetted(100);
      assert.equal(t.public.biggestBet, 100, 'must account for bet');

      assert.ok(!t.isValidBet(150), 'minimum raise is 2x biggest bet');
      assert.ok(t.isValidBet(200));
      t.playerRaised(200);

      // smallest raise = biggest bet + biggest raise
      assert.ok(t.isValidBet(300));
      assert.ok(t.isValidBet(400));
      assert.ok(t.isValidBet(600));
      assert.ok(!t.isValidBet(1100), 'bet is more than chips in play');
    });

    it('should reject invalid raises', () => {
      const t = initializeTestTable();
      t.public.activeSeat = 1;

      t.playerBetted(100);
      assert.equal(t.public.biggestBet, 100, 'must account for bet');

      assert.ok(!t.isValidBet(100), 'raise is below minimum');
      assert.ok(!t.isValidBet(150), 'raise is below minimum');
      t.playerRaised(200);
      assert.ok(!t.isValidBet(200), 'raise is below min');
      assert.ok(!t.isValidBet(250), 'raise is below min');
      assert.ok(t.isValidBet(300), 'raise is below min');
      t.playerRaised(300);

      // Setting a low amount of chips of this player
      t.seats[t.public.activeSeat].public.chipsInPlay = 310;
      assert.ok(!t.isValidBet(300), 'raise below min');
      assert.ok(!t.isValidBet(305), 'raise below min');
      assert.ok(!t.isValidBet(415), 'raise more than chips is play');
      assert.equal(t.public.biggestBet, 300);
      assert.equal(t.public.biggestRaise, 100);
      assert.ok(t.isValidBet(310));
    });

    it('should reject invalid re-raises', () => {
      const t = initializeTestTableHeadsUp();
      t.public.dealerSeat = 1;
      t.initializeRound(false);
      t.playerPostedSmallBlind();
      t.playerPostedBigBlind();
      assert.equal(t.public.activeSeat, 0);
      assert.equal(t.public.biggestRaise, 20);
      assert.equal(t.public.biggestBet, 20);
      assert.equal(t.seats[1].public.bet, 10);
      assert.equal(t.seats[0].public.bet, 20);

      t.playerRaised(100);
      assert.equal(t.public.biggestBet, 100);
      assert.equal(t.public.biggestRaise, 80);
      assert.equal(t.public.activeSeat, 1);
      assert.ok(!t.isValidBet(1800));
      assert.ok(t.isValidBet(180));
      assert.ok(t.isValidBet(200));
      assert.ok(t.isValidBet(300));

      t.playerRaised(200); // Seat 1
      assert.equal(t.public.activeSeat, 0);
      assert.equal(t.public.biggestBet, 200);
      assert.equal(t.public.biggestRaise, 100);
      assert.ok(!t.isValidBet(250));
      assert.ok(t.isValidBet(350));
      assert.ok(t.isValidBet(400));

      t.playerRaised(400); // Seat 0
      assert.equal(t.public.biggestBet, 400);
      assert.equal(t.public.biggestRaise, 200);
      assert.equal(t.seats[0].public.chipsInPlay, 600);
      assert.equal(t.seats[0].public.bet, 400);
      assert.ok(!t.isValidBet(550));
      assert.ok(t.isValidBet(600));
      assert.ok(t.isValidBet(700));
      assert.ok(t.isValidBet(800));

      t.playerRaised(800); // Seat 1
      assert.equal(t.public.biggestBet, 800);
      assert.equal(t.seats[1].public.chipsInPlay, 200);
      assert.equal(t.seats[1].public.bet, 800);
      assert.ok(!t.isValidBet(800));
      assert.ok(!t.isValidBet(900));
      assert.ok(!t.isValidBet(1600));
      assert.ok(!t.isValidBet(100));
      assert.ok(!t.isValidBet(200));
      assert.ok(t.isValidBet(1000));

      t.playerRaised(1000); // Seat 0 raise to All In
      assert.equal(t.seats[0].public.chipsInPlay, 0);
      assert.equal(t.seats[0].public.bet, 1000);
      assert.ok(!t.isValidBet(800));
      assert.ok(!t.isValidBet(1600));

      assert.equal(t.seats[1].public.chipsInPlay, 200);
      assert.equal(t.seats[1].public.bet, 800);

      assert.ok(!t.isValidBet(1000));
      t.playerCalled(1000);
      assert.equal(t.seats[1].public.chipsInPlay, 0);
      assert.equal(t.seats[1].public.bet, 1000);
    });
  });

  describe('#raise()', () => {
    it('should update player data when pot is raised', () => {
      const t = initializeTestTableHeadsUp();
      t.public.dealerSeat = 1;
      t.initializeRound(false);
      t.playerPostedSmallBlind();
      t.playerPostedBigBlind();
      assert.equal(t.public.biggestBet, 20);
      assert.equal(t.public.biggestRaise, 20);
      assert.equal(t.seats[1].public.bet, 10);
      assert.equal(t.seats[1].public.chipsInPlay, 990);
      assert.equal(t.seats[0].public.bet, 20);
      assert.equal(t.seats[0].public.chipsInPlay, 980);

      assert.equal(t.public.activeSeat, 0);
      t.playerRaised(100);
      assert.equal(t.seats[0].public.bet, 100);
      assert.equal(t.public.biggestRaise, 80);
      assert.equal(t.seats[0].public.chipsInPlay, 900);
      assert.equal(t.public.seats[0].bet, 100);
      assert.equal(t.public.seats[0].chipsInPlay, 900);

      assert.equal(t.public.activeSeat, 1);
      t.playerRaised(200);
      assert.equal(t.seats[1].public.bet, 200);
      assert.equal(t.public.biggestRaise, 100);
      assert.equal(t.seats[1].public.chipsInPlay, 800);
      assert.equal(t.public.seats[1].bet, 200);
      assert.equal(t.public.seats[1].chipsInPlay, 800);
    });
  });

  describe('#initializeKeySubmit()', () => {
    it('should deal 4 cards when game mode is PLO', () => {
      const t = initializeTestTable(GAME_MODE_PLO);
      t.initializeRound();
      t.public.phase = 'mentalShuffle';
      t.endPhase();
      assert.equal(t.seats[1].public.mentalCards.length, 4);
      assert.equal(t.seats[2].public.mentalCards.length, 4);
      assert.equal(t.seats[3].public.mentalCards.length, 4);
      assert.equal(t.seats[4].public.mentalCards.length, 4);
    });
    it('should deal 2 cards when game mode is NLHE', () => {
      const t = initializeTestTable(GAME_MODE_NLHE);
      t.initializeRound();
      t.public.phase = 'mentalShuffle';
      t.endPhase();
      assert.equal(t.seats[1].public.mentalCards.length, 2);
      assert.equal(t.seats[2].public.mentalCards.length, 2);
      assert.equal(t.seats[3].public.mentalCards.length, 2);
      assert.equal(t.seats[4].public.mentalCards.length, 2);
    });
    it('should begin from the player after the dealer', () => {
      const t = initializeTestTable();
      t.initializeRound();
      t.public.dealerSeat = 1; // Next seat should be 2
      t.public.activeSeat = 1; // Fake some active seat
      t.public.phase = 'preflop';
      const t2 = initializeTestTable();
      t2.initializeRound();
      t2.public.dealerSeat = 2;
      t2.public.activeSeat = 1; // Fake some active seat

      t.initializeKeySubmit();
      t2.initializeKeySubmit();

      assert.equal(t.public.activeSeat, 2, 'starting seat must be after the dealer');
      assert.equal(t.lastPlayerToAct, 1, 'last player to act must be the dealer');
      assert.equal(t2.public.activeSeat, 3, 'starting seat must be after the dealer');
      assert.equal(t2.lastPlayerToAct, 2, 'last player to act must be the dealer');
    });

    it('should increment the game action', () => {
      const t = initializeTestTable();
      t.initializeRound();
      assert.equal(1, t.action, 'the sb action is not incremented'); // IDK how to check the timer details...
      t.public.dealerSeat = 1; // Next seat should be 2
      t.public.activeSeat = 1; // Fake some active seat
      t.public.phase = 'preflop';

      t.initializeKeySubmit();

      assert.equal(2, t.action, 'the active player is not timed'); // IDK how to check the timer details...
    });
  });

  describe('#initializeRound()', () => {
    it('should count the players in the hand', () => {
      const table = initializeTestTable();
      table.initializeRound();
      assert.equal(table.public.playersInHandCount, 4);
      assert.equal(table.playersInHandDealtCards, 4);
    });
  });

  describe('#chekPassword()', () => {
    it('should check table bassword correctly', () => {
      const table = new Table(
        0, // id
        'Sample Table', // name
        6, // seats
        20, // bb
        10, // sb
        2000, // max buy in
        400, // min buy in
        15000, // Timeout
        false, // private?
        false,
        false,
        'NLHE',
        'passw@rd',
      );

      assert.ok(table.checkPassword('passw@rd'));
      assert.ok(table.checkPassword('pASsw@rD'));
      assert.ok(table.checkPassword('passw@rd '));
      assert.ok(!table.checkPassword('notopass'));
    });
  });

  describe('#playerSubmittedShuffle()', () => {
    it('should appent deck to the mental deck object, add commitments and track historic player order', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();

      assert.equal(table.public.phase, 'mentalShuffle');
      assert.equal(table.public.activeSeat, 1);

      for (let i = 0; i < 4; i += 1) {
        table.playerSubmittedShuffle(deck.history[i + 1], deck.commitments[i + 1]);
        assert.equal(table.mentalDeck.historicPlayerOrder[i + 1], `p_${i}`);
        assert.equal(table.mentalDeck.commitments[i + 1], deck.commitments[i + 1]);
      }

      assert.equal(table.mentalDeck.history.length, 5);
      assert.equal(table.mentalDeck.historicPlayerOrder.length, 5);

      for (let i = 0; i < 4; i += 1) {
        table.playerSubmittedShuffle(deck.history[i + 5], deck.commitments[i + 1]);
        assert.equal(table.mentalDeck.historicPlayerOrder[i + 5], `p_${i}`);
      }

      assert.equal(table.mentalDeck.commitments.length, 5);
    });
  });

  describe('#initializeMentalShuffle()', () => {
    it('should increment the game action', () => {
      const t = initializeTestTable();
      t.initializeRound();
      assert.equal(1, t.action, 'the sb action is not incremented'); // IDK how to check the timer details...

      t.activeSeatTimeout = null;

      t.initializeMentalShuffle();
      assert.equal(2, t.action, 'the sb action is not incremented'); // IDK how to check the timer details...
    });

    it('should begin from the player after the dealer', () => {
      const t = initializeTestTable();
      t.initializeRound();
      t.public.dealerSeat = 1; // Next seat should be 2
      t.public.activeSeat = 1; // Fake some active seat
      const t2 = initializeTestTable();
      t2.initializeRound();
      t2.public.dealerSeat = 2;
      t2.public.activeSeat = 1; // Fake some active seat


      t.initializeMentalShuffle();
      t2.initializeMentalShuffle();

      assert.ok(t.public.activeSeat, 2);
      assert.ok(t2.public.activeSeat, 3);
    });
  });

  describe('#initializeSmallBlind()', () => {
    it('should increment the game action', () => {
      const t = initializeTestTable();
      assert.equal(t.action, 1);

      t.initializeSmallBlind();
      assert.equal(t.action, 2, 'game action not incremented');
    });
  });

  describe('#initializeBigBlind()', () => {
    it('should increment game action', () => {
      const t = initializeTestTable();
      assert.equal(t.action, 1);

      t.initializeBigBlind();
      assert.equal(t.action, 2, 'game action not incremented');
    });
  });

  describe('#playerSatIn()', () => {
    it('should invalidate pre-shuffled deck when a new player sits in', () => {
      const table = initializeTestTable();
      table.initializeRound();
      table.public.isNextDeckAvailabe = true;
      const player = new Player(socket, 123, 'new_pl', 1000);
      table.playerSatOnTheTable(player, 5, 1000);
      assert.equal(table.public.isNextDeckAvailabe, false);
    });

    it('should stop pre-shuffling deck when a new player sits in', () => {
      const table = initializeTestTable();
      table.initializeRound();
      table.public.isBackgroundShuffling = true;
      const player = new Player(socket, 123, 'new_pl', 1000);
      table.playerSatOnTheTable(player, 5, 1000);
      assert.equal(table.public.isBackgroundShuffling, false);
    });

    it('should reset sitting out rounds', () => {
      const table = initializeTestTable();
      table.initializeRound();
      table.playerSatOut(1);
      assert.equal(table.seats[1].public.sittingIn, false);
      assert.equal(table.seats[1].sittingOutRounds, 0);
      table.seats[1].sittingOutRounds = 3;
      table.playerSatIn(1);
      assert.equal(table.seats[1].sittingOutRounds, 0);
    });
  });

  describe('#playerSatOut()', () => {
    it('should end the round when players that are sitting in are < 2', () => {
      const t = initializeTestTable();
      assert.ok(t.gameIsOn);
      assert.ok(t.public.dealerSeat !== null);

      t.playerSatOut(1);
      t.playerSatOut(2);
      t.playerSatOut(3);

      assert.ok(!t.gameIsOn);
      assert.ok(t.public.dealerSeat === null);
    });

    it('should invalidate the pre-shuffled deck when the shuffle finished and a players sits out', () => {
      const table = initializeTestTable();
      table.initializeRound();
      table.initializeNextMentalShuffle();
      // When the deck has been shuffled
      table.public.isNextDeckAvailabe = true;
      table.public.isBackgroundShuffling = false;
      table.playerSatOut(1);
      assert.equal(table.public.isNextDeckAvailabe, false);
      assert.equal(table.public.isBackgroundShuffling, false);
    });

    it('should invalidate the pre-shuffled deck when the shuffle is in progress and a player sits out', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);

      table.initializeRound();
      table.initializeNextMentalShuffle();
      table.playerSubmittedNextShuffle(deck.history[1], deck.commitments[1]);

      assert.equal(table.public.isNextDeckAvailabe, false);
      assert.equal(table.public.isBackgroundShuffling, true);

      table.playerSatOut(1);
      assert.equal(table.public.isNextDeckAvailabe, false);
      assert.equal(table.public.isBackgroundShuffling, false);
    });

    it('should remove player from pot', () => {
      const t = initializeTestTable();
      t.public.dealerSeat = 4; // Force the dealer to be player at position 4
      t.initializeRound(false);
      t.playerPostedSmallBlind();
      t.playerPostedBigBlind();
      t.initializePreflop();
      t.public.phase = 'preflop';
      t.playerCalled();
      t.playerCalled();
      t.playerCalled();
      t.playerChecked();
      t.initializeNextPhase();
      assert.equal(t.public.phase, 'flop');
      assert.equal(t.pot.pots.length, 1);
      assert.equal(t.pot.pots[0].amount, 80);
      assert.equal(t.pot.pots[0].contributors.length, 4);
      [1, 2, 3, 4].forEach(s => assert.ok(t.pot.pots[0].contributors.includes(s)));
      assert.equal(t.public.activeSeat, 1);
      t.playerSatOut(3, true);
      assert.equal(t.pot.pots.length, 1);
      assert.equal(t.pot.pots[0].contributors.length, 3);
      [1, 2, 4].forEach(s => assert.ok(t.pot.pots[0].contributors.includes(s)));
    });
  });

  describe('#clearTimeouts()', () => {
    it('should increment game action when timeout is cleared', () => {
      const t = initializeTestTable();
      t.timeActivePlayer();

      const old = t.action;
      t.clearTimeouts();

      // This is to avoid ignoring table data when timeouts are cleared
      assert.equal(t.action, old + 1, 'game action must increment when timeouts are cleared');
    });
  });

  describe('#gameStopped()', () => {
    it('should reset variables when game is stopped', () => {
      const t = initializeTestTable();
      t.initializeRound();
      assert.equal(t.public.playersInHandCount, 4);
      t.stopGame();
      assert.equal(t.public.activeSeat, null);
      assert.ok(!t.gameIsOn);
      assert.equal(t.public.phase, null);
      assert.equal(t.public.playersInHandCount, 0);
    });
  });

  describe('#playerDisconnected()', () => {
    it('should not kick the player once he disconnects', () => {
      const t = initializeTestTable();
      t.playerDisconnected(1);
      assert.ok(t.seats[1]);
      assert.ok(t.seats[1].public.inHand);
    });
  });

  describe('#playerReconnected()', () => {
    it('should change the socket ID when player reconnects', () => {
      const t = initializeTestTable();
      t.seats[1].session = 'session-token';
      t.seats[1].socket = 'old-socket-id';

      t.playerReconnected(1, 'new-socket-id');

      assert.equal(t.seats[1].socket, 'new-socket-id');
    });
  });

  describe('#keySubmitTimeout()', () => {
    it('should fail on wrong action or round', () => {
      const t = initializeTestTable();
      t.action = 1;
      t.round = 1;

      assert.ok(!t.keySubmitTimeout(), 'must fail if no args are provided');
      assert.ok(!t.keySubmitTimeout(1, 2));
      assert.ok(!t.keySubmitTimeout(2, 1));
      assert.ok(!t.keySubmitTimeout(2, 2));
    });

    it('should fail when called more than one time on an action and round', () => {
      const t = initializeTestTable();
      t.action = 1;
      t.round = 1;

      assert.ok(t.keySubmitTimeout(1, 1));
      assert.ok(!t.keySubmitTimeout(1, 1));
      assert.ok(!t.keySubmitTimeout(1, 1));
      assert.ok(!t.keySubmitTimeout(1, 1));
    });

    it('must reset last ask for keys', () => {
      const t = initializeTestTable();
      t.action = 1;
      t.round = 1;

      assert.ok(t.keySubmitTimeout(1, 1));

      t.initializeRound();
      t.action = 1;
      t.round = 1;

      assert.ok(t.keySubmitTimeout(1, 1));
    });

    it('should be called sucessfully on correct round and action', () => {
      const t = initializeTestTable();
      t.action = 1;
      t.round = 1;

      assert.ok(t.keySubmitTimeout(1, 1));
    });
  });

  describe('#playerTimeout()', () => {
    it('should succeed true when round and action are correct', () => {
      const t = initializeTestTable();
      t.action = 1;
      t.round = 1;

      assert.ok(t.playerTimeout(1, 1));
    });


    it('should fail when called conseqtive times', () => {
      const t = initializeTestTable();
      t.action = 1;
      t.round = 1;

      assert.ok(t.playerTimeout(1, 1));
      assert.ok(!t.playerTimeout(1, 1));
      assert.ok(!t.playerTimeout(1, 1));
    });


    it('should fail on wrong round and action', () => {
      const t = initializeTestTable();
      t.action = 1;
      t.round = 1;

      assert.ok(!t.playerTimeout(), 'must fail if no args are provided');
      assert.ok(!t.playerTimeout(1, 2));
      assert.ok(!t.playerTimeout(2, 1));
      assert.ok(!t.playerTimeout(2, 2));
    });
  });

  describe('#getKeysToSubmit()', () => {
    it('should return correct indexes on preflopKeySubmit & showdownKeySubmit & protocolFailure', () => {
      const t = initializeTestTable();
      t.initializeRound();
      t.public.phase = 'preflopKeySubmit';
      t.public.activeSeat = 1;

      t.seats[1].public.mentalCards = [2, 10];
      t.seats[2].public.mentalCards = [1, 3];
      t.seats[3].public.mentalCards = [50, 21];
      t.seats[4].public.mentalCards = [34, 23];

      let keys = t.getKeysToSubmit();
      [1, 3, 50, 21, 34, 23].forEach(i => assert.ok(keys.includes(i), `${keys} must contain ${i}`));
      [2, 10].forEach(i => assert.ok(!keys.includes(i)));

      t.public.activeSeat = 2;
      keys = t.getKeysToSubmit();
      [2, 10, 50, 21, 34, 23].forEach(i => assert.ok(keys.includes(i)));
      [1, 3].forEach(i => assert.ok(!keys.includes(i)));

      t.public.activeSeat = 3;
      keys = t.getKeysToSubmit();
      [2, 10, 1, 3, 34, 23].forEach(i => assert.ok(keys.includes(i)));
      [50, 21].forEach(i => assert.ok(!keys.includes(i)));

      t.public.phase = 'showdownKeySubmit';
      t.public.activeSeat = 1;
      keys = t.getKeysToSubmit();
      [2, 10].forEach(i => assert.ok(keys.includes(i)));
      t.public.activeSeat = 2;
      keys = t.getKeysToSubmit();
      [1, 3].forEach(i => assert.ok(keys.includes(i)));

      t.public.phase = 'protocolFailure';
      keys = t.getKeysToSubmit();
      [...Array(53).keys()].forEach(i => keys.includes(i));
    });

    it('should return corret indexes when its called with a seat number', () => {
      const t = initializeTestTable();
      t.initializeRound();
      t.public.phase = 'preflopKeySubmit';
      t.seats[1].public.mentalCards = [2, 10];
      t.seats[2].public.mentalCards = [1, 3];
      t.seats[3].public.mentalCards = [50, 21];
      t.seats[4].public.mentalCards = [34, 23];

      let keys = t.getKeysToSubmit(1);
      [1, 3, 50, 21, 34, 23].forEach(i => assert.ok(keys.includes(i), `${keys} must contain ${i}`));
      [2, 10].forEach(i => assert.ok(!keys.includes(i)));

      keys = t.getKeysToSubmit(2);
      [2, 10, 50, 21, 34, 23].forEach(i => assert.ok(keys.includes(i)));
      [1, 3].forEach(i => assert.ok(!keys.includes(i)));

      t.public.phase = 'flopKeySubmit';
      t.mentalDeck.communityCards = [4, 10, 20];
      keys = t.getKeysToSubmit(2);
      [4, 10, 20].forEach(i => assert.ok(keys.includes(i)));
    });

    it('should return correct indexes on flop, turn, river', () => {
      const t = initializeTestTable();
      t.initializeRound();
      t.mentalDeck.communityCards = [4, 10, 20];
      t.public.activeSeat = 1;

      t.public.phase = 'flopKeySubmit';
      let keys = t.getKeysToSubmit();
      [4, 10, 20].forEach(i => assert.ok(keys.includes(i)));

      t.public.phase = 'turnKeySubmit';
      t.mentalDeck.communityCards.push(50);
      keys = t.getKeysToSubmit();
      assert.equal(keys[0], 50);

      t.public.phase = 'riverKeySubmit';
      t.mentalDeck.communityCards.push(11);
      keys = t.getKeysToSubmit();
      assert.equal(keys[0], 11);
    });
  });

  describe('#playerSubmittedKeys()', () => {
    it('should append keys to the mental deck', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      // Set initial deck to equal the one we generated
      table.mentalDeck.history[0] = deck.history[0];
      table.playerSubmittedShuffle(deck.history[1], deck.commitments[1]);
      table.playerSubmittedShuffle(deck.history[2], deck.commitments[2]);
      table.playerSubmittedShuffle(deck.history[3], deck.commitments[3]);
      table.playerSubmittedShuffle(deck.history[4], deck.commitments[4]);
      table.playerSubmittedShuffle(deck.history[5]);
      table.playerSubmittedShuffle(deck.history[6]);
      table.playerSubmittedShuffle(deck.history[7]);
      table.playerSubmittedShuffle(deck.history[8]);

      assert.equal(table.public.phase, 'preflopKeySubmit');
      assert.equal(table.public.activeSeat, 1);
      const keys = players.map(p => p.keyPairs.map(k => k.privateKey));
      assert.equal(keys.length, 4);
      keys.forEach(k => assert.equal(k.length, 53));

      table.playerSubmittedKeys(keys[0], 1);
      assert.equal(table.public.activeSeat, 2);
      table.playerSubmittedKeys(keys[1], 2);

      assert.equal(table.public.activeSeat, 3);
      table.playerSubmittedKeys(keys[2], 3);

      assert.equal(table.public.activeSeat, 4);
      table.playerSubmittedKeys(keys[3], 4);

      let playersChecked = 0;
      table.mentalDeck.keys.forEach((keysFromMap, player) => {
        assert.equal(keysFromMap.length, 53);
        playersChecked += 1;
        const playerIdx = Number(player.charAt(2));
        let keysChecked = 0;
        keysFromMap.forEach((key, i) => {
          assert.equal(Buffer.compare(key, keys[playerIdx][i]), 0);
          keysChecked += 1;
        });
        assert.equal(keysChecked, 53);
      });
      assert.equal(playersChecked, 4);
      assert.equal(table.public.phase, 'preflop');
    });

    it('should allow players to submit keys out of order', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      // Set initial deck to equal the one we generated
      table.mentalDeck.history[0] = deck.history[0];
      table.playerSubmittedShuffle(deck.history[1], deck.commitments[1]);
      table.playerSubmittedShuffle(deck.history[2], deck.commitments[2]);
      table.playerSubmittedShuffle(deck.history[3], deck.commitments[3]);
      table.playerSubmittedShuffle(deck.history[4], deck.commitments[4]);
      table.playerSubmittedShuffle(deck.history[5]);
      table.playerSubmittedShuffle(deck.history[6]);
      table.playerSubmittedShuffle(deck.history[7]);
      table.playerSubmittedShuffle(deck.history[8]);

      const keys = players.map(p => p.keyPairs.map(k => k.privateKey));
      assert.equal(keys.length, 4);
      keys.forEach(k => assert.equal(k.length, 53));

      assert.equal(table.public.activeSeat, 1);
      assert.equal(table.lastPlayerToAct, 4);
      assert.equal(table.public.phase, 'preflopKeySubmit');

      table.playerSubmittedKeys(keys[1], 2); // Seat 2 submits all keys
      assert.equal(table.public.activeSeat, 1);
      assert.equal(table.public.phase, 'preflopKeySubmit');

      table.playerSubmittedKeys([null, keys[3][1]], 4); // Does not submit all keys of interest
      assert.equal(table.public.activeSeat, 1);
      assert.equal(table.public.phase, 'preflopKeySubmit');

      table.playerSubmittedKeys(keys[0], 1); // Seat 1 submits all keys
      assert.equal(table.public.activeSeat, 3);
      assert.equal(table.public.phase, 'preflopKeySubmit');

      table.playerSubmittedKeys(keys[2], 3); // Seat 3 submits all keys
      assert.equal(table.public.activeSeat, 4);
      assert.equal(table.public.phase, 'preflopKeySubmit');

      table.playerSubmittedKeys(keys[3], 4); // Seat 4 submits all keys
      assert.equal(table.public.phase, 'preflop');

      let playersChecked = 0;
      table.mentalDeck.keys.forEach((keysFromMap, player) => {
        assert.equal(keysFromMap.length, 53);
        playersChecked += 1;
        const playerIdx = Number(player.charAt(2));
        let keysChecked = 0;
        keysFromMap.forEach((key, i) => {
          assert.equal(Buffer.compare(key, keys[playerIdx][i]), 0);
          keysChecked += 1;
        });
        assert.equal(keysChecked, 53);
      });
      assert.equal(playersChecked, 4);
      assert.equal(table.public.phase, 'preflop');
    });
  });


  describe('#sitOut()', () => {
    it('shuld it out player', () => {
      const table = initializeTestTable();
      assert.equal(table.playersSittingInCount, 4);

      table.playerSatOut(1);
      assert.equal(table.playersSittingInCount, 3);
      assert.equal(table.seats[1].public.sittingIn, false);

      table.playerSatOut(2);
      assert.equal(table.playersSittingInCount, 2);
      assert.equal(table.seats[2].public.sittingIn, false);

      table.playerSatOut(3);
      assert.equal(table.playersSittingInCount, 1);
    });
  });

  describe('#playerLeft()', () => {
    it('should end game when player leaves during shuffle 1', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      assert.equal(table.public.playersInHandCount, 4);
      assert.equal(table.public.phase, 'smallBlind');
      table.playerPostedSmallBlind();
      assert.equal(table.public.phase, 'bigBlind');
      table.playerPostedBigBlind();
      assert.equal(table.bigBlindSeat, 2);
      assert.equal(table.public.activeSeat, 1);
      // Set initial deck to equal the one we generated
      table.mentalDeck.history[0] = deck.history[0];
      assert.equal(table.public.phase, 'mentalShuffle');
      assert.equal(table.lastPlayerToAct, 4);
      assert.equal(table.public.activeSeat, 1);
      table.playerSubmittedShuffle(deck.history[1], deck.commitments[1]);
      assert.equal(table.public.activeSeat, 2);
      table.playerSubmittedShuffle(deck.history[2], deck.commitments[2]);
      assert.equal(table.public.activeSeat, 3);
      table.playerSubmittedShuffle(deck.history[3], deck.commitments[3]);
      assert.equal(table.lastPlayerToAct, 4);
      assert.equal(table.public.activeSeat, 4);
      table.playerLeft(1);
      assert.equal(table.public.phase, 'smallBlind');
      assert.equal(table.public.seats[1], null);
      assert.equal(table.seats[1], null);
    });

    it('should end game when player leaves during shuffle 2', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      assert.equal(table.public.playersInHandCount, 4);
      assert.equal(table.public.phase, 'smallBlind');
      table.playerPostedSmallBlind();
      assert.equal(table.public.phase, 'bigBlind');
      table.playerPostedBigBlind();
      assert.equal(table.bigBlindSeat, 2);
      assert.equal(table.public.activeSeat, 1);
      // Set initial deck to equal the one we generated
      table.mentalDeck.history[0] = deck.history[0];
      assert.equal(table.public.phase, 'mentalShuffle');
      assert.equal(table.lastPlayerToAct, 4);
      assert.equal(table.public.activeSeat, 1);
      table.playerSubmittedShuffle(deck.history[1], deck.commitments[1]);
      assert.equal(table.public.activeSeat, 2);
      table.playerSubmittedShuffle(deck.history[2], deck.commitments[2]);
      assert.equal(table.public.activeSeat, 3);
      table.playerSubmittedShuffle(deck.history[3], deck.commitments[3]);
      assert.equal(table.lastPlayerToAct, 4);
      assert.equal(table.public.activeSeat, 4);
      table.playerLeft(4);
      assert.equal(table.public.seats[4], null);
      assert.equal(table.seats[4], null);
      assert.ok(table.public.seats[1]); // seat one is here
      assert.equal(table.public.phase, 'smallBlind');
    });

    it('should not end round when player leaves during showdown', () => {
      const table = initializeTestTable();
      table.public.phase = 'showdown';
      table.public.playersInHandCount = 4;
      assert.equal(table.lastOffence, null);
      table.playerLeft(2);
      assert.equal(table.lastOffence, null);
      assert.equal(table.public.phase, 'showdown');
    });

    it('should invalidate pre-shuffled deck', () => {
      const table = initializeTestTable();
      table.public.isNextDeckAvailabe = true;
      table.nextShuffleSeats = [1, 2, 3, 4];
      table.public.phase = 'showdown';
      table.public.playersInHandCount = 4;
      assert.equal(table.lastOffence, null);
      table.playerLeft(2);
      assert.equal(table.public.isNextDeckAvailabe, false);
    });

    it('should end round and penalize when player leaves during flop', () => {
      const table = initializeTestTable();
      table.public.phase = 'flop';
      table.public.playersInHandCount = 4;
      assert.equal(table.lastOffence, null);
      table.playerLeft(2);
      assert.equal(table.lastOffence.seat, 2);
      assert.equal(table.public.phase, 'smallBlind');
    });

    it('should not end round when all keys are submitted and player leaves', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      assert.equal(table.public.playersInHandCount, 4);
      assert.equal(table.public.phase, 'smallBlind');
      table.playerPostedSmallBlind();
      assert.equal(table.public.phase, 'bigBlind');
      table.playerPostedBigBlind();
      assert.equal(table.bigBlindSeat, 2);
      assert.equal(table.public.activeSeat, 1);
      // Set initial deck to equal the one we generated
      table.mentalDeck.history[0] = deck.history[0];
      assert.equal(table.public.phase, 'mentalShuffle');
      table.playerSubmittedShuffle(deck.history[1], deck.commitments[1]);
      table.playerSubmittedShuffle(deck.history[2], deck.commitments[2]);
      table.playerSubmittedShuffle(deck.history[3], deck.commitments[3]);
      table.playerSubmittedShuffle(deck.history[4], deck.commitments[4]);
      assert.equal(table.mentalDeck.commitments.length, 5);
      assert.equal(table.mentalDeck.history.length, 5);
      table.playerSubmittedShuffle(deck.history[5], 'should-ignore');
      table.playerSubmittedShuffle(deck.history[6]);
      table.playerSubmittedShuffle(deck.history[7]);
      table.playerSubmittedShuffle(deck.history[8], null);
      assert.equal(table.mentalDeck.commitments.length, 5);
      assert.equal(table.mentalDeck.history.length, 9);
      table.mentalDeck.history.forEach((d, deckIdx) => {
        assert.equal(d.length, 52);
        assert.ok(
          d.every((card, cardIdx) => Buffer.compare(card, deck.history[deckIdx][cardIdx]) === 0),
          `in deck ${deckIdx} card does not match card from valid deck`,
        );
      });
      assert.equal(table.public.phase, 'preflopKeySubmit');
      const { mentalCards } = table.seats[1].public;
      const keys = players[0].keyPairs.map((k, i) => mentalCards.includes(i) ? sha256(k.privateKey) : k.privateKey);
      table.playerSubmittedAllKeys(keys, 1);
      assert.ok(table.seats[1].hasSubmittedAllKeys);
      table.playerLeft(1);
      assert.equal(table.public.phase, 'preflopKeySubmit');
    });
  });

  describe('#endRound()', () => {
    it('should increment sitting out rounds and kick players who have been sitting out for more than 4 rounds', () => {
      const table = initializeTestTable();
      table.seats[1].sitOut();
      table.endRound();
      assert.equal(table.seats[1].sittingOutRounds, 1);
      assert.equal(table.seats[2].sittingOutRounds, 0);
      assert.equal(table.seats[3].sittingOutRounds, 0);
      assert.equal(table.seats[4].sittingOutRounds, 0);
      assert.equal(table.public.playersSeatedCount, 4);
      table.endRound();
      table.endRound();
      assert.equal(table.seats[2].sittingOutRounds, 0);
      assert.equal(table.seats[3].sittingOutRounds, 0);
      assert.equal(table.seats[4].sittingOutRounds, 0);
      assert.equal(table.public.playersSeatedCount, 4);
      assert.equal(table.seats[1].sittingOutRounds, 3);
      assert.ok(table.seats[1]);
      table.endRound();
      table.endRound();
      table.endRound();
      table.endRound();
      table.endRound();
      table.endRound();
      table.endRound();
      assert.equal(table.public.playersSeatedCount, 4);
      table.endRound();
      assert.equal(table.public.playersSeatedCount, 3);
      assert.equal(table.seats[1], null);
    });
  });

  describe('#initializeNextMentalShuffle()', () => {
    it('should include player in the shuffle if he sits in during the blinds', () => {
      const table = initializeTestTable();
      const newPlayer = new Player(socket, 10, 'p_10', 1000);
      table.public.dealerSeat = 4;
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerSatOnTheTable(newPlayer, 5, 1000);
      table.playerPostedBigBlind();
      table.initializeNextMentalShuffle(true);
      assert.equal(table.nextShuffleSeats.length, 5);
    });

    it('should include player in next shuffle if he sits in befor the small blind', () => {
      const table = initializeTestTable();
      const newPlayer = new Player(socket, 10, 'p_10', 1000);
      table.public.dealerSeat = 4;
      table.initializeRound(false);
      table.playerSatOnTheTable(newPlayer, 5, 1000);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      table.initializeNextMentalShuffle(true);
      assert.equal(table.nextShuffleSeats.length, 5);
    });

    it('should include player in the next shuffle if he sits during mental shuffle', () => {
      const table = initializeTestTable();
      const newPlayer = new Player(socket, 10, 'p_10', 1000);
      table.public.dealerSeat = 4;
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      assert.equal(table.public.phase, 'mentalShuffle');
      table.playerSatOnTheTable(newPlayer, 5, 1000);
      table.initializeNextMentalShuffle(true);
      assert.equal(table.nextShuffleSeats.length, 5);
    });

    it('should initialize data correctly', () => {
      const table = initializeTestTable();
      table.public.dealerSeat = 4;
      table.initializeRound(false);
      assert.equal(table.public.isBackgroundShuffling, false);
      assert.equal(table.public.isNextDeckAvailabe, false);

      table.initializeNextMentalShuffle(true);
      assert.equal(table.public.isBackgroundShuffling, true);
      assert.equal(table.public.isNextDeckAvailabe, false);
      assert.equal(table.public.nextShuffleActiveSeat, 2);
      assert.equal(table.nextShuffleSeats.length, 4);
      assert.ok(table.nextMentalDeck);
      assert.equal(table.nextMentalDeck.history.length, 1);
    });
  });

  describe('#playerSubmittedNextShuffle()', () => {
    it('should add shuffle data properly to the next mental deck', () => {
      const table = initializeTestTable();
      const [deck, players] = correctMentalShuffle(4);

      table.public.dealerSeat = 4;
      table.initializeRound(false);
      table.initializeNextMentalShuffle();
      assert.equal(table.public.isBackgroundShuffling, true);
      assert.equal(table.public.isNextDeckAvailabe, false);
      assert.equal(table.public.nextShuffleActiveSeat, 2);
      table.playerSubmittedNextShuffle(deck.history[1], deck.commitments[1]);
      assert.equal(table.nextMentalDeck.historicPlayerOrder[1], 'p_1');
      table.playerSubmittedNextShuffle(deck.history[2], deck.commitments[2]);
      table.playerSubmittedNextShuffle(deck.history[3], deck.commitments[3]);
      table.playerSubmittedNextShuffle(deck.history[4], deck.commitments[4]);

      assert.equal(table.nextMentalDeck.historicPlayerOrder[1], 'p_1');
      assert.equal(table.nextMentalDeck.historicPlayerOrder[2], 'p_2');
      assert.equal(table.nextMentalDeck.historicPlayerOrder[3], 'p_3');
      assert.equal(table.nextMentalDeck.historicPlayerOrder[4], 'p_0');
      assert.equal(table.nextMentalDeck.historicPlayerOrder.length, 5);
      assert.equal(table.nextMentalDeck.commitments.length, 5);

      table.playerSubmittedNextShuffle(deck.history[5], 'asd');
      table.playerSubmittedNextShuffle(deck.history[6], 'somebs');
      table.playerSubmittedNextShuffle(deck.history[7], 'asdasd');
      table.playerSubmittedNextShuffle(deck.history[8], 'asdasd');

      assert.equal(table.nextMentalDeck.historicPlayerOrder[5], 'p_1');
      assert.equal(table.nextMentalDeck.historicPlayerOrder[6], 'p_2');
      assert.equal(table.nextMentalDeck.historicPlayerOrder[7], 'p_3');
      assert.equal(table.nextMentalDeck.historicPlayerOrder[8], 'p_0');
      assert.equal(table.nextMentalDeck.historicPlayerOrder.length, 9);

      assert.equal(table.nextMentalDeck.commitments.length, 5);
      assert.equal(table.public.isBackgroundShuffling, false);
      assert.equal(table.public.isNextDeckAvailabe, true);
    });
  });

  describe('#playerOffended()', () => {
    it('should penalize pot amount after preflop', () => {
      const table = initializeTestTable();
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      table.endPhase();
      table.endPhase();
      assert.equal(table.public.phase, 'preflop');
      assert.equal(table.public.activeSeat, 3);
      table.playerCalled();
      table.playerCalled();
      table.playerCalled();
      table.playerChecked();
      table.pot.addTableBets(table.seats);
      assert.equal(table.pot.pots[0].amount, 80);
      table.seats.filter(s => s !== null).forEach(s => assert.equal(s.public.chipsInPlay, 980));
      table.playerOffended(1);
      assert.equal(table.seats[1], null);
      assert.equal(table.lastOffence.seat, 1);
      assert.equal(table.lastOffence.penaltyChips, 240);
      assert.equal(table.public.phase, 'smallBlind');
    });

    it('should not penalize on preflop', () => {
      const table = initializeTestTable();
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      table.endPhase();
      table.endPhase();
      assert.equal(table.public.phase, 'preflop');
      assert.equal(table.public.activeSeat, 3);
      table.playerCalled();
      table.playerCalled();
      table.playerCalled();
      table.playerOffended(1);
      assert.equal(table.seats[1], null);
      assert.equal(table.lastOffence.seat, 1);
      assert.equal(table.lastOffence.penaltyChips, 0);
      assert.equal(table.public.phase, 'smallBlind');
    });

    it('should not penalize on mental shuffle', () => {
      const table = initializeTestTable();
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      assert.equal(table.public.phase, 'mentalShuffle');
      table.playerOffended(1);
      assert.equal(table.seats[1], null);
      assert.equal(table.lastOffence.seat, 1);
      assert.equal(table.lastOffence.penaltyChips, 0);
      assert.equal(table.public.phase, 'smallBlind');
    });
  });

  describe('#kickAllPlayers()', () => {
    it('should kick all players', () => {
      const table = initializeTestTable();
      assert.equal(table.public.playersSeatedCount, 4);
      assert.ok(table.seats[1]);
      assert.ok(table.seats[2]);
      assert.ok(table.seats[3]);
      assert.ok(table.seats[4]);
      assert.ok(table.public.seats[1]);
      table.kickAllPlayers();
      assert.equal(table.seats[1], null);
      assert.equal(table.seats[2], null);
      assert.equal(table.seats[3], null);
      assert.equal(table.seats[4], null);
      assert.equal(table.public.seats[1], null);
      assert.equal(table.public.playersSeatedCount, 0);
      assert.equal(table.public.dealerSeat, null);
    });
  });

  describe('#playerPostedSmallBlind()', () => {
    it('should have biggest raise equals bb even when player has not enough chips for sb', () => {
      const table = initializeTestTable();
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      assert.equal(table.public.activeSeat, 1);
      assert.equal(table.public.smallBlind, 10);
      table.seats[1].public.chipsInPlay = 5;

      table.playerPostedSmallBlind();
      assert.equal(table.public.biggestRaise, 20);
      assert.equal(table.seats[1].public.chipsInPlay, 0);
    });
  });

  describe('#playerPostedBigBlind()', () => {
    it('should use pre-shuffled deck when one is available', () => {
      const table = initializeTestTable();
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      table.initializeNextMentalShuffle();
      table.public.isNextDeckAvailabe = true;
      // Distinguish the mental deck from a newly created one
      table.nextMentalDeck.historicPlayerOrder.push('somePlayer');

      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();
      assert.equal(table.public.phase, 'preflopKeySubmit');
      assert.equal(table.mentalDeck.historicPlayerOrder[1], 'somePlayer');
    });

    it('should calculate correct biggest raise equals bb even when player has not enough chips', () => {
      const table = initializeTestTable();
      table.public.dealerSeat = 4; // Force the dealer to be player at position 4
      table.initializeRound(false);
      assert.equal(table.public.activeSeat, 1);
      assert.equal(table.public.bigBlind, 20);
      table.seats[2].public.chipsInPlay = 15;

      table.playerPostedSmallBlind();
      table.playerPostedBigBlind();

      assert.equal(table.public.biggestRaise, 20);
      assert.equal(table.seats[2].public.chipsInPlay, 0);
    });
  });
});
