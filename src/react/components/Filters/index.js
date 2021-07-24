import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import CheckboxComponent from '../Checkbox';
import FilterComponent from '../Filter';

import { CurrencyContext } from '../../common/CurrencyContext';

const { Consumer } = CurrencyContext;

class FiltersComponent extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isTypeFilterDropdownOpen: false,
      isGameTypeFilterDropdownOpen: false,
      isBuyInFilterDropdownOpen: false,
    };
  }

  toggleTypeDropdown() {
    this.setState((prevState) => ({
      isTypeFilterDropdownOpen: !prevState.isTypeFilterDropdownOpen,
      isGameTypeFilterDropdownOpen: false,
      isBuyInFilterDropdownOpen: false,
    }));
  }

  toggleGameTypeDropdown() {
    this.setState((prevState) => ({
      isGameTypeFilterDropdownOpen: !prevState.isGameTypeFilterDropdownOpen,
      isTypeFilterDropdownOpen: false,
      isBuyInFilterDropdownOpen: false,
    }));
  }

  toggleBuyInDropdown() {
    this.setState((prevState) => ({
      isBuyInFilterDropdownOpen: !prevState.isBuyInFilterDropdownOpen,
      isTypeFilterDropdownOpen: false,
      isGameTypeFilterDropdownOpen: false,
    }));
  }

  toggleCheckbox(filterProperty) {
    this.setState({
      isTypeFilterDropdownOpen: false,
      isGameTypeFilterDropdownOpen: false,
      isBuyInFilterDropdownOpen: false,
    });
    this.props.onFiltersChange(filterProperty)
  }

  render() {
    const {
      filterProperties: {
        hideEmptyTables,
        hideFullTables,
        filterTableType,
        filterGameType,
        filterStakes,
      },
      allTablesFilterOptions,
      stakesFilterOptions,
      gameTypeFilterOptions,
      whiteLabel,
    } = this.props;

    return (
      <Consumer>
        {({denominationRate, decimals}) => {
          return (
            <div className="filters">
              <div className={classNames(
                'filters__select',
                {
                  'filters__select--cpg-blue' : whiteLabel === 'cpg',
                }
                )}>
                <FilterComponent 
                  title="Table type"
                  options={allTablesFilterOptions}
                  selectedValue={filterTableType}
                  isDropdownOpen={this.state.isTypeFilterDropdownOpen}
                  toogleDropdown={() => this.toggleTypeDropdown()}
                  optionClickHandler={(value) => this.props.onFiltersChange({ filterTableType: value })}
                  whiteLabel={whiteLabel}
                />
              </div>
              <div className={classNames(
                'filters__select',
                {
                  'filters__select--cpg-blue' : whiteLabel === 'cpg',
                }
                )}>
                <FilterComponent 
                  title="Game type"
                  options={gameTypeFilterOptions}
                  selectedValue={filterGameType}
                  isDropdownOpen={this.state.isGameTypeFilterDropdownOpen}
                  toogleDropdown={() => this.toggleGameTypeDropdown()}
                  optionClickHandler={(value) => this.props.onFiltersChange({ filterGameType: value })}
                  whiteLabel={whiteLabel}
                />
              </div>
              <div className={classNames(
                'filters__select',
                {
                  'filters__select--cpg-blue' : whiteLabel === 'cpg',
                }
                )}>
                <FilterComponent 
                  title="Stakes"
                  options={stakesFilterOptions}
                  selectedValue={filterStakes}
                  isDropdownOpen={this.state.isBuyInFilterDropdownOpen}
                  toogleDropdown={() => this.toggleBuyInDropdown()}
                  optionClickHandler={(value) => this.props.onFiltersChange({ filterStakes: value })}
                  whiteLabel={whiteLabel}
                />
              </div>
              <CheckboxComponent
                checked={hideFullTables}
                handleClick={() => this.toggleCheckbox({ hideFullTables: !hideFullTables })}
                whiteLabel={whiteLabel}
              />
              <div className={classNames(
                'filters__text',
                {
                  'filters__text--cpg-blue' : whiteLabel === 'cpg',
                }
                )}>Hide full tables</div>
              <CheckboxComponent
                checked={hideEmptyTables}
                handleClick={() => this.toggleCheckbox({ hideEmptyTables: !hideEmptyTables })}
                whiteLabel={whiteLabel}
              />
              <div className={classNames(
                'filters__text',
                {
                  'filters__text--cpg-blue' : whiteLabel === 'cpg',
                }
                )}>Hide empty tables</div>
            </div>
          );
        }}
      </Consumer>
    );
  }
} 

FiltersComponent.propTypes = {
  filterProperties: PropTypes.shape({
    hideEmptyTables: PropTypes.bool.isRequired,
    hideFullTables: PropTypes.bool.isRequired,
    filterTableType: PropTypes.number.isRequired,
    filterStakes: PropTypes.string.isRequired,
    filterGameType: PropTypes.string.isRequired,
  }),
  onFiltersChange: PropTypes.func.isRequired,
  allTablesFilterOptions: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      value: PropTypes.any.isRequired,
    })
  ).isRequired,
  stakesFilterOptions: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    })
  ).isRequired,
  gameTypeFilterOptions: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    })
  ).isRequired,
  whiteLabel: PropTypes.string,
}

export default FiltersComponent;
