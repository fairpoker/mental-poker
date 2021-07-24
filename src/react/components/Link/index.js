import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { Glitch } from '../Glitch';

const LinkComponent = (props) => (
  <div className={classNames(
    'link',
    {
      'link--cpg-blue' : props.whiteLabel === 'cpg',
    }
    )}>
    {
      props.changeRoot
        ? (
          <a
            className="link__anchor glitch"
            href={props.destination}
          >
            <Glitch className={classNames(
              'link__text',
              {
                'link__text--cpg-blue' : props.whiteLabel === 'cpg',
              }
              )}>
              {props.text}
            </Glitch>    
          </a>
        )
        : (
          <span className="link__anchor glitch">
            <Glitch className={classNames(
              'link__text',
              {
                'link__text--cpg-blue' : props.whiteLabel === 'cpg',
              }
              )}>
              {props.text}
            </Glitch>    
          </span>
        )
    }
  </div>
);

LinkComponent.propTypes = {
  text: PropTypes.string.isRequired,
  destination: PropTypes.string.isRequired,
  changeRoot: PropTypes.bool,
  whiteLabel: PropTypes.string,
};

LinkComponent.defaultProps = {
  changeRoot: false,
}

export default LinkComponent;
