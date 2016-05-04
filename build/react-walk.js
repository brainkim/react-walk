import React from 'react';
function identity(element) { return element; }

export function walk(element, innerFn, outerFn) {
  // NOTE( ͡° ͜ʖ ͡°): touching ur children
  const children = React.Children.map(element.props.children, (child) => {
    if (React.isValidElement(child)) {
      return innerFn(child);
    } else {
      return child;
    }
    return innerFn(child);
  });
  // NOTE(¯\_(ツ)_/¯): {...element.props} b/c otherwise React warns about `ref` and `key` not being a prop
  return outerFn(React.cloneElement(element, {...element.props}, children));
}

export function preWalk(element, transformFn) {
  return walk(transformFn(element), (element) => preWalk(element, transformFn), identity);
}

export function postWalk(element, transformFn) {
  return walk(element, (element) => postWalk(element, transformFn), transformFn);
}
