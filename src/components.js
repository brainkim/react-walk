import React, { Component, Children } from 'react';
import { Range } from 'immutable';

import { spring, TransitionMotion } from 'react-motion';

import Chess from 'chess.js';

import debounce from 'lodash.debounce';

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
  ).toJS()}</div>

const squareToCoords = (square, offset={x: 0, y: 0}) => {
  const rank = 7 - (parseInt(square[1]) - 1);
  const file = square.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
  return {
    x: file * SQUARE_SIZE + offset.x,
    y: rank * SQUARE_SIZE + offset.y,
  };
};

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

class PieceLayer extends Component {
  constructor(props) {
    super(props);

    this.pieceKeyCache = null;
  }

  render() {
    return (
      <TransitionMotion
        styles={this.getStyles()}
        willLeave={this.pieceWillLeave}>
        {(styles) =>
          <div
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
            }}
          >{styles.map(({key, style, data}) =>
            <div
              key={key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translate(${style.x}px,${style.y}px)`,
              }}
            >{data}</div>
          )}</div>
        }
      </TransitionMotion>
    );
  }

  getStyles() {
    const { children } = this.props;
    return Children.map(children, (c) => {
      const {square} = c.props;
      const {x, y} = squareToCoords(square);
      return {
        key: c.key,
        data: c,
        style: {
          x: spring(x),
          y: spring(y),
        },
      };
    });
  }
}


class Piece extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {name, color, square, index, originalSquare} = this.props;
    const {x, y} = squareToCoords(square);
    return (
      <div
        style={{
          width: SQUARE_SIZE,
          height: SQUARE_SIZE,
          cursor: 'pointer',
        }}
        >
        <img
          style={{
            width: SQUARE_SIZE,
            height: SQUARE_SIZE,
            position: 'absolute',
          }}
          src={pieceSrc(name, color)}
        />
        <div style={{position: 'absolute'}}>{originalSquare} - {index}</div>
      </div>
    );
  }
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
  if (fromSquare === toSquare) {
    return null;
  } else {
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
  }
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

const fenToPieces = (fen) => {
  const pieces = [];
  fen.split(/\s/)[0].split('/').forEach((rowStr, y) => {
    let rank = 7 - y;
    let file = 0;
    rowStr.split('').forEach((p) => {
      let p1 = parseInt(p);
      if (Number.isNaN(p1)) {
        pieces.push({
          name: p.toLowerCase(),
          color: p === p.toUpperCase() ? 'white' : 'black',
          square: String.fromCharCode(97 + file) + (rank + 1).toString(),
        });
        file += 1;
      } else {
        file += p1;
      }
    });
  });
  return pieces;
};

const originalSquare = (piece, position) => {
  return position.history({verbose: true}).reverse().reduce((square, move) => {
    if (move.san === 'O-O' && piece.name === 'r') {
      if (move.color === 'w' && square.toLowerCase() === 'f1') {
        return 'h1';
      } else if (move.color === 'b' && square.toLowerCase() === 'f8') {
        return 'h8';
      } else {
        return square;
      }
    } else if (move.san === 'O-O-O' && piece.name === 'r') { 
      if (move.color === 'w' && square.toLowerCase() === 'd1') {
        return 'a1';
      } else if (move.color === 'b' && square.toLowerCase() === 'd8') {
        return 'a8';
      } else {
        return square;
      }
    } else if (move.to.toLowerCase() === square.toLowerCase()) {
      return move.from;
    } else {
      return square;
    }
  }, piece.square);
};

const pgnToPositions = (pgn) => {
  const game = new Chess();
  game.load_pgn(pgn);
  const gameHistory = game.history({ verbose: true });
  const positions = [];
  gameHistory.forEach((move, i) => {
    const position = gameHistory
      .slice(0, i)
      .reduce((g, m) => {
        g.move(m);
        return g;
      }, new Chess());
    const pieces = fenToPieces(position.fen());
    pieces.forEach((piece) => {
      piece.originalSquare = originalSquare(piece, position);
    });

    positions.push(pieces);
  });
  return positions;
};

import fischerImmortal from './fischer-immortal.pgn';

const positions = pgnToPositions(fischerImmortal);

export class App extends Component {
  constructor(props) { 
    super(props);
    this.state = {
      moveIndex: 0,
      positions: positions,
    };
  }

  componentDidMount() {
    window.addEventListener('keydown', debounce((ev) => {
      if (ev.keyCode === 37) { //left
        this.goBack();
      } else if (ev.keyCode === 39) { //right
        this.goForward();
      }
    }), 26);
  }
  
  goBack() {
    const { positions, moveIndex } = this.state;
    const skip = Math.floor(Math.random() * 5);
    this.setState({ 
      moveIndex: Math.max(moveIndex - skip, 0),
    });
  }

  goForward() {
    const { positions, moveIndex } = this.state;
    const skip = Math.floor(Math.random() * 5);
    this.setState({ 
      moveIndex: Math.max(moveIndex + skip, 0),
    });
  }

  render() {
    const { positions, moveIndex } = this.state;
    const position = positions[moveIndex];

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
        <Board>
          {/*
          <SVGLayer>
            {position.map((p, i) => {
              if (p.square === p.originalSquare) {
                return (<Circle square={p.square} key={i} />);
              } else {
                return (<Arrow fromSquare={p.square} toSquare={p.originalSquare} key={i} />);
              }
            })}
          </SVGLayer>
          */}
          <PieceLayer>
            {position.map((p, i) =>
              <Piece
                key={p.originalSquare}
                name={p.name}
                color={p.color}
                square={p.square}
                index={i}
                originalSquare={p.originalSquare}
              />
            )}
          </PieceLayer>
        </Board>
        <div>
          <div>
            <button onClick={() => { this.setState({moveIndex: Math.max(this.state.moveIndex - 1, 0)}); }}>{'<'}</button>
            <button onClick={() => { this.setState({moveIndex: Math.min(this.state.moveIndex + 1, historyLength)}); }}>{'>'}</button>
          </div>
        </div>
      </div>
    );
  }
}
