import React from 'react';

export const CurrencyContext = React.createContext({});

export const withCurrency = ComponentToWrap => (props) => (
  <CurrencyContext.Consumer>
    {contextProps => <ComponentToWrap {...props} currency={contextProps} />}
  </CurrencyContext.Consumer>
)
