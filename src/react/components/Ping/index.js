import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import WifiIconComponent from '../WifiIcon';

const PingComponent = (props) => (
  <div className="ping">
      <WifiIconComponent  connectionLevel={props.wifiIconValue} whiteLabel={props.whiteLabel}/>
      <span className='ping__text'>connection level:</span>
      <span className={classNames('ping__value', { 'ping__value--cpg' : props.whiteLabel })}>{props.pingValue}</span>
  </div>
);

PingComponent.propTypes = {
  wifiIconValue: PropTypes.number.isRequired,
  pingValue: PropTypes.string.isRequired,
  whiteLabel: PropTypes.string.isRequired,
};

export default PingComponent;
