import React from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

import { Glitch } from '../Glitch';

const ButtonComponent = (props) => (
  <span className="button__wrapper">
    <span
      className={classNames(
        'button',
        props.className,
        {
          'button--cpg-blue' : props.whiteLabel === 'cpg',
          'button--reversed' : props.reversed,
          'button--reversed--cpg-blue' : props.reversed && props.whiteLabel === 'cpg',
        },
      )}
      onClick={() => props.clickHandler()}
    >
      {
        props.withGlitch
          ? (
            <span className="button__text glitch">
              <Glitch className={classNames(
                'button__text',
                {
                  'button__text--white' : props.whiteLabel === 'cpg' && !props.reversed,
                }
                )}>
                {props.children}
              </Glitch>    
            </span>
          )
          : (
              <span className={classNames(
                'button__text',
                {
                  'button__text--white' : props.whiteLabel === 'cpg' && !props.reversed,
                }
                )}>
                {props.children}
              </span>
            )
      }
    </span>

  </span>
);

ButtonComponent.propTypes = {
  withGlitch: PropTypes.bool,
  clickHandler: PropTypes.func.isRequired,
  whiteLabel: PropTypes.string,
  reversed: PropTypes.bool,
};

ButtonComponent.defaultProps = {
  withGlitch: true,
  reversed: false,
}

export default ButtonComponent;
