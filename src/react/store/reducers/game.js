import { GameActionTypes } from '../actions/game';

const initialTableState = {
  id: '',
  name: '',
  isPasswordProtected: false,
  seatsCount: 0,
  bigBlind: 0,
  smallBlind: 0,
  minBuyIn: 0,
  maxBuyIn: 0,
  playersSeatedCount: 0,
  gameMode: '',
  pot: [
    {
      amount: 0,
      contributors: [],
    },
  ],
  biggestBet: 0,
  biggestRaise: 0,
  dealerSeat: null,
  activeSeat: null,
  seats: [],
  phase: null,
  board: [
    '',
    '',
    '',
    '',
    '',
  ],
  log: {
    message: '',
    seat: '',
    action: '',
    notification: '',
  },
  timeout: 0,
  playersInHandCount: 0,
};

const initialMentalDeckState = {
  mentalDeck: {},
  mentalPlayer: {},
  privateKeyHashes: [], // SHA256 of each private key
  commitment: null, // Full mental commitment of player
  startingMentalDeck: [],
  finalMentalDeck: [],
};

const initialState = {
  currentTable: {},
  decryptedBoard: [],
  madeHand: '',
  isFetching: false,
  isError: false,
  kickoutNotification: '',
  currentMentalDeckData: { ...initialMentalDeckState },
  nextMentalDeckData: { ...initialMentalDeckState },
  // Only for debugging: how this player will offend the mental poker protocol
  plannedProtocolOffence: [],
  myMentalCards: [],
  notifications: [],
  openCards: [],
  seatAction: {
    seat: null,
    notification: '',
  },
  showdownCards: {},
  tableData: { ...initialTableState },
};

export default (state = initialState, action) => {
  switch (action.type) {
    case GameActionTypes.ENTER_TABLE: {
      return {
        ...state,
        currentTable: action.payload,
      };
    }
    case GameActionTypes.LEAVE_TABLE: {
      return {
        ...state,
        currentTable: {},
        tableData: { ...initialTableState },
        decryptedBoard: [],
        openCards: [],
      };
    }
    case GameActionTypes.FETCH_TABLE_DATA_REQUEST: {
      return {
        ...state,
        isFetching: true,
        isError: false,
      };
    }
    case GameActionTypes.FETCH_TABLE_DATA_SUCCESS: {
      return {
        ...state,
        isFetching: false,
        tableData: action.payload,
      };
    }
    case GameActionTypes.FETCH_TABLE_DATA_FAILURE: {
      return {
        ...state,
        isFetching: false,
        isError: true,
      };
    }
    case GameActionTypes.PREPARE_FOR_MENTAL_POKER_ROUND: {
      return {
        ...state,
        currentMentalDeckData: {
          mentalPlayer: action.payload.mentalPlayer,
          privateKeyHashes: action.payload.privateKeyHashes,
          commitment: action.payload.commitment,
          finalMentalDeck: [],
          startingMentalDeck: [],
        },
        myMentalCards: [],
        decryptedBoard: [],
        openCards: [],
        showdownCards: {},
        madeHand: '',
      };
    }
    case GameActionTypes.PREPARE_NEXT_MENTAL_DECK: {
      return {
        ...state,
        nextMentalDeckData: {
          mentalPlayer: action.payload.mentalPlayer,
          privateKeyHashes: action.payload.privateKeyHashes,
          commitment: action.payload.commitment,
          finalMentalDeck: [],
          startingMentalDeck: [],
        },
      };
    }
    case GameActionTypes.SET_MENTAL_CARDS: {
      return {
        ...state,
        myMentalCards: action.payload,
      };
    }
    case GameActionTypes.SAVE_MADE_HAND: {
      return {
        ...state,
        madeHand: action.payload,
      };
    }
    case GameActionTypes.UPDATE_MENTAL_DECK: {
      return {
        ...state,
        currentMentalDeckData: {
          ...state.currentMentalDeckData,
          mentalDeck: {
            ...state.currentMentalDeckData.mentalDeck,
            ...action.payload,
          },
        },
      };
    }
    case GameActionTypes.USE_NEXT_MENTAL_DECK: {
      return {
        ...state,
        currentMentalDeckData: {
          ...state.nextMentalDeckData,
        },
        nextMentalDeckData: { ...initialMentalDeckState },
      };
    }
    case GameActionTypes.UPDATE_NEXT_MENTAL_DECK: {
      return {
        ...state,
        nextMentalDeckData: {
          ...state.nextMentalDeckData,
          mentalDeck: {
            ...state.nextMentalDeckData.mentalDeck,
            ...action.payload,
          },
        },
      };
    }
    case GameActionTypes.SET_STARTING_DECK: {
      return {
        ...state,
        currentMentalDeckData: {
          ...state.currentMentalDeckData,
          startingMentalDeck: action.payload,
        },
      };
    }
    case GameActionTypes.SET_FINAL_DECK: {
      return {
        ...state,
        currentMentalDeckData: {
          ...state.currentMentalDeckData,
          finalMentalDeck: action.payload,
        },
      };
    }
    case GameActionTypes.SAVE_RECEIVED_MESSAGE: {
      const notifications = [...state.notifications, action.payload];
      return {
        ...state,
        notifications,
      };
    }
    case GameActionTypes.CLEAR_MESSAGES: {
      return {
        ...state,
        notifications: [],
      };
    }
    case GameActionTypes.SAVE_OPEN_CARDS: {
      return {
        ...state,
        openCards: action.payload.decryptedCards,
      };
    }
    case GameActionTypes.SAVE_SEAT_ACTION: {
      return {
        ...state,
        seatAction: action.payload,
      };
    }
    case GameActionTypes.SAVE_BOARD: {
      const newBoard = [...state.decryptedBoard, ...action.payload];
      return {
        ...state,
        decryptedBoard: newBoard,
      };
    }
    case GameActionTypes.SAVE_OPEN_SHOWDOWN_CARDS: {
      const { seat, cards } = action.payload;
      return {
        ...state,
        showdownCards: {
          ...state.showdownCards,
          [seat]: cards,
        },
      };
    }
    case GameActionTypes.SET_PLANNED_PROTOCOL_OFFENCE: {
      return {
        ...state,
        plannedProtocolOffence: action.payload,
      };
    }
    default:
      return state;
  }
};
