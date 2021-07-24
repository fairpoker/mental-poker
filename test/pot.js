/* global describe, it */
const assert = require('assert');
const Pot = require('../src/poker_modules/pot');
const Player = require('../src/poker_modules/player');
const { getRake, getMaxRake } = require('../src/utils/helpers');

const getPlayerWithBet = (bet = 0, seat, inHand = true) => {
  const p = new Player();
  p.public.bet = bet;
  p.public.chipsInPlay = 100;
  p.seat = seat;
  p.public.inHand = inHand;
  return p;
};

const getPlayer = (balance, seat, name) => {
  const p = new Player();
  p.public.inHand = true;
  p.public.chipsInPlay = balance;
  p.seat = seat;
  p.public.name = name;
  return p;
};

const bb = 2;
const maxBuyIn = 250;
const seatsCount = 6;
const rakeAmount = getRake(bb, seatsCount);


describe('Pot', () => {
  it('should initialize pot correctly', () => {
    const pot = new Pot('tableid', bb, seatsCount, maxBuyIn);
    assert.equal(pot.tableID, 'tableid');
    assert.equal(pot.bigBlind, 2);
    assert.equal(pot.seatsCount, 6);
    assert.equal(pot.maxBuyIn, 250);
  });
  describe('#addTableBets()', () => {
    it('should add bets to pot when bets are equal', () => {
      const pot = new Pot();
      const players = [
        getPlayerWithBet(10, 0),
        null,
        getPlayerWithBet(10, 2),
        null,
        getPlayerWithBet(10, 4),
        getPlayerWithBet(10, 5),
      ];

      pot.addTableBets(players);

      assert.equal(pot.pots[0].amount, 40);
      players.filter(p => p !== null).forEach((p) => {
        assert.equal(p.public.bet, 0);
        assert.ok(pot.pots[0].contributors.includes(p.seat));
      });

      // Another betting round
      players[0].bet(20);
      players[2].bet(20);
      players[4].bet(20);
      players[5].bet(20);

      pot.addTableBets(players);

      assert.equal(pot.pots[0].amount, 120);
      players.filter(p => p !== null).forEach((p) => {
        assert.equal(p.public.bet, 0);
        assert.ok(pot.pots[0].contributors.includes(p.seat));
      });
    });

    it('should add bets to the pot from players who are not in the hand (have folded)', () => {
      const pot = new Pot();
      const players = [
        getPlayerWithBet(10, 0),
        null,
        getPlayerWithBet(10, 2),
        null,
        getPlayerWithBet(10, 4),
        getPlayerWithBet(5, 5, false), // Has folded
      ];

      pot.addTableBets(players);

      assert.equal(pot.pots[0].amount, 35);
      assert.equal(pot.pots.length, 1);
      assert.ok(pot.pots[0].contributors.includes(0), 'seat 0 must be in the pot');
      assert.ok(pot.pots[0].contributors.includes(4), 'seat 4 must be in the pot');
      assert.ok(pot.pots[0].contributors.includes(2), 'seat 2 must be in the pot');

      players[0].bet(20);
      players[2].bet(10); // Has called but now folded
      players[2].fold();
      players[4].bet(20); // Called

      pot.addTableBets(players);

      assert.equal(pot.pots[0].amount, 85);
      assert.equal(pot.pots.length, 1);
      assert.ok(pot.pots[0].contributors.includes(0), 'seat 0 must be in the pot');
      assert.ok(pot.pots[0].contributors.includes(4), 'seat 4 must be in the pot');
      assert.ok(!pot.pots[0].contributors.includes(2), 'seat 2 must not be in the pot');
    });

    it('should build a sidepot', () => {
      const pot = new Pot();
      const players = [
        getPlayerWithBet(10, 0),
        null,
        getPlayerWithBet(10, 2),
        getPlayerWithBet(10, 3),
        getPlayerWithBet(10, 4),
        getPlayerWithBet(5, 5), // All in with 5 chips
      ];

      pot.addTableBets(players);
      assert.equal(pot.pots[0].amount, 25);
      assert.equal(pot.pots[0].contributors.length, 5);
      assert.ok(pot.pots[0].contributors.includes(5), 'seat five must be in main pot');
      assert.equal(pot.pots[1].amount, 20);
      assert.equal(pot.pots[1].contributors.length, 4);
      assert.ok(!pot.pots[1].contributors.includes(5), 'seat five must be out of sidepot');

      players[0].bet(30);
      players[2].bet(30); // Called
      players[3].bet(15); // All in
      players[4].bet(10); // Called less but folded
      players[4].fold();

      pot.addTableBets(players);
      assert.equal(pot.pots[0].amount, 25); // Main pot hasn't changed
      assert.equal(pot.pots[0].contributors.length, 4);
      assert.ok(pot.pots[0].contributors.includes(5), 'seat five must be in main pot');
      assert.ok(!pot.pots[0].contributors.includes(4), 'seat four is out of all pots');
      assert.equal(pot.pots[1].amount, 75);
      assert.equal(pot.pots[1].contributors.length, 3);
      assert.ok(pot.pots[1].contributors.includes(0));
      assert.ok(pot.pots[1].contributors.includes(2));
      assert.ok(pot.pots[1].contributors.includes(3));
      assert.equal(pot.pots[2].amount, 30);
      assert.equal(pot.pots[2].contributors.length, 2);
      assert.ok(pot.pots[2].contributors.includes(0));
      assert.ok(pot.pots[2].contributors.includes(2));
    });

    it('should build a sidepot when all bets are equal but the player is all-in', () => {
      const pot = new Pot();

      // One player can call the 10 chips bet but nas no chips remaining
      const allInP = getPlayerWithBet(10, 5);
      allInP.public.chipsInPlay = 0;
      const players = [
        getPlayerWithBet(10, 0),
        null,
        getPlayerWithBet(10, 2),
        getPlayerWithBet(10, 3),
        getPlayerWithBet(10, 4),
        allInP,
      ];

      pot.addTableBets(players);
      assert.equal(pot.pots.length, 2);
      assert.equal(pot.pots[0].amount, 50);
      assert.ok(pot.pots[0].contributors.includes(0));
      assert.ok(pot.pots[0].contributors.includes(2));
      assert.ok(pot.pots[0].contributors.includes(3));
      assert.ok(pot.pots[0].contributors.includes(4));
      assert.ok(pot.pots[0].contributors.includes(5));
      assert.equal(pot.pots[1].amount, 0);

      players[0].bet(20);
      players[2].bet(20);
      players[3].bet(20);
      players[4].bet(20);

      pot.addTableBets(players);
      assert.equal(pot.pots.length, 2);
      assert.equal(pot.pots[1].amount, 80);
      assert.equal(pot.pots[0].contributors.length, 5);
      assert.equal(pot.pots[1].contributors.length, 4);
      assert.ok(!pot.pots[1].contributors.includes(5));
    });

    it('should build a sidepot when all bets are equal but more than one player is all-in', () => {
      const pot = new Pot();

      // One player can call the 10 chips bet but nas no chips remaining
      const allInP4 = getPlayerWithBet(10, 4);
      allInP4.public.chipsInPlay = 0;

      const allInP5 = getPlayerWithBet(10, 5);
      allInP5.public.chipsInPlay = 0;
      const players = [
        getPlayerWithBet(10, 0),
        null,
        getPlayerWithBet(10, 2),
        getPlayerWithBet(10, 3),
        allInP4,
        allInP5,
      ];

      pot.addTableBets(players);
      assert.equal(pot.pots.length, 2);
      assert.equal(pot.pots[0].amount, 50);
      assert.equal(pot.pots[1].amount, 0);
      assert.equal(pot.pots[0].contributors.length, 5);

      players[0].bet(20);
      players[2].bet(20);
      players[3].bet(20);

      pot.addTableBets(players);

      assert.equal(pot.pots.length, 2);
      assert.equal(pot.pots[0].amount, 50);
      assert.equal(pot.pots[1].amount, 60);
      assert.equal(pot.pots[1].contributors.length, 3);
      assert.equal(pot.pots[0].contributors.length, 5);
    });
  });

  describe('#addPlayersBets()', () => {
    it('should add the player bet to the pot', () => {
      const pot = new Pot();
      pot.pots[0].amount = 60;
      pot.pots.contributors = [1, 2, 3];
      const p = getPlayerWithBet(10, 4);

      pot.addPlayersBets(p);
      assert.equal(pot.pots[0].amount, 70);
      assert.ok(pot.pots[0].contributors.includes(4));
      assert.equal(p.public.bet, 0);
    });
  });

  describe('#removePlayer()', () => {
    it('should remove player from all pots', () => {
      const pot = new Pot();
      pot.pots[0].contributors = [0, 1, 2];
      pot.pots.push({
        amount: 0,
        contributors: [],
      });
      pot.pots[1].contributors = [0, 1];

      pot.removePlayer(0);

      assert.ok(!pot.pots[0].contributors.includes(0));
      assert.ok(pot.pots[0].contributors.includes(1));
      assert.ok(pot.pots[0].contributors.includes(2));
      assert.ok(!pot.pots[1].contributors.includes(0));
      assert.ok(pot.pots[1].contributors.includes(1));
    });
  });

  describe('#takeRake()', () => {
    it('should take correct amount of rake when pot will split', () => {
      const pot = new Pot('table_id', bb, seatsCount, maxBuyIn);
      pot.pots[0].amount = 100;
      pot.pots[0].contributors = [1, 2];

      const seats = [
        null,
        getPlayer(200, 1, 'p_1'),
        getPlayer(200, 2, 'p_2'),
        null,
        null,
        null,
      ];

      const board = ['As', '7s', '5c', '2s', '9d'];
      seats[1].cards = ['As', '3d'];
      seats[2].cards = ['Ac', '3c'];
      seats[1].evaluateHand(board);
      seats[2].evaluateHand(board);

      pot.distributeToWinners(seats, 1, 2);

      const b1 = 200 + 50 - Math.ceil(50 * 0.015);

      assert.equal(seats[1].public.chipsInPlay, b1);
      assert.equal(seats[2].public.chipsInPlay, b1);
    });

    it('should not take more than maximum rake', () => {
      const potAmt = 2000000;
      const pot = new Pot('tableid', bb, seatsCount, maxBuyIn);
      pot.pots[0].amount = potAmt; // 2,000 bits pot to hit max rake
      pot.pots[0].contributors = [1, 2];

      const seats = [
        null,
        getPlayer(100, 1, 'p_1'),
        getPlayer(100, 2, 'p_2'),
        null,
        null,
        null,
      ];

      const maxRake = getMaxRake(bb);
      const bal = potAmt + 100 - maxRake;

      pot.giveToWinner(seats[1], 'turn');
      assert.equal(seats[1].public.chipsInPlay, bal);
    });

    it('should take correct amount of rake when player folds', () => {
      const pot = new Pot('tableid', bb, seatsCount, maxBuyIn);
      pot.pots[0].amount = 100;
      pot.pots[0].contributors = [1, 2];

      const seats = [
        null,
        getPlayer(100, 1, 'p_1'),
        getPlayer(100, 2, 'p_2'),
        getPlayer(100, 3, 'p_3'),
        null,
        null,
      ];

      const bal = 100 + 100 - Math.ceil(rakeAmount * 100);

      pot.giveToWinner(seats[1], 'turn', 3);
      assert.equal(seats[1].public.chipsInPlay, bal);
    });

    it('should not take rake on preflop', () => {
      const pot = new Pot('tableid', bb, seatsCount, maxBuyIn);
      pot.pots[0].amount = 100;
      pot.pots[0].contributors = [1, 2];

      const seats = [
        null,
        getPlayer(100, 1, 'p_1'),
        getPlayer(100, 2, 'p_2'),
        null,
        null,
        null,
      ];

      pot.giveToWinner(seats[1], 'preflop');
      assert.equal(seats[1].public.chipsInPlay, 200);
    });
  });

  describe('#distributeToWinners()', () => {
    it('should give pot to strongest hand', () => {
      const pot = new Pot('tableid', bb, seatsCount, maxBuyIn);
      pot.pots[0].amount = 100;
      pot.pots[0].contributors = [1, 2];

      const seats = [
        null,
        getPlayer(100, 1, 'p_1'),
        getPlayer(100, 2, 'p_2'),
        getPlayer(100, 3, 'p_3'),
        null,
        null,
      ];
      const board = ['As', '7s', '5c', '2s', '9d'];
      seats[1].cards = ['As', 'Kd'];
      seats[2].cards = ['Ac', '3c'];
      seats[1].evaluateHand(board);
      seats[2].evaluateHand(board);

      const msg = pot.distributeToWinners(seats, 1, 3);

      const rake = Math.ceil(100 * rakeAmount);

      assert.equal(seats[1].public.chipsInPlay, 200 - rake);
      assert.equal(seats[2].public.chipsInPlay, 100);
      assert.equal(msg[0], 'p_1 wins the pot (96) with a pair of aces [ A&#9824;, A&#9824;, K&#9830;, 9&#9830;, 7&#9824;]');
    });

    it('should split pot when hand rating is equal', () => {
      const pot = new Pot('tableid', bb, seatsCount, maxBuyIn);
      pot.pots[0].amount = 100;
      pot.pots[0].contributors = [1, 2];

      const seats = [
        null,
        getPlayer(100, 1, 'p_1'),
        getPlayer(100, 2, 'p_2'),
        null,
        null,
        null,
      ];
      const board = ['As', '7s', '5c', '2s', '9d'];
      seats[1].cards = ['As', '3d'];
      seats[2].cards = ['Ac', '3c'];
      seats[1].evaluateHand(board);
      seats[2].evaluateHand(board);

      const msg = pot.distributeToWinners(seats, 1);

      const rake = Math.ceil(50 * 0.015);

      assert.equal(seats[1].public.chipsInPlay, 150 - rake);
      assert.equal(seats[2].public.chipsInPlay, 150 - rake);
      assert.equal(msg[0], `p_1 ties the pot (${50 - rake}) with a pair of aces [A&#9824;, A&#9824;, 9&#9830;, 7&#9824;, 5&#9827;]`);
      assert.equal(msg[1], `p_2 ties the pot (${50 - rake}) with a pair of aces [A&#9827;, A&#9824;, 9&#9830;, 7&#9824;, 5&#9827;]`);
    });
  });
});
