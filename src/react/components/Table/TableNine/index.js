import React from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

import BoardCardsComponent from '../../BoardCards';
import PotComponent from '../../Pot';
import SeatComponent from '../../Seat';

const TableNineComponent = (props) => {
  const {
    decryptedBoard,
    isModalOpen,
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
        { 
          (selectedSeat === null || seats[8])
            && <SeatComponent
              action={seatAction.seat === 8 ? seatAction.notification : ''}
              betSide={'right'}
              gamePhase={phase}
              isActiveSeat={phase !== 'showdown' && activeSeat === 8}
              openCards={cardsToDisplay(8)}
              isDealer={dealerSeat === 8}
              user={seats[8]}
              gameMode={gameMode}
              sitIn={() => onTableSitClick(8)}
              timeout={timeout}
              timesUp={handleDefaultAction}
              whiteLabel={whiteLabel}
            />
        }
      </div>
      <div className="table__column table__column--center">
        <div className="table__row">
          {
            (selectedSeat === null || seats[1])
              && <SeatComponent
                action={seatAction.seat === 1 ? seatAction.notification : ''}
                betSide={'bottom'}
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
          { 
            (selectedSeat === null || seats[2])
              && <SeatComponent
                action={seatAction.seat === 2 ? seatAction.notification : ''}
                betSide={'bottom'}
                gamePhase={phase}
                isActiveSeat={phase !== 'showdown' && activeSeat === 2}
                openCards={cardsToDisplay(2)}
                isDealer={dealerSeat === 2}
                user={seats[2]}
                gameMode={gameMode}
                sitIn={() => onTableSitClick(2)}
                timeout={timeout}
                timesUp={handleDefaultAction}
                whiteLabel={whiteLabel}
              />
          }
          { 
          (selectedSeat === null || seats[3])
            && <SeatComponent
              action={seatAction.seat === 3 ? seatAction.notification : ''}
              betSide={'bottom'}
              gamePhase={phase}
              isActiveSeat={phase !== 'showdown' && activeSeat === 3}
              openCards={cardsToDisplay(3)}
              isDealer={dealerSeat === 3}
              user={seats[3]}
              gameMode={gameMode}
              sitIn={() => onTableSitClick(3)}
              timeout={timeout}
              timesUp={handleDefaultAction}
              whiteLabel={whiteLabel}
            />
        }
        </div>
        <div className="table__row table__game-row">
          <PotComponent pot={pot} phase={phase} />
          <BoardCardsComponent boardCards={boardToDisplay()} />
        </div>
        <div className="table__row">
          { 
            (selectedSeat === null || seats[7])
              && <SeatComponent
                action={seatAction.seat === 7 ? seatAction.notification : ''}
                betSide={'top'}
                gamePhase={phase}
                isActiveSeat={phase !== 'showdown' && activeSeat === 7}
                openCards={cardsToDisplay(7)}
                isDealer={dealerSeat === 7}
                user={seats[7]}
                gameMode={gameMode}
                sitIn={() => onTableSitClick(7)}
                timeout={timeout}
                timesUp={handleDefaultAction}
                whiteLabel={whiteLabel}
              />
          }
          {
            (selectedSeat === null || seats[6])
              && <SeatComponent
                action={seatAction.seat === 6 ? seatAction.notification : ''}
                betSide={'top'}
                gamePhase={phase}
                isActiveSeat={phase !== 'showdown' && activeSeat === 6}
                openCards={cardsToDisplay(6)}
                isDealer={dealerSeat === 6}
                user={seats[6]}
                gameMode={gameMode}
                sitIn={() => onTableSitClick(6)}
                timeout={timeout}
                timesUp={handleDefaultAction}
                whiteLabel={whiteLabel}
              />
          }
        </div>
      </div>
      <div className="table__column">
        { 
          (selectedSeat === null || seats[4])
            && <SeatComponent
              action={seatAction.seat === 4 ? seatAction.notification : ''}
              betSide={'left'}
              gamePhase={phase}
              isActiveSeat={phase !== 'showdown' && activeSeat === 4}
              openCards={cardsToDisplay(4)}
              isDealer={dealerSeat === 4}
              user={seats[4]}
              gameMode={gameMode}
              sitIn={() => onTableSitClick(4)}
              timeout={timeout}
              timesUp={handleDefaultAction}
              whiteLabel={whiteLabel}
            />
        }
        { 
            (selectedSeat === null || seats[5])
              && <SeatComponent
                action={seatAction.seat === 5 ? seatAction.notification : ''}
                betSide={'left'}
                gamePhase={phase}
                isActiveSeat={phase !== 'showdown' && activeSeat === 5}
                openCards={cardsToDisplay(5)}
                isDealer={dealerSeat === 5}
                user={seats[5]}
                gameMode={gameMode}
                sitIn={() => onTableSitClick(5)}
                timeout={timeout}
                timesUp={handleDefaultAction}
                whiteLabel={whiteLabel}
              />
          }
      </div>
    </div>
  );
};

TableNineComponent.propTypes = {
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
    isActiveSeat: PropTypes.number,
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
  onTableSitClick: PropTypes.func.isRequired,
  whiteLabel: PropTypes.string,
};

export default TableNineComponent;
