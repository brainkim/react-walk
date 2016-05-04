import fs from 'fs';
import React from 'react';
import ReactDOM from 'react-dom/server';

export default {
  writeFileSync(file, element) {
    element = ReactDOM.renderToStaticMarkup(element);
    fs.writeFileSync(file, element);
  },
};
