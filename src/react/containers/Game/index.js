import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import ActionButtonsComponent from '../../components/ActionButtons';
import ButtonComponent from '../../components/Button';
import ChatComponent from '../../components/Chat';
import LinkComponent from '../../components/Link';
import KickoutNotificationComponent from '../../components/KickoutNotification';
import ShuffleStatusComponent from '../../components/ShuffleStatus';
import MadeHandComponent from '../../components/MadeHand';
import TableTwoComponent from '../../components/Table/TableTwo';
import TableSixComponent from '../../components/Table/TableSix';
import TableNineComponent from '../../components/Table/TableNine';
import SitInModalComponent from '../../components/SitInModal';
import UserMenuComponent from '../../components/UserMenu';

import gameActions from '../../store/actions/game';
import { setUserBalance } from '../../store/actions/auth';

import authSelectors from '../../store/selectors/auth';
import gameSelectors from '../../store/selectors/game';
import lobbySelectors from '../../store/selectors/lobby';

import { socket } from '../Sockets';

import sounds from '../../utils/sounds';

class GameComponent extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isSitInModalOpen: false,
      isReBuyModalOpen: false,
      isKickoutNotificationModalOpen: false,
      kickoutMessage: {
        title: '',
        body: '',
      },
      selectedSeat: null,
      minStack: null,
      sitInError: '',
      reBuyError: '',
      actionState: '',
      lastActedPhase: '',
    };

    this.leaveRoom = this.leaveRoom.bind(this);
    this.handleFold = this.handleFold.bind(this);
    this.handleCall = this.handleCall.bind(this);
    this.handleCheck = this.handleCheck.bind(this);
    this.handleBet = this.handleBet.bind(this);
    this.handleRaise = this.handleRaise.bind(this);
    this.handleDefaultAction = this.handleDefaultAction.bind(this);
    this.resetState = this.resetState.bind(this);
    this.standUp = this.standUp.bind(this);
    this.unloadWindow = this.unloadWindow.bind(this);
    this.closeReBuyModal = this.closeReBuyModal.bind(this);
    this.showSitInButton = this.showSitInButton.bind(this);
    this.showLeaveTableButton = this.showLeaveTableButton.bind(this);
    this.showSitOutNextHandButton = this.showSitOutNextHandButton.bind(this);
    this.showReBuyButton = this.showReBuyButton.bind(this);
    this.getShuffleStatusText = this.getShuffleStatusText.bind(this);
    this.reconnectToTable = this.reconnectToTable.bind(this);
    this.sendNotification = this.sendNotification.bind(this);
    this.playBeepSound = this.playBeepSound.bind(this);
    
    socket.on('prepareForNewRound', this.resetState);

    socket.on('actBettedPot', () => {
      this.playBeepSound();
      this.setState({
        actionState: 'actBettedPot',
      });
    });

    socket.on('actNotBettedPot', () => {
      this.playBeepSound();
      this.setState({
        actionState: 'actNotBettedPot',
      });
    });

    socket.on('actOthersAllIn', () => {
      this.playBeepSound();
      this.setState({
        actionState: 'actOthersAllIn',
      });
    });

    socket.on('kicked', (message) => {
      this.setState({
        selectedSeat: null,
        sitInError: '',
        actionState: '',
        lastActedPhase: '',
        isKickoutNotificationModalOpen: true,
        kickoutMessage: JSON.parse(message),
      });
    });

    socket.on('penalized', (message) => {
      this.setState({
        selectedSeat: null,
        sitInError: '',
        actionState: '',
        lastActedPhase: '',
        isKickoutNotificationModalOpen: true,
        kickoutMessage: JSON.parse(message),
      });
    });

    socket.on('reconnect', this.reconnectToTable);
  }

  playBeepSound() {
    if (document.hidden || this.props.gameState.playersInHandCount >= 4) {
      sounds.beepSound.play();
    }
  }

  componentDidMount() {
    const {
      table: {
        id,
      },
    } = this.props
    socket.emit('enterRoom', id);
    this.props.fetchTableDataAction(id);

    window.addEventListener('beforeunload', this.unloadWindow, false);
  };

  componentWillUnmount() {
    this.leaveRoom();
    this.props.clearMessagesAction();

    // Clear all socket listeners tied to this component to prevent memory leaks
    socket.off('prepareForNewRound', this.resetState); // Target only this specific listener
    socket.off('actBettedPot');
    socket.off('actNotBettedPot');
    socket.off('actOthersAllIn');
    socket.off('kicked');
    socket.off('reconnect');

    window.removeEventListener('beforeunload', this.unloadWindow);
  };

  /**
   * When the window unloads it sends the keys back to the server
   * @param {Object} e - event
   */
  unloadWindow(e) {
    const {
      keyPairs,
      privateKeyHashes,
      myMentalCards,
      gameState,
    } = this.props;
    const { selectedSeat } = this.state;
    const confirmationMessage = 'Are you sure you want to leave?';

    // Immediately send all keys if window starts unloading
    if (selectedSeat && gameState.seats[selectedSeat] && gameState.seats[selectedSeat].inHand) {
      const bufferData = keyPairs.map((key, i) => myMentalCards.includes(i) ? privateKeyHashes[i] : key.privateKey);
      socket.emit('urgentKeySubmit', bufferData);

      (e || window.event).returnValue = confirmationMessage; //Gecko + IE
      return confirmationMessage;                            //Webkit, Safari, Chrome
    }
  }

  resetState() {
    this.setState({
      actionState: '',
      lastActedPhase: '',
    });
  }

  reconnectToTable() {
    const {
      id,
    } = this.props.table;
    const { sessionToken } = this.props;
    const { selectedSeat } = this.state;

    console.log('reconnected');

    socket.emit('reconnectTable', sessionToken, id, selectedSeat, (res) => {
      if (res.success) {
        console.log('reconnected to table!');
      } else {
        console.log('failed to reconnect to table');
        socket.emit('enterRoom', id);
        this.setState({
          selectedSeat: null,
          sitInError: '',
          actionState: '',
          lastActedPhase: '',
        });
      }
    });
  }

  openSitInModal(index) {
    if (this.props.userName === 'guest') {
      window.location = '/auth';
    } else if (this.state.selectedSeat === null && (this.props.gameState.seats[index] === null || this.props.gameState.seats[index] === undefined || !this.props.gameState.seats[index].isSitting)) {
      socket.emit('getBuyInInfo', this.props.gameState.id, (response) => {
        if (response.success) {
          this.props.setUserBalance(response.balance);
          this.setState({
            minStack: response.minStack,
            selectedSeat: index,
            isSitInModalOpen: true,
            sitInError: '',
          });
        }
      });
    }
  };

  openReBuyModal() {
    socket.emit('getBuyInInfo', this.props.gameState.id, (response) => {
      if (response.success) {
        this.props.setUserBalance(response.balance);
      }

      this.setState({
        isReBuyModalOpen: true,
      });
    });
  };

  closeSitInModal() {
    this.setState({
      isSitInModalOpen: false,
      selectedSeat: null,
    })
  };

  closeReBuyModal() {
    this.setState({
      isReBuyModalOpen: false,
      reBuyError: '',
    });
  }

  closeKickoutNotificationModal() {
    this.setState({
      isKickoutNotificationModalOpen: false,
      kickoutMessage: {
        title: '',
        body: '',
      },
    })
  };

  leaveTable() {
    this.props.history.push('/');
  };

  leaveRoom() {
    socket.emit('leaveRoom');
    this.props.leaveTableAction();
  }

  sitOut() {
    socket.emit('sitOut');
  }

  sitIn() {
    socket.emit('sitIn');
  }

  standUp() {
    const { selectedSeat } = this.state;
    const { gameState } = this.props;

    // TODO: Create a way to gracefully leave table during shuffle!
    if(selectedSeat !== null
      && gameState.seats[selectedSeat]
      && gameState.seats[selectedSeat].hasCards
      && gameState.seats[selectedSeat].inHand
      && gameState.phase !== 'showdown'
      ) {
      console.log('send keys and leave');
      const {
        keyPairs,
        privateKeyHashes,
        myMentalCards,
      } = this.props;
      const bufferData = keyPairs.map((key, i) => myMentalCards.includes(i) ? privateKeyHashes[i] : key.privateKey);

      socket.emit('urgentKeySubmit', bufferData, (response) => {
        if (response.success) {
          socket.emit('leaveTable', (response) => {
            if (response.success) {
              this.props.setUserBalance(response.totalChips);
              this.setState({
                selectedSeat: null,
              });
            }
          });
        }
      })
    } else if (
      selectedSeat === null 
      || gameState.phase === null // Game is stopped
      || gameState.phase === 'showdown'
      || !gameState.seats[selectedSeat].inHand) { // We're not in hand
      socket.emit('leaveTable', (response) => {
        this.props.setUserBalance(response.totalChips);
        if (response.success) {
          this.setState({
            selectedSeat: null,
          });
        }
      });
    }
  }

  submitModal(chips, password) {
    socket.emit('sitOnTheTable',
      { 
        chips,
        password,
        seat: this.state.selectedSeat,
        tableID: this.props.table.id,
      }, 
      (response) => {
        if (response.success) {
          this.setState({
            isSitInModalOpen: false,
          });
        } else {
          this.setState({
            sitInError: response.error || 'Ups, smth went wrong...',
          })
        }
    });
  }

  submitReBuy(chips) {
    const { selectedSeat } = this.state;
    const { gameState } = this.props;

    socket.emit('reBuy', chips, (response) => {
      if (response.success) {
        this.setState({
          isReBuyModalOpen: false,
          reBuyError: '',
        });

        if (!gameState.seats[selectedSeat].sittingIn) {
          this.sitIn();
        }
      } else {
        this.setState({
          reBuyError: response.error || 'Ups, smth went wrong...',
        });
      }
    });
  }

  sendNotification(message) {
    // Commands in chat box only for debugging!
    if (window.location.host === 'game.front.traefik' || window.location.host === 'play-dev.fair.poker') {
      // check for debugging commands
      const commands = message.split(' ');
      if (commands[0] === '/d') {
        socket.disconnect();
      } else if (commands[0] === '/r') {
        socket.connect();
        this.reconnectToTable();
      } else if (commands[0] === '/o') {
        console.log('proto offence:', commands[1]);
        this.props.setPlannedProtocolOffence(commands.slice(1, commands.length));
      }
    }

    socket.emit('sendMessage', message)
  }

  handleFold() {
    const {
      keyPairs,
      privateKeyHashes,
      myMentalCards,
    } = this.props;
    const bufferData = keyPairs.map((key, i) => myMentalCards.includes(i) ? privateKeyHashes[i] : key.privateKey);

    socket.emit('fold', bufferData);
  }

  handleCall() {
    const { gameState } = this.props;

    socket.emit('call', (response) => {
      if (response.success) {
        this.setState({
          lastActedPhase: gameState.phase,
          actionState: '',
        });
      }
    });
  }

  handleBet(betAmount) {
    const { gameState } = this.props;
    socket.emit('bet', betAmount, (response) => {
      if (response.success) {
        this.setState({
          lastActedPhase: gameState.phase,
          actionState: '',
        });
      }
    });
  }

  handleCheck() {
    const { gameState } = this.props;

    socket.emit('check', (response) => {
      if (response.success) {
        this.setState({
          lastActedPhase: gameState.phase,
          actionState: '',
        });
      }
    });
  }

  handleRaise(raiseAmount) {
    const { gameState } = this.props;

    socket.emit('raise', raiseAmount, (response) => {
      if (response.success) {
        this.setState({
          lastActedPhase: gameState.phase,
          actionState: '',
        });
      }
    });
  }

  handleDefaultAction() {
    const { actionState, selectedSeat } = this.state;

    if (this.props.gameState.activeSeat === selectedSeat) {
      switch (actionState) {
        case 'actBettedPot':
        case 'actOthersAllIn': {
          this.handleFold();
        }
        case 'actNotBettedPot': {
          this.handleCheck();
        }
      }
    }
  }

  calculateBetAmount() {
    const { biggestBet, biggestRaise, bigBlind } = this.props.gameState;
    const { chipsInPlay, bet } = this.props.gameState.seats[this.state.selectedSeat];

    if (biggestBet) {
      return biggestBet >= chipsInPlay + bet ? 0 : Math.min(chipsInPlay + bet, biggestBet + biggestRaise);
    } else {
      return  Math.min(chipsInPlay, bigBlind);
    }
  }

  calculateCallAmount() {
    const { biggestBet } = this.props.gameState;
    const { chipsInPlay, bet } = this.props.gameState.seats[this.state.selectedSeat];

    return this.biggestBet === 0 ? 0 : Math.min(biggestBet - bet, chipsInPlay);
  }

  showSitOutNextHandButton() {
   const { selectedSeat } = this.state;
   const { gameState } = this.props;
   return gameState.seats[selectedSeat] && gameState.seats[selectedSeat].inHand;
  }

  showSitInButton() {
    const { selectedSeat } = this.state;
    const { gameState } = this.props;
    return gameState.seats[selectedSeat] 
      && !gameState.seats[selectedSeat].sittingIn 
      && gameState.seats[selectedSeat].chipsInPlay > 0;
  }

  showLeaveTableButton() {
    const { selectedSeat } = this.state;
    const { gameState } = this.props;
    const mySeat = gameState.seats[selectedSeat];

    return mySeat && mySeat.sittingIn && !mySeat.inHand
     || mySeat && !mySeat.sittingIn
     || (mySeat && mySeat.sittingIn && gameState.playersInHandCount === 0);
  }

  showSitOutButton() {
    const { selectedSeat } = this.state;
    const { gameState } = this.props;
    const mySeat = gameState.seats[selectedSeat];

    return mySeat && mySeat.sittingIn && !mySeat.inHand && gameState.playersSeatedCount > 1;
  }

  showReBuyButton() {
    const { selectedSeat } = this.state;
    const { gameState, table } = this.props;
    return gameState.seats[selectedSeat] 
      && !gameState.seats[selectedSeat].inHand 
      && gameState.seats[selectedSeat].chipsInPlay < table.maxBuyIn;
  }

  getShuffleStatusText() {
    const {
      isBackgroundShuffling, 
      isNextDeckAvailabe,
      phase,
      seats,
    } = this.props.gameState;
    const { selectedSeat, isReBuyModalOpen, isSitInModalOpen } = this.state;
    
    if (selectedSeat === null
      || (seats[selectedSeat] && !seats[selectedSeat].sittingIn)
      || isReBuyModalOpen 
      || isSitInModalOpen ) return '';

    if (isBackgroundShuffling) {
      return 'pre-shuffling next deck...';
    } else if (isNextDeckAvailabe) {
      return 'pre-shuffled deck available';
    } else if (!isNextDeckAvailabe && !isBackgroundShuffling && phase === 'mentalShuffle') {
      return 'shuffling deck...';
    }

    return '';
  }

  render() {
    const {
      balance,
      decryptedBoard,
      gameState,
      notifications,
      seatAction,
      table,
      openCards,
      openShowdownCards,
      userName,
      madeHand,
      whiteLabel,
    } = this.props;

    const minSitInStack = this.state.minStack ? Number(this.state.minStack) : table.minBuyIn;

    const isCryptoPokerGlobalBranded = 
      table.name.toLowerCase().includes('crypto poker global') 
        || table.name.toLowerCase().includes('cpg')
        || whiteLabel === 'cpg';

    const othersAllIn = gameState.seats
      .filter((seat, i) =>  seat !== null && i !== this.state.selectedSeat)
      .every(s => s.chipsInPlay === 0);

    return (
      <div className={classNames('game', {
        'game--cpg' : whiteLabel === 'cpg',
      })}>
        <div className="game__header">
          {
            (this.state.isSitInModalOpen || this.state.selectedSeat === null)
              ? (
                <div
                  className="game__back-button"
                  onClick={() => this.leaveTable()}
                >
                  <LinkComponent
                    whiteLabel={whiteLabel}
                    text="go to lobby"
                    destination={'/'}
                  />
                </div>
              )
              : (
                <div className="game__back-button">
                  {
                    this.showLeaveTableButton()
                     && (
                    <ButtonComponent
                      destination={'/'}
                      clickHandler={() => this.standUp()}
                      whiteLabel={whiteLabel}
                    >
                      leave table
                    </ButtonComponent>
                     )
                  }
                  {
                    this.showSitOutNextHandButton()
                    && (
                    <ButtonComponent
                      clickHandler={() => this.sitOut()}
                      whiteLabel={whiteLabel}
                    >
                      sit out next hand
                    </ButtonComponent>
                    )
                  }
                  {
                    this.showSitOutButton()
                    && (
                      <ButtonComponent
                      clickHandler={() => this.sitOut()}
                      whiteLabel={whiteLabel}
                    >
                      sit out
                    </ButtonComponent>
                    )
                  }
                  {
                    this.showSitInButton()
                    && (
                    <ButtonComponent
                      clickHandler={() => this.sitIn()}
                      whiteLabel={whiteLabel}
                    >
                      sit in
                    </ButtonComponent>
                    )
                  }
                  {
                    this.showReBuyButton()
                    && (
                    <ButtonComponent
                      clickHandler={() => this.openReBuyModal()}
                      whiteLabel={whiteLabel}
                    >
                      re-buy
                    </ButtonComponent>
                    )
                  }
                </div>
              )
          }
          <UserMenuComponent
            whiteLabel={whiteLabel}
            user={userName}
          />
          </div>
        {(() => {
          switch(table.seatsCount) {
            case 2: {
              return (
                <TableTwoComponent
                  seatAction={seatAction}
                  balance={balance}
                  isModalOpen={this.state.isSitInModalOpen || this.state.isKickoutNotificationModalOpen || this.state.isReBuyModalOpen}
                  gameState={gameState}
                  openCards={openCards}
                  openShowdownCards={openShowdownCards}
                  selectedSeat={this.state.selectedSeat}
                  onTableSitClick={(i) => this.openSitInModal(i)}
                  handleDefaultAction={this.handleDefaultAction}
                  decryptedBoard={decryptedBoard}
                  isCryptoPokerGlobalBranded={isCryptoPokerGlobalBranded}
                  whiteLabel={whiteLabel}
                />
              );
            }
            case 6: {
              return (
                <TableSixComponent
                  seatAction={seatAction}
                  balance={balance}
                  isModalOpen={this.state.isSitInModalOpen || this.state.isKickoutNotificationModalOpen || this.state.isReBuyModalOpen}
                  gameState={gameState}
                  openCards={openCards}
                  openShowdownCards={openShowdownCards}
                  selectedSeat={this.state.selectedSeat}
                  onTableSitClick={(i) => this.openSitInModal(i)}
                  handleDefaultAction={this.handleDefaultAction}
                  decryptedBoard={decryptedBoard}
                  isCryptoPokerGlobalBranded={isCryptoPokerGlobalBranded}
                  whiteLabel={whiteLabel}
                />
              );
            }
            case 9: {
              return (
                <TableNineComponent
                  seatAction={seatAction}
                  balance={balance}
                  isModalOpen={this.state.isSitInModalOpen || this.state.isKickoutNotificationModalOpen || this.state.isReBuyModalOpen}
                  gameState={gameState}
                  openCards={openCards}
                  openShowdownCards={openShowdownCards}
                  selectedSeat={this.state.selectedSeat}
                  onTableSitClick={(i) => this.openSitInModal(i)}
                  handleDefaultAction={this.handleDefaultAction}
                  decryptedBoard={decryptedBoard}
                  isCryptoPokerGlobalBranded={isCryptoPokerGlobalBranded}
                  whiteLabel={whiteLabel}
              />
              );
            }
          default:
            return '';
          }
        })()}
        <div className="made-hand">
        {
          (
            this.state.selectedSeat !== null
            && !(gameState.seats[this.state.selectedSeat] === undefined)
            && !(gameState.seats[this.state.selectedSeat] === null)
            && (gameState.seats[this.state.selectedSeat].inHand)
          ) ?
            <MadeHandComponent madeHand={madeHand} />
          : ''
        }
        </div>
        <div className="game__actions-wrapper">
          <ChatComponent
            isModalOpen={this.state.isSitInModalOpen || this.state.isKickoutNotificationModalOpen}
            notifications={notifications}
            sendMessage={(notification) => this.sendNotification(notification)}
            whiteLabel={whiteLabel}
          />
          {
            (
              this.state.selectedSeat !== null
                && !(gameState.seats[this.state.selectedSeat] === undefined)
                && !(gameState.seats[this.state.selectedSeat] === null)
                && (gameState.seats[this.state.selectedSeat].inHand)
                && (gameState.seats[this.state.selectedSeat].chipsInPlay > 0)
                && !(othersAllIn && this.state.actionState === '')
                && (gameState.phase === 'preflop' || gameState.phase === 'flop' || gameState.phase === 'turn' || gameState.phase === 'river')
            )
              ? (
                  <ActionButtonsComponent
                    actionState={this.state.actionState}
                    betAmount={this.calculateBetAmount()}
                    callAmount={this.calculateCallAmount()}
                    callButtonText={this.calculateCallAmount() === gameState.seats[this.state.selectedSeat].chipsInPlay ? 'all in' : 'call'}
                    isModalOpen={this.state.isSitInModalOpen || this.state.isKickoutNotificationModalOpen || this.state.isReBuyModalOpen}
                    isActive={gameState.activeSeat === this.state.selectedSeat}
                    chipsInPlay={gameState.seats[this.state.selectedSeat].chipsInPlay}
                    gamePhase={gameState.phase}
                    gameMode={gameState.gameMode}
                    isActive={gameState.activeSeat === this.state.selectedSeat}
                    lastActedPhase={this.state.lastActedPhase}
                    myBet={gameState.seats[this.state.selectedSeat].bet}
                    pots={gameState.pot}
                    seats={gameState.seats}
                    tableBiggestBet={gameState.biggestBet}
                    tableBigBlind={gameState.bigBlind}
                    handleFold={this.handleFold}
                    handleCall={this.handleCall}
                    handleBet={this.handleBet}
                    handleCheck={this.handleCheck}
                    handleRaise={this.handleRaise}
                    whiteLabel={whiteLabel}
                  />
                )
              : ''
          }
        </div>
        { this.state.isSitInModalOpen
          && (
            <SitInModalComponent
              isReBuy={false}
              name={table.name}
              isPasswordProtected={table.isPasswordProtected}
              balance={balance}
              minBuyIn={Math.max(table.minBuyIn, minSitInStack)}
              maxBuyIn={Math.max(table.maxBuyIn, minSitInStack)}
              sitInError={this.state.sitInError}
              closeSitInModal={() => this.closeSitInModal()}
              submitModal={(chips, password) => this.submitModal(chips, password)}
              whiteLabel={whiteLabel}
            />
          )
        }
        { 
          this.state.isReBuyModalOpen
          && (
            <SitInModalComponent
              isReBuy={true}
              name={table.name}
              isPasswordProtected={table.isPasswordProtected}
              balance={balance + gameState.seats[this.state.selectedSeat].chipsInPlay}
              minBuyIn={Math.max(gameState.seats[this.state.selectedSeat].chipsInPlay, table.minBuyIn)}
              maxBuyIn={table.maxBuyIn}
              sitInError={this.state.reBuyError}
              closeSitInModal={() => this.closeReBuyModal()}
              submitModal={(chips) => this.submitReBuy(chips)}
              whiteLabel={whiteLabel}
            />
          )
        }
        { this.state.isKickoutNotificationModalOpen
          && (
            <KickoutNotificationComponent
              message={this.state.kickoutMessage}
              closeNotificationModal={() => this.closeKickoutNotificationModal()}
            />
          )
        }
        <ShuffleStatusComponent nextShuffleStatus={ this.getShuffleStatusText() } />
      </div>
    );
  }
}

