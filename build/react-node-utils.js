import fs from 'fs';
import React from 'react';
import ReactDOM from 'react-dom/server';

export default {
  writeFileSync(file, data) {
    try {
      data = ReactDOM.renderToStaticMarkup(data);
      console.log(data);
      fs.writeFileSync(file, data); 
    } catch (err) {
      console.log(err);
    }
  },
};
