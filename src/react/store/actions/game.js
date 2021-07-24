import axios from 'axios';
import {
  createConfig,
  createPlayer,
} from 'mental-poker';
import { sha256 } from 'js-sha256';

import { cardCount } from '../../utils/const';

const PREFIX = '[Game]';

export const ENTER_TABLE = `${PREFIX} ENTER_TABLE`;
export const LEAVE_TABLE = `${PREFIX} LEAVE_TABLE`;

export const FETCH_TABLE_DATA_REQUEST = `${PREFIX} FETCH_TABLE_DATA_REQUEST`;
export const FETCH_TABLE_DATA_SUCCESS = `${PREFIX} FETCH_TABLE_DATA_SUCCESS`;
export const FETCH_TABLE_DATA_FAILURE = `${PREFIX} FETCH_TABLE_DATA_FAILURE`;

export const PREPARE_FOR_MENTAL_POKER_ROUND = `${PREFIX} PREPARE_FOR_MENTAL_POKER_ROUND`;
export const PREPARE_NEXT_MENTAL_DECK = `${PREFIX} PREPARE_NEXT_MENTAL_DECK`;
export const SET_MENTAL_CARDS = `${PREFIX} SET_MENTAL_CARDS`;
export const UPDATE_MENTAL_DECK = `${PREFIX} UPDATE_MENTAL_DECK`;
export const UPDATE_NEXT_MENTAL_DECK = `${PREFIX} UPDATE_NEXT_MENTAL_DECK`;
export const SET_STARTING_DECK = `${PREFIX} SET_STARTING_DECK`;
export const SET_FINAL_DECK = `${PREFIX} SET_FINAL_DECK`;
export const USE_NEXT_MENTAL_DECK = `${PREFIX} USE_NEXT_MENTAL_DECK`;

export const SAVE_RECEIVED_MESSAGE = `${PREFIX} SAVE_RECEIVED_MESSAGE`;
export const CLEAR_MESSAGES = `${PREFIX} CLEAR_MESSAGES`;

export const SAVE_OPEN_CARDS = `${PREFIX} SAVE_OPEN_CARDS`;
export const SAVE_SEAT_ACTION = `${PREFIX} SAVE_SEAT_ACTION`;
export const SAVE_BOARD = `${PREFIX} SAVE_BOARD`;
export const SAVE_MADE_HAND = `${PREFIX} SAVE_MADE_HAND`;
export const SAVE_OPEN_SHOWDOWN_CARDS = `${PREFIX} SAVE_OPEN_SHOWDOWN_CARDS`;
export const SET_PLANNED_PROTOCOL_OFFENCE = `${PREFIX} SET_PLANNED_PROTOCOL_OFFENCE`;

const enterTable = payload => ({
  type: ENTER_TABLE,
  payload,
});

const leaveTable = () => ({
  type: LEAVE_TABLE,
});

const fetchTableDataRequest = () => ({
  type: FETCH_TABLE_DATA_REQUEST,
});

const fetchTableDataSuccess = payload => ({
  type: FETCH_TABLE_DATA_SUCCESS,
  payload,
});

const fetchTableDataFailure = () => ({
  type: FETCH_TABLE_DATA_FAILURE,
});

const setMentalCards = payload => ({
  type: SET_MENTAL_CARDS,
  payload,
});

const updateMentalDeck = payload => ({
  type: UPDATE_MENTAL_DECK,
  payload,
});

const setPlannedProtocolOffence = payload => ({
  type: SET_PLANNED_PROTOCOL_OFFENCE,
  payload,
});

const updateNextMentalDeck = payload => ({
  type: UPDATE_NEXT_MENTAL_DECK,
  payload,
});

const useNextMentalDeck = () => ({
  type: USE_NEXT_MENTAL_DECK,
});

const saveReceivedMessage = payload => ({
  type: SAVE_RECEIVED_MESSAGE,
  payload,
});

