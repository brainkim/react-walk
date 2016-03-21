import React, { Component } from 'react';
import { Range } from 'immutable'; 

function isLight(i) {
  const rank = Math.floor(i / 8);
  if (rank % 2 === 0) {
    return i % 2 === 1;
  } else {
    return i % 2 === 0;
  }
}

const Square = ({color, width, height, coords, index}) =>
  <div
    style={{
      position: 'absolute',
      left: coords.x,
      top: coords.y,
      width,
      height,
      backgroundColor: color,
    }}
  >{index}</div>

const SquareLayer = ({lightColor, darkColor, width, height}) =>
  <div style={{
    transform: 'translateY(40px)',
    ...styles.squareLayer
  }}>
    {Range(0, 64).map((i) => 
      <Square
        key={i}
        color={isLight(i) ? lightColor : darkColor}
        width={width / 8}
        height={width / 8}
        coords={{
          x: (i % 8) * (width / 8),
          y: Math.floor(i / 8) * (height / 8),
        }}
        index={i}
      />
    )}
  </div>

export default class Board extends Component {
  render() {
    return (
      <div style={styles.board}>
        <SquareLayer
          lightColor="#fff"
          darkColor="#aaa"
          width={400}
          height={400}
        />
      </div>
    );
  }
}

const styles = {
  board: {
    position: 'relative',
    width: 400,
    height: 400,
    backgroundColor: 'red',
  },
  squareLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 400,
    height: 400,
    backgroundColor: 'green'
  }
};
