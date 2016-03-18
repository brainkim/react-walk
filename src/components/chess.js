var React = require('react');
var DOM = React.DOM;

var Piece = require('./piece');
var Square = require('./square');

var fen = require('../chess/fen');
var constants = require('../chess/constants');
var comb = require('../utils/comb');
var bait = require('../utils/bait');
var _ = require('underscore');

function isDark(ri, ci) { return (ri % 2 === 0) != (ci % 2 === 0); }

var spec = {};
spec.displayName = 'Chess';

spec.getInitialState = function() {
  var pieceObj = fen.parse(constants.INITIAL_FEN).pieceObj;
  pieceObj = comb.map(pieceObj, function(piece, square) {
    return {key: square, value: {key: square, fenCh: piece}};
  });
  return {pieceObj: pieceObj, from: null};
};

spec.getDefaultProps = function() {
  return {perspective: 'white'};
};

spec.onPieceClick = function(ev) {
  if (this.state.from === ev.square) {
    this.setState({from: null});
    ev.stopPropagation();
  }
  else if (!this.state.from) {
    this.setState({from: ev.square});
    ev.stopPropagation();
  }
};

spec.onSquareClick = function(ev) {
  var from = this.state.from;
  var moving = this.state.pieceObj[from];
  if (from != null) {
    var to = ev.square;
    var pieceObj = comb.filter(this.state.pieceObj, function(piece, square) {
      return square !== from;
    });
    pieceObj[to] = moving;
    this.setState({from: null, pieceObj: pieceObj});
  }
};

spec.render = function() {
  var props = this.props;
  var perspective = props.perspective;
  var ranks = constants.RANKS;
  var files = constants.FILES;
  var pieceObj = this.state.pieceObj;
  if (perspective === 'south') {
    ranks = _.reverse(ranks);
    files = _.reverse(files);
  }
  var children = [];
  _.forEach(ranks, function(rank, ri) {
    var squares = [];
    _.forEach(files, function(file, fi) {
      var label = file + rank;
      var pieceData = pieceObj[label];
      var piece;
      if (pieceData) {
        piece = Piece({key: pieceData.key,
                       fenCh: pieceData.fenCh,
                       onClick: bait(this.onPieceClick, {square: label})});
      }
      squares.push(Square({key: label + '-square',
                           label: label,
                           isDark: isDark(ri, fi),
                           width: 60,
                           height: 60,
                           onClick: bait(this.onSquareClick, {square: label})},
                          piece));
    }.bind(this));
    children.push(DOM.div({key: ranks[ri] + 'row'}, squares));
  }.bind(this));

  return DOM.div({className: 'board',
                  style: {lineHeight: 0,
                          outline: 'black solid 1px',
                          width: '480px'}},
                 children);
};

module.exports = React.createClass(spec);
