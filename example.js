import React from 'react';
import * as ReactWalk from './src/react-walk';
import ReactDOMServer from 'react-dom/server';

const page = (
  <html>
    <head>
      <title>I am an html5 page JK It's JSX psychhhhhh templates can do one</title>
    </head>
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

console.log(ReactDOMServer.renderToStaticMarkup(hydratedPage));//.renderToString(hydratedPage));
// <html><head><title>I am an html5 page JK It&#x27;s JSX psychhhhhh templates can do one</title></head><body><div>I pooped!</div></body></html>
//                             ^^^^^^^^^
