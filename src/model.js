import im, {Record, Map, List, Set, Range, Repeat} from 'immutable';
import ohm from 'ohm-js';
import fen from './fen.ohm';

const RANK_LABELS = List(['1','2','3','4','5','6','7','8']);
const FILE_LABELS = List(['a','b','c','d','e','f','g','h']);
const SQUARES = Set(RANK_LABELS.flatMap((r) => FILE_LABELS.map(f => `${f}${r}`)));

const PLAYERS = {
  WHITE: 'WHITE',
  BLACK: 'BLACK',
};

const KINGSIDE = 'O-O';
const QUEENSIDE = 'O-O-O';

const fenGrammar = ohm.grammar(fen);
const fenSemantics = fenGrammar.semantics();

fenSemantics.addOperation('data', {
  Position(piecePlacement, turn, castlings, enPassantTarget, plyClock, moveNumber) {
    return Map({
      pieces: piecePlacement.data(),
      turn: turn.data(),
      castlings: castlings.data(),
      enPassantTarget: enPassantTarget.data(),
      plyClock: plyClock.data(),
      moveNumber: moveNumber.data(),
    });
  },
  piecePlacement(firstRank, _, restRanks) {
    const ranks = [firstRank.data()].concat(restRanks.data());
    const pieceMap = ranks.reduce((pieceMap, rank, rankIndex) => {
      const rankLabel = RANK_LABELS.get(RANK_LABELS.count() - rankIndex - 1);
      return rank.reduce(({pieceMap, fileIndex}, character) => {
        const fileLabel = FILE_LABELS.get(fileIndex);
        const skip = parseInt(character);
        if (Number.isNaN(skip)) {
          const color = character === character.toUpperCase()
            ? PLAYERS.WHITE
            : PLAYERS.BLACK;
          const square = `${fileLabel}${rankLabel}`;
          pieceMap[square] = Map({
            color,
            square,
            type: character.toLowerCase(),
          });
          return {
            pieceMap,
            fileIndex: fileIndex + 1,
          };
        } else {
          return {
            pieceMap,
            fileIndex: fileIndex + skip,
          };
        }
      }, {pieceMap, fileIndex: 0}).pieceMap;
    }, {});
    return Map(pieceMap);
  },
  turn(color) {
    switch (color.data()) {
      case 'w':
        return PLAYERS.WHITE;
      case 'b':
        return PLAYERS.BLACK;
      default:
        return null;
    }
  },
  castlings(letters) {
    if (letters.isIteration) {
      letters = letters.data();
      return Map({
        [PLAYERS.WHITE]: Set([
          letters.indexOf('K') !== -1 ? KINGSIDE : null,
          letters.indexOf('Q') !== -1 ? QUEENSIDE : null,
        ]),
        [PLAYERS.BLACK]: Set([
          letters.indexOf('k') !== -1 ? KINGSIDE : null,
          letters.indexOf('q') !== -1 ? QUEENSIDE : null,
        ])
      });
    } else {
      return Map({
        [PLAYERS.WHITE]: Set([]),
        [PLAYERS.BLACK]: Set([]),
      });
    }
  },
  moveNumber(_) {
    return parseInt(this.interval.contents);
  },
  plyClock(_) {
    return parseInt(this.interval.contents);
  },
  empty(_) {
    return null;
  },
});

export function parseFen(fen) {
  const match = fenGrammar.match(fen);
  if (match.succeeded()) {
    return fenSemantics(match).data();
  } else {
    throw new Error(match.message);
  }
}

function getCoordsFromSquare(square) {
  const x = FILE_LABELS.indexOf(square[0]);
  const y = RANK_LABELS.indexOf(square[1]);
  if (x != null && y != null) {
    return {x, y};
  } else {
    return null;
  }
}

function getSquareFromCoords({x, y}) {
  return FILE_LABELS.get(x) + RANK_LABELS.get(y);
}

