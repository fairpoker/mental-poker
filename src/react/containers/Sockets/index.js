import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { setUserSession } from '../../store/actions/auth'
import gameActions from '../../store/actions/game'

import gameSelectors  from '../../store/selectors/game';
import authSelectors from '../../store/selectors/auth';

import { getCookie, findGetParameter } from '../../utils/helpers';
import { 
  mentalShuffle,
  decryptCards,
} from '../../utils/shuffling';
import {
  findBestPokerHandOnBoard,
} from '../../../utils/helpers';

import sounds from '../../utils/sounds';

export const socket = io.connect();
class SocketsContainer extends Component {
  constructor(props) {
    super(props);

    const {
      saveSeatNotificationAction,
      setUserSessionAction,
      setMentalCards,
      setStartingMentalDeck,
      setFinalMentalDeck,
      storeNewTableDataAction,
    } = this.props;

    socket.on('connect', () => {
      const isGuest = findGetParameter('guest') === "true";
      const cookieSessionToken = getCookie('GAME_SESSION');

      // If the session token is empty then this is a newly opened window.
      if (this.props.sessionToken === '' && cookieSessionToken) {
        socket.emit('auth', cookieSessionToken, (response) => {
          if (response.success) {
            setUserSessionAction({ ...response, sessionToken: cookieSessionToken });
          } else {
            window.location = '/auth';
          }
        });
      } else if (!cookieSessionToken && !isGuest) {
        window.location = '/auth';
      } else if (!isGuest) {
        // If the session token exists then the user has disconnected and now is attempting to reconnect again
        // Attempt to re-authenticate but do not re-direct user to the account section,
        // as this user might be in an ongoing game.
        socket.emit('auth', this.props.sessionToken, (response) => {
          console.log('re-authenticated', response.success);
        });
      } else {
        // This is a guest
        setUserSessionAction({
          totalChips: 0,
          screenName: 'guest',
          sessionToken: '',
        })
      }
    });

    socket.on('table-data', (response) => {
      storeNewTableDataAction(response);

      const {
        message,
        action,
        seat,
        notification,
      } = response.log;

      if (message) {
        this.props.messageReceivedAction({ message, sender: '' });
      }
      switch (response.log.action) {
        case 'fold':
          sounds.foldSound.play();
          break;
        case 'check':
          sounds.checkSound.play();
          break;
        case 'call':
          sounds.callSound.play();
          break;
        case 'bet':
          sounds.betSound.play();
          break;
        case 'raise':
          sounds.raiseSound.play();
          break;
      }

      if (action) {
        saveSeatNotificationAction({ seat, notification });
        setTimeout(() => {
          saveSeatNotificationAction({ seat: null, notification: '' });
        }, 1000);
      }
    });

    socket.on('postSmallBlind', () => {
      socket.emit( 'postBlind', true, (response) => {
        if (response.success) {
          sounds.betSound.play();
        }
      });
    });

    socket.on('postBigBlind', () => {
      socket.emit( 'postBlind', true, (response) => {
        if (response.success) {
          sounds.betSound.play();
        }
      });
    });

    socket.on('receiveMessage', (message) => {
      this.props.messageReceivedAction(message);
    });

    socket.on('gameStopped', (response) => {
      this.props.storeNewTableDataAction(response);
    });

    // Mental poker API

    /**
     * When we must generate new mental player.
     */
    socket.on('prepareForNewRound', () => {
      this.props.prepareForMentalPokerRound();
    });

    /**
     * When certain object keys of the mental deck change
     */
    socket.on('mental-deck-data', (data) => {
      this.props.updateMentalDeck(data);
    });

    socket.on('next-mental-deck-data', (data) => {
      this.props.updateNextMentalDeck(data);
    });

    socket.on('prepareNextMentalDeck', () => {
      this.props.prepareNextMentalDeck();
    });

    socket.on('useNextMentalDeck', () => {
      this.props.useNextMentalDeck();
    });

    /**
     * When the player is asked to shuffle cards
     * 
     * @param {Array} deck - The deck of cards to shuffle
     * @param {Boolean} shouldShuffle - True if this is a shuffle, false if it's a locking
     */
    socket.on('shuffleCards', async (deck, shouldShuffle) => {
      let shuffledCards;
      if (this.props.plannedProtocolOffence[0] === 'shuff') {
        // We debug the protocol failure cases here
        console.log('Offending shuffle!');
        const bogusKeyPairs = gameActions.generateNewMentalDeck().mentalPlayer.keyPairs;
        shuffledCards = await mentalShuffle(bogusKeyPairs, deck, shouldShuffle);
      } else {
        shuffledCards = await mentalShuffle(this.props.keyPairs, deck, shouldShuffle);
      }
      socket.emit('shuffleCards', shuffledCards, this.props.commitment, (response) => {
        if(!response.success) {
          console.log('error in card submission!');
        }
      });
    });

    socket.on('shuffleNextCards', async (deck, shouldShuffle) => {
      let shuffledCards;
      if (this.props.plannedProtocolOffence[0] === 'nextShuff') {
        // We debug the protocol failure cases here
        console.log('Offending next shuffle!');
        const bogusKeyPairs = gameActions.generateNewMentalDeck().mentalPlayer.keyPairs;
        shuffledCards = await mentalShuffle(bogusKeyPairs, deck, shouldShuffle);
      } else {
        shuffledCards = await mentalShuffle(this.props.nextKeyPairs, deck, shouldShuffle);
      }

      socket.emit('shuffleNextCards', shuffledCards, this.props.nextCommitment, (response) => {
        if(!response.success) {
          console.log('error in card submission!');
        }
      });
    });

    /**
     * When the player is dealt his face down mental cards.
     * These are indexes from the final deck which the player will decrypt by himself.
     * 
     * @param {Array} cards - The cards of this player
     */
    socket.on('dealingMentalCards', (cards) => {
      setMentalCards(cards);
    });

    /**
     * When the player is asked to submit his private keys to certain cards of the deck.
     * 
     * @param {Array} indexes - The indexes of cards the player is asked to send
     */
    socket.on('submitKeys', (indexes) => {
      const keys = [];
      indexes.forEach(i => keys[i] = this.props.keyPairs[i].privateKey);

      socket.emit('submitKeys', keys, (response) => {
        if(!response.success) {
          console.log('error submitting keys!');
        }
      });
    });

    socket.on('allKeySubmit', () => {
      const keys = this.props.keyPairs.map(k => k.privateKey);
      socket.emit('allKeySubmit', keys);
    })

    /**
     * When card shuffling and send keys have finished and 
     * we have all necessary data to decrypt our face-down cards 
     */
    socket.on('openCards', () => {
      const {
        keyPairs,
        myMentalCards, 
        mentalDeck: { history, transportKeys },
        saveOpenCardsAction,
       } = this.props;

      /* Here we must convert the starting and final deck of cards to Buffer.
       * Since this is an expensive computation and we'll need those decks later on, 
       * we save them to the global data store.*/
      const startingDeck = history[0].map(c => Buffer.from(c));
      const finalDeck = history[history.length - 1].map(c => Buffer.from(c));
      setStartingMentalDeck(startingDeck);
      setFinalMentalDeck(finalDeck);

      const cards = decryptCards(startingDeck, finalDeck, transportKeys, keyPairs, myMentalCards);
      if (cards.error) {
        socket.emit('protocolFailure', keyPairs.map(k => k.privateKey), (response) => {
          if (response.success) {
            console.log('initialized protocol failure');
          }
        });
      }

      saveOpenCardsAction(cards);
    });

    /**
     * When all players have submitted keys to the community cards
     * and we have all necessary data to open new card from the board.
     * 
     * @param {string} phase - The game phase
     */
    socket.on('openBoard', (phase) => {
      const {
        startingMentalDeck,
        finalMentalDeck,
        mentalDeck: { communityCards, transportKeys },
        saveDecryptedBoardAction,
        saveMadeHand,
        openCards,
        decryptedBoard,
      } = this.props;

      let cardsToDecrypt = [];
      if (phase === 'flop') {
        cardsToDecrypt.push(...communityCards);
      } else if (phase === 'turn') {
        cardsToDecrypt.push(communityCards[3]);
      } else if (phase === 'river') {
        cardsToDecrypt.push(communityCards[4]);
      }

      const newBoardCards = decryptCards(startingMentalDeck, finalMentalDeck, transportKeys, null, cardsToDecrypt)
         .decryptedCards;

      const madeHand = findBestPokerHandOnBoard(openCards, decryptedBoard.concat(newBoardCards))
         .name;

      saveMadeHand(madeHand);
      saveDecryptedBoardAction(newBoardCards);
    });

    socket.on('openShowdownCards', (seat) => {
      const {
        startingMentalDeck,
        finalMentalDeck,
        mentalDeck: { transportKeys },
        gameState,
        saveOpenShowdownCardsAction,
      } = this.props;

      const faceUpCards = decryptCards(
        startingMentalDeck,
        finalMentalDeck,
        transportKeys,
        null,
        gameState.seats[seat].mentalCards,
        ).decryptedCards;
      saveOpenShowdownCardsAction({
        seat,
        cards: faceUpCards,
      });

    });

    /**
     * When the server requests the player to urgently submit ALL of their card keys.
     * This can happen if the player has bad internet connection.
     */
    socket.on('urgentKeySubmit', () => {
      const { myMentalCards, keyPairs, privateKeyHashes } = this.props;
      const keys = this.props.keyPairs.map((k, i) => myMentalCards.includes(i) ? privateKeyHashes[i] : k.privateKey);
      socket.emit('urgentKeySubmit', keys);
    });
  }

