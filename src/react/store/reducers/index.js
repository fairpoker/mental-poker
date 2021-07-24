import { combineReducers } from 'redux';

import auth from './auth';
import game from './game';
import lobby from './lobby';

export default combineReducers({
  auth,
  game,
  lobby,
});
