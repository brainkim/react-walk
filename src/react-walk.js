import React from 'react'

export function walk(element, innerFn, outerFn) {
  const children = React.Children.map(element.props.children, (child) => {
    if (React.isValidElement(child)) {
      return innerFn(child);
    } else {
      return child;
    }
  });
  return outerFn(React.cloneElement(element, {children}));
}

export function preWalk(element, transformFn) {
  element = transformFn(element);
  if (React.isValidElement(element)) {
    return walk(
      element,
      (element) => preWalk(element, transformFn),
      (element) => element
    );
  } else {
    return element;
  }
}

export function postWalk(element, transformFn) {
  if (React.isValidElement(element)) {
    return walk(
      element,
      (element) => postWalk(element, transformFn),
      transformFn
    );
  } else {
    return element;
  }
}

export function flatten(element) {
  const result = [];
  postWalk(element, (element) => {
    result.push(element);
    return element;
  });
  return result;
}
