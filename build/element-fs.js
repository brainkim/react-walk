import fs from 'fs';
import React from 'react';
import ReactDOM from 'react-dom/server';

export default {
  writeFileSync(file, element) {
    try {
      element = ReactDOM.renderToStaticMarkup(element);
      fs.writeFileSync(file, element);
    } catch (err) {
      console.log(err);
    }
  },
};
