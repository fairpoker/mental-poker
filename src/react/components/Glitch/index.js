import React from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

export const Glitch = ({
  className,
  children,
}) => (
  <div className={className}>
    <div className={classNames(className, 'glitch__label')}>{children}</div>
    <div className="glitch__mask"><span className={className}>{children}</span></div>
    <div className="glitch__mask"><span className={className}>{children}</span></div>
    <div className="glitch__mask"><span className={className}>{children}</span></div>
    <div className="glitch__mask"><span className={className}>{children}</span></div>
    <div className="glitch__mask"><span className={className}>{children}</span></div>
  </div>
);

Glitch.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
};

Glitch.defaultProps = {
  className: '',
};
