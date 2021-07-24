import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import FiltersComponent from '../../components/Filters';
import HeaderComponent from '../../components/Header';
import TablesListComponent from '../../components/TablesList';

import lobbyActions from '../../store/actions/lobby'
import gameActions from '../../store/actions/game'

import authSelectors from '../../store/selectors/auth';
import lobbySelectors from '../../store/selectors/lobby';

class LobbyComponent extends Component {
  constructor(props) {
    super(props);
    
    this.FETCH_TIMEOUT = 5000;
    this.fetchInterval;
  }


  componentDidMount() {
    this.props.fetchTablesAction();
    this.fetchInterval = setInterval(
      () => this.props.fetchTablesAction(),
      this.FETCH_TIMEOUT,
    );
    this.props.fetchCurrencyRateAction();
  }

  componentWillUnmount() {
    clearInterval(this.fetchInterval);
  }

  getTablesTypeOptions() {
    return [
      {
        title: 'All tables',
        value: 0,
      },
      {
        title: '2-handed',
        value: 2,
      },
      {
        title: '6-handed',
        value: 6,
      },
      {
        title: '9-handed',
        value: 9,
      },
    ];
  }

  getStakesOptions() {
    return [
      {
        title: 'All',
        value: '',
      },
      {
        title: 'Micro',
        value: 'micro',
      },
      {
        title: 'Small',
        value: 'small'
      },
      {
        title: 'Medium',
        value: 'medium'
      },
      {
        title: 'High',
        value: 'high',
      }
    ]
  }

  getGameTypeOptions() {
    return [
      {
        title: 'All',
        value: '',
      },
      {
        title: "Hold'em",
        value: 'NLHE'
      },
      {
        title: 'Omaha',
        value: 'PLO',
      }
    ]
  }

  handleFiltersChange(property) {
    this.props.filterTablesAction(property);
  }

  render() {
    const {
      accUrl,
      blindFilterOptions,
      currencyRate,
      filterProperties,
      sortProperties,
      tables,
      totalChips,
      userName,
      sortTablesAction,
      enterTableAction,
      whiteLabel,
    } = this.props;
  
    return (
      <div className={classNames('lobby', {
        'lobby--cpg' : whiteLabel === 'cpg',
      })}>
        <div className={classNames('lobby__header', {'lobby__header--cpg' : whiteLabel === 'cpg'})}>
          <HeaderComponent
            accUrl={accUrl}
            balance={totalChips}
            user={userName}
            currencyRate={currencyRate}
            whiteLabel={whiteLabel}
          />
        </div>
        <div className="lobby__content">
          <div className="lobby__filters">
            <FiltersComponent
              filterProperties={filterProperties}
              allTablesFilterOptions={this.getTablesTypeOptions()}
              stakesFilterOptions={this.getStakesOptions()}
              gameTypeFilterOptions={this.getGameTypeOptions()}
              onFiltersChange={(property) => this.handleFiltersChange(property)}
              whiteLabel={whiteLabel}
            />
          </div>
          <TablesListComponent
            sortBy={sortProperties.sortBy}
            sortOrder={sortProperties.sortOrder}
            tables={tables}
            sortTables={sortTablesAction}
            enterTable={enterTableAction}
            currencyRate={currencyRate}
            whiteLabel={whiteLabel}
          />
        </div>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  accUrl: lobbySelectors.selectAccountUrl(state),
  currencyRate: lobbySelectors.selectCurrencyRateUSD(state),
  isFetching: lobbySelectors.selectIsFetching(state),
  isError: lobbySelectors.selectIsError(state),
  userName: authSelectors.selectUserName(state),
  filterProperties: lobbySelectors.selectFilterProperties(state),
  sortProperties: lobbySelectors.selectSortProperties(state),
  tables: lobbySelectors.selectTables(state),
  totalChips: authSelectors.selectUserBalance(state),
  whiteLabel: lobbySelectors.selectWhiteLabel(state),
});

const mapDispatchToProps = dispatch => ({
  enterTableAction: bindActionCreators(gameActions.enterTable, dispatch),
  fetchTablesAction: bindActionCreators(lobbyActions.fetchTables, dispatch),
  fetchCurrencyRateAction: bindActionCreators(lobbyActions.fetchCurrencyRate, dispatch),
  filterTablesAction: bindActionCreators(lobbyActions.filterTables, dispatch),
  sortTablesAction: bindActionCreators(lobbyActions.sortTables, dispatch),
});

LobbyComponent.propTypes = {
  currencyRate: PropTypes.number.isRequired,
  isFetching: PropTypes.bool.isRequired,
  isError: PropTypes.bool.isRequired,
  filterProperties: PropTypes.shape({
    hideEmptyTables: PropTypes.bool.isRequired,
    hideFullTables: PropTypes.bool.isRequired,
    filterTableType: PropTypes.number.isRequired,
    filterStakes: PropTypes.string.isRequired,
    filterGameType: PropTypes.string.isRequired,
  }),
  userName: PropTypes.string.isRequired,
  sortProperties: PropTypes.shape({
    sortBy: PropTypes.string.isRequired,
    sortOrder: PropTypes.string.isRequired,
  }),
  tables: PropTypes.arrayOf(PropTypes.shape(
    {
      id: PropTypes.string,
      name: PropTypes.string,
      bigBlind: PropTypes.number,
      maxBuyIn: PropTypes.number,
      minBuyIn: PropTypes.number,
      playersSeatedCount: PropTypes.number,
      seatsCount: PropTypes.number,
      smallBlind: PropTypes.number,
      timeout: PropTypes.number,
    }
  )).isRequired,
  totalChips: PropTypes.number.isRequired,
  enterTableAction: PropTypes.func.isRequired,
  fetchCurrencyRateAction: PropTypes.func.isRequired,
  fetchTablesAction: PropTypes.func.isRequired,
  filterTablesAction: PropTypes.func.isRequired,
  sortTablesAction: PropTypes.func.isRequired,
}

export default connect(
    mapStateToProps,
    mapDispatchToProps,
  )(LobbyComponent);
