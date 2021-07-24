import React from 'react';
import { Provider } from 'react-redux';
import {
  BrowserRouter as Router,
} from 'react-router-dom';

import configureStore from './store/store'
import MainComponent from './containers/Main';

export default () => (
  <Provider store={configureStore({})}>
    <Router>
      <MainComponent />
    </Router>
  </Provider>
);
