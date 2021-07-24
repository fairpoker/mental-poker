import { LobbyActionTypes } from '../actions/lobby';

const initialState = {
  accURL: '',
  hostname: '',
  whiteLabel: '',
  isError: false,
  isFetching: false,
  tables: [],
  sortProperties: {
    sortBy: 'players',
    sortOrder: 'DSC',
  },
  currencyRates: {
    data: {},
    isFetching: false,
    isError: false,
  },
  filterProperties: {
    hideEmptyTables: false,
    hideFullTables: false,
    filterTableType: 0,
    filterGameType: '',
    filterStakes: '',
  },
};

export default (state = initialState, action) => {
  switch (action.type) {
    case LobbyActionTypes.FETCH_TABLES_REQUEST: {
      return {
        ...state,
        isFetching: true,
      };
    }
    case LobbyActionTypes.FETCH_TABLES_SUCCESS: {
      return {
        ...state,
        isFetching: false,
        accURL: action.payload.accURL,
        hostname: action.payload.hostname,
        tables: action.payload.tables,
        whiteLabel: action.payload.whiteLabel,
      };
    }
    case LobbyActionTypes.FETCH_TABLES_FAILURE: {
      return {
        ...state,
        isError: true,
        isFetching: false,
      };
    }
    case LobbyActionTypes.CHANGE_FILTER_PROPERTIES: {
      return {
        ...state,
        filterProperties: {
          ...state.filterProperties,
          ...action.payload,
        },
      };
    }
    case LobbyActionTypes.CHANGE_SORT_PROPERTIES: {
      const {
        sortBy,
        sortOrder,
      } = action.payload;
      return {
        ...state,
        sortProperties: {
          sortBy,
          sortOrder,
        },
      };
    }
    case LobbyActionTypes.FETCH_CURRENCY_RATE_REQUEST: {
      return {
        ...state,
        currencyRates: {
          ...state.currencyRates,
          isFetching: true,
        },
      };
    }
    case LobbyActionTypes.FETCH_CURRENCY_RATE_SUCCESS: {
      return {
        ...state,
        currencyRates: {
          ...state.currencyRates,
          isFetching: false,
          data: action.payload,
        },
      };
    }
    case LobbyActionTypes.FETCH_CURRENCY_RATE_FAILURE: {
      return {
        ...state,
        currencyRates: {
          ...state.currencyRates,
          isFetching: false,
          isError: true,
        },
      };
    }
    default:
      return state;
  }
};
