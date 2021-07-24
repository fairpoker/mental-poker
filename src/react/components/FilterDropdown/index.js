import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

const FilterDropdownComponent = (props) => (
  <div className={classNames(
    'filter-dropdown',
    {
      'filter-dropdown--cpg-blue' : props.whiteLabel === 'cpg',
    }
    )}>
    {
      props.options.map(option => (
        <div
          className={classNames(
            'filter-dropdown__option',
            {
              'filter-dropdown__option-cpg-blue' : props.whiteLabel === 'cpg',
            }
            )}
          key={option.value}
          onClick={() => props.handleOptionClick(option.value)}
        >
          {option.title}
        </div>
      ))
    }
  </div>
);

FilterDropdownComponent.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      value: PropTypes.any.isRequired,
    })
  ).isRequired,
  handleOptionClick: PropTypes.func.isRequired,
  whiteLabel: PropTypes.string,
}

export default FilterDropdownComponent;
