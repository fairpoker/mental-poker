import React from 'react';
import PropTypes from 'prop-types';

const CardComponent = (props) => (
  <img className="card" src={`/static/images/cards/${props.card}.png`} />
);

CardComponent.propTypes = {
  card: PropTypes.string.isRequired,
};

export default CardComponent;
