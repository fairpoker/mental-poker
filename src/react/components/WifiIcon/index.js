import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

const WifiIconComponent = (props) => {
  const { connectionLevel, whiteLabel } = props;
  return (
    <svg width="44px" height="45px" viewBox="0 0 44 45">
      <title>wifi icon</title>
      <desc>Created with sketchtool.</desc>
      <defs>
          <filter x="-95.8%" y="-109.5%" width="291.7%" height="323.8%" filterUnits="objectBoundingBox" id="filter-1">
              <feOffset dx="0" dy="0" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset>
              <feGaussianBlur stdDeviation="6" in="shadowOffsetOuter1" result="shadowBlurOuter1"></feGaussianBlur>
              <feColorMatrix values="0 0 0 0 0.819207317   0 0 0 0 0.999288218   0 0 0 0 1  0 0 0 0.5 0" type="matrix" in="shadowBlurOuter1" result="shadowMatrixOuter1"></feColorMatrix>
              <feMerge>
                  <feMergeNode in="shadowMatrixOuter1"></feMergeNode>
                  <feMergeNode in="SourceGraphic"></feMergeNode>
              </feMerge>
          </filter>
      </defs>
      <g id="Design" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd" strokeLinecap="square">
          <g id="Lobby" transform="translate(-1218.000000, -720.000000)">
              <g id="FOOTER" transform="translate(1228.000000, 732.000000)">
                  <g className="wifi-icon">
                      <g filter="url(#filter-1)" id="wifi">
                          <path
                            d="M10,16 L14,16 C14.5522847,16 15,16.4477153 15,17 L15,20 C15,20.5522847 14.5522847,21 14,21 L10,21 C9.44771525,21 9,20.5522847 9,20 L9,17 C9,16.4477153 9.44771525,16 10,16 Z"
                            className={classNames(connectionLevel > 0 ? 'wifi-icon--green' :  'wifi-icon--grey', { 'wifi-icon--cpg-blue' : whiteLabel === 'cpg' && connectionLevel > 0 })}>
                          </path>
                          <path
                            d="M8.66666667,12.5 L15.4745753,12.5 L8.66666667,12.5 Z"
                            className={classNames(connectionLevel > 1 ? 'wifi-icon--green' :  'wifi-icon--grey', { 'wifi-icon--cpg-blue' : whiteLabel === 'cpg' && connectionLevel > 1 })}>
                          ></path>
                          <path
                            d="M5.7,8.5 L18.3,8.5 L5.7,8.5 Z"
                            className={classNames(connectionLevel > 2 ? 'wifi-icon--green' :  'wifi-icon--grey', { 'wifi-icon--cpg-blue' : whiteLabel === 'cpg' && connectionLevel > 2 })}>
                          ></path>
                          <path
                            d="M2.71428571,4.5 L21.2857143,4.5 L2.71428571,4.5 Z"
                            className={classNames(connectionLevel > 3 ? 'wifi-icon--green' :  'wifi-icon--grey', { 'wifi-icon--cpg-blue' : whiteLabel === 'cpg' && connectionLevel > 3 })}>
                          ></path>
                          <path
                            d="M0.666666667,0.5 L23.3333333,0.5 L0.666666667,0.5 Z"
                            className={classNames(connectionLevel > 4 ? 'wifi-icon--green' :  'wifi-icon--grey', { 'wifi-icon--cpg-blue' : whiteLabel === 'cpg' && connectionLevel > 4 })}>
                          </path>
                      </g>
                  </g>
              </g>
          </g>
      </g>
    </svg>
  );
}

WifiIconComponent.propTypes = {
  connectionLevel: PropTypes.number.isRequired,
  whiteLabel: PropTypes.string.isRequired,
};

export default WifiIconComponent;
