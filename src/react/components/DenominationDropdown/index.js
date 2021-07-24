import React from 'react';
import PropTypes from 'prop-types';

import { currencies } from '../../utils/const';
import { getDenominatedBalance } from '../../utils/helpers';

import { CurrencyContext } from '../../common/CurrencyContext';

const options = [
  // {
  //   title: 'BTC',
  //   value: currencies.BTC,
  // },
  {
    title: 'mBTC',
    value: currencies.MBTC,
  },
  {
    title: 'Bits',
    value: currencies.BITS,
  },
  {
    title: 'Satoshi',
    value: currencies.SATOSHI,
  },
];

const { Consumer } = CurrencyContext;

const DenominationDropdownComponent = (props) => (
  <Consumer>
    {
      ({ changeCurrency }) => (
        <div className="denomination-dropdown">
          {
            options.map(option => (
              <div
                className="denomination-dropdown__option"
                key={option.value}
                onClick={(event) => {
                  props.toggleDropdown();
                  changeCurrency(option.value);
                  event.stopPropagation();
                }}
              >
              {
                props.balance >= 0
                  ? (
                    <span className="denomination-dropdown__balance">  
                      { getDenominatedBalance(props.balance, option.value) }
                    </span>
                  )
                  : ''
              }
                <span className="denomination-dropdown__currency">
                  {option.title}
                </span>
              </div>
            ))
          }
        </div>
      )
    }
  </Consumer>
);

DenominationDropdownComponent.propTypes = {
  balance: PropTypes.number,
  toggleDropdown: PropTypes.func.isRequired,
};

export default DenominationDropdownComponent;
