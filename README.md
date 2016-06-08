# react-walk

`react-walk` exposes a couple functions to help you read and manipulate ReactElements as trees.

## Example
```javascript
import React;
import ReactWalk from 'react-walk';

const page = (
  <html>
    <head>
      <title>I am an html5 page JK It's JSX psychhhhhh templates can do one</title>
    <body>
      <div id="poop"/>
    </body>
  </html>
);

// NOTE(brian): shit's still kinda low-level but I want to add a bunch more
// functions as we figure out what we're actually creating a library for I dunno
const hydratedPage = ReactWalk.postWalk(page, (elem) => {
  if (elem.props.id === 'poop') {
    return (
      <div>I pooped!</div>
    );
  } else {
    return elem;
  }
});

console.log(React.renderToString(hydratedPage));
```
