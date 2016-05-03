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

const SIDES = {
  KINGSIDE: 'O-O',
  QUEENSIDE: 'O-O-O',
};

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
          letters.indexOf('K') !== -1 ? SIDES.KINGSIDE : null,
          letters.indexOf('Q') !== -1 ? SIDES.QUEENSIDE : null,
        ]),
        [PLAYERS.BLACK]: Set([
          letters.indexOf('k') !== -1 ? SIDES.KINGSIDE : null,
          letters.indexOf('q') !== -1 ? SIDES.QUEENSIDE : null,
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

export function getSquareRange(startSquare, endSquare) {
  const startCoords = getCoordsFromSquare(startSquare);
  const endCoords = getCoordsFromSquare(endSquare);
  const xs = new Range(startCoords.x, endCoords.x);
  const ys = new Range(startCoords.y, endCoords.y);
  if (xs.isEmpty()) {
    return ys.map((y) => {
      return getSquareFromCoords({x: startCoords.x, y});
    });
  } else if (ys.isEmpty()) {
    return xs.map((x) => {
      return getSquareFromCoords({x, y: startCoords.y});
    });
  } else if (xs.count() === ys.count()) {
    return xs.zipWith((x, y) => {
      return getSquareFromCoords({x, y});
    }, ys);
  } else {
    return new List();
  }
}

export function getSquaresBetween(startSquare, endSquare) {
  return getSquareRange(startSquare, endSquare).skip(1);
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

function getPromotionRank(player) {
  switch (player) {
    case PLAYERS.WHITE:
      return RANK_LABELS.indexOf('8');
    case PLAYERS.BLACK:
      return RANK_LABELS.indexOf('1');
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
  square: null,
  player: null,
  key: null,
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
  'g7': new Pawn({square: 'g7', key: 'g7', player: PLAYERS.BLACK}),
  'h7': new Pawn({square: 'h7', key: 'h7', player: PLAYERS.BLACK}),

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

const castleCity = new Map({
  'g7': new Rook({square: 'g7', player: PLAYERS.WHITE}),
  'd7': new Rook({square: 'd7', player: PLAYERS.WHITE}),

  'a8': new Rook({square: 'a8', player: PLAYERS.BLACK}),
  'h8': new Rook({square: 'h8', player: PLAYERS.BLACK}),
  'e8': new King({square: 'e8', player: PLAYERS.BLACK}),
});

const promotionCity = new Map({
  'e7': new Pawn({square: 'e7', player: PLAYERS.WHITE}),
  'e2': new Pawn({square: 'e2', player: PLAYERS.BLACK}),

  'e1': new King({square: 'e1', player: PLAYERS.WHITE}),
  'h1': new Rook({square: 'h1', player: PLAYERS.WHITE}),
  'a1': new Rook({square: 'a1', player: PLAYERS.WHITE}),

  'g8': new King({square: 'g8', player: PLAYERS.BLACK}),
});


const _Position = new Record({
  // pieces: initialPieces,
  // turn: PLAYERS.WHITE,
  // castlings: new Map({
  //   [PLAYERS.WHITE]: new Set([SIDES.KINGSIDE, SIDES.QUEENSIDE]),
  //   [PLAYERS.BLACK]: new Set([SIDES.KINGSIDE, SIDES.QUEENSIDE]),
  // }),
  pieces: inCheck,
  turn: PLAYERS.BLACK,
  castlings: new Map({
    [PLAYERS.WHITE]: new Set(),
    [PLAYERS.BLACK]: new Set(),
  }),
});

function getCastlingSquares(player, side) {
  let kingStartSquare, kingEndSquare, rookStartSquare, rookEndSquare;
  if (player === PLAYERS.WHITE) {
    kingStartSquare = 'e1';
    if (side === SIDES.KINGSIDE) {
      kingEndSquare = 'g1';
      rookStartSquare = 'h1';
      rookEndSquare = 'f1';
    } else {
      kingEndSquare = 'c1';
      rookStartSquare = 'a1';
      rookEndSquare = 'd1';
    }
  } else {
    kingStartSquare = 'e8';
    if (side === SIDES.KINGSIDE) {
      kingEndSquare = 'g8';
      rookStartSquare = 'h8';
      rookEndSquare = 'f8';
    } else {
      kingEndSquare = 'c8';
      rookStartSquare = 'a8';
      rookEndSquare = 'd8';
    }
  }
  return {kingStartSquare, kingEndSquare, rookStartSquare, rookEndSquare};
}

export function getPieceLetter(pieceType) {
  switch (pieceType) {
    case Pawn:
      return 'p';
    case Bishop:
      return 'b';
    case Knight:
      return 'n';
    case Rook:
      return 'r';
    case Queen:
      return 'q';
    case King:
      return 'k';
    default:
      throw new Error('write better code, Brain!');
  }
}

export class Position extends _Position {
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
    }, new Set());
    return opposingAttacks.includes(kingSquare);
  }

  getPseudoLegalMoves() {
    const pieceMoves = this.pieces.filter((piece) => {
      return piece.player === this.turn;
    }).map((piece, fromSquare) => {
      const toSquares = piece.getPseudoLegalMoves(this.pieces);
      return new Repeat(fromSquare).zipWith((from, to) => {
        if (piece.constructor === Pawn
            && getCoordsFromSquare(to).y === getPromotionRank(piece.player)) {
          return new List([Pawn, Bishop, Knight, Rook, Queen]).map((pieceType) => {
            return new Map({from, to, promotion: getPieceLetter(pieceType)});
          });
        } else {
          return new List([new Map({from, to})]);
        }
      }, toSquares);
    }).valueSeq().flatten(2);

    const castleMoves = this.getPseudoLegalCastleMoves();

    return pieceMoves.concat(castleMoves);
  }

  getPseudoLegalCastleMoves() {
    if (this.inCheck()) {
      return new List();
    } else {
      return new List(this.castlings.get(this.turn).filter((side) => {
        const {kingStartSquare, kingEndSquare, rookStartSquare} = getCastlingSquares(this.turn, side);
        return (
          getSquaresBetween(kingStartSquare, rookStartSquare).every((square) => {
            return this.pieces.get(square) == null;
          })
          && getSquaresBetween(kingStartSquare, kingEndSquare).every((square) => {
            return !this.movePiece(kingStartSquare, square).inCheck();
          })
        );
      }));
    }
  }

  movePiece(from, to) {
    return this.update('pieces', (pieces) => {
      const movingPiece = pieces.get(from).set('square', to);
      return pieces.remove(from).set(to, movingPiece);
    });
  }

  makePseudoLegalMove(move) {
    if (move === SIDES.KINGSIDE || move === SIDES.QUEENSIDE) {
      const {kingStartSquare, kingEndSquare, rookStartSquare, rookEndSquare} = getCastlingSquares(this.turn, move);
      return this.movePiece(kingStartSquare, kingEndSquare).movePiece(rookStartSquare, rookEndSquare);
    } else {
      return this.movePiece(move.get('from'), move.get('to'));
    }
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
          const letter = getPieceLetter(piece.constructor);
          return piece.player === PLAYERS.WHITE
            ? letter.toUpperCase()
            : letter.toLowerCase();
        }
      }).join('|');
    }).join('\n');
  }
}

const defaultStartingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const defaultStartingPosition = parseFen(defaultStartingFen);
