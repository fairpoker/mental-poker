import axios from 'axios';

const PREFIX = '[Lobby]';

export const FETCH_TABLES_REQUEST = `${PREFIX} FETCH_TABLES_REQUEST`;
export const FETCH_TABLES_SUCCESS = `${PREFIX} FETCH_TABLES_SUCCESS`;
export const FETCH_TABLES_FAILURE = `${PREFIX} FETCH_TABLES_FAILURE`;

export const CHANGE_FILTER_PROPERTIES = `${PREFIX} CHANGE_FILTER_PROPERTIES`;
export const CHANGE_SORT_PROPERTIES = `${PREFIX} CHANGE_SORT_PROPERTIES`;

export const FETCH_CURRENCY_RATE_REQUEST = `${PREFIX} FETCH_CURRENCY_RATE_REQUEST`;
export const FETCH_CURRENCY_RATE_SUCCESS = `${PREFIX} FETCH_CURRENCY_RATE_SUCCESS`;
export const FETCH_CURRENCY_RATE_FAILURE = `${PREFIX} FETCH_CURRENCY_RATE_FAILURE`;

const fetchTablesRequest = () => ({
  type: FETCH_TABLES_REQUEST,
});

const fetchTablesSuccess = payload => ({
  type: FETCH_TABLES_SUCCESS,
  payload,
});

const fetchTablesFailure = () => ({
  type: FETCH_TABLES_FAILURE,
});

const filterTables = payload => ({
  type: CHANGE_FILTER_PROPERTIES,
  payload,
});

const sortTables = payload => ({
  type: CHANGE_SORT_PROPERTIES,
  payload,
});

const fetchCurrencyRateRequest = () => ({
  type: FETCH_CURRENCY_RATE_REQUEST,
});

const fetchCurrencyRateSuccess = payload => ({
  type: FETCH_CURRENCY_RATE_SUCCESS,
  payload,
});

const fetchCurrencyRateFailure = () => ({
  type: FETCH_CURRENCY_RATE_FAILURE,
});

export const fetchTables = () => (dispatch, getState) => {
  dispatch(fetchTablesRequest());
  const {
    sortProperties: {
      sortBy,
      sortOrder,
    },
  } = getState().lobby;

  return axios
    .get('/lobby-data')
    .then(({ data }) => {
      dispatch(fetchTablesSuccess(data));
      dispatch(sortTables({ sortBy, sortOrder }));

      return data;
    })
    .catch((error) => {
      dispatch(fetchTablesFailure());

      throw error;
    });
};

export const fetchCurrencyRate = () => (dispatch) => {
  dispatch(fetchCurrencyRateRequest());

  return axios
    .get('https://api.coindesk.com/v1/bpi/currentprice.json')
    .then(({ data }) => {
      dispatch(fetchCurrencyRateSuccess(data.bpi));
      return data;
    })
    .catch((error) => {
      dispatch(fetchCurrencyRateFailure());

      throw error;
    });
};

export const LobbyActionTypes = {
  CHANGE_FILTER_PROPERTIES,
  CHANGE_SORT_PROPERTIES,
  FETCH_TABLES_REQUEST,
  FETCH_TABLES_SUCCESS,
  FETCH_TABLES_FAILURE,
  FETCH_CURRENCY_RATE_REQUEST,
  FETCH_CURRENCY_RATE_SUCCESS,
  FETCH_CURRENCY_RATE_FAILURE,
};

export default {
  fetchTables,
  sortTables,
  filterTables,
  fetchCurrencyRate,
};
