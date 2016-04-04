import { Map, List } from 'immutable';
import ohm from 'ohm-js';
import fen from './fen.ohm';

const fenGrammar = ohm.grammar(fen);

const PLAYER = {
  WHITE: 'WHITE',
  BLACK: 'BLACK',
};

const initialState = Map({
  pieces: List(),
});

const fenToState = (fen) => {

};
