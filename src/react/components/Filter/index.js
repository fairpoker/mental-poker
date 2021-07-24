import React from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

import FilterDropdownComponent from '../FilterDropdown';

const FilterComponent = (props) => (
  <div
  className={classNames(
    'filter',
    {
      'filter--with-dropdown-open': props.isDropdownOpen,
    },
    {
      'filter--cpg-blue' : props.whiteLabel === 'cpg',
    }
    )}
    onClick={() => props.toogleDropdown()}
  >
    <span className={classNames(
      'filter__underscore',
      {
        'filter__underscore--cpg-blue' : props.whiteLabel === 'cpg',
      }
      )}>_</span>
    <div className={classNames(
      "filter__title",
      {
        'filter__title--cpg-blue' : props.whiteLabel === 'cpg',
      }
      )}>
      {props.title}
      {
        props.selectedValue
        ? (<span className={classNames(
          'filter__selected-value',
          {
            'filter__selected-value--cpg-blue' : props.whiteLabel === 'cpg',
          }
          )}>
            {`(${props.options.find(
              option => option.value === props.selectedValue
            ).title})`}
          </span>)
        : ''
      }
    </div>
    <span className={
      classNames(
        'filter__dropdown-icon',
        'icon-arrow-down',
        {
          'filter__dropdown-icon--upside-down': props.isDropdownOpen,
          'filter__dropdown-icon--cpg-blue' : props.whiteLabel === 'cpg',
        }
      )
    } />
    {
      props.isDropdownOpen
        ? (
          <div className="filter__dropdown">
            <FilterDropdownComponent
              options={props.options}
              handleOptionClick={(value) => props.optionClickHandler(value)}
              whiteLabel={props.whiteLabel}
            />
          </div>
        )
        : ''
    }
  </div>
);

FilterComponent.propTypes = {
  isDropdownOpen: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      value: PropTypes.any.isRequired,
    })
  ).isRequired,
  selectedValue: PropTypes.any,
  toogleDropdown: PropTypes.func.isRequired,
  optionClickHandler: PropTypes.func.isRequired,
  whiteLabel: PropTypes.string,
};

export default FilterComponent;