const mapStateToProps = state => ({
  balance: authSelectors.selectUserBalance(state),
  sessionToken: authSelectors.selectSessionToken(state),
  decryptedBoard: gameSelectors.selectDecryptedBoard(state),
  gameState: gameSelectors.selectTableGameData(state),
  keyPairs: gameSelectors.selectKeyPairs(state),
  myMentalCards: gameSelectors.selectMyMentalCards(state),
  notifications: gameSelectors.selectNotifications(state),
  openCards: gameSelectors.selectOpenCards(state),
  openShowdownCards: gameSelectors.selectOpenShowdownCards(state),
  privateKeyHashes: gameSelectors.selectPrivateKeyHashes(state),
  seatAction: gameSelectors.selectSeatAction(state),
  table: gameSelectors.selectCurrentTableData(state),
  madeHand: gameSelectors.selectMadeHand(state),
  userName: authSelectors.selectUserName(state),
  whiteLabel: lobbySelectors.selectWhiteLabel(state),
});

const mapDispatchToProps = dispatch => ({
  clearMessagesAction: bindActionCreators(gameActions.clearMessages, dispatch),
  fetchTableDataAction: bindActionCreators(gameActions.fetchTableData, dispatch),
  leaveTableAction: bindActionCreators(gameActions.leaveTable, dispatch),
  setUserBalance: bindActionCreators(setUserBalance, dispatch),
  setPlannedProtocolOffence: bindActionCreators(gameActions.setPlannedProtocolOffence, dispatch),
});