  render() {
    return (
      <div />
    )
  }
}

const mapStateToProps = state => ({
  sessionToken: authSelectors.selectSessionToken(state),
  keyPairs: gameSelectors.selectKeyPairs(state),
  commitment: gameSelectors.selectCommitment(state),
  mentalDeck: gameSelectors.selectMentalDeck(state),
  myMentalCards: gameSelectors.selectMyMentalCards(state),
  gameState: gameSelectors.selectTableGameData(state),
  startingMentalDeck: gameSelectors.selectStartingMentalDeck(state),
  finalMentalDeck: gameSelectors.selectFinalMentalDeck(state),
  privateKeyHashes: gameSelectors.selectPrivateKeyHashes(state),
  nextKeyPairs: gameSelectors.selectNextKeyPairs(state),
  nextCommitment: gameSelectors.selectNextCommitment(state),
  plannedProtocolOffence: gameSelectors.selectPlannedProtocolOffence(state),
  openCards: gameSelectors.selectOpenCards(state),
  decryptedBoard: gameSelectors.selectDecryptedBoard(state),
});


const mapDispatchToProps = dispatch => ({
  setUserSessionAction: bindActionCreators(setUserSession, dispatch),
  storeNewTableDataAction: bindActionCreators(gameActions.fetchTableDataSuccess, dispatch),
  setMentalCards: bindActionCreators(gameActions.setMentalCards, dispatch),
  updateMentalDeck: bindActionCreators(gameActions.updateMentalDeck, dispatch),
  setStartingMentalDeck: bindActionCreators(gameActions.setStartingMentalDeck, dispatch),
  setFinalMentalDeck: bindActionCreators(gameActions.setFinalMentalDeck, dispatch),
  prepareForMentalPokerRound: bindActionCreators(gameActions.prepareForMentalPokerRound, dispatch),
  messageReceivedAction: bindActionCreators(gameActions.saveReceivedMessage, dispatch),
  saveOpenCardsAction: bindActionCreators(gameActions.saveOpenCards, dispatch),
  saveSeatNotificationAction: bindActionCreators(gameActions.saveSeatAction, dispatch),
  saveDecryptedBoardAction: bindActionCreators(gameActions.saveBoard, dispatch),
  saveOpenShowdownCardsAction: bindActionCreators(gameActions.saveOpenShowdownCards, dispatch),
  saveMadeHand: bindActionCreators(gameActions.saveMadeHand, dispatch),
  prepareNextMentalDeck: bindActionCreators(gameActions.prepareNextMentalDeck, dispatch),
  updateNextMentalDeck: bindActionCreators(gameActions.updateNextMentalDeck, dispatch),
  useNextMentalDeck: bindActionCreators(gameActions.useNextMentalDeck, dispatch),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SocketsContainer);
