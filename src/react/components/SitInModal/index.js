import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';

import Button from '../../components/Button';
import Denomination from '../../components/Denomination';

import { withCurrency } from '../../common/CurrencyContext';

class SitInModalComponent extends Component {
  constructor(props) {
    super(props);

    const {
      currency: {
        decimals,
        denominationRate,
      },
      minBuyIn,
      maxBuyIn,
      balance,
    } = this.props;

    // The default buy-in value
    const buyInValue = balance >= maxBuyIn || balance < minBuyIn ?  minBuyIn + (maxBuyIn - minBuyIn) / 2 : minBuyIn + (balance - minBuyIn) / 2;

    this.state = {
      value: (buyInValue / denominationRate).toFixed(decimals).toString(),
      password: '',
      validationErrors: {
        pattern: '',
        range: '',
        availableChips: '',
      }
    }

    this.inputRef = React.createRef();
  }

  componentDidMount() {
    this.inputRef.current.focus();
  }

  checkValidity(value) {
    const {
      balance,
      currency: {
        decimals,
        denominationRate,
      },
      minBuyIn,
      maxBuyIn,
    } = this.props;
    const min = (minBuyIn / denominationRate).toFixed(decimals);
    const max = (maxBuyIn / denominationRate).toFixed(decimals);
    if (!value || Number(value) < min || Number(value) > max) {
      this.setState({
        validationErrors: {
          range: `Value must be between ${min} and ${max}`
        }
      })
    } else if (Number(value) > balance) {
      this.setState({
        validationErrors: {
          availableChips: `You have only ${(balance / denominationRate).toFixed(decimals)}`,
        }
      });
    } else if (!value.match('^[0-9][0-9.,]*[0-9]$')) {
      this.setState({
        validationErrors: {
          pattern: 'Only numbers allowed',
        }
      });
    } else {
      this.setState({
        validationErrors: {
          range: '',
          pattern: '',
        }
      });
    };
  }

  handleChange(event) {
    const {
      currency: {
        decimals,
        denominationRate,
      }
    } = this.props;
    this.checkValidity(event.target.value, denominationRate, decimals);
    this.setState({
      value: event.target.value.replace(',', '.')
    })
  }

  submitForm() {
    this.checkValidity(this.state.value);

    const {
      maxBuyIn,
      minBuyIn,
      currency,
      submitModal,
    } = this.props;

    const {
      value,
      password,
      validationErrors,
    } = this.state;

    if (value && !(validationErrors.pattern || validationErrors.range)) {
      // If the buy in amount is only one number possible we must send it in sats without denomination
      // This hack helps us sending rounded buy-ins to the API
      if (minBuyIn === maxBuyIn) {
        submitModal(maxBuyIn, password);
      } else if (value * currency.denominationRate < minBuyIn) {
        // Handles the case where bits to satoshi conversion gives a number lower that the allowed buy-in amount
        submitModal(minBuyIn, password);
      } else {
        submitModal(value * currency.denominationRate, password);
      }
    }
  }

  handleEnter(event) {
    if (event.key === 'Enter') {
      this.submitForm();
    };
  }

