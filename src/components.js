import React, { Component } from 'react';
import { Range } from 'immutable'; 

import Chess from 'chess.js';
import { graphql } from 'graphql';

import schema from './schema';
import opera from './opera.pgn';

const BOARD_SIZE = 600;
const SQUARE_SIZE = BOARD_SIZE / 8;
const CENTER_OFFSET = { x: SQUARE_SIZE/2, y: SQUARE_SIZE/2 };

const Square = ({color, coords}) =>
  <div
    style={{
      position: 'absolute',
      left: coords.x,
      top: coords.y,
      width: SQUARE_SIZE,
      height: SQUARE_SIZE,
      backgroundColor: color,
    }}
  />

const isLight = (i) => {
  const rank = Math.floor(i / 8);
  if (rank % 2 === 0) {
    return i % 2 === 0;
  } else {
    return i % 2 === 1;
  }
};

const SquareLayer = ({lightColor, darkColor}) =>
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: BOARD_SIZE,
      height: BOARD_SIZE,
    }}
  >{Range(0, 64).map((i) => 
    <Square
      key={i}
      color={isLight(i) ? lightColor : darkColor}
      coords={{
        x: (i % 8) * SQUARE_SIZE,
        y: Math.floor(i / 8) * SQUARE_SIZE,
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
    return require(`./images/cburnett/${color}${name}.svg`);
  } catch (er) {
    return require('./images/cburnett/wK.svg');
  }
};

const squareToCoords = (square, offset={x: 0, y: 0}) => {
  const rank = 7 - (parseInt(square[1]) - 1);
  const file = square.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
  return {
    x: file * SQUARE_SIZE + offset.x,
    y: rank * SQUARE_SIZE + offset.y,
  };
};

const Piece = ({name, color, square}) => {
  const {x, y} = squareToCoords(square);
  return (
    <img
      style={{
        width: SQUARE_SIZE,
        height: SQUARE_SIZE,
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

const SVGLayer = ({children}) =>
  <svg
    width={BOARD_SIZE}
    height={BOARD_SIZE}
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
    }}
  >
    <defs>
      <marker
        id="arrowhead"
        viewBox="0 0 10 10" 
        orient="auto"
        refX="0"
        refY="5"
        markerUnits="strokeWidth"
        fill="#15781B"
      >
        <g>
          <path d="M 0,0 L 0,10 L 8.5,5 z" />
        </g>
      </marker>
    </defs>
    {children}
  </svg>

const Circle = ({square}) => {
  const coords = squareToCoords(square, CENTER_OFFSET);
  return (
    <circle
      cx={coords.x}
      cy={coords.y}
      r={SQUARE_SIZE*0.5 - 5}
      stroke="#15781B"
      strokeWidth="6"
      fill="none"
    />
  );
};

const Arrow = ({fromSquare, toSquare}) => {
  const from = squareToCoords(fromSquare, CENTER_OFFSET);
  const to = squareToCoords(toSquare, CENTER_OFFSET);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x - (Math.cos(angle)*(SQUARE_SIZE*0.34))}
      y2={to.y - (Math.sin(angle)*(SQUARE_SIZE*0.34))}
      stroke="#15781B"
      strokeWidth="10"
      strokeLinecap="round"
      markerEnd="url(#arrowhead)"
      opacity="0.6"
    />
  );
};

export const Board = ({ children }) =>
  <div
    style={{
      position: 'relative',
      width: BOARD_SIZE,
      height: BOARD_SIZE,
    }}>
    <SquareLayer
      lightColor="#eee"
      darkColor="#999"
    />
    { children }
  </div>

const game = new Chess();
game.load_pgn(opera);

export class App extends Component {
  constructor(props) { 
    super(props);
    this.state = {
      moveIndex: 0,
      data: null,
    };
  }

  componentDidMount() {
    this.updateData(this.state.moveIndex);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.moveIndex !== this.state.moveIndex) {
      this.updateData(this.state.moveIndex);
    }
  }

  updateData(moveIndex) {
    const query = `{
      position(moveIndex: ${moveIndex}) { 
        fen,
        pieces {
          name,
          square,
          color,
        },
      },
      history {
        length,
      }
    }`;

    graphql(schema, query, game).then((result) => {
      console.log(result);

      if (result.data != null) {
        this.setState({
          data: result.data,
        });
      }
    });
  }

  render() {
    const { data } = this.state;
    const pieces = data != null ? data.position.pieces : [];
    const legalMoves = data != null ? data.position.legalMoves : [];
    const historyLength = data != null ? data.history.length : 0;

    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'top',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <div>
        <Board>
          {pieces.map((p) =>
            <Piece
              name={p.name}
              color={p.color}
              square={p.square}
              key={p.square}
            />
          )}
        </Board>
          <div>
            <button
              onClick={() => { this.setState({moveIndex: Math.max(this.state.moveIndex - 1, 0)}); }}>{'<'}</button>
            <button
              onClick={() => { this.setState({moveIndex: Math.min(this.state.moveIndex + 1, historyLength)}); }}>{'>'}</button>
          </div>
        </div>
      </div>
    );
  }
}
