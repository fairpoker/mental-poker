const PREFIX = '[Auth]';

export const GET_USER_SESSION_SUCCESS = `${PREFIX} GET_USER_SESSION_SUCCESS`;
export const SET_USER_BALANCE = `${PREFIX} SET_USER_BALANCE`;

export const setUserSession = payload => ({
  type: GET_USER_SESSION_SUCCESS,
  payload,
});

export const setUserBalance = payload => ({
  type: SET_USER_BALANCE,
  payload,
});
