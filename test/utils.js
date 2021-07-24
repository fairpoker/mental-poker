/* global describe, it */

const assert = require('assert');
const {
  getRake,
  getMaxRake,
  evaluateSevenCardsPokerHand,
  findBestPokerHandOnBoard,
} = require('../src/utils/helpers');

describe('Utils', () => {
  describe('#findBestPokerHandOnBoard()', () => {
    it('should find best PLO hand on board with three community cards', () => {
      const tests = [
        {
          cards: ['4h', '7h', 'Jc', '3s'],
          board: ['Kh', 'Td', '4s'],
          expected: 'a pair of fours',
        },
        {
          cards: ['4h', '7h', 'Jc', '3s'],
          board: ['Kh', '7d', '4s'],
          expected: 'two pair, sevens and fours',
        },
        {
          cards: ['4h', '4h', '7c', '3s'],
          board: ['Kh', '7d', '4s'],
          expected: 'three of a kind, fours',
        },
        {
          cards: ['4h', '5h', '7c', '3s'],
          board: ['6h', '7d', '8s'],
          expected: 'a straight to eight',
        },
        {
          cards: ['4h', '5h', '7c', '3s'],
          board: ['6h', '2h', '8h'],
          expected: 'a flush, eight high',
        },
        {
          cards: ['4h', '5h', '4c', '3s'],
          board: ['4d', '7h', '7h'],
          expected: 'a full house, fours full of sevens',
        },
        {
          cards: ['4h', '5h', '4c', '3s'],
          board: ['4d', '4s', '7h'],
          expected: 'four of a kind, fours',
        },
        {
          cards: ['9h', 'Kh', '4c', '3s'],
          board: ['Jh', 'Qh', 'Th'],
          expected: 'a straight flush, nine to king',
        },
        {
          cards: ['Ah', 'Kh', '4c', '3s'],
          board: ['Jh', 'Qh', 'Th'],
          expected: 'a royal flush',
        },
        {
          cards: ['4h', '6s', 'Jc', '4s'],
          board: ['Td', '9h', '4c'],
          expected: 'three of a kind, fours',
        },
        {
          cards: ['4h', '6s', 'Jc', '4s'],
          board: ['Td', '6h', '4c', '6d'],
          expected: 'a full house, sixes full of fours',
        },
      ];

      tests.forEach((test) => {
        const res = findBestPokerHandOnBoard(test.cards, test.board);
        assert.equal(res.name, test.expected);
      });
    });
  });
  describe('#evaluateSevenCardsPokerHand()', () => {
    it('should evaluate correct five card poker hand', () => {
      let res = evaluateSevenCardsPokerHand(['As', '4d', 'Ts', '5d', 'Ad']);
      assert.equal(res.name, 'a pair of aces');

      res = evaluateSevenCardsPokerHand(['As', '4d', '4s', '5d', 'Ad']);
      assert.equal(res.name, 'two pair, aces and fours');

      res = evaluateSevenCardsPokerHand(['5s', '5d', '5c', '7d', 'Ad']);
      assert.equal(res.name, 'three of a kind, fives');

      res = evaluateSevenCardsPokerHand(['Ts', 'Jd', 'Qc', 'Kd', 'Ad']);
      assert.equal(res.name, 'a straight to ace');

      res = evaluateSevenCardsPokerHand(['7d', '5d', 'Qd', 'Kd', 'Ad']);
      assert.equal(res.name, 'a flush, ace high');
    });
  });
  describe('#getMaxRake()', () => {
    it('should return correct amount of max rake', () => {
      assert.equal(
        getMaxRake(1, 5),
        10000,
      );

      assert.equal(
        getMaxRake(200, 5),
        10000,
      );

      assert.equal(
        getMaxRake(200, 2),
        2500,
      );

      assert.equal(
        getMaxRake(5000, 2),
        3500,
      );

      assert.equal(
        getMaxRake(100000, 2),
        5000,
      );
    });
  });
  describe('#getRake()', () => {
    it('should return correct rake for standard tables', () => {
      const r60 = getRake(20, 6);
      assert.equal(r60, 0.04);
      const r61 = getRake(50, 6);
      assert.equal(r61, 0.04);
      const r62 = getRake(1000, 6);
      assert.equal(r62, 0.025);
      const r63 = getRake(2000, 6);
      assert.equal(r63, 0.025);
      const r64 = getRake(5000, 6);
      assert.equal(r64, 0.02);
      const r6def = getRake(10000, 6);
      assert.equal(r6def, 0.02);

      const r21 = getRake(1000, 2);
      assert.equal(r21, 0.02);
      const r22 = getRake(2000, 2);
      assert.equal(r22, 0.02);
      const r23 = getRake(5000, 2);
      assert.equal(r23, 0.02);
      const r24 = getRake(10000, 2);
      assert.equal(r24, 0.015);
      const r2def = getRake(100000, 2);
      assert.equal(r2def, 0.015);

      assert.equal(getRake(50000, 2), 0.015);
    });
  });
});
