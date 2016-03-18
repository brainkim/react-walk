var React = require('react');
var DOM = React.DOM;
var cx = require('react/lib/cx');

var spec = {};
spec.displayName = 'Square';

spec.render = function() {
  var props = this.props;
  var className = cx({'square': true,
                      'square-dark': props.isDark,
                      'square-light': !props.isDark})
                    + ' square-' + props.label;
  var style = {height: props.height + 'px',
               width: props.width + 'px',
               backgroundColor: this.props.isHighlighted ? 'red' : null,
               display: 'table-cell',
               verticalAlign: 'middle',
               textAlign: 'center'};
  return this.transferPropsTo(
    DOM.div({className: className,
             style: style},
            props.children));
};

module.exports = React.createClass(spec);