export function getSquaresBetween(square1, square2) {
  const coords1 = getCoordsFromSquare(square1);
  const coords2 = getCoordsFromSquare(square2);
  const xs = new Range(coords1.x, coords2.x);
  const ys = new Range(coords1.y, coords2.y);
  if (xs.isEmpty()) {
    return ys.map((y) => {
      return getSquareFromCoords({x: coords1.x, y});
    }).skip(1);
  } else if (ys.isEmpty()) {
    return xs.map((x) => {
      return getSquareFromCoords({x, y: coords1.y});
    }).skip(1);
  } else if (xs.count() === ys.count()) {
    return xs.zipWith((x, y) => {
      return getSquareFromCoords({x, y});
    }, ys).skip(1);
  } else {
    return List();
  }
}

function getOpposingPlayer(player) {
  switch (player) {
    case PLAYERS.WHITE:
      return PLAYERS.BLACK;
    case PLAYERS.BLACK:
      return PLAYERS.WHITE;
    default:
      throw new Error('Invalid player');
  }
}

function getDiagonalSquares(square) {
  const coords = getCoordsFromSquare(square);
  return SQUARES.filter((square1) => {
    const coords1 = getCoordsFromSquare(square1);
    return (
      square !== square1
      && Math.abs(coords.x - coords1.x) === Math.abs(coords.y - coords1.y)
    );
  });
}

function getOrthogonalSquares(square) {
  const coords = getCoordsFromSquare(square);
  return SQUARES.filter((square1) => {
    const coords1 = getCoordsFromSquare(square1);
    return (
      square !== square1 && (coords.x === coords1.x || coords.y === coords1.y)
    );
  });
}

const Piece = new Record({
  key: null,
  square: null,
  player: null,
});

class Pawn extends Piece {
  getRawMoves() {
    const square = this.square;
    const coords = getCoordsFromSquare(square);
    return SQUARES.filter((square1) => {
      const coords1 = getCoordsFromSquare(square1);
      return (
        square !== square1
        && (
          (
            coords1.y - coords.y === (this.player === PLAYERS.WHITE ? 1 : -1)
            && Math.abs(coords.x - coords1.x) <= 1
          )
          ||
          (
            coords.y === (this.player === PLAYERS.WHITE ? 1 : 6)
            && coords.x === coords1.x
            && coords1.y - coords.y === (this.player === PLAYERS.WHITE ? 2 : -2)
          )
        )
      );
    });
  }

  getPseudoLegalMoves(pieces) {
    const square = this.square;
    const coords = getCoordsFromSquare(square);
    return this.getRawMoves().filter((square1) => {
      const coords1 = getCoordsFromSquare(square1);
      if (Math.abs(coords.x - coords1.x) === 1) {
        return (
          pieces.get(square1) != null
          && pieces.get(square1).player === getOpposingPlayer(this.player)
        );
      } else {
        return (
          pieces.get(square1) == null
          && getSquaresBetween(square, square1).every((square) => {
            return pieces.get(square) == null;
          })
        );
      }
    });
  }
}

class Bishop extends Piece {
  getRawMoves() {
    return getDiagonalSquares(this.square);
  }

  getPseudoLegalMoves(pieces) {
    return this.getRawMoves().filter((square) => {
      return (
        (
          pieces.get(square) == null
          || pieces.get(square).player === getOpposingPlayer(this.player)
        )
        && getSquaresBetween(this.square, square).every((square1) => {
          return pieces.get(square1) == null;
        })
      );
    });
  }
}

class Knight extends Piece {
  getRawMoves() {
    const square = this.square;
    const coords = getCoordsFromSquare(square);
    return SQUARES.filter((square1) => {
      const coords1 = getCoordsFromSquare(square1);
      const xDistance = Math.abs(coords.x - coords1.x);
      const yDistance = Math.abs(coords.y - coords1.y);
      return (
        square !== square1
        && (
          xDistance === 2 && yDistance === 1
          || xDistance === 1 && yDistance === 2
        )
      );
    });
  }

