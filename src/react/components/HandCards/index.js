import React from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

import CardComponent from '../Card';

const HandCardsComponent = (props) => (
  <div className={classNames(
    'hand-cards',
    { 
      'hand-cards__faded' : props.isFaded,
      'hand-cards__plo' : props.gameMode === 'PLO',
     },
  )}>
    <div
      className={classNames(
        'hand-cards__left',
        {
          'hand-cards__left--slanted': !props.openCards.length,
          'hand-cards__left--face-down': !props.openCards.length,
          'hand-cards__left--plo': props.gameMode === 'PLO',
          'hand-cards__plo': props.gameMode === 'PLO',
        }
      )}
    >
      {
        props.openCards[0] ? <CardComponent card={props.openCards[0]} /> : ''
      }
    </div>
    <div
      className={classNames(
        'hand-cards__right',
        {
          'hand-cards__left--face-down': !props.openCards.length,
          'hand-cards__plo': props.gameMode === 'PLO',
        }
      )}
    >
       {
        props.openCards[1] ? <CardComponent card={props.openCards[1]} /> : ''
      }
    </div>
    {
      props.gameMode === 'PLO' &&
      <div
      className={classNames(
        'hand-cards__right',
        'hand-cards__third',
        {
          'hand-cards__left--face-down': !props.openCards.length,
          'hand-cards__plo': props.gameMode === 'PLO',
        }
      )}
    >
       {
        props.openCards[2] ? <CardComponent card={props.openCards[2]} /> : ''
      }
    </div>
    }
    {
      props.gameMode === 'PLO' &&
      <div
      className={classNames(
        'hand-cards__right',
        'hand-cards__fourth',
        {
          'hand-cards__left--face-down': !props.openCards.length,
          'hand-cards__plo': props.gameMode === 'PLO',
        }
      )}
    >
       {
        props.openCards[3] ? <CardComponent card={props.openCards[3]} /> : ''
      }
    </div> 
    }
  </div>
);

HandCardsComponent.propTypes = {
  openCards: PropTypes.array.isRequired,
  isFaded: PropTypes.bool.isRequired,
  gameMode: PropTypes.string.isRequired,
};


export default HandCardsComponent;
