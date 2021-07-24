import createjs from 'preload-js';

import { cardCodes } from './const';

export default () => {
  const manifestCards = cardCodes.map(
    cardCode => ({ src: `${cardCode}.png`, id: cardCode }),
  );

  const manifestRewers = [
    { src: 'cardLocked.png', id: 'cardLocked' },
    { src: 'Rewers.jpeg', id: 'Rewers' },
  ];

  const preload = new createjs.LoadQueue(true, 'test/');
  preload.loadManifest(manifestCards, true, '/static/images/cards/');
  preload.loadManifest(manifestRewers, true, '/static/images/');
};
