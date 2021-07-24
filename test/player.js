/* global describe, it */
const assert = require('assert');
const Player = require('../src/poker_modules/player');

describe('Player', () => {
  describe('#prepareForNewRound()', () => {
    it('should reset check if player has submitted all keys', () => {
      const p = new Player();
      p.hasSubmittedAllKeys = true;
      p.sittingOutRounds = 5;
      p.prepareForNewRound();
      assert.equal(p.hasSubmittedAllKeys, false);
      assert.equal(p.sittingOutRounds, 0);
    });
  });

  describe('#evaluateHand()', () => {
    describe("Hold'em", () => {
      it('should assign higher rating to better hand', () => {
        const p1 = new Player();
        const p2 = new Player();
        const p3 = new Player();
        const p4 = new Player();
        const p5 = new Player();
        const p6 = new Player();

        const board = ['As', '7s', '5c', '2s', '9d'];
        p1.cards = ['Ad', 'Kd'];
        p2.cards = ['7d', '2c'];
        p3.cards = ['Kc', '4d'];
        p4.cards = ['2d', '3h'];
        p5.cards = ['9s', '8s'];
        p6.cards = ['3c', '6c'];

        p1.evaluateHand(board);
        p2.evaluateHand(board);
        p3.evaluateHand(board);
        p4.evaluateHand(board);
        p5.evaluateHand(board);
        p6.evaluateHand(board);

        assert.equal(p1.evaluatedHand.rank, 'pair');
        assert.equal(p2.evaluatedHand.rank, 'two pair');
        assert.equal(p3.evaluatedHand.rank, 'high card');
        assert.equal(p4.evaluatedHand.rank, 'pair');
        assert.equal(p5.evaluatedHand.rank, 'flush');
        assert.equal(p6.evaluatedHand.rank, 'high card');
        assert.ok(p3.evaluatedHand.rating > p6.evaluatedHand.rating);
        assert.ok(p2.evaluatedHand.rating > p1.evaluatedHand.rating);
        assert.ok(p4.evaluatedHand.rating > p3.evaluatedHand.rating);
        assert.ok(p5.evaluatedHand.rating > p2.evaluatedHand.rating);
      });

      it('should correctly rank two pair vs two pair', () => {
        const p1 = new Player();
        const p2 = new Player();

        const board = ['As', 'Jc', '5d', '5c', '9s'];
        p1.cards = ['8s', '8h'];
        p2.cards = ['9s', '4d'];

        p1.evaluateHand(board);
        p2.evaluateHand(board);

        assert.ok(p2.evaluatedHand.rating > p1.evaluatedHand.rating);
      });

      it('should corectly split two pair same rating', () => {
        const p1 = new Player();
        const p2 = new Player();
        const p3 = new Player();

        const board = ['Ts', 'Tc', '5d', '5c', '2s'];
        p1.cards = ['9h', '8s'];
        p2.cards = ['3s', '9d'];
        p3.cards = ['2c', '9h'];

        p1.evaluateHand(board);
        p2.evaluateHand(board);
        p3.evaluateHand(board);

        assert.equal(p1.evaluatedHand.rank, 'two pair');
        assert.equal(p2.evaluatedHand.rank, 'two pair');
        assert.equal(p3.evaluatedHand.rank, 'two pair');
        assert.equal(p3.evaluatedHand.rating, p2.evaluatedHand.rating);
        assert.equal(p2.evaluatedHand.rating, p1.evaluatedHand.rating);
      });

      it('should corectly split two pair same rating 2', () => {
        const p1 = new Player();
        const p2 = new Player();

        const board = ['As', 'Jc', '5d', 'Ts', '5c'];
        p1.cards = ['Th', 'Qs'];
        p2.cards = ['Tc', '4h'];

        p1.evaluateHand(board);
        p2.evaluateHand(board);

        assert.equal(p1.evaluatedHand.rank, 'two pair');
        assert.equal(p2.evaluatedHand.rank, 'two pair');
        assert.equal(p2.evaluatedHand.rating, p1.evaluatedHand.rating);
      });

      it('should correctly rank three of kind vs two pair', () => {
        const p1 = new Player();
        const p2 = new Player();

        const board = ['Ks', 'Qc', 'Jd', '8s', '5c'];
        p1.cards = ['Qh', 'Qs'];
        p2.cards = ['Kc', '8c'];

        p1.evaluateHand(board);
        p2.evaluateHand(board);

        assert.equal(p1.evaluatedHand.rank, 'three of a kind');
        assert.equal(p2.evaluatedHand.rank, 'two pair');
        assert.ok(p2.evaluatedHand.rating < p1.evaluatedHand.rating);
      });

      it('should correctly rank full house vs flush', () => {
        const p1 = new Player();
        const p2 = new Player();

        const board = ['2s', '4s', '5s', '5h', '2c'];
        p1.cards = ['2h', '6s'];
        p2.cards = ['Ks', 'As'];

        p1.evaluateHand(board);
        p2.evaluateHand(board);

        assert.equal(p1.evaluatedHand.rank, 'full house');
        assert.equal(p2.evaluatedHand.rank, 'flush');
        assert.ok(p2.evaluatedHand.rating < p1.evaluatedHand.rating);
      });

      it('should assign higher hand rating to better hand from full set of hands', () => {
        const p1 = new Player();
        const p2 = new Player();
        const p3 = new Player();
        const p4 = new Player();
        const p5 = new Player();
        const p6 = new Player();
        const p7 = new Player();

        const board = ['3s', '4s', '5c', '5s', '9d'];
        p1.cards = ['6s', '7s']; // Straight flush
        p2.cards = ['Ad', 'Kh']; // Pair + high card
        p3.cards = ['3d', 'Kc']; // Two pair
        p4.cards = ['5c', 'Kd']; // Three of a kind
        p5.cards = ['Ah', '2c']; // Straight
        p6.cards = ['5h', '9d']; // Full house
        p7.cards = ['5h', '5d']; // Four of a kind (impossible given prev hands but ok for test)

        p1.evaluateHand(board);
        p2.evaluateHand(board);
        p3.evaluateHand(board);
        p4.evaluateHand(board);
        p5.evaluateHand(board);
        p6.evaluateHand(board);
        p7.evaluateHand(board);

        assert.equal(p1.evaluatedHand.rank, 'straight flush');
        assert.equal(p2.evaluatedHand.rank, 'pair');
        assert.ok(p1.evaluatedHand.rating > p2.evaluatedHand.rating);
        assert.equal(p3.evaluatedHand.rank, 'two pair');
        assert.ok(p3.evaluatedHand.rating > p2.evaluatedHand.rating);
        assert.equal(p4.evaluatedHand.rank, 'three of a kind');
        assert.ok(p4.evaluatedHand.rating > p3.evaluatedHand.rating);
        assert.equal(p5.evaluatedHand.rank, 'straight');
        assert.ok(p5.evaluatedHand.rating > p4.evaluatedHand.rating);
        assert.equal(p6.evaluatedHand.rank, 'full house');
        assert.ok(p6.evaluatedHand.rating > p5.evaluatedHand.rating);
        assert.equal(p7.evaluatedHand.rank, 'four of a kind');
        assert.ok(p7.evaluatedHand.rating > p6.evaluatedHand.rating);
        assert.ok(p1.evaluatedHand.rating > p7.evaluatedHand.rating);
      });

      it('should detect the flushes for all suits', () => {
        const boards = [
          ['7s', '9s', '2s', '3d', 'Ad'],
          ['7d', '9d', '2d', '3s', 'Ac'],
          ['7c', '9c', '2c', '3s', 'Ad'],
          ['7h', '9h', '2h', '3s', 'Ad'],
        ];
        const hands = [
          ['As', '3s'],
          ['Ad', '3d'],
          ['Ac', '3c'],
          ['Ah', '3h'],
        ];

        boards.forEach((board, i) => {
          const p = new Player();
          p.cards = hands[i];
          p.evaluateHand(board);
          assert.equal(p.evaluatedHand.rank, 'flush', `borad - ${board}, hand - ${hands[i]} must be a flush`);
        });
      });

      it('should corrently rank flushes', () => {
        const p1 = new Player();
        const p2 = new Player();
        const p3 = new Player();
        const p4 = new Player();

        const board = ['7s', '9s', '2s', '3d', 'Ad'];
        p1.cards = ['As', '3s']; // Best
        p2.cards = ['Ks', '4s']; // Second best
        p3.cards = ['Qs', '5s'];
        p4.cards = ['6s', '8s'];

        p1.evaluateHand(board);
        p2.evaluateHand(board);
        p3.evaluateHand(board);
        p4.evaluateHand(board);

        assert.ok(p3.evaluatedHand.rating > p4.evaluatedHand.rating);
        assert.ok(p2.evaluatedHand.rating > p3.evaluatedHand.rating);
        assert.ok(p1.evaluatedHand.rating > p2.evaluatedHand.rating);
      });

      it('should assign best rating to royal flush', () => {
        const p1 = new Player();
        const p2 = new Player();

        const board = ['Ks', 'Qs', 'Js', 'Ts', '7d'];
        p1.cards = ['As', '6c'];
        p2.cards = ['9s', 'Ad'];

        p1.evaluateHand(board);
        p2.evaluateHand(board);

        assert.equal(p1.evaluatedHand.rank, 'royal flush');
        assert.equal(p2.evaluatedHand.rank, 'straight flush');
        assert.ok(p1.evaluatedHand.rating > p2.evaluatedHand.rating);
      });

      it('should choose the best two out of three pairs', () => {
        const p1 = new Player();
        const p2 = new Player();

        const board = ['5s', '5d', '6s', '6d', '7d'];
        p1.cards = ['Ts', '7c'];
        p2.cards = ['2s', 'Ad'];

        p1.evaluateHand(board);
        p2.evaluateHand(board);

        assert.equal(p1.evaluatedHand.name, 'two pair, sevens and sixes');
        assert.equal(p2.evaluatedHand.name, 'two pair, sixes and fives');
        assert.ok(p1.evaluatedHand.rating > p2.evaluatedHand.rating);
      });
    });

    describe('Omaha', () => {
      it('should find best hand', () => {
        const p1 = new Player();
        const p2 = new Player();
        const p3 = new Player();

        const board = ['3s', '4d', 'Ts', '5d', 'Ad'];
        p1.cards = ['5s', 'Tc', 'Th', 'Td'];
        p2.cards = ['2s', '6c', '7c', '5d'];

        p1.evaluateHand(board);
        p2.evaluateHand(board);

        assert.equal(p1.evaluatedHand.name, 'three of a kind, tens');
        assert.equal(p2.evaluatedHand.name, 'a straight to seven');
        assert.ok(p2.evaluatedHand.rating > p1.evaluatedHand.rating);

        const board2 = ['Kh', 'Th', '6s', '3h', '2h'];
        p3.cards = ['Ah', 'Kc', 'Qs', 'Jc'];

        p3.evaluateHand(board2);

        assert.equal(p3.evaluatedHand.name, 'a pair of kings');
      });

      it('should recognize hands correctly', () => {  
        const boardsAndCards = [
          {
            board: ['4c', '7d', '9s', 'Ah', '5d'],
            cards: ['3c', 'Ac', '8d', 'Td'],
            expectHand: 'a pair of aces',
          },
          {
            board: ['4c', '7d', '9s', 'Ah', '5d'],
            cards: ['4d', '7c', '8d', 'Td'],
            expectHand: 'two pair, sevens and fours',
          },
          {
            board: ['4c', '7d', '9s', 'Ah', '5d'],
            cards: ['7s', '7c', '8d', 'Td'],
            expectHand: 'three of a kind, sevens',
          },
          {
            board: ['7c', '7d', '9s', 'Ah', '5d'],
            cards: ['7s', '3c', '8d', 'Td'],
            expectHand: 'three of a kind, sevens',
          },
          {
            board: ['7c', '8d', '9s', 'Ah', '5d'],
            cards: ['Js', '3c', '8s', 'Td'],
            expectHand: 'a straight to jack',
          },
          {
            board: ['7c', '8d', '9s', 'Ad', '5d'],
            cards: ['Jd', '3c', '8s', 'Td'],
            expectHand: 'a flush, ace high',
          },
          {
            board: ['8c', '8d', '9s', 'Ad', '5d'],
            cards: ['9d', '9c', '8s', 'Td'],
            expectHand: 'a full house, nines full of eights',
          },
          {
            board: ['8c', '8d', '9s', 'Ad', '5d'],
            cards: ['9d', '8h', '8s', 'Td'],
            expectHand: 'four of a kind, eights',
          },
          {
            board: ['5d', '9c', 'Tc', 'Ad', '8c'],
            cards: ['Jc', 'Qc', '8s', 'Td'],
            expectHand: 'a straight flush, eight to queen',
          },
          {
            board: ['5d', '9c', 'Tc', 'Jc', 'Ac'],
            cards: ['Qc', 'Kc', '8s', 'Td'],
            expectHand: 'a royal flush',
          },

          // Tricky PLO hands below:
          {
            // no royal flush here :(
            board: ['5d', 'Qc', 'Tc', 'Jc', 'Ac'],
            cards: ['Kc', 'Ad', '7s', '3d'],
            expectHand: 'a straight to ace',
          },
          {
            // No flush here
            board: ['4d', '5d', 'Jd', 'Kd', '3h'],
            cards: ['7d', '4s', 'Ts', '2c'],
            expectHand: 'a pair of fours',
          },
          {
            // No straight
            board: ['4c', '5s', '6h', '7s', 'Js'],
            cards: ['Ac', '2c', '8s', 'Th'],
            expectHand: 'ace high',
          },
        ];

        boardsAndCards.forEach((t) => {
          const p = new Player();
          p.cards = t.cards;
          p.evaluateHand(t.board);
          assert.equal(p.evaluatedHand.name, t.expectHand);
        });
      });
    });
  });
});
