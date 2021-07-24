import React from 'react';

import { CurrencyContext } from '../../common/CurrencyContext';

const DenominationComponent = ({ className, children }) => {
  const { Consumer } = CurrencyContext;

  return (
    <Consumer>
      {
        ({ 
          denominationRate,
          decimals,
        }) => (
          <span className={className}>
            {(children / denominationRate).toLocaleString(undefined, {
              maximumFractionDigits: decimals,
            })}
          </span>
        )
      }
    </Consumer>
  );
}

export default DenominationComponent;