const clearMessages = () => ({
  type: CLEAR_MESSAGES,
});

const setStartingMentalDeck = payload => ({
  type: SET_STARTING_DECK,
  payload,
});

const setFinalMentalDeck = payload => ({
  type: SET_FINAL_DECK,
  payload,
});

const saveOpenCards = payload => ({
  type: SAVE_OPEN_CARDS,
  payload,
});

const saveSeatAction = payload => ({
  type: SAVE_SEAT_ACTION,
  payload,
});

const saveBoard = payload => ({
  type: SAVE_BOARD,
  payload,
});

const saveOpenShowdownCards = payload => ({
  type: SAVE_OPEN_SHOWDOWN_CARDS,
  payload,
});

const saveMadeHand = payload => ({
  type: SAVE_MADE_HAND,
  payload,
});

const fetchTableData = tableID => (dispatch) => {
  dispatch(fetchTableDataRequest());

  return axios
    .get(`/table-data/${tableID}`)
    .then(({ data: { table } }) => {
      dispatch(fetchTableDataSuccess(table));

      return table;
    })
    .catch((error) => {
      dispatch(fetchTableDataFailure());

      throw error;
    });
};

const generateNewMentalDeck = () => {
  const conf = createConfig(cardCount);
  const mentalPlayer = createPlayer(conf);
  const privateKeyHashes = mentalPlayer.keyPairs.map(k => sha256(k.privateKey));
  const commitment = sha256(privateKeyHashes.reduce((acc, key) => acc + key));

  return {
    mentalPlayer,
    privateKeyHashes,
    commitment,
  };
};

const prepareForMentalPokerRoundSuccess = payload => ({
  type: PREPARE_FOR_MENTAL_POKER_ROUND,
  payload,
});

const prepareForMentalPokerRound = () => (dispatch) => {
  const deckData = generateNewMentalDeck();

  dispatch(prepareForMentalPokerRoundSuccess(deckData));
};

const prepareNextMentalDeckSuccess = payload => ({
  type: PREPARE_NEXT_MENTAL_DECK,
  payload,
});

const prepareNextMentalDeck = () => (dispatch) => {
  const deckData = generateNewMentalDeck();

  dispatch(prepareNextMentalDeckSuccess(deckData));
};

export const GameActionTypes = {
  CLEAR_MESSAGES,
  ENTER_TABLE,
  FETCH_TABLE_DATA_FAILURE,
  FETCH_TABLE_DATA_REQUEST,
  FETCH_TABLE_DATA_SUCCESS,
  LEAVE_TABLE,
  PREPARE_FOR_MENTAL_POKER_ROUND,
  PREPARE_NEXT_MENTAL_DECK,
  SAVE_BOARD,
  SAVE_OPEN_CARDS,
  SAVE_OPEN_SHOWDOWN_CARDS,
  SAVE_RECEIVED_MESSAGE,
  SAVE_SEAT_ACTION,
  SET_FINAL_DECK,
  SET_MENTAL_CARDS,
  SET_STARTING_DECK,
  UPDATE_MENTAL_DECK,
  UPDATE_NEXT_MENTAL_DECK,
  USE_NEXT_MENTAL_DECK,
  SAVE_MADE_HAND,
  SET_PLANNED_PROTOCOL_OFFENCE,
};

export default {
  clearMessages,
  enterTable,
  fetchTableData,
  fetchTableDataSuccess,
  leaveTable,
  prepareForMentalPokerRound,
  prepareNextMentalDeck,
  updateNextMentalDeck,
  useNextMentalDeck,
  saveBoard,
  saveOpenCards,
  saveOpenShowdownCards,
  saveReceivedMessage,
  saveSeatAction,
  setFinalMentalDeck,
  setMentalCards,
  setStartingMentalDeck,
  updateMentalDeck,
  setPlannedProtocolOffence,
  generateNewMentalDeck,
  saveMadeHand,
};
