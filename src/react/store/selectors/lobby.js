import { createSelector } from 'reselect';

import { filterAndSortTables, compareTables } from '../../utils/helpers';

const getLobbyState = state => state.lobby;

const selectAccountUrl = createSelector(getLobbyState, ({ accURL }) => accURL);
const selectIsFetching = createSelector(getLobbyState, ({ isFetching }) => isFetching);
const selectIsError = createSelector(getLobbyState, ({ isError }) => isError);
const selectTablesData = createSelector(getLobbyState, ({ tables }) => tables);
const selectSortProperties = createSelector(getLobbyState, ({ sortProperties }) => sortProperties);
const selectFilterProperties = createSelector(getLobbyState, ({ filterProperties }) => filterProperties);
const selectWhiteLabel = createSelector(getLobbyState, ({ whiteLabel }) => whiteLabel);

const selectTables = createSelector(getLobbyState, (state) => {
  const {
    tables,
    sortProperties,
    filterProperties,
  } = state;

  return filterAndSortTables([...tables], sortProperties, filterProperties);
});

const selectBlindFilterOptions = createSelector(selectTablesData, (tables) => {
  const uniqBlindsOptions = [
    {
      title: 'All bets',
      value: '',
    },
  ];

  new Set([...tables]
    .sort(compareTables('bb-sb', 'ASC'))
    .map(
      table => `${table.bigBlind}/${table.smallBlind}`,
    ))
    .forEach(
      blind => uniqBlindsOptions.push(
        {
          title: blind,
          value: blind,
          bb: Number(blind.split('/')[0]),
          sb: Number(blind.split('/')[1]),
        },
      ),
    );

  return uniqBlindsOptions;
});

const selectBuyInFilterOptions = createSelector(selectTablesData, (tables) => {
  const uniqBuyInOptions = [
    {
      title: 'All min buy in',
      value: 0,
    },
  ];

  new Set([...tables]
    .sort(compareTables('minBuyIn', 'ASC'))
    .map(
      table => table.minBuyIn,
    ))
    .forEach(
      buyIn => uniqBuyInOptions.push({ title: buyIn.toString(), value: buyIn }),
    );

  return uniqBuyInOptions;
});

const getCurrencyRateState = createSelector(getLobbyState, ({ currencyRates }) => currencyRates);

const selectCurrencyRateIsFetching = createSelector(getCurrencyRateState, ({ isFetching }) => isFetching);
const selectCurrencyRateIsError = createSelector(getCurrencyRateState, ({ isError }) => isError);
const selectCurrencyRateUSD = createSelector(getCurrencyRateState, ({ data }) => data.USD ? data.USD.rate_float : 0);

export default {
  selectAccountUrl,
  selectIsFetching,
  selectIsError,
  selectTablesData,
  selectSortProperties,
  selectFilterProperties,
  selectTables,
  selectBlindFilterOptions,
  selectBuyInFilterOptions,
  selectCurrencyRateIsFetching,
  selectCurrencyRateIsError,
  selectCurrencyRateUSD,
  selectWhiteLabel,
};
