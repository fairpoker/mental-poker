import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

import AmountComponent from '../Amount';
import ButtonComponent from '../Button';
import Denomination from '../Denomination';
import game from '../../store/selectors/game';

class ActionButtonsComponent extends Component {
  constructor(props) {
    super(props);

    this.state = {
      plannedAction: null,
      usersBetAmount: 0,
    };

    this.handleBetAmountChange = this.handleBetAmountChange.bind(this);
    this.handleEnter = this.handleEnter.bind(this);
    this.summarizePots = this.summarizePots.bind(this);
    this.setInitialState = this.setInitialState.bind(this);
    this.myTurnNotPassed = this.myTurnNotPassed.bind(this);
    this.showAmountComponent = this.showAmountComponent.bind(this);
  }

  componentDidMount() {
    this.setState({
      usersBetAmount: this.props.betAmount,
    });
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.isActive 
        && !prevProps.isActive
        && this.props.betAmount === prevProps.betAmount
        && this.props.callAmount === prevProps.callAmount
        && this.state.plannedAction
    ) {
      switch (this.state.plannedAction) {
        case 'call':
          this.call();
          break;
        case 'check':
          this.check();
          break;
        case 'fold':
          this.fold();
          break;
        case 'raise':
          this.raise();
          break;
        case 'bet':
          if (this.props.tableBiggestBet === 0) {
            this.bet();
          } else {
            this.raise();
          }
          break;
        case 'check/fold':
          if (this.props.myBet === this.props.tableBiggestBet) {
            this.check();
          } else {
            this.fold();
          }
      };
    } else if (this.props.betAmount > this.state.usersBetAmount 
      && (this.state.plannedAction !== 'fold' 
        && this.state.plannedAction !== 'check/fold')) {
      // When planned action must be deselected
      this.setState({
        usersBetAmount: this.props.betAmount,
        plannedAction: null,
      })
    }
  }

  setInitialState() {
    this.setState({
      plannedAction: null,
    });
  }

  bet() {
    if (this.props.isActive) {
      this.props.handleBet(this.state.usersBetAmount);
      this.setInitialState();
    } else {
      this.setState(prevState => ({
        plannedAction: prevState.plannedAction === 'bet' ? '' : 'bet',
      }))
    };
  }

  call() {
    if (this.props.isActive) {
      this.props.handleCall();
      this.setInitialState();
    } else {
     this.setState(prevState => ({
        plannedAction: prevState.plannedAction === 'call' ? '' : 'call',
      }))
    };
  }

  check() {
    if (this.props.isActive) {
      this.props.handleCheck();
      this.setInitialState();
    } else {
      this.setState(prevState => ({
        plannedAction: prevState.plannedAction === 'check' ? '' : 'check',
      }))
    };
  }

  fold() {
    if (this.props.isActive) {
      this.props.handleFold();
      this.setInitialState();
    } else {
      this.setState(prevState => ({
        plannedAction: prevState.plannedAction === 'fold' ? '' : 'fold',
      }))
    };
  }

  checkFold() {
    this.setState(prevState => ({
      plannedAction: prevState.plannedAction === 'check/fold' ? '' : 'check/fold',
    }))
  }

  myTurnNotPassed() {
    const { 
      myBet,
      tableBiggestBet,
      chipsInPlay,
      gamePhase,
      lastActedPhase
    } = this.props;

    return gamePhase !== lastActedPhase || myBet < tableBiggestBet && chipsInPlay > 0;
  }

  raise() {
    if (this.props.isActive) {
      this.props.handleRaise(this.state.usersBetAmount);
      this.setInitialState();
    } else {
      this.setState(prevState => ({
        plannedAction: prevState.plannedAction === 'raise' ? '' : 'raise',
      }))
    };
  }

  showFoldButton() {
    const {
      tableBiggestBet,
      myBet,
    } = this.props;
    return this.myTurnNotPassed() && myBet < tableBiggestBet;
  }

  showCallButton() {
    const {
      isActive,
      callAmount,
      actionState,
      gamePhase,
      tableBiggestBet,
    } = this.props;

    return !!callAmount
      && ((isActive && (gamePhase === 'preflop' || actionState === 'actBettedPot' || actionState === 'actOthersAllIn'))
        || !isActive && tableBiggestBet !== 0 && this.myTurnNotPassed());
  }

  showCheckButton() {
    const {
      callAmount,
      isActive,
      actionState,
      tableBiggestBet,
    } = this.props;

    return (isActive && actionState === 'actNotBettedPot')
      || (isActive && (actionState === 'actBettedPot' || actionState === 'actOthersAllIn') && !callAmount)
      || (!isActive && (!callAmount || (tableBiggestBet === 0)) && this.myTurnNotPassed());
  }

  showRaiseButton() {
    const {
      betAmount,
      isActive,
      actionState,
      tableBiggestBet,
    } = this.props;
    return !!betAmount
      && ((isActive && actionState === 'actBettedPot')
      || (!isActive && tableBiggestBet > 0 && this.myTurnNotPassed()));
  }

  showBetButton() {
    const {
      isActive,
      actionState,
      tableBiggestBet,
      betAmount,
    } = this.props;
    return !!betAmount
      && ((isActive && actionState === 'actNotBettedPot')
      || (!isActive && tableBiggestBet === 0 && this.myTurnNotPassed()));
  }

  showAmountComponent() {
    const {
      actionState,
      betAmount,
      chipsInPlay,
      myBet
    } = this.props;

    return actionState !== 'actOthersAllIn' 
      && this.myTurnNotPassed() 
      && betAmount > 0 
      && chipsInPlay > betAmount - myBet;
  }

  handleBetAmountChange(usersBetAmount) {
    this.setState({
      usersBetAmount,
    })
  }

  handleEnter($event) {
    if (event.key === 'Enter') {
      if (this.showBetButton()) {
        this.bet();
      } else if (this.showRaiseButton()) {
        this.raise();
      }
    }
  }

  summarizePots() {
    const { pots, seats } = this.props;
    const sumPots = pots.reduce(
      (total, current) => total + current.amount,
      0,
    );
    // Player bets are considered to be in the pot, so we add them to the sum
    const sumBets = seats
      .filter(s => s !== null)
      .reduce((total, current) => total + current.bet, 0);
    return sumPots + sumBets;
  }

  render() {
    const {
      actionState,
      betAmount,
      callAmount,
      callButtonText,
      chipsInPlay,
      isModalOpen,
      myBet,
      tableBiggestBet,
      tableBigBlind,
      gameMode,
      whiteLabel,
    } = this.props;

    return (
      <div className={classNames(
        'action-buttons',
        { 'action-buttons--transparent': isModalOpen }
      )}>
      <div className={'button-spacing'}>
        {
          (this.showCheckButton() && !this.props.isActive)
            && (
              <ButtonComponent
                withGlitch={false}
                className='action-buttons__button'
                reversed={!this.props.isActive && this.state.plannedAction !== 'check/fold'}
                clickHandler={() => this.checkFold()}
                whiteLabel={whiteLabel}
              >
                check/fold
              </ButtonComponent>
            )
        }
        {
          (this.showCheckButton() && this.props.isActive)
            && (
              <ButtonComponent
                withGlitch={false}
                className='action-buttons__button'
                reversed={!this.props.isActive && this.state.plannedAction !== 'check'}
                clickHandler={() => this.check()}
                whiteLabel={whiteLabel}
              >
                check
              </ButtonComponent>
            )
        }
        {
          this.showFoldButton()
            && (
              <ButtonComponent
                withGlitch={false}
                className='action-buttons__button'
                reversed={!this.props.isActive && this.state.plannedAction !== 'fold' && this.state.plannedAction !== 'check/fold'}
                clickHandler={() => this.fold()}
                whiteLabel={whiteLabel}
              >
                fold
              </ButtonComponent>
            )
        }
      </div>
      <div className={'button-spacing'}>
        {
          this.showCallButton()
            && (
              <ButtonComponent
                withGlitch={false}
                className='action-buttons__button'
                reversed={!this.props.isActive && this.state.plannedAction !== 'call' && this.state.plannedAction !== 'callAny'}
                clickHandler={() => this.call()}
                whiteLabel={whiteLabel}
              >
                <span>{callButtonText} <Denomination>{callAmount}</Denomination></span>
              </ButtonComponent>
            )
        }
      </div>
      <div className={'button-spacing'}>
        {
          this.showBetButton()
            && (
              <ButtonComponent
                withGlitch={false}
                className='action-buttons__button'
                reversed={!this.props.isActive && this.state.plannedAction !== 'bet'}
                clickHandler={() => this.bet()}
                whiteLabel={whiteLabel}
              >
                <span>
                  {this.state.usersBetAmount === chipsInPlay + myBet ? 'all in ' : 'bet '}
                  <Denomination>{this.state.usersBetAmount}</Denomination></span>
              </ButtonComponent>
            )
        }
        {
          this.showRaiseButton()
            && (
              <ButtonComponent
                withGlitch={false}
                className='action-buttons__button'
                reversed={!this.props.isActive && this.state.plannedAction !== 'raise'}
                clickHandler={() => this.raise()}
                whiteLabel={whiteLabel}
              >
                <span>
                  {Number(this.state.usersBetAmount) === chipsInPlay + myBet ? 'all in ' : 'raise to '}
                  <Denomination>
                    {this.state.usersBetAmount}
                  </Denomination>
                </span>
              </ButtonComponent>
            )
        }
      </div>
      <div className={'amount-component-spacing'}>
        {
            this.showAmountComponent()
            && (
              <AmountComponent
                betAmount={betAmount}
                biggestBet={tableBiggestBet}
                bigBlind={tableBigBlind}
                chipsInPlay={chipsInPlay}
                myBet={myBet}
                gameMode={gameMode}
                potsValue={this.summarizePots()}
                handleBetChange={this.handleBetAmountChange}
                handleEnter={this.handleEnter}
                callAmount={callAmount}
                whiteLabel={whiteLabel}
              /> 
            )
          }
      </div>
        
      </div>
    );
  }
}

