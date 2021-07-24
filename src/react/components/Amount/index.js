import React, { Component, Fragment, createRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { withCurrency } from '../../common/CurrencyContext';

class AmountComponent extends Component {
  constructor(props) {
    super(props);

    this.state = {
      value: 0,
      displayValue: 0,
    }

    this.sliderDragged = false;

    this.sliderHandlerContainerRef = createRef();

    this.validateBetValue = this.validateBetValue.bind(this);
    this.handleSliderMouseDown = this.handleSliderMouseDown.bind(this);
    this.handleSliderMouseUp = this.handleSliderMouseUp.bind(this);
    this.handleSliderMouseMove = this.handleSliderMouseMove.bind(this);
    this.denominateValue = this.denominateValue.bind(this);
    this.handleOnePot = this.handleOnePot.bind(this);
    this.handleHalfPot = this.handleHalfPot.bind(this);
    this.handleThreeX = this.handleThreeX.bind(this);
    this.handleTwoThirdsPot = this.handleTwoThirdsPot.bind(this);
    this.getMaxBetValue = this.getMaxBetValue.bind(this);
    }

  componentDidMount() {
    this.setState({
      value: this.props.betAmount,
      displayValue: this.denominateValue(this.props.betAmount),
    });
  }

  componentDidUpdate(prevProps) {
    const {
      betAmount,
    } = this.props;
    if (betAmount !== prevProps.betAmount && betAmount > this.state.value) {
      this.setState({
        value: betAmount,
        displayValue: this.denominateValue(betAmount),
      });
    }
  }

  /**
   * 
   * @param {number} value - The value of the new bet amount
   * @param {bool} isDenominated - Whether the first parameter is denominated
   */
  handleChange(value, isDenominated = false) {
    let displayValue;
    let satValue;

    if (isDenominated) {
      displayValue = value;
      satValue = (Number(value) * this.props.currency.denominationRate).toFixed(this.props.currency.decimals);
    } else {
      displayValue = this.denominateValue(value);
      satValue = Number(value);
    }

    this.setState(
      {
        value: satValue,
        displayValue,
      },
      () => {
        if (this.validateBetValue()) {
          this.props.handleBetChange(this.state.value);
        }
      }
    );
  }

  handleDecrement() {
    this.setState(
      prevState => {
        const value = Math.max(this.props.betAmount, Number(prevState.value) - this.props.bigBlind);
        return {
          value,
          displayValue: this.denominateValue(value),
        };
      },
      () => {
        if (this.validateBetValue()) {
          this.props.handleBetChange(this.state.value);
        }
      }
    );
  }

  handleIncrement() {
    this.setState(
      prevState => {
        const value = Math.min(this.getMaxBetValue(), Number(prevState.value) + this.props.bigBlind);
        return {
          value,
          displayValue: this.denominateValue(value),
        };
      },
      () => {
        if (this.validateBetValue()) {
          this.props.handleBetChange(this.state.value);
        }
      }
    );
  }

  handleSliderMouseDown(e) {
    this.sliderDragged = true;

    if (e.type === 'touchstart') {
      window.addEventListener('touchmove', this.handleSliderMouseMove);
      window.addEventListener('touchend', this.handleSliderMouseUp);
    } else {
      window.addEventListener('mousemove', this.handleSliderMouseMove);
      window.addEventListener('mouseup', this.handleSliderMouseUp);
    }
  }

  handleSliderMouseUp(e) {
    this.sliderDragged = false;

    if (e.type === 'touchend') {
      window.removeEventListener('touchmove', this.handleSliderMouseMove);
      window.removeEventListener('touchend', this.handleSliderMouseUp);
    } else {
      window.removeEventListener('mousemove', this.handleSliderMouseMove)
      window.removeEventListener('mouseup', this.handleSliderMouseUp)
    }
  }

  getMaxBetValue() {
    const {
      gameMode,
      potsValue,
      myBet,
      chipsInPlay,
      biggestBet,
      callAmount,
    } = this.props;

    if (gameMode === 'PLO') {
      const maxRaiseTo = potsValue + callAmount + biggestBet;
      return maxRaiseTo < chipsInPlay + myBet ? maxRaiseTo : chipsInPlay + myBet;
    }

    return chipsInPlay + myBet;
  }

  handleSliderMouseMove(e) {
    if (this.sliderDragged) {
      const {
        betAmount, // min value
      } = this.props
      let { value } = this.state;
      const mousePositionX = e.x || e.touches[0].clientX;
      const maxValue = this.getMaxBetValue();
      const container = this.sliderHandlerContainerRef.current;
      const {
        left: containerLeftOffset,
        right: containerRightOffset,
        width: containerWidth,
      } = container.getBoundingClientRect();

      if (mousePositionX <= containerLeftOffset) {
        value = betAmount;
      } else if (mousePositionX >= containerRightOffset) {
        value = maxValue;
      } else {
        const handlerRelativePosition = mousePositionX - containerLeftOffset;
        const handlerPercentPosition = (handlerRelativePosition * 100) / containerWidth;
        value = Math.floor((maxValue - betAmount) / 100 * handlerPercentPosition + betAmount)
      }

      this.setState({
        value, 
        displayValue: this.denominateValue(value),
      }, () => {
        if (this.validateBetValue()){
          this.props.handleBetChange(this.state.value);
        }
      });
    }
  }

  calculateSliderPosition() {
    const {
      betAmount, // min value
    } = this.props
    const { value } = this.state;
    const maxValue = this.getMaxBetValue();
    const currentValue = value;
    const percentsValue = ((currentValue - betAmount) / (maxValue - betAmount)) * 100

    return `${Math.max(Math.min(percentsValue, 100), 0)}%`;
  }

  validateBetValue() {
    return this.state.value.toString().match('^[0-9][0-9.,]*[0-9]$')
      && this.state.value >= this.props.betAmount
      && this.state.value <= this.props.chipsInPlay + this.props.myBet;
  }

  denominateValue(value) {
    const {
      currency: {
        denominationRate,
        decimals,
      },
    } = this.props;
    return (value / denominationRate).toFixed(decimals);
  }

  handleThreeX() {
    const { biggestBet, chipsInPlay, myBet } = this.props;

    const bet = Math.min(biggestBet * 3, chipsInPlay + myBet);
    this.handleChange(bet, false);
  }

  handleHalfPot() {
    const { potsValue, chipsInPlay, myBet, betAmount, callAmount, biggestBet } = this.props;

    const bet = Math.min((potsValue + callAmount) / 2 + biggestBet, chipsInPlay + myBet);

    if (bet > betAmount) {
      this.handleChange(bet, false);
    } else {
      this.handleChange(betAmount, false);
    }
  }

  handleTwoThirdsPot() {
    const { potsValue, chipsInPlay, myBet, betAmount, callAmount, biggestBet } = this.props;

    const bet = Math.min((2 * (potsValue + callAmount)) / 3 + biggestBet, chipsInPlay + myBet);

    if (bet > betAmount) {
      this.handleChange(bet, false);
    } else {
      this.handleChange(betAmount, false);
    }
  }

  handleOnePot() {
    const { potsValue, chipsInPlay, myBet, callAmount, biggestBet } = this.props;

    const bet = Math.min(potsValue + callAmount + biggestBet, chipsInPlay + myBet);
    this.handleChange(bet, false);
  }

  render() {
    const {
      chipsInPlay,
      myBet,
      gameMode,
      whiteLabel,
    } = this.props;
    return (
      <div className="amount">
        <div className="amount__form-input">
          <input
            placeholder="_"
            className={classNames('amount__input', {
              'amount__input--cpg-blue' : whiteLabel === 'cpg',
            })}
            value={this.state.displayValue}
            onChange={($event) => this.handleChange($event.target.value, true)}
            onKeyDown={($event) => this.props.handleEnter($event)}
          />
        </div>
        <div className="amount__slider-wrapper">
          <div className="amount__slider-row">
          <span
            className={classNames('amount__button', {
              'amount__button--cpg-blue' : whiteLabel === 'cpg',
            })}
            onClick={this.handleHalfPot}
          >
            1/2x pot
          </span>
          {
            gameMode === 'PLO' &&
              <span
                className={classNames('amount__button', {
                  'amount__button--cpg-blue' : whiteLabel === 'cpg',
                })}
                onClick={this.handleTwoThirdsPot}
              >
                2/3x pot
              </span>
          }
          <span
            className={classNames('amount__button', {
              'amount__button--cpg-blue' : whiteLabel === 'cpg',
            })}
            onClick={this.handleOnePot}
          >
            1x pot
          </span>
            {
              gameMode !== 'PLO' &&
                <span
                  className={classNames('amount__button', {
                    'amount__button--cpg-blue' : whiteLabel === 'cpg',
                  })}
                  onClick={() => this.handleChange(chipsInPlay + myBet, false)}
                >
                  Max
                </span>
            }
          </div>
          <div className="amount__slider-row">
            <button
              className={classNames('amount__button', 'amount__button--dark', {
                'amount__button--dark--cpg-blue' : whiteLabel === 'cpg',
              })}
              onClick={() => this.handleDecrement()}
            >
              -
            </button>
            <div className={classNames('amount__slider', {
              'amount__slider--cpg-blue' : whiteLabel === 'cpg',
            })}>
              <div
                className={classNames('amount__slider-handler-container', {
                  'amount__slider-handler-container--white' : whiteLabel === 'cpg',
                })}
                ref={this.sliderHandlerContainerRef}
              >
                <div
                  className={classNames('amount__slider-handler', {
                    'amount__slider-handler--white' : whiteLabel === 'cpg',
                  })}
                  style={{ left: this.calculateSliderPosition() }}
                  onMouseDown={this.handleSliderMouseDown}
                  onTouchStart={this.handleSliderMouseDown}
                />
              </div>
            </div>
            <button
              className={classNames('amount__button', 'amount__button--dark', {
                'amount__button--dark--cpg-blue' : whiteLabel === 'cpg',
              })}
              onClick={() => this.handleIncrement()}
            >
              +
            </button>
          </div>
        </div>
      </div>
    );
  }
}

AmountComponent.propTypes = {
  gameMode: PropTypes.string.isRequired,
  betAmount: PropTypes.number.isRequired,
  biggestBet: PropTypes.number.isRequired,
  bigBlind: PropTypes.number.isRequired,
  chipsInPlay: PropTypes.number.isRequired,
  myBet: PropTypes.number.isRequired,
  potsValue: PropTypes.number.isRequired,
  handleBetChange: PropTypes.func.isRequired,
  handleEnter: PropTypes.func.isRequired,
  callAmount: PropTypes.number.isRequired,
  whiteLabel: PropTypes.string,
};

export default withCurrency(AmountComponent);
