import React from 'react'

// custom components
// TODO(brian): add propTypes when api stabilizes
function Script() {
  throw new Error(`Bob didn't replace this element, sorry!`);
}

function Link() {
  throw new Error(`Bob didn't replace this element, sorry!`);
}

Fragment.defaultProps = {
  wrapper: 'div',
};
function Fragment(props) {
  const {wrapper, id, entryfile} = props;
  // ¿Can I return when the entryfile could leak path information?
  // console.warn(`fragment targeting ${entryfile} was not replaced`);
  // throw new Error(`Bob didn't replace this element, sorry!`);
  return React.createElement(wrapper, {id});
}
