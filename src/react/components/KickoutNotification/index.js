import React from 'react';
import PropTypes from 'prop-types';

import Button from '../Button';

const KickoutNotificationComponent = (props) => (
  <div className="modal">
    <div className="modal__content">
      <div className="modal__close-button"></div>
      <div className="modal__header">
        <div className="modal__header-title">
          {`${props.message.title}`}
        </div>
        <span 
          className="modal__close-icon icon-cross"
          onClick={() => props.closeNotificationModal()}
        />
      </div>
      <div className="modal__body">
        <span className="modal__notification">
          {props.message.body}
        </span>
        <Button
          className="modal__button"
          clickHandler={() => props.closeNotificationModal()}
        >
          ok
        </Button>
      </div>
    </div>
    <div className="modal__overlay"></div>
  </div>
);

KickoutNotificationComponent.propTypes = {
  message: PropTypes.shape({
    title: PropTypes.string.isRequired,
    body: PropTypes.string.isRequired,
  }).isRequired,
  closeNotificationModal: PropTypes.func.isRequired,
};

export default KickoutNotificationComponent;
