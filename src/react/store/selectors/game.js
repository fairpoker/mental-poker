import { createSelector } from 'reselect';

const getGameState = state => state.game;

const getCurrentMentalDeck = state => state.game.currentMentalDeckData;

const getNextMentalDeck = state => state.game.nextMentalDeckData;

const selectCommitment = createSelector(getCurrentMentalDeck, ({ commitment }) => commitment);

const selectFinalMentalDeck = createSelector(getCurrentMentalDeck, ({ finalMentalDeck }) => finalMentalDeck);

const selectPlannedProtocolOffence = createSelector(getGameState, ({ plannedProtocolOffence }) => plannedProtocolOffence);

const selectKeyPairs = createSelector(getCurrentMentalDeck, ({ mentalPlayer }) => mentalPlayer.keyPairs);

const selectMentalDeck = createSelector(getCurrentMentalDeck, ({ mentalDeck }) => mentalDeck);

const selectMentalPlayer = createSelector(getCurrentMentalDeck, ({ mentalPlayer }) => mentalPlayer);

const selectPrivateKeyHashes = createSelector(getCurrentMentalDeck, ({ privateKeyHashes }) => privateKeyHashes);

const selectStartingMentalDeck = createSelector(getCurrentMentalDeck, ({ startingMentalDeck }) => startingMentalDeck);

const selectNextKeyPairs = createSelector(getNextMentalDeck, ({ mentalPlayer }) => mentalPlayer.keyPairs);

const selectNextCommitment = createSelector(getNextMentalDeck, ({ commitment }) => commitment);

const selectCurrentTableData = createSelector(getGameState, ({ currentTable }) => currentTable);

const selectDecryptedBoard = createSelector(getGameState, ({ decryptedBoard }) => decryptedBoard);

const selectMyMentalCards = createSelector(getGameState, ({ myMentalCards }) => myMentalCards);

const selectNotifications = createSelector(getGameState, ({ notifications }) => notifications);

const selectOpenCards = createSelector(getGameState, ({ openCards }) => openCards);

const selectMadeHand = createSelector(getGameState, ({ madeHand }) => madeHand);

const selectOpenShowdownCards = createSelector(getGameState, ({ showdownCards }) => showdownCards);

const selectSeatAction = state => state.game.seatAction;

const selectTableGameData = state => state.game.tableData;


export default {
  selectCommitment,
  selectCurrentTableData,
  selectDecryptedBoard,
  selectFinalMentalDeck,
  selectKeyPairs,
  selectMentalDeck,
  selectMentalPlayer,
  selectMyMentalCards,
  selectNotifications,
  selectOpenCards,
  selectOpenShowdownCards,
  selectPrivateKeyHashes,
  selectSeatAction,
  selectStartingMentalDeck,
  selectTableGameData,
  selectNextKeyPairs,
  selectNextCommitment,
  selectPlannedProtocolOffence,
  selectMadeHand,
};
