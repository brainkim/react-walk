import Chess from 'chess.js';
import {
  graphql,
  GraphQLSchema,
  GraphQLString,
  GraphQLInt,
  GraphQLList,
  GraphQLEnumType,
  GraphQLObjectType,
} from 'graphql';

import { fromJS } from 'immutable'; 

import opera from './opera.pgn';
import fischerImmortal from './fischer-immortal.pgn';

const game = new Chess();
game.load_pgn(fischerImmortal);
const gameHistory = game.history({ verbose: true });

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
    for (var i = 0; i < rowStr.length; i++) {
      let piece = rowStr[i];
    }
  });
  return pieces;
};

const moveType = new GraphQLObjectType({
  name: 'move',
  fields: {
    from: { type: GraphQLString },
    to: { type: GraphQLString },
    color: { type: GraphQLString },
    san: { type: GraphQLString },
  },
});

const pieceType = new GraphQLObjectType({
  name: 'piece',
  fields: {
    name: { type: GraphQLString },
    color: { type: GraphQLString },
    square: { type: GraphQLString },
    originalSquare: { type: GraphQLString, },
  },
});

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

const positionType = new GraphQLObjectType({
  name: 'position',
  fields: {
    fen: { type: GraphQLString },

    pieces: {
      type: new GraphQLList(pieceType),
      resolve: (position) => {
        const pieces = fenToPieces(position.fen()).map((piece, i) => {
          piece.originalSquare = originalSquare(piece, position);
          return piece;
        });
        pieces.sort((oP, nP) => {
          if (oP.originalSquare < nP.originalSquare) {
            return -1;
          } else {
            return 1;
          }
        });
        return pieces;
      }
    },

    legalMoves: {
      type: new GraphQLList(moveType),
      resolve: (position) => position.moves({ verbose: true }),
    },

    moveIndex: {
      type: GraphQLInt,
      resolve: (position) => {
        return position.moveIndex != null
          ? position.moveIndex
          : position.history().length;
      },
    },
  },
});

const historyType = new GraphQLObjectType({
  name: 'history',
  fields: {
    length: {
      type: GraphQLInt,
    },
    moves: {
      type: new GraphQLList(moveType),
      resolve: (history) => {
        return history;
      },
    },
  }, 
});

const _positions = {};

const gameType = new GraphQLObjectType({
  name: 'game',
  fields: {
    position: {
      type: positionType,
      args: {
        moveIndex: { type: GraphQLInt },
        color: { type: GraphQLString },
      },
      resolve: (_, {moveIndex}) => {
        return _positions[moveIndex];
      },
    },

    history: {
      type: historyType,
      resolve: () => {
        return gameHistory;
      },
    },
  },
});


export default new GraphQLSchema({
  query: gameType,
});
