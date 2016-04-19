import fs from 'fs';
import path from 'path';

import React, { Component } from 'react';
import ReactDOM from 'react-dom/server';

import webpack from 'webpack';

function WebpackScript({assetName}) {
  throw new Error('ReactWebpack did not replace this element');
}

// NOTE(-_-): the value of assetsByChunkName from webpack can be an array (if there are multiple assets like js, css, js.map), a string (if there is a single asset).
function normalizeAssets(assets) {
  if (Array.isArray(assets)) {
    return assets;
  } else if (typeof assets === 'string') {
    return [assets];
  } else {
    return [];
  }
}

function getAssetURL(stats, assetName, extension='.js') {
  const publicPath = stats.publicPath;
  const assets = normalizeAssets(stats.assetsByChunkName[assetName]);
  const test = new RegExp(`${extension}$`, 'i');
  const asset = assets.filter((a) => test.test(a))[0];
  if (asset != null) {
    return publicPath + asset;
  } else {
    return '';
  }
}

function replaceScripts(stats, element) {
  if (element.type === WebpackScript) {
    const {assetName} = element.props;
    return (
      <script src={getAssetURL(stats, assetName)} />
    );
  } else {
    return React.cloneElement(element, {...element.props}, React.Children.map(element.props.children, (child) => {
      if (React.isValidElement(child)) {
        return replaceScripts(stats, child);
      } else {
        return child;
      }
    }));
  }
}

class ReactWebpack {
  static run(config, element, callback) {
    const compiler = webpack(config);
    compiler.run((err, stats) => {
      if (err) {
        callback(err);
      } else {
        element = replaceScripts(stats.toJson(), element);
        callback(null, element);
      }
    });
  }
}

const config = require('../webpack.config.js');

function main() {
  const template = (
    <html>
      <head>
        <title>React Chess</title>
      </head>
      <body>
        <div id='root'></div>
        <WebpackScript assetName="chess" />
      </body>
    </html>
  );

  ReactWebpack.run(config, template, (err, element) => {
    fs.writeFileSync(path.join(config.output.path, 'index.html'), ReactDOM.renderToStaticMarkup(element));
  });
}

main();
