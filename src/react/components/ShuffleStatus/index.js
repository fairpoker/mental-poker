import React, { Component } from 'react';
import PropTypes from 'prop-types';

const ShuffleStatusComponent = (props) => (
    <div className="shuffle-status">
        <span className="shuffle-status__text">{props.nextShuffleStatus}</span>
    </div>
);

ShuffleStatusComponent.propTypes = {
    nextShuffleStatus: PropTypes.string.isRequired,
}

export default ShuffleStatusComponent;