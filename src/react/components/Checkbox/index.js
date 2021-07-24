import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

const CheckboxComponent = (props) => (
  <div className={classNames(
    'checkbox',
    {
      'checkbox--cpg-blue' : props.whiteLabel === 'cpg',
    }
    )} onClick={() => props.handleClick()}>
    {
      props.checked
        ? <span className={classNames(
          'checkbox--checked icon-cross',
          {
            'checkbox--checked--cpg-blue' : props.whiteLabel === 'cpg',
          }
          )}/>
        : ''
    }
  </div>
);

CheckboxComponent.propTypes = {
  checked: PropTypes.bool.isRequired,
  whiteLabel: PropTypes.string,
};

export default CheckboxComponent;
