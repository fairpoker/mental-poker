export const currencies = {
  BTC: 'BTC',
  MBTC: 'MBTC',
  BITS: 'BITS',
  SATOSHI: 'SATOSHI',
};

export const cardCodes = [
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

export const cardCount = 52;

export const timeoutRanges = [
  {
    range: 'turbo',
    minValue: 0,
    maxValue: 15000,
  },
  {
    range: 'normal',
    minValue: 15001,
    maxValue: 30000,
  },
  {
    range: 'slow',
    minValue: 30001,
    maxValue: Number.POSITIVE_INFINITY,
  },
];

export const pingRanges = [
  {
    range: '100%',
    wifiIconValue: 5,
    minValue: 0,
    maxValue: 75,
  },
  {
    range: '80%',
    wifiIconValue: 4,
    minValue: 75,
    maxValue: 150,
  },
  {
    range: '60%',
    wifiIconValue: 3,
    minValue: 150,
    maxValue: 250,
  },
  {
    range: '40%',
    wifiIconValue: 2,
    minValue: 251,
    maxValue: 450,
  },
  {
    range: '20%',
    wifiIconValue: 1,
    minValue: 451,
    maxValue: 850,
  },
  {
    range: '1%',
    wifiIconValue: 0,
    minValue: 851,
    maxValue: Number.POSITIVE_INFINITY,
  },
];

export const stakesRanges = [
  {
    value: 'micro',
    minBB: 0,
    maxBB: 200,
  },
  {
    value: 'small',
    minBB: 201,
    maxBB: 2000,
  },
  {
    value: 'medium',
    minBB: 2001,
    maxBB: 10000,
  },
  {
    value: 'high',
    minBB: 10001,
    maxBB: Number.POSITIVE_INFINITY,
  },
];
