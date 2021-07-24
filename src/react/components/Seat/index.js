import React, { Component, createRef } from 'react';

import PropTypes from 'prop-types';

import classNames  from 'classnames';

import HandCardsComponent from '../HandCards';
import Denomination from '../Denomination';

class SeatComponent extends Component {
  constructor(props) {
    super(props);

    this.state = {
      chipStyles: null,
      countdownNumber: null,
      chipsInPlay: 0,
      hoveringOnCards: false,
    }

    this.toggleHover = this.toggleHover.bind(this);

    this.chipRef = createRef();
  }

  componentDidMount() {
    this.setState({
      chipsInPlay: this.props.user && this.props.user.chipsInPlay,
    })
  }

  componentDidUpdate(prevProps) {
    const {
      gamePhase,
      isActiveSeat,
      timeout,
      user,
    } = this.props;

    if (isActiveSeat && !prevProps.isActiveSeat) {
      this.setState({
        countdownNumber: timeout / 1000,
      }, () => {
        this.countdown();
      });
    } else if (!isActiveSeat && prevProps.isActiveSeat) {
      this.setState({
        countdownNumber: null,
      }, () => {
        clearTimeout(this.countdownCounter);
      });
    } else if (isActiveSeat 
      && prevProps.isActiveSeat 
      && gamePhase !== prevProps.gamePhase
      && (gamePhase === 'flop' || gamePhase === 'turn' || gamePhase === 'river')) {
      this.setState({
        countdownNumber: null,
      }, () => {
        clearTimeout(this.countdownCounter);
      });

      setTimeout(() => {
        this.setState({
          countdownNumber: timeout / 1000,
        }, () => {
          this.countdown();
        });
      }, 100);
    }

    if (
      (gamePhase === 'flopKeySubmit' && prevProps.gamePhase !== 'flopKeySubmit') ||
      (gamePhase === 'turnKeySubmit' && prevProps.gamePhase !== 'turnKeySubmit') ||
      (gamePhase === 'riverKeySubmit' && prevProps.gamePhase !== 'riverKeySubmit') ||
      (gamePhase === 'showdownKeySubmit' && prevProps.gamePhase !== 'showdownKeySubmit')
    ) {
      this.getChipNewPosition();
    } else if (!this.chipRef.current && this.state.chipStyles !== null) {
      this.setState({
        chipStyles: null,
      });
    }
    
    if (user && !prevProps.user) {
      this.setState({
        chipsInPlay: user.chipsInPlay,
      })
    } else if (user && prevProps.user && (user.chipsInPlay !== prevProps.user.chipsInPlay)) {
      const fpsInterval = gamePhase === 'showdown' ? 3000 / 60 : 1000 / 60;
      const unit = (user.chipsInPlay - prevProps.user.chipsInPlay) / fpsInterval;

      const amountInterval = setInterval(() => {
        this.setState(({ chipsInPlay }) => ({
          chipsInPlay: unit > 0
            ? Math.min(chipsInPlay + unit, user.chipsInPlay)
            : Math.max(chipsInPlay + unit, user.chipsInPlay),
        }), () => {
          if (
            (unit > 0 && this.state.chipsInPlay >= user.chipsInPlay)
              || (unit < 0 && this.state.chipsInPlay <= user.chipsInPlay)
          ) {
            clearInterval(amountInterval);
          }
        });
      }, fpsInterval);
    }
  }

  componentWillUnmount() {
    if (this.countdownCounter) {
      clearTimeout(this.countdownCounter);
    }
  }

  countdown() {
    this.countdownCounter = setTimeout(() => {
      this.setState(({ countdownNumber }) => ({
        countdownNumber: countdownNumber - 1,
      }), () => {
        const { countdownNumber } = this.state;
        if (countdownNumber > 0) {
          this.countdown();
        } else {
          this.props.timesUp();
          this.setState({
            countdownNumber: null,
          });
        }
      });
    }, 1000)
  }

  getChipNewPosition() {
    if (this.chipRef.current) {
      const mainPot = document.querySelector('#main-pot');
      const {
        height: potHeight,
        left: potLeft,
        top: potTop,
        width: potWidth,
      } = mainPot.getBoundingClientRect();
      const {
        left: chipLeft,
        top: chipTop,
      } = this.chipRef.current.getBoundingClientRect();

      const potHeightCenter = potHeight / 2;
      const potWidthCenter = potWidth / 2;
      const chipNewTop = potTop - chipTop + potHeightCenter;
      const chipNewLeft = potLeft - chipLeft + potWidthCenter;

      const chipStyles = {
        top: chipNewTop,
        left: chipNewLeft,
        opacity: 0,
      };

      this.setState({
        chipStyles,
      });
    }
  }

