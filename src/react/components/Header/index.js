import React, { Component } from 'react';
import PropTypes from 'prop-types';

import LinkComponent from '../Link';
import UserMenuComponent from '../UserMenu';

class HeaderComponent extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    let logo = "/../static/images/Logo.png";
    if (this.props.whiteLabel === "cpg") {
      logo = "/../static/images/LogoCPG.png"
    } 
    // Add more ifs for other white labels

    return (
      <div className="header">
        <div className="header__top-row">
          <div className="header__back-button">
            <LinkComponent
              text="account"
              destination={this.props.accUrl}
              changeRoot={true}
              whiteLabel={this.props.whiteLabel}
            />
          </div>
          <UserMenuComponent
            user={this.props.user}
            balance={this.props.balance}
            currencyRate={this.props.currencyRate}
            whiteLabel={this.props.whiteLabel}
          />
        </div>
        <div className="header__bottom-row">
          <img
            className="header__logo"
            src={logo}
          >
          </img>
        </div>
    </div>
    );
  }
};

HeaderComponent.propTypes = {
  accUrl: PropTypes.string.isRequired,
  user: PropTypes.string.isRequired,
  balance: PropTypes.number.isRequired,
  currencyRate: PropTypes.number.isRequired,
  whiteLabel: PropTypes.string.isRequired,
};

export default HeaderComponent;
