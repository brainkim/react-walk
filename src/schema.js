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
  },
});

const positionType = new GraphQLObjectType({
  name: 'position',
  fields: {
    fen: { type: GraphQLString },

    pieces: {
      type: new GraphQLList(pieceType),
      resolve: (position) => {
        return fenToPieces(position.fen());
      }
    },

    legalMoves: {
      type: new GraphQLList(moveType),
      resolve: (position) => position.moves({ verbose: true }),
    },

    moveIndex: {
      type: GraphQLInt,
      resolve: (position) => position.history().length,
    },
  },
});

const gameType = new GraphQLObjectType({
  name: 'game',
  fields: {
    position: {
      type: positionType,
      args: {
        moveIndex: { type: GraphQLInt },
        color: { type: GraphQLString },
      },
      resolve: (game, {moveIndex}) => {
        const history = game.history().slice(0, moveIndex);
        return history.reduce((g, m) => {
          g.move(m);
          return g;
        }, new Chess());
      },
    },

    history: {
      type: new GraphQLList(moveType),
      resolve: (game) => {
        return game.history({ verbose: true });
      },
    },
  },
});


export default new GraphQLSchema({
  query: gameType,
});