  toggleHover(isMouseIn) {
    this.setState({
      hoveringOnCards: isMouseIn,
    })
  }

  render() {
    const {
      action,
      betSide,
      className,
      gamePhase,
      isActiveSeat,
      isDealer,
      user,
      sitIn,
      openCards,
      timeout,
      gameMode,
      whiteLabel,
    } = this.props;
    const {
      chipStyles,
      countdownNumber,
    } = this.state;

    return (
      <div className={classNames(
        'seat',
        className,
        {
          'seat--margin-bottom': betSide === 'bottom',
        },
        )}
        onMouseEnter={() => this.toggleHover(true)}
        onMouseLeave={() => this.toggleHover(false)}
      >
        {
          user && Object.keys(user).length && user.bet
          ? (
              <div className={classNames(
                'seat__bet-amount-wrapper',
                `seat__bet-amount-wrapper--${betSide}`,
                )}
              >
                <img
                  className="seat__bet-chip-image"
                  src="/../../static/images/Chip.png"
                  style={chipStyles}
                  ref={this.chipRef}
                />
                <span className={classNames('seat__bet-amount', {
                  'seat__bet-amount--fade-out': chipStyles !== null,
                })}>
                  <Denomination>
                    {user.bet}
                  </Denomination>
                </span>
              </div>
          )
          : ''
        }
        {user && Object.keys(user).length > 0 && (user.hasCards || openCards.length > 0 && this.state.hoveringOnCards && user.sittingIn) && <HandCardsComponent isFaded={!user.hasCards && openCards.length > 0} gameMode={gameMode} openCards={openCards}/>}
        {
          isActiveSeat && gamePhase === 'mentalShuffle' && (
            <div className="seat__shuffle-container">
              <div className="seat__shuffle-card card" />
              <div className="seat__shuffle-card card" />
              <div className="seat__shuffle-card card" />
            </div>
          )
        }
        <div
          className={classNames(
            'seat__name',
            {
              'seat__name--active': isActiveSeat,
              'seat__name--clickable': !user,
              'seat__name--with-margin': !user,
              'seat__name--cpg-blue': whiteLabel === 'cpg',
            }
          )}
          onClick={() => sitIn()}
        >
          <span
            className={classNames('seat__countdown-bar', {
              'seat__countdown-bar--count-down': countdownNumber !== null,
              'seat__countdown-bar--cpg-blue' : whiteLabel === 'cpg',
            })}
            style={{ animationDuration: `${timeout / 1000}s` }}
          />
          {user && Object.keys(user).length
            ? user.name
            : 'Sit In'
          }
          {countdownNumber !== null && (
            <span className={classNames('seat__counter', {
              'seat__counter--cpg-blue' : whiteLabel === 'cpg',
            })}>{countdownNumber}</span>
          )}
        </div>
        {user && Object.keys(user).length > 0 && (
          <div className={classNames(
            'seat__balance',
            {
              'seat__balance--cpg-blue' : whiteLabel === 'cpg',
            }
            )}>
            {
              isDealer
                && <div className="seat__dealer-marker">D</div>
            }
            {
              user.sittingIn
              ? <Denomination>
                {this.state.chipsInPlay}
              </Denomination>
              : 'sitting out'
            }
            <span className={classNames(
              'seat__notification',
              {
                'seat__notification--right': user && user.bet && betSide === 'bottom'
              }
              )}
            >
              {action}
            </span>
          </div>
        )}
      </div>
    );
  }
}

SeatComponent.propTypes = {
  action: PropTypes.string.isRequired,
  betSide: PropTypes.string.isRequired,
  gamePhase: PropTypes.string,
  isActiveSeat: PropTypes.bool.isRequired,
  isDealer: PropTypes.bool.isRequired,
  openCards: PropTypes.array.isRequired,
  timeout: PropTypes.number.isRequired,
  gameMode: PropTypes.string.isRequired,
  user: PropTypes.shape({
    name: PropTypes.string,
    chipsInPlay: PropTypes.number,
    sittingIn: PropTypes.bool,
    inHand: PropTypes.bool,
    hasCards: PropTypes.bool,
    cards: PropTypes.array,
    mentalCards: PropTypes.array,
    bet: PropTypes.number,
  }),
  sitIn: PropTypes.func.isRequired,
  whiteLabel: PropTypes.string,
};

export default SeatComponent;