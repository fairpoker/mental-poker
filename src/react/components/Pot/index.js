import React, { Component } from 'react';
import isEqual from 'lodash.isequal';
import PropTypes from 'prop-types';

import Denomination from '../Denomination';

import { socket } from '../../containers/Sockets';

class PotComponent extends Component {
  constructor(props) {
    super(props);

    const potAmounts = props.pot.map(pot => pot.amount);
    this.animateValueChanges = this.animateValueChanges.bind(this);
    this.resetPot = this.resetPot.bind(this);
    this.resetPotAfterSecond = this.resetPotAfterSecond.bind(this);

    this.state = {
      potAmounts,
      resetPotTimeout: null,
    };

    socket.on('prepareForNewRound', this.resetPot);

    // HACK: Nullify the pots if the game is stopped as there is issue with animation
    // when pots update very fast at the end of the game
    socket.on('gameStopped', this.resetPotAfterSecond);
  }

  componentWillUnmount() {
    // Clear the pot reset timeout itself
    clearTimeout(this.state.resetPotTimeout);
    // Clear all socket liteners
    socket.off('gameStopped', this.resetPotAfterSecond);
    socket.off('prepareForNewRound', this.resetPot);
  }

  resetPot() {
    this.setState({
      potAmounts: [0],
    });
  }

  /**
   * It brings the pot to zero after a second
   * and saves the reset timeout in the component's state.
   */
  resetPotAfterSecond() {
    const timeout = setTimeout(() => {
      this.setState({
        potAmounts: [0],
      }, () => {
        clearTimeout(timeout);
      });
    }, 1000);
    this.setState({
      resetPotTimeout: timeout,
    });
  }

  componentDidUpdate(prevProps) {
    if (this.state.potAmounts.length < this.props.pot.length) {
      const newPots = new Array(this.props.pot.length - this.state.potAmounts.length).fill(0);
      this.setState(({ potAmounts }) => ({
        potAmounts: [ ...potAmounts, ...newPots ],
      }),
      () => {
        this.animateValueChanges();
      });
    } else if (prevProps.pot.length > this.props.pot.length) {
      const newPots = new Array(this.state.potAmounts.length - this.props.pot.length).fill(0);
      this.setState(({ potAmounts }) => ({
        potAmounts: [ ...potAmounts.slice(0, this.props.pot.length), ...newPots ],
      }),
      () => {
        this.animateValueChanges();
      });
    } else if (!isEqual(this.props.pot, prevProps.pot)) {
      this.animateValueChanges();
    }
  }

  animateValueChanges() {
    this.props.pot.forEach(
      (pot, index) => {
        const { amount: potAmount } = pot;
        const { potAmounts: statePots } = this.state;
        const currentStatePot = statePots[index];

        if (potAmount !== currentStatePot) {
          const fpsInterval = this.props.phase === 'showdown' ? 3000 / 60 : 1000 / 60;
          const unit = (potAmount - currentStatePot) / fpsInterval;

          const amountInterval = setInterval(() => {
            this.setState(({ potAmounts }) => {
              const newPot = unit > 0
                ? Math.min(potAmounts[index] + unit, potAmount)
                : Math.max(potAmounts[index] + unit, potAmount);

              return {
                potAmounts: [
                  ...potAmounts.slice(0, index),
                  newPot,
                  ...potAmounts.slice(index + 1),
                ],
              }
            }, () => {
              const { potAmounts: newPotAmounts } = this.state;

              if (
                (unit > 0 && newPotAmounts[index] >= potAmount)
                || (unit < 0 && newPotAmounts[index] <= potAmount)
              ) {
                clearInterval(amountInterval);
              }
            });
          }, fpsInterval);
        }
      }
    );
  }

  render() {
    const { potAmounts } = this.state;

    return (
      <div className="pot">
        {potAmounts[0] || potAmounts[0] === 0
          ? (
            <div className="pot__pot" id="main-pot">
              <span className="pot__name">
                POT
              </span>
              <span className="pot__value">
                <Denomination>
                  {potAmounts[0]}
                </Denomination>
              </span>
            </div>
          ) : ''
        }
        {potAmounts.slice(1).length
          ? potAmounts.slice(1).map(
            (sidepot, index) => (
              <div
                key={`${index}${sidepot}`}
                className="pot__pot"
              >
                <span className="pot__name">
                  SIDEPOT
                </span>
                <span className="pot__value">
                  <Denomination>
                    {sidepot}
                  </Denomination>
                </span>
              </div>
            )
          )
          : ''
        }
      </div>
    );
  }
}

PotComponent.propTypes = {
  pot: PropTypes.array.isRequired,
};

export default PotComponent;
