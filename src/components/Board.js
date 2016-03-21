import React, { Component } from 'react';
import { Range } from 'immutable'; 
import Chess from 'chess.js';

function isLight(i) {
  const rank = Math.floor(i / 8);
  if (rank % 2 === 0) {
    return i % 2 === 0;
  } else {
    return i % 2 === 1;
  }
}

const Square = ({color, width, height, coords}) =>
  <div
    style={{
      position: 'absolute',
      left: coords.x,
      top: coords.y,
      width,
      height,
      backgroundColor: color,
    }}
  />

const SquareLayer = ({lightColor, darkColor, width, height}) =>
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: 400,
      height: 400,
    }}
  >{Range(0, 64).map((i) => 
    <Square
      key={i}
      color={isLight(i) ? lightColor : darkColor}
      width={width / 8}
      height={height / 8}
      coords={{
        x: (i % 8) * (width / 8),
        y: Math.floor(i / 8) * (height / 8),
      }}
    />
  )}</div>


const pieceSrc = (name, color) => {
  color = color.slice(0,1).toLowerCase();
  if (/knight/i.test(name)) { 
    name = 'N';
  }
  name = name.slice(0,1).toUpperCase();
  try {
    return require(`../images/cburnett/${color}${name}.svg`);
  } catch (er) {
    return require('../images/cburnett/wK.svg');
  }
};

const squareToCoordinates = (square) => {
  const rank = 7 - (parseInt(square[1]) - 1);
  const file = square.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
  return {
    x: file * 50,
    y: rank * 50
  };
};

const Piece = ({name, color, square}) => {
  const {x, y} = squareToCoordinates(square);
  return (
    <img
      style={{
        width: 50,
        height: 50,
        position: 'absolute',
        top: 0,
        left: 0,
        transform: `translate(${x}px,${y}px)`,
        transition: 'transform 0.2s ease-in',
        cursor: 'pointer',
      }}
      src={pieceSrc(name, color)}
    />
  );
};

const fenToPieces = (fen) => {
  const pieces = [];
  fen.split(/\s/)[0].split('/').forEach((rowStr, y) => {
    let rank = 7 - y;
    let file = 0;
    rowStr.split('').forEach((p) => {
      let p1 = parseInt(p);
      if (Number.isNaN(p1)) {
        pieces.push({
          name: p.toUpperCase(),
          color: p === p.toUpperCase() ? 'white' : 'black',
          square: String.fromCharCode(65 + file) + (rank + 1).toString(),
        });
        file += 1;
      } else {
        file += p1;
      }
    });
    for (var i = 0; i < rowStr.length; i++) {
      let piece = rowStr[i];
    }
  });
  return pieces;
};

const game = new Chess(
  'r1k4r/p2nb1p1/2b4p/1p1n1p2/2PP4/3Q1NB1/1P3PPP/R5K1 b - c3 0 19'
);

export default class Board extends Component {
  constructor(props) { 
    super(props);
    this.state = {
      game: game
    };
  }
  render() {
    const {game} = this.state;
    const pieces = fenToPieces(game.fen());
    return (
      <div
        style={{
          position: 'relative',
          width: 400,
          height: 400,
        }}
      >
        <SquareLayer
          lightColor="#fff"
          darkColor="#aaa"
          width={400}
          height={400}
        />
        {pieces.map((p) =>
          <Piece
            name={p.name}
            color={p.color}
            square={p.square}
            key={p.square}
          />
        )}
      </div>
    );
  }
}
