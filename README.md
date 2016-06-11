# react-walk
🚨  UNDER CONSTRUCTION GO AWAY DO NOT USE DO NOT THINK ABOUT 🚨

React Walk exposes a couple functions to help you read and transform React Elements as trees.

## Examples
```jsx
import React from 'react';
import * as ReactWalk from './src/react-walk';

const page = (
  <html>
    <head>
      <title>It me, jsx</title>
    </head>
    <body>
      <div id="poop" />
      <script src="vendor.js" />
      <script src="main.js" />
    </body>
  </html>
);

// reading all the script tags
const scriptSrcs = ReactWalk.flatten(page).filter((elem) => {
  return elem.type === 'script';
}).map((scriptElem) => {
  return scriptElem.props.src;
});

console.log(scriptSrcs);
// ["vendor.js", "main.js"]

// hydrating an element with a specific id.
const hydratedPage = ReactWalk.postWalk(page, (elem) => {
  if (elem.props.id === 'poop') {
    return (
      <div {...elem.props}>I pooped!</div>
    );
  } else {
    return elem;
  }
});

import ReactDOMServer from 'react-dom/server';

console.log(ReactDOMServer.renderToStaticMarkup(hydratedPage));
// <html><head><title>It me, jsx</title></head><body><div id="poop">I pooped!</div></body></html>
```
