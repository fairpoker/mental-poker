import React, { Component } from 'react';
import PropTypes from 'prop-types';

const MadeHandComponent = (props) => (
    <span className="made-hand__text">{props.madeHand}</span>
);

MadeHandComponent.propTypes = {
    madeHand: PropTypes.string.isRequired,
}

export default MadeHandComponent;