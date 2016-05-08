const React = require('react');

exports.walk = walk;
function walk(element, innerFn, outerFn) {
  const children = React.Children.map(element.props.children, (child) => {
    if (React.isValidElement(child)) {
      return innerFn(child);
    } else {
      return child;
    }
  });
  return outerFn(React.cloneElement(element, {children}));
}

exports.preWalk = preWalk;
function preWalk(element, transformFn) {
  return walk(
    transformFn(element),
    (element) => preWalk(element, transformFn),
    (element) => element
  );
}

exports.postWalk = postWalk;
function postWalk(element, transformFn) {
  return walk(
    element,
    (element) => postWalk(element, transformFn),
    transformFn
  );
}

exports.flatten = flatten;
function flatten(element) {
  const result = [];
  postWalk(element, (element) => {
    result.push(element);
    return element;
  });
  return result;
}