  getPseudoLegalMoves(pieces) {
    return this.getRawMoves().filter((square) => {
      return (
        pieces.get(square) == null
        || pieces.get(square).player === getOpposingPlayer(this.player)
      );
    });
  }
}

class Rook extends Piece {
  getRawMoves() {
    return getOrthogonalSquares(this.square);
  }

  getPseudoLegalMoves(pieces) {
    return this.getRawMoves().filter((square) => {
      return (
        (
          pieces.get(square) == null
          || pieces.get(square).player === getOpposingPlayer(this.player)
        )
        && getSquaresBetween(this.square, square).every((square1) => {
          return pieces.get(square1) == null;
        })
      );
    });
  }
}

class Queen extends Piece {
  getRawMoves() {
    return getOrthogonalSquares(this.square)
      .union(getDiagonalSquares(this.square));
  }

  getPseudoLegalMoves(pieces) {
    return this.getRawMoves().filter((square) => {
      return (
        (
          pieces.get(square) == null
          || pieces.get(square).player === getOpposingPlayer(this.player)
        )
        && getSquaresBetween(this.square, square).every((square1) => {
          return pieces.get(square1) == null;
        })
      );
    });
  }
}

class King extends Piece {
  getRawMoves() {
    const square = this.square;
    const coords = getCoordsFromSquare(square);
    return getDiagonalSquares(square)
      .union(getOrthogonalSquares(square))
      .filter((square1) => {
        const coords1 = getCoordsFromSquare(square1);
        return (
          Math.abs(coords.x - coords1.x) <= 1
          && Math.abs(coords.y - coords1.y) <= 1
        );
      });
  }

  getPseudoLegalMoves(pieces) {
    return this.getRawMoves().filter((square) => {
      return (
        pieces.get(square) == null
        || pieces.get(square).player === getOpposingPlayer(this.player)
      );
    });
  }
}

const initialPieces = new Map({
  'a1': new Rook({square: 'a1', key: 'a1', player: PLAYERS.WHITE}),
  'b1': new Knight({square: 'b1', key: 'b1', player: PLAYERS.WHITE}),
  'c1': new Bishop({square: 'c1', key: 'c1', player: PLAYERS.WHITE}),
  'd1': new Queen({square: 'd1', key: 'd1', player: PLAYERS.WHITE}),
  'e1': new King({square: 'e1', key: 'e1', player: PLAYERS.WHITE}),
  'f1': new Bishop({square: 'f1', key: 'f1', player: PLAYERS.WHITE}),
  'g1': new Knight({square: 'g1', key: 'g1', player: PLAYERS.WHITE}),
  'h1': new Rook({square: 'h1', key: 'h1', player: PLAYERS.WHITE}),

  'a2': new Pawn({square: 'a2', key: 'a2', player: PLAYERS.WHITE}),
  'b2': new Pawn({square: 'b2', key: 'b2', player: PLAYERS.WHITE}),
  'c2': new Pawn({square: 'c2', key: 'c2', player: PLAYERS.WHITE}),
  'd2': new Pawn({square: 'd2', key: 'd2', player: PLAYERS.WHITE}),
  'e2': new Pawn({square: 'e2', key: 'e2', player: PLAYERS.WHITE}),
  'f2': new Pawn({square: 'f2', key: 'f2', player: PLAYERS.WHITE}),
  'g2': new Pawn({square: 'g2', key: 'g2', player: PLAYERS.WHITE}),
  'h2': new Pawn({square: 'h2', key: 'h2', player: PLAYERS.WHITE}),

  'a7': new Pawn({square: 'a7', key: 'a7', player: PLAYERS.BLACK}),
  'b7': new Pawn({square: 'b7', key: 'b7', player: PLAYERS.BLACK}),
  'c7': new Pawn({square: 'c7', key: 'c7', player: PLAYERS.BLACK}),
  'd7': new Pawn({square: 'd7', key: 'd7', player: PLAYERS.BLACK}),
  'e7': new Pawn({square: 'e7', key: 'e7', player: PLAYERS.BLACK}),
  'f7': new Pawn({square: 'f7', key: 'f7', player: PLAYERS.BLACK}),
  'g7': new Pawn({square: 'g7', key: 'g7', player: PLAYERS.WHITE}),
  'h7': new Pawn({square: 'h7', key: 'h7', player: PLAYERS.WHITE}),

  'a8': new Rook({square: 'a8', key: 'a8', player: PLAYERS.BLACK}),
  'b8': new Knight({square: 'b8', key: 'b8', player: PLAYERS.BLACK}),
  'c8': new Bishop({square: 'c8', key: 'c8', player: PLAYERS.BLACK}),
  'd8': new Queen({square: 'd8', key: 'd8', player: PLAYERS.BLACK}),
  'e8': new King({square: 'e8', key: 'e8', player: PLAYERS.BLACK}),
  'f8': new Bishop({square: 'f8', key: 'f8', player: PLAYERS.BLACK}),
  'g8': new Knight({square: 'g8', key: 'g8', player: PLAYERS.BLACK}),
  'h8': new Rook({square: 'h8', key: 'h8', player: PLAYERS.BLACK}),
});

