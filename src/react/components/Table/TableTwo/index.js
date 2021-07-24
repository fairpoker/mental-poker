import React from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

import BoardCardsComponent from '../../BoardCards';
import PotComponent from '../../Pot';
import SeatComponent from '../../Seat';

const TableTwoComponent = (props) => {
  const {
    isModalOpen,
    decryptedBoard,
    gameState: {
      activeSeat,
      board,
      dealerSeat,
      phase,
      pot,
      seats,
      timeout,
      gameMode,
    },
    openCards,
    openShowdownCards,
    seatAction,
    selectedSeat,
    onTableSitClick,
    handleDefaultAction,
    isCryptoPokerGlobalBranded,
    whiteLabel,
  } = props;

  const cardsToDisplay = (index) => {
    return selectedSeat === index
      ? openCards
      : openShowdownCards[index] 
        || (seats[index] && seats[index].cards)
        || []
  }

  const boardToDisplay = () => {
    return selectedSeat === null || (seats[selectedSeat] && !seats[selectedSeat].inHand)
      ? board : decryptedBoard;
  }

  return (
    <div className={classNames(
      'table',
      { 'table--transparent': isModalOpen }
    )}>
      <div className={classNames(
        'table__cloth',
        { 'table__cloth--cpg' : isCryptoPokerGlobalBranded }
      )}></div>
      <div className="table__column">
        { 
          (selectedSeat === null || seats[0])
            && <SeatComponent
              action={seatAction.seat === 0 ? seatAction.notification : ''}
              betSide={'right'}
              gamePhase={phase}
              isActiveSeat={phase !== 'showdown' && activeSeat === 0}
              openCards={cardsToDisplay(0)}
              isDealer={dealerSeat === 0}
              user={seats[0]}
              gameMode={gameMode}
              sitIn={() => onTableSitClick(0)}
              timeout={timeout}
              timesUp={handleDefaultAction}
              whiteLabel={whiteLabel}
            />
        }
      </div>
      <div className="table__column table__column--center">
        <div className="table__row table__game-row">
          <PotComponent pot={pot} phase={phase} />
          <BoardCardsComponent boardCards={boardToDisplay()} />
        </div>
      </div>
      <div className="table__column">
        {
          (selectedSeat === null || seats[1])
            && <SeatComponent
              action={seatAction.seat === 1 ? seatAction.notification : ''}
              betSide={'left'}
              gamePhase={phase}
              isActiveSeat={phase !== 'showdown' && activeSeat === 1}
              openCards={cardsToDisplay(1)}
              isDealer={dealerSeat === 1}
              user={seats[1]}
              gameMode={gameMode}
              sitIn={() => onTableSitClick(1)}
              timeout={timeout}
              timesUp={handleDefaultAction}
              whiteLabel={whiteLabel}
            />
        }
      </div>
    </div>
  );
};

TableTwoComponent.propTypes = {
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
    gameMode: PropTypes.string.isRequired,
    board: PropTypes.array.isRequired,
    log: PropTypes.shape({
      message: PropTypes.string.isRequired,
      seat: PropTypes.any.isRequired,
      action: PropTypes.string.isRequired
    }),
    timeout: PropTypes.number.isRequired,
    playersInHandCount: PropTypes.number.isRequired,
  }),
  isCryptoPokerGlobalBranded: PropTypes.bool.isRequired,
  openCards: PropTypes.arrayOf(PropTypes.string).isRequired,
  openShowdownCards: PropTypes.object.isRequired,
  seatAction: PropTypes.shape({
    seat: PropTypes.number,
    notification: PropTypes.string,
  }).isRequired,
  onTableSitClick: PropTypes.func.isRequired,
  whiteLabel: PropTypes.string,
};

export default TableTwoComponent;
