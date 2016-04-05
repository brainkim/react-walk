import { Map, List, Set } from 'immutable';
import ohm from 'ohm-js';
import fen from './fen.ohm';

const RANK_LABELS = [1,2,3,4,5,6,7,8];
const FILE_LABELS = ['a','b','c','d','e','f','g','h'];

const fenGrammar = ohm.grammar(fen);
const fenSemantics = fenGrammar.semantics();

fenSemantics.addOperation('data', {
  Position(piecePlacement, turn, castling, enPassantTarget, plyClock, moveNumber) {
    return Map({
      pieces: piecePlacement.data(),
      turn: turn.data(),
      castling: Set(castling.data()),
      enPassantTarget: enPassantTarget.data(),
      plyClock: plyClock.data(),
      moveNumber: moveNumber.data(),
    });
  },
  piecePlacement(firstRank, _, restRanks) {
    const ranks = [firstRank.data()].concat(restRanks.data());
    const pieceMap = ranks.reduce((pieceMap, rank, rankIndex) => {
      const rankLabel = RANK_LABELS[RANK_LABELS.length - rankIndex - 1];
      return rank.reduce(({pieceMap, fileIndex}, character) => {
        const fileLabel = FILE_LABELS[fileIndex];
        if (Number.isNaN(parseInt(character))) {
          const color = character === character.toUpperCase()
            ? 'white'
            : 'black';
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
            fileIndex: fileIndex + parseInt(character),
          };
        }
      }, {pieceMap, fileIndex: 0}).pieceMap;
    }, {});
    return Map(pieceMap);
  },
  turn(color) {
    return color.data();
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

const parseFen = (fen) => {
  const match = fenGrammar.match(fen);
  if (match.succeeded()) {
    return fenSemantics(match).data();
  } else {
    throw new Error(match.message);
  }
};

const defaultStartingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1';
const defaultStartingPosition = parseFen(defaultStartingFen);
