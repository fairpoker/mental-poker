import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { Scrollbars } from 'react-custom-scrollbars';

export default class CustomScrollbarComponent extends Component {
  constructor(props) {
    super(props);

    this.renderView = this.renderView.bind(this);
    this.renderThumb = this.renderThumb.bind(this);
  }

  renderView({ style, withoutPadding, ...props }) {
    const viewStyle = {
      padding: 10,
      paddingTop: this.props.withoutPadding ? 0 : 10,
      overflow: 'hidden',
      overflowY: 'scroll',
    };
    return (
      <div
        style={{ ...style, ...viewStyle }}
        {...props}
      />
    );
  }

  renderThumb({ style, withoutPadding, ...props }) {
    const thumbStyle = {
      backgroundColor: '#D1FFFF',
    };
    return (
      <div
        style={{ ...style, ...thumbStyle }}
        {...props}
      />
    );
  }

  render() {
    const {
      withoutPadding,
      ...rest
    } = this.props
    return (
      <Scrollbars
        renderView={this.renderView}
        renderThumbVertical={this.renderThumb}
        thumbSize={30}
        {...rest}
      />
    );
  }
}

CustomScrollbarComponent.propTypes = {
  withoutPadding: PropTypes.bool,
}