  render() {
    const {
      balance,
      currency: {
        currencyName,
        denominationRate,
        decimals
      },
      minBuyIn,
      maxBuyIn,
      name,
      sitInError,
      closeSitInModal,
      isReBuy,
      isPasswordProtected,
      whiteLabel,
    } = this.props;


    return (
      <div className="modal">
        <div className={classNames(
          'modal__content',
          {
            'modal__content--long' : isPasswordProtected && !isReBuy,
            'modal__content--cpg-blue' : whiteLabel === 'cpg',
          }
          )}>
          <div className={classNames(
            'modal__close-button',
            {
              'modal__close-button--cpg-blue' : whiteLabel === 'cpg',
            },
            )}></div>
          <div className={classNames(
            'modal__header',
            {
              'modal__header--cpg-blue' : whiteLabel === 'cpg',
            }
            )}>
            <div className={classNames(
              'modal__header-title',
              {
                'modal__header-title--white' : whiteLabel === 'cpg',
              }
              )}>
              {
                isPasswordProtected && !isReBuy ? (
                  <FontAwesomeIcon icon={faLock} className="icon-lock"/>
                ) : ''
              }
              {name}
            </div>
            <span
              className={classNames(
                'modal__close-icon',
                'icon-cross',
                {
                  'modal__close-icon--white' : whiteLabel === 'cpg',
                }
                )}
              onClick={() => closeSitInModal()}
            />
          </div>
          <div className="modal__body">
            <div>
              <span className="modal__buy-in-info">
                {
                  isReBuy ? (
                    'Max re-buy'
                  ) : (
                    'Max buy-in'
                  )
                }
              </span>
              <span className="modal__dash-icon icon-minus" />
              <span className="modal__buy-in-info modal__buy-in-info--bold">
                <Denomination>
                  {maxBuyIn}
                </Denomination>
              </span>
            </div>
            <div>
              <span className="modal__buy-in-info">
                {
                  isReBuy ? (
                    'Min re-buy'
                  ) : (
                    'Min buy-in'
                  )
                }
              </span>
              <span className="modal__dash-icon icon-minus" />
              <span className="modal__buy-in-info modal__buy-in-info--bold">
                <Denomination>
                  {minBuyIn}
                </Denomination>
              </span>
            </div>
            <div>
              <span className={classNames(
                'modal__balance-info',
                { 'modal__balance-info--cpg-blue' : whiteLabel === 'cpg'},
                )}>
                You have a total of
              </span>
              <span className={classNames(
                'modal__balance-info',
                'modal__balance-info--bold',
                { 'modal__balance-info--cpg-blue' : whiteLabel === 'cpg'},
                )}>
                <Denomination>
                  {balance}
                </Denomination>
              </span>
              <span className={classNames(
                'modal__balance-info',
                { 'modal__balance-info--cpg-blue' : whiteLabel === 'cpg'},
                )}>{currencyName}</span>
            </div>
            <div className="modal__form">
              {
                isPasswordProtected && !isReBuy ? (
                  <div>
                    <div className="modal__form-label">
                      Table password:
                    </div>

                    <div className="modal__form-input modal__password">
                      <input
                          placeholder="Password"
                          value={this.state.password}
                          onChange={($event) => this.setState({password : $event.target.value})}
                          onKeyDown={($event) => this.handleEnter($event)}
                          className="modal__input"
                      />
                    </div>
                  </div>
                ) : ''
              }

              <div className="modal__form-label">
                {
                  isReBuy ? (
                    'Re-buy with Amount:'
                  ) : (
                    'Sit In With Amount:'
                  )
                }
              </div>
              <div className="modal__form-input">
                <input
                  className={classNames(
                    'modal__input',
                    {'modal__input--cpg-blue' : whiteLabel === 'cpg'},
                    )}
                  placeholder={currencyName}
                  value={this.state.value}
                  onChange={($event) => this.handleChange($event, denominationRate, decimals)}
                  onKeyDown={($event) => this.handleEnter($event)}
                  ref={this.inputRef}
                />
                <Button
                  className="modal__button"
                  clickHandler={() => this.submitForm(denominationRate, decimals)}
                  whiteLabel={whiteLabel}
                >
                  {
                    isReBuy ? (
                      're-buy'
                    ) : (
                      'sit in'
                    )
                  }
                </Button>
              </div>
            </div>
            <div className="modal__error">
              {sitInError}
            </div>
            {
              this.state.validationErrors.pattern
                && (
                  <div className="modal__error">
                    {this.state.validationErrors.pattern}
                  </div>
                )
            }
            {
              this.state.validationErrors.range
                && (
                  <div className="modal__error">
                    {this.state.validationErrors.range}
                  </div>
                )
            }
            {
              this.state.validationErrors.availableChips
                && (
                  <div className="modal__error">
                    {this.state.validationErrors.availableChips}
                  </div>
                )
            }
          </div>
        </div>
        <div className="modal__overlay"></div>
      </div>
    );
  }
}

SitInModalComponent.propTypes = {
  balance: PropTypes.number.isRequired,
  name: PropTypes.string.isRequired,
  minBuyIn: PropTypes.number.isRequired,
  maxBuyIn: PropTypes.number.isRequired,
  sitInError: PropTypes.string.isRequired,
  closeSitInModal: PropTypes.func.isRequired,
  submitModal: PropTypes.func.isRequired,
  isReBuy: PropTypes.bool.isRequired,
  isPasswordProtected: PropTypes.bool.isRequired,
  whiteLabel: PropTypes.string,
};

export default withCurrency(SitInModalComponent);
