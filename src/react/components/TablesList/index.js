import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';


import DenominationComponent from'../Denomination';
import CustomScrollbar from '../CustomScrollbar';

import { mapTimeout, compareTables } from '../../utils/helpers';

class TablesListComponent extends Component {
  constructor(props) {
    super(props);
  }

  handleSorting(property) {
    const sortBy = property;
    const sortOrder = this.props.sortBy !== property 
      ? 'ASC' 
      : (this.props.sortOrder === 'ASC' ? 'DESC' : 'ASC');
    this.props.sortTables({ sortBy, sortOrder });
  }

  goToGame(table) {
    this.props.enterTable(table);
    this.props.history.push(`table-${table.seatsCount}/${table.id}`);
  }

  render() {
    const {
      sortBy,
      sortOrder,
      tables,
      currencyRate,
      whiteLabel,
    } = this.props;

    return (
      <div className="tables-list">
        <div className="tables-list__table-wrapper tables-list__table-wrapper--upper">  
          <table className="tables-list__table">
            <thead>
              <tr className="tables-list__table-row">
                <th
                  className={classNames(
                    'tables-list__table-header',
                    {
                      'tables-list__table-header--cpg-blue' : whiteLabel === 'cpg',
                    }
                  )}
                  onClick={() => this.handleSorting('name')}
                >
                  <div className={classNames(
                    'tables-list__table-header-text',
                    {
                      'tables-list__table-header-text-white' : whiteLabel === 'cpg',
                    }
                    )}>Table</div>
                  {
                    sortBy !== 'name'
                      ? <span className="tables-list__sort-button icon-arrows" />
                      : (
                        sortOrder === 'ASC'
                          ? <span className="tables-list__sort-button tables-list__sort-button--upside-down icon-arrow-down" />
                          : <span className="tables-list__sort-button icon-arrow-down" />
                      )
                  }
                </th>
                <th
                  className={classNames(
                    'tables-list__table-header',
                    {
                      'tables-list__table-header--cpg-blue' : whiteLabel === 'cpg',
                    }
                  )}
                  onClick={() => this.handleSorting('gameMode')}
                >
                  <div className={classNames(
                    'tables-list__table-header-text',
                    {
                      'tables-list__table-header-text-white' : whiteLabel === 'cpg',
                    }
                    )}>Game Type</div>
                  {
                    sortBy !== 'gameMode'
                      ? <span className="tables-list__sort-button icon-arrows" />
                      : (
                        sortOrder === 'ASC'
                          ? <span className="tables-list__sort-button tables-list__sort-button--upside-down icon-arrow-down" />
                          : <span className="tables-list__sort-button icon-arrow-down" />
                      )
                  }
                </th>
                <th
                  className={classNames(
                    'tables-list__table-header',
                    {
                      'tables-list__table-header--cpg-blue' : whiteLabel === 'cpg',
                    }
                  )}
                  onClick={() => this.handleSorting('bb-sb')}
                >
                  <div className={classNames(
                    'tables-list__table-header-text',
                    {
                      'tables-list__table-header-text-white' : whiteLabel === 'cpg',
                    }
                    )}>SB/BB</div>
                  {
                    sortBy !== 'bb-sb'
                      ? <span className="tables-list__sort-button icon-arrows" />
                      : (
                        sortOrder === 'ASC'
                          ? <span className="tables-list__sort-button tables-list__sort-button--upside-down icon-arrow-down" />
                          : <span className="tables-list__sort-button icon-arrow-down" />
                      )
                  }
                </th>
                <th
                  className={classNames(
                    'tables-list__table-header',
                    {
                      'tables-list__table-header--cpg-blue' : whiteLabel === 'cpg',
                    }
                  )}
                  onClick={() => this.handleSorting('players')}
                >
                  <div className={classNames(
                    'tables-list__table-header-text',
                    {
                      'tables-list__table-header-text-white' : whiteLabel === 'cpg',
                    }
                    )}>Players</div>
                  {
                    sortBy !== 'players'
                      ? <span className="tables-list__sort-button icon-arrows" />
                      : (
                        sortOrder === 'ASC'
                          ? <span className="tables-list__sort-button tables-list__sort-button--upside-down icon-arrow-down" />
                          : <span className="tables-list__sort-button icon-arrow-down" />
                      )
                  }
                </th>
                <th
                  className={classNames(
                    'tables-list__table-header',
                    {
                      'tables-list__table-header--cpg-blue' : whiteLabel === 'cpg',
                    }
                  )}
                  onClick={() => this.handleSorting('minBuyIn')}
                >
                  <div className={classNames(
                    'tables-list__table-header-text',
                    {
                      'tables-list__table-header-text-white' : whiteLabel === 'cpg',
                    }
                    )}>Minimum Buy In</div>
                  {
                    sortBy !== 'minBuyIn'
                      ? <span className="tables-list__sort-button icon-arrows" />
                      : (
                        sortOrder === 'ASC'
                          ? <span className="tables-list__sort-button tables-list__sort-button--upside-down icon-arrow-down" />
                          : <span className="tables-list__sort-button icon-arrow-down" />
                      )
                  }
                </th>
                <th
                  className={classNames(
                    'tables-list__table-header',
                    {
                      'tables-list__table-header--cpg-blue' : whiteLabel === 'cpg',
                    }
                  )}
                  onClick={() => this.handleSorting('timeout')}
                >
                  <div className={classNames(
                    'tables-list__table-header-text',
                    {
                      'tables-list__table-header-text-white' : whiteLabel === 'cpg',
                    }
                    )}>Speed</div>
                  {
                    sortBy !== 'timeout'
                      ? <span className="tables-list__sort-button icon-arrows" />
                      : (
                        sortOrder === 'ASC'
                          ? <span className="tables-list__sort-button tables-list__sort-button--upside-down icon-arrow-down" />
                          : <span className="tables-list__sort-button icon-arrow-down" />
                      )
                  }
                </th>
              </tr>
            </thead>
          </table>
        </div>
        <CustomScrollbar
          className="tables-list__table-wrapper tables-list__table-wrapper--bottom"
          style={{ height: 120 }}
          withoutPadding={true}
        >    
          <table className="tables-list__table">
            <tbody>
              {
                tables.map((table, index) => {
                  const rowClasses = {
                    'tables-list__table-row--even': index % 2 === 0,
                    'tables-list__table-row--odd': index % 2 !== 0,
                  }
                  return (
                    <tr 
                      className={classNames(
                        'tables-list__table-row', 
                        rowClasses,
                        {
                          'tables-list__table-row--cpg-blue' : whiteLabel === 'cpg',
                        }
                        )}
                      key={table.id}
                      onClick={() => this.goToGame(table)}
                    >
                      <td className="tables-list__table-cell tables-list__table-cell-text tables-list__table-cell--bold">
                        {
                          table.isPasswordProtected ? (
                            <FontAwesomeIcon icon={faLock} className="icon-lock"/>
                          ) : ''
                        }
                        {table.name}
                      </td>
                      <td className="tables-list__table-cell tables-list__table-cell-text">
                        {table.gameMode}
                      </td>
                      <td className="tables-list__table-cell">
                        <DenominationComponent className="tables-list__table-cell-text">
                          {table.smallBlind}
                        </DenominationComponent>
                        <span className="tables-list__table-cell-text">/</span>
                        <DenominationComponent className="tables-list__table-cell-text">
                          {table.bigBlind}
                        </DenominationComponent>
                        <span className="tables-list__table-cell-text tables-list__table-cell-curr-rate">(${(table.smallBlind / 100000000 * currencyRate).toFixed(2)}/${(table.bigBlind / 100000000 * currencyRate).toFixed(2)})</span>
                      </td>
                      <td className="tables-list__table-cell tables-list__table-cell-text">{table.playersSeatedCount}/{table.seatsCount}</td> 
                      <td className="tables-list__table-cell">
                        <DenominationComponent  className="tables-list__table-cell-text">
                          {table.minBuyIn}
                        </DenominationComponent>
                      </td>
                      <td className="tables-list__table-cell">
                        <span className="tables-list__table-cell-text">
                          {mapTimeout(table.timeout)}
                        </span>
                      </td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </CustomScrollbar> 
      </div>
    );
  }
};

TablesListComponent.propTypes = {
  sortBy: PropTypes.string.isRequired,
  sortOrder: PropTypes.string.isRequired,
  tables: PropTypes
    .arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      gameMode: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      bigBlind: PropTypes.number.isRequired,
      maxBuyIn: PropTypes.number.isRequired,
      minBuyIn: PropTypes.number.isRequired,
      playersSeatedCount: PropTypes.number.isRequired,
      seatsCount: PropTypes.number.isRequired,
      smallBlind: PropTypes.number.isRequired,
      timeout: PropTypes.number.isRequired,
      isPasswordProtected: PropTypes.bool.isRequired,
    }))
    .isRequired,
  enterTable: PropTypes.func.isRequired,
  sortTables: PropTypes.func.isRequired,
  currencyRate: PropTypes.number.isRequired,
  whiteLabel: PropTypes.string,
}

export default withRouter(TablesListComponent);