const inCheck = new Map({
  'a2': new Pawn({square: 'a2', player: PLAYERS.WHITE}),
  'd3': new Pawn({square: 'd3', player: PLAYERS.WHITE}),
  'f5': new Pawn({square: 'f5', player: PLAYERS.WHITE}),
  'g2': new Pawn({square: 'g2', player: PLAYERS.WHITE}),
  'h3': new Pawn({square: 'h3', player: PLAYERS.WHITE}),

  'a6': new Pawn({square: 'a6', player: PLAYERS.BLACK}),
  'b5': new Pawn({square: 'b5', player: PLAYERS.BLACK}),
  'c5': new Pawn({square: 'c5', player: PLAYERS.BLACK}),
  'd4': new Pawn({square: 'd4', player: PLAYERS.BLACK}),
  'f6': new Pawn({square: 'f6', player: PLAYERS.BLACK}),
  'f7': new Pawn({square: 'f7', player: PLAYERS.BLACK}),
 
  'h4': new Rook({square: 'h4', player: PLAYERS.WHITE}),

  'c7': new Rook({square: 'c7', player: PLAYERS.BLACK}),
  'g8': new Rook({square: 'g8', player: PLAYERS.BLACK}),

  'f8': new Bishop({square: 'f8', player: PLAYERS.WHITE}),

  'c2': new Knight({square: 'c2', player: PLAYERS.BLACK}),

  'g1': new King({square: 'g1', player: PLAYERS.WHITE}),
  'h8': new King({square: 'h8', player: PLAYERS.BLACK}),
});

