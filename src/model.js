import im, {Record, Map, List, Set} from 'immutable';
import ohm from 'ohm-js';
import fen from './fen.ohm';

const RANK_LABELS = List(['1','2','3','4','5','6','7','8']);
const FILE_LABELS = List(['a','b','c','d','e','f','g','h']);

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

// const initialPosition = IM.fromJS({
//   pieces: {
//     'a8': 'r',
//     'b8': 'n',
//     'c8': 'b',
//     'd8': 'q',
//     'e8': 'k',
//     'f8': 'b',
//     'g8': 'n',
//     'h8': 'r',
// 
//     'a7': 'p',
//     'b7': 'p',
//     'c7': 'p',
//     'd7': 'p',
//     'e7': 'p',
//     'f7': 'p',
//     'g7': 'p',
//     'h7': 'p',
// 
//     'a2': 'p',
//     'b2': 'p',
//     'c2': 'p',
//     'd2': 'p',
//     'e2': 'p',
//     'f2': 'p',
//     'g2': 'p',
//     'h2': 'p',
// 
//     'a1': 'r',
//     'b1': 'n',
//     'c1': 'b',
//     'd1': 'q',
//     'e1': 'k',
//     'f1': 'b',
//     'g1': 'n',
//     'h1': 'r',
//   },
//   turn: 'w',
//   castlings: {
//     [PLAYERS.WHITE]: Set(KINGSIDE, QUEENSIDE),
//     [PLAYERS.BLACK]: Set(KINGSIDE, QUEENSIDE),
//   },
//   enPassantTarget: null,
//   shotClock: 0,
//   fullMoveNumber: 0,
// });

function getFilesBetween(f1, f2) {
  let start = FILE_LABELS.indexOf(f1);
  let end = FILE_LABELS.indexOf(f2);
  if (start > end) {
    [start, end] = [end, start];
  }
  if (start !== -1 && end !== -1) {
    return FILE_LABELS.slice(start + 1, end);
  } else {
    return null;
  }
}

function getRanksBetween(r1, r2) {
  let start = RANK_LABELS.indexOf(r1);
  let end = RANK_LABELS.indexOf(r2);
  if (start > end) {
    [start, end] = [end, start];
  }
  if (start !== -1 && end !== -1) {
    return RANK_LABELS.slice(start + 1, end);
  } else {
    return null;
  }
}

export function getSquaresBetween(square1, square2) {
  const files = getFilesBetween(square1[0], square2[0]);
  const ranks = getRanksBetween(square1[1], square2[1]);
  if (files == null || ranks == null) {
    return List(); 
  } else if (files.isEmpty()) {
    return ranks.map((r) => {
      return `${square1[0]}${r}`;
    });
  } else if (ranks.isEmpty()) {
    return files.map((f) => {
      return `${f}${square1[1]}`;
    });
  } else if (files.count() === ranks.count()) {
    return files.map((f, i) => {
      const r = ranks.get(i);
      return `${f}${r}`;
    });
  } else {
    return List();
  }
}

function getCastlingSquares(move) {
  const kingSquare = move.get('player') === PLAYERS.WHITE
    ? 'e1'
    : 'e8';
  const rookSquare = move.get('player') === PLAYERS.WHITE
    ? move.get('side') === KINGSIDE
      ? 'h1'
      : 'a1'
    : move.get('side') === KINGSIDE
      ? 'h8'
      : 'a8';
  return { kingSquare, rookSquare };
}

export function canCastle(pieces, turn, castlings, move) {
  const {kingSquare, rookSquare} = getCastlingSquares(move);
  return (
    turn === move.get('player') &&
    castlings.get(turn).has(move.get('side')) && 
    getSquaresBetween(kingSquare, rookSquare).every((square) => {
      return pieces.get(square) == null;
    })
  );
}

function updatePieces(position, move) {
  const { turn, castlings } = position;
}

function updatePosition(position, move) {
  return Map({
    pieces: updatePieces(position, move),
  });
}

const defaultStartingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const defaultStartingPosition = parseFen(defaultStartingFen);