GameComponent.propTypes = {
  balance: PropTypes.number.isRequired,
  gameState: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    seatsCount: PropTypes.number.isRequired,
    bigBlind: PropTypes.number.isRequired,
    smallBlind: PropTypes.number.isRequired,
    minBuyIn: PropTypes.number.isRequired,
    maxBuyIn: PropTypes.number.isRequired,
    playersSeatedCount: PropTypes.number.isRequired,
    pot: PropTypes.arrayOf(
      PropTypes.shape({
        amount: PropTypes.number.isRequired,
        contributors: PropTypes.array,
      })
    ).isRequired,
    biggestBet: PropTypes.number.isRequired,
    dealerSeat: PropTypes.number,
    activeSeat: PropTypes.number,
    seats: PropTypes.array.isRequired,
    phase: PropTypes.string,
    board: PropTypes.array.isRequired,
    log: PropTypes.shape({
      message: PropTypes.string.isRequired,
      seat: PropTypes.any.isRequired,
      action: PropTypes.string.isRequired
    }),
    timeout: PropTypes.number.isRequired,
    playersInHandCount: PropTypes.number.isRequired,
  }),
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      message: PropTypes.string,
      sender: PropTypes.string,
    })
  ).isRequired,
  openCards: PropTypes.arrayOf(PropTypes.string).isRequired,
  openShowdownCards: PropTypes.object.isRequired,
  seatAction: PropTypes.shape({
    seat: PropTypes.number,
    notification: PropTypes.string,
  }).isRequired,
  table: PropTypes.shape(
    {
      id: PropTypes.string,
      name: PropTypes.string,
      bigBlind: PropTypes.number,
      maxBuyIn: PropTypes.number,
      minBuyIn: PropTypes.number,
      playersSeatedCount: PropTypes.number,
      seatsCount: PropTypes.number,
      smallBlind: PropTypes.number,
    }
  ).isRequired,
  clearMessagesAction: PropTypes.func.isRequired,
  fetchTableDataAction: PropTypes.func.isRequired,
  leaveTableAction: PropTypes.func.isRequired,
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps,
)(GameComponent));
