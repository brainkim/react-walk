import fs from 'node';
import React from 'react';
import ReactDOM from 'react-dom/server';

export function writeFileSync(file, data) {
  data = ReactDOM.renderToStaticMarkup(data);
  fs.writeFileSync(file, data); 
};
