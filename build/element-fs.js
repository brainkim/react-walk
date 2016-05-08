const fs = require('fs');
const React = require('react');
const ReactDOM = require('react-dom/server');

module.exports = {
  writeFileSync(file, element) {
    const markup = ReactDOM.renderToStaticMarkup(element);
    fs.writeFileSync(file, markup);
  },
};
