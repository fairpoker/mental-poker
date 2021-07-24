const mainURL = process.env.MAIN_URL || 'https://fair.poker';

const cardCodes = [
  'As', 'Ah', 'Ad', 'Ac',
  'Ks', 'Kh', 'Kd', 'Kc',
  'Qs', 'Qh', 'Qd', 'Qc',
  'Js', 'Jh', 'Jd', 'Jc',
  'Ts', 'Th', 'Td', 'Tc',
  '9s', '9h', '9d', '9c',
  '8s', '8h', '8d', '8c',
  '7s', '7h', '7d', '7c',
  '6s', '6h', '6d', '6c',
  '5s', '5h', '5d', '5c',
  '4s', '4h', '4d', '4c',
  '3s', '3h', '3d', '3c',
  '2s', '2h', '2d', '2c',
];

// [0, 1, 2, 3, 4]
const FIVE_ELEMENTS_ARRAY_COMBS = [
  [0, 1, 2],
  [0, 1, 3],
  [0, 1, 4],
  [0, 2, 3],
  [0, 2, 4],
  [0, 3, 4],
  [1, 2, 3],
  [1, 2, 4],
  [1, 3, 4],
  [2, 3, 4],
];

const cardCount = 52;

const GAME_MODE_NLHE = 'NLHE';
const GAME_MODE_PLO = 'PLO';


module.exports = {
  mainURL,
  cardCodes,
  cardCount,
  GAME_MODE_NLHE,
  GAME_MODE_PLO,
  FIVE_ELEMENTS_ARRAY_COMBS,
};