ActionButtonsComponent.propTypes = {
  actionState: PropTypes.string.isRequired,
  betAmount: PropTypes.number.isRequired,
  callAmount: PropTypes.number.isRequired,
  callButtonText: PropTypes.string.isRequired,
  chipsInPlay: PropTypes.number.isRequired,
  gameMode: PropTypes.string.isRequired,
  gamePhase: PropTypes.string.isRequired,
  isActive: PropTypes.bool.isRequired,
  isModalOpen: PropTypes.bool.isRequired,
  lastActedPhase: PropTypes.string.isRequired,
  myBet: PropTypes.number.isRequired,
  pots: PropTypes.arrayOf(
    PropTypes.shape({
      amount: PropTypes.number.isRequired,
      contributors: PropTypes.array,
    })
  ).isRequired,
  seats: PropTypes.arrayOf(
    PropTypes.shape({
      bet: PropTypes.number.isRequired,
      // More props but we don't care
    })
  ).isRequired,
  tableBiggestBet: PropTypes.number.isRequired,
  tableBigBlind: PropTypes.number.isRequired,
  handleFold: PropTypes.func.isRequired,
  handleCall: PropTypes.func.isRequired,
  handleBet: PropTypes.func.isRequired,
  handleCheck: PropTypes.func.isRequired,
  handleRaise: PropTypes.func.isRequired,
  whiteLabel: PropTypes.string,
};

export default ActionButtonsComponent;
