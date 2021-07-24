import React, { Component } from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

import DenominationComponent from'../Denomination';
import DenominationDropdownComponent from'../DenominationDropdown';

import { CurrencyContext } from '../../common/CurrencyContext';

const CurrencyConsumer = CurrencyContext.Consumer;
class UserMenuComponent extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isDenominationDropdownOpen: false,
    }
  }
  
  toggleDropdown() {
    this.setState((prevState) => ({
      isDenominationDropdownOpen: !prevState.isDenominationDropdownOpen,
    }))
  }
  render() {
  
    const {
      user,
      balance,
      currencyRate,
      whiteLabel,
    } = this.props;

    return (
      <div className="user-menu">
        <div className={classNames(
          'user-menu__user-name',
          {
            'user-menu__user-name--cpg-blue' : whiteLabel === 'cpg',
          }
          )}>
          {user}
        </div>
        <div 
          className="user-menu__balance-wrapper"
          onClick={() => this.toggleDropdown()}
        >
          {
            balance >= 0
              ? (
                <DenominationComponent className="user-menu__balance">
                  {balance}
                </DenominationComponent>
              )
              : ''
          }
          <CurrencyConsumer>
            { ({ currencyName }) => <span className="user-menu__currency">{currencyName}</span>}
          </CurrencyConsumer>
          {
            balance >= 0
              ? (
                <div className={classNames(
                  'user-menu__denomination',
                  {
                    'user-menu__denomination--cpg-blue' : whiteLabel === 'cpg',
                  }
                  )}>
                  {`${(balance / 100000000 * currencyRate).toFixed(2)}`}
                  <span className="user-menu__currency">USD</span>
                </div>
              )
              : ''
          }
          <span
            className={
              classNames(
                'user-menu__dropdown-arrow',
                'icon-arrow-down',
                {
                  'user-menu__dropdown-arrow--upside-down': this.state.isDenominationDropdownOpen
                }
              )}
          />
          {
            this.state.isDenominationDropdownOpen
              ? <DenominationDropdownComponent
                  balance={balance}
                  toggleDropdown={() => {
                    this.toggleDropdown();
                  }}
                />
              : ''
          }
        </div>
      </div>
    );
  }
}

UserMenuComponent.propTypes = {
  user: PropTypes.string.isRequired,
  balance: PropTypes.number,
  currencyRate: PropTypes.number,
  whiteLabel: PropTypes.string,
};

export default UserMenuComponent;