class Position extends new Record({
  pieces: initialPieces,
  turn: PLAYERS.WHITE,
}) {
  inCheck() {
    const kingSquare = this.pieces.filter((piece) => {
      return piece.player === this.turn && piece.constructor === King;
    }).keySeq().first();
    const opposingPieces = this.pieces.filter((piece) => {
      return piece.player === getOpposingPlayer(this.turn);
    });
    const opposingAttacks = opposingPieces.map((piece) => {
      return piece.getPseudoLegalMoves(this.pieces);
    }).reduce((opposingAttacks, attacks) => {
      return opposingAttacks.union(attacks);
    });
    return opposingAttacks.includes(kingSquare);
  }

  getPseudoLegalMoves() {
    return this.pieces.filter((piece) => {
      return piece.player === this.turn;
    }).map((piece, fromSquare) => {
      const toSquares = piece.getPseudoLegalMoves(this.pieces);
      return new Repeat(fromSquare).zipWith((from, to) => {
        return new Map({from, to});
      }, toSquares);
    }).reduce((moves1, moves) => {
      return moves1.concat(moves);
    });
  }

  makePseudoLegalMove(move) {
    return this.update('pieces', (pieces) => {
      const movingPiece = pieces.get(move.get('from')).set('square', move.get('to'));
      return pieces.remove(move.get('from')).set(move.get('to'), movingPiece);
    });
  }

  getLegalMoves() {
    return this.getPseudoLegalMoves().filter((move) => {
      return !this.makePseudoLegalMove(move).inCheck();
    });
  }

  ascii() {
    return RANK_LABELS.reverse().map((r) => {
      return FILE_LABELS.map((f) => {
        const piece = this.pieces.get(f + r);
        if (piece == null) {
          return ' ';
        } else {
          switch (piece.constructor) {
            case Pawn:
              if (piece.player === PLAYERS.WHITE) {
                return 'P';
              } else {
                return 'p';
              }
            case Bishop:
              if (piece.player === PLAYERS.WHITE) {
                return 'B';
              } else {
                return 'b';
              }
            case Knight:
              if (piece.player === PLAYERS.WHITE) {
                return 'N';
              } else {
                return 'n';
              }
            case Rook:
              if (piece.player === PLAYERS.WHITE) {
                return 'R';
              } else {
                return 'r';
              }
            case Queen:
              if (piece.player === PLAYERS.WHITE) {
                return 'Q';
              } else {
                return 'q';
              }
            case King:
              if (piece.player === PLAYERS.WHITE) {
                return 'K';
              } else {
                return 'k';
              }
          }
        }
      }).join('|');
    }).join('\n');
  }
}

const position = new Position({pieces: inCheck, turn: PLAYERS.BLACK});
// console.log('\n' + position.ascii());

// console.log(position.inCheck());
// console.log(position.makePseudoLegalMove(position.getPseudoLegalMoves().first()).inCheck());
console.log(position.getLegalMoves().toJS());
// const position1 = position.makePseudoLegalMove(new Map({from: 'h8', to: 'h7'}));
// console.log('\n'+position1.ascii());
// console.log(position1.inCheck());

// var position = new Position({pieces: initialPieces, turn: PLAYERS.WHITE}).makePseudoLegalMove((new Map({from: 'e2', to: 'e4'})));

// console.log('\n'+ position.ascii());

// console.log(new Rook({square: 'e5', player: PLAYERS.WHITE}).getPseudoLegalMoves(new Map({
//  'f4': new Pawn({square: 'f4', player: PLAYERS.WHITE}),
//  'f6': new Pawn({square: 'f6', player: PLAYERS.WHITE}),
//  'd4': new Pawn({square: 'd4', player: PLAYERS.WHITE}),
//  'd6': new Pawn({square: 'd6', player: PLAYERS.WHITE}),
//  'e4': new Pawn({square: 'e4', player: PLAYERS.BLACK}),
//  'e6': new Pawn({square: 'e6', player: PLAYERS.BLACK}),
//  'd5': new Pawn({square: 'd5', player: PLAYERS.BLACK}),
//  'f5': new Pawn({square: 'f5', player: PLAYERS.BLACK}),
// })).toJS());

// function getCastlingSquares(move) {
//   const kingSquare = move.get('player') === PLAYERS.WHITE
//     ? 'e1'
//     : 'e8';
//   const rookSquare = move.get('player') === PLAYERS.WHITE
//     ? move.get('side') === KINGSIDE
//       ? 'h1'
//       : 'a1'
//     : move.get('side') === KINGSIDE
//       ? 'h8'
//       : 'a8';
//   return { kingSquare, rookSquare };
// }
// export function canCastle(pieces, castlings, move) {
//   const {kingSquare, rookSquare} = getCastlingSquares(move);
//   return (
//     castlings.get(move.get('player')).has(move.get('side')) && 
//     getSquaresBetween(kingSquare, rookSquare).every((square) => {
//       return pieces.get(square) == null;
//     })
//   );
// }

const defaultStartingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const defaultStartingPosition = parseFen(defaultStartingFen);
