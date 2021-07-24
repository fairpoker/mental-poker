import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';
import CustomScrollbar from '../CustomScrollbar';

import ButtonComponent from '../Button';

class ChatComponent extends Component {
  constructor(props) {
    super(props);

    this.state = {
      value: '',
    }

    this.messagesEnd = React.createRef();
  }


  componentDidMount () {
    this.scrollToBottom()
  }

  componentDidUpdate () {
    this.scrollToBottom()
  }

  scrollToBottom () {
    this.messagesEnd.current.scrollIntoView({ behavior: 'smooth' })
  }

  handleChange(event) {
    this.setState({
      value: event.target.value,
    })
  }

  submitForm() {
    if (this.state.value.trim()) {
      this.props.sendMessage(this.state.value.trim());
        this.setState({
          value: '',
        })
      }
  }

  handleEnter(event) {
    if (event.key === 'Enter') {
      this.submitForm();
    };
  }

  formatNotification(notification) {
    return notification.replace(/&quot;/g, '\'').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  render() {
    return (
      <div className={classNames(
        'chat',
        { 'chat--transparent': this.props.isModalOpen }
      )}>
        <CustomScrollbar
          className={classNames(
            'chat__messages',
            {
              'chat__messages--cpg-blue': this.props.whiteLabel === 'cpg',
            }
            )}
          style={{ height: 120 }}
        >
          { 
            this.props.notifications.map(
              (notification, index) => (
                <div key={`${index}${notification.sender}`} className="chat__notification">
                  {
                    notification.sender !== ''
                      ? (
                        <Fragment>
                          <span className="chat__sender">{notification.sender}</span>
                          <span className="chat__message">{this.formatNotification(notification.message)}</span>
                        </Fragment>
                      )
                      : <span className="chat__message" dangerouslySetInnerHTML={{ __html: notification.message }}/>
                  }
                </div>
              )
            )
          }
          <div ref={this.messagesEnd}></div>
        </CustomScrollbar>
        <div className="chat__enter-message">
          <input
            className={classNames(
              'chat__input',
              {
                'chat__input--cpg-blue' : this.props.whiteLabel === 'cpg',
              }
              )}
            placeholder={'_'}
            value={this.state.value}
            onChange={($event) => this.handleChange($event)}
            onKeyDown={($event) => this.handleEnter($event)}
          />
          <ButtonComponent
            className="modal__button button--narrow"
            clickHandler={() => this.submitForm()}
            whiteLabel={this.props.whiteLabel}
          >
            <span className="chat__icon icon-enter-arrow" />
          </ButtonComponent>
        </div>
      </div>
    );
  };
}

ChatComponent.propTypes = {
  notifications: PropTypes.array.isRequired,
  sendMessage: PropTypes.func.isRequired,
  whiteLabel: PropTypes.string,
};

export default ChatComponent;
