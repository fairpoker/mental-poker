import { createSelector } from 'reselect';

const getAuthState = state => state.auth;

const getUserData = createSelector(getAuthState, ({ user }) => user);

const selectSessionToken = createSelector(getAuthState, ({ sessionToken }) => sessionToken);

export default {
  selectUserName: createSelector(getUserData, ({ screenName }) => screenName),
  selectUserBalance: createSelector(getUserData, ({ totalChips }) => totalChips),
  selectSessionToken,
};
