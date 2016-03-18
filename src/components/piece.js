var React = require('react');
var DOM = React.DOM;

var spec = {};
spec.displayName = 'Piece';

function srcFn(fenCh) {
  var urls = {p: 'bpawn', r: 'brook', n: 'bknight',
              b: 'bbishop', q: 'bqueen', k: 'bking',
              P: 'wpawn', R: 'wrook', N: 'wknight',
              B: 'wbishop', Q: 'wqueen', K: 'wking'};
  return 'img/wikipedia/' + urls[fenCh] + '.svg';
}

spec.getDefaultProps = function() {
  return {srcFn: srcFn, square: null, onClick: function() {}};
};

spec.render = function() {
  var fenCh = this.props.fenCh || this.props.children;
  return this.transferPropsTo(
    DOM.img({src: this.props.srcFn(fenCh),
             className: 'piece',
             draggable: false,
             style: {width: 'inherit',
                     height: 'inherit'}},
            this.props.children));
};

module.exports = React.createClass(spec);
