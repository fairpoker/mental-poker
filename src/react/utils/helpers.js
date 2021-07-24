import Cookie from 'js-cookie';

import {
  currencies,
  pingRanges,
  timeoutRanges,
  stakesRanges,
} from './const';

export const getCookie = cname => Cookie.get(cname);

export const mapPingTime = time => pingRanges
  .find(range => time >= range.minValue && time <= range.maxValue);

export const mapTimeout = time => timeoutRanges
  .find(range => time >= range.minValue && time <= range.maxValue)
  .range;

export const mapStakes = stakes => stakesRanges
  .find(range => stakes === range.value);

export const compareTables = (sortBy, sortOrder) => (tableA, tableB) => {
  let aCompare;
  let bCompare;
  let comparison;

  if (sortBy === 'name') {
    aCompare = tableA.name.toLowerCase().trim();
    bCompare = tableB.name.toLowerCase().trim();
    comparison = aCompare.localeCompare(bCompare);
  } else if (sortBy === 'minBuyIn' || sortBy === 'maxBuyIn') {
    aCompare = tableA[sortBy];
    bCompare = tableB[sortBy];
    comparison = aCompare - bCompare;
  } else if (sortBy === 'bb-sb') {
    aCompare = tableA.bigBlind === tableB.bigBlind ? tableA.smallBlind : tableA.bigBlind;
    bCompare = tableA.bigBlind === tableB.bigBlind ? tableB.smallBlind : tableB.bigBlind;
    comparison = aCompare - bCompare;
  } else if (sortBy === 'players') {
    aCompare = tableA.playersSeatedCount;
    bCompare = tableB.playersSeatedCount;
    comparison = aCompare - bCompare;
  } else if (sortBy === 'timeout') {
    aCompare = tableA.timeout;
    bCompare = tableB.timeout;
    comparison = aCompare - bCompare;
  } else if (sortBy === 'gameMode') {
    aCompare = tableA.gameMode.toLowerCase().trim();
    bCompare = tableB.gameMode.toLowerCase().trim();
    comparison = aCompare.localeCompare(bCompare);
  }
  return sortOrder === 'ASC' ? comparison : -1 * comparison;
};

const filterTables = (filterProperties) => {
  const {
    hideEmptyTables,
    hideFullTables,
    filterTableType,
    filterGameType,
    filterStakes,
  } = filterProperties;

  const stakes = mapStakes(filterStakes);

  return table => (
    (hideFullTables ? table.playersSeatedCount !== table.seatsCount : true)
      && (hideEmptyTables ? table.playersSeatedCount : true)
      && (filterTableType ? table.seatsCount === filterTableType : true)
      && (filterGameType ? table.gameMode === filterGameType : true)
      && (stakes ? table.bigBlind >= stakes.minBB && table.bigBlind <= stakes.maxBB : true)
  );
};

export const filterAndSortTables = (tables, sortProperties, filterProperties) => {
  const {
    sortBy,
    sortOrder,
  } = sortProperties;
  return tables
    .filter(filterTables(filterProperties))
    .sort(compareTables(sortBy, sortOrder));
};

export const getDenominationRate = (currency) => {
  switch (currency) {
    case currencies.SATOSHI: {
      return {
        denominationRate: 1,
        decimals: 0,
        currencyName: 'Satoshi',
      };
    }
    case currencies.BTC: {
      return {
        denominationRate: 100000000,
        decimals: 5,
        currencyName: 'BTC',
      };
    }
    case currencies.MBTC: {
      return {
        denominationRate: 100000,
        decimals: 2,
        currencyName: 'mBTC',
      };
    }
    case currencies.BITS: {
      return {
        denominationRate: 100,
        decimals: 0,
        currencyName: 'Bits',
      };
    }
    default:
      return {
        denominationRate: 1,
        decimals: 0,
        currencyName: 'Satoshi',
      };
  }
};

export const getDenominatedBalance = (balance, currency) => {
  switch (currency) {
    case currencies.BTC: {
      return (balance / 100000000).toFixed(5);
    }
    case currencies.MBTC: {
      return (balance / 100000).toFixed(2);
    }
    case currencies.BITS: {
      return (balance / 100).toFixed(0);
    }
    default:
      return balance;
  }
};

export const findGetParameter = (parameterName) => {
  let result = null;
  let tmp = [];
  location.search
    .substr(1)
    .split('&')
    .forEach((item) => {
      tmp = item.split('=');
      if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
    });
  return result;
};
