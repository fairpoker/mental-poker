import React from 'react';
import PropTypes from 'prop-types';
import CardComponent from '../Card';

const BoardCardsComponent = (props) => (
  <div className="board-cards">
    {
      props.boardCards.map(
        card => (
          card
            ? (
            <div 
              className="board-cards__card"
              key={card}
            >
              <CardComponent card={card} />
            </div>
            )
            : ''
        )
      )
    }
  </div>
);

BoardCardsComponent.propTypes = {
  boardCards: PropTypes.array.isRequired,
};


export default BoardCardsComponent;
