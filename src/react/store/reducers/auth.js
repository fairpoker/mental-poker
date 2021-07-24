import {
  GET_USER_SESSION_SUCCESS,
  SET_USER_BALANCE,
} from '../actions/auth';

const initialState = {
  user: {
    screenName: '',
    totalChips: 0,
    offend: false, // TODO: Remove offend
  },
  sessionToken: '',
};

export default (state = initialState, action) => {
  switch (action.type) {
    case GET_USER_SESSION_SUCCESS: {
      return {
        ...state,
        user: {
          ...state.user,
          screenName: action.payload.screenName,
          totalChips: Number(action.payload.totalChips),
        },
        sessionToken: action.payload.sessionToken,
      };
    }
    case SET_USER_BALANCE: {
      return {
        ...state,
        user: {
          ...state.user,
          totalChips: Number(action.payload),
        },
      };
    }
    default:
      return state;
  }
};
