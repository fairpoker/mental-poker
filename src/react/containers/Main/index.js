import React, { Component } from 'react';
import {
  Redirect,
  Route,
  Switch,
} from 'react-router-dom';
import classNames from 'classnames';
import axios from 'axios';

import GameContainer from '../Game';
import LobbyContainer from '../Lobby';
import PingComponent from '../../components/Ping';
import SocketsContainer from '../Sockets';
import { socket } from '../Sockets';
import { mapPingTime } from '../../utils/helpers';

import { CurrencyContext } from '../../common/CurrencyContext';

import { getDenominationRate } from '../../utils/helpers';
import preloadImages from '../../utils/preload';

class MainComponent extends Component {
  constructor(props) {
    super(props);

    this.state = {
      denominationRate: 100,
      decimals: 0,
      currencyName: 'Bits',
      wifiIconValue: 0,
      pingValue: 'connecting',
      whiteLabel: '',
    }

    socket.on('connect', () => {
      this.setState({
        wifiIconValue: 4,
        pingValue: 'OK',
      });
    });

    socket.on('disconnect', () => {
      this.setState({
        wifiIconValue: 0,
        pingValue: 'disconnected',
      });
    });

    socket.on('reconnecting', () => {
      this.setState({
        wifiIconValue: 0,
        pingValue: 'reconnecting',
      })
    });

    socket.on('pong', (ms) => {
      const pingValue = mapPingTime(ms);
      this.setState({
        wifiIconValue: pingValue.wifiIconValue,
        pingValue: `${pingValue.range}`,
      });
    });
  }

  componentDidMount() {
    preloadImages();

    // Setting the state by doing a manual request to /lobby-data as I can't get the Redux state from here
    // The issue comes from using connect where the Privider component is - does not work
    axios
    .get('/lobby-data')
    .then(({ data }) => {
      const { whiteLabel } = data;
      this.setState({ whiteLabel });

      if (whiteLabel === 'cpg') {
        document.title = 'Moon Poker';
      }
    })
    .catch((err) => console.log(`could not fetch lobby data in main component ${err}`));
  }

  handleCurrencyChange(currency) {
    const { denominationRate, decimals, currencyName } = getDenominationRate(currency);
    this.setState({
      denominationRate,
      decimals,
      currencyName,
    });
  }

  render() {
    const { Provider } = CurrencyContext;

    return (
      <Provider
        value={{
          denominationRate: this.state.denominationRate,
          decimals: this.state.decimals,
          currencyName: this.state.currencyName,
          changeCurrency: (value) => this.handleCurrencyChange(value),
        }}
      >
        <div className={classNames('main', { 
          'main--cpg': this.state.whiteLabel === 'cpg' })}>
          <SocketsContainer />
            <Switch>
              <Route exact path='/' component={LobbyContainer} />
              <Route path='/table-:slots/:tableID' component={GameContainer} />
              <Redirect to='/' />
            </Switch>
          <div className="main__footer">
            <PingComponent 
              pingValue={this.state.pingValue} 
              wifiIconValue={this.state.wifiIconValue} 
              whiteLabel={this.state.whiteLabel} />
          </div>
        </div>
      </Provider>
    );
  }
}

export default MainComponent;
