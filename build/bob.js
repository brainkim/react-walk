import fs from 'fs';
import path from 'path';

import React, { Component } from 'react';
import ReactDOM from 'react-dom/server';

import webpack from 'webpack';

function Asset({assetName}) {
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
  if (element.type === Script) {
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

const defaultConfig = require('../webpack.config.js');
class Bob {
  constructor(config=defaultConfig) {
    this.compiler = webpack(config);
  }

  build(elementTree) {
    return new Promise((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) {
          reject(err);
        } else if (stats.hasErrors()) {
          console.log(`what the fuck ${stats.errors} ${stats.warnings}`);
          reject([stats.errors, stats.warnings]);
        } else {
          element = replaceScripts(stats, lement);
          resolve(swapAssets(stats, entry));
        }
      });
    });
  }
}
const bob = new Bob();

import ReactNode from './react-node-utils';

function async main() {
  let html = (
    <html>
      <head>
        <title>React Chess</title>
        <Asset name="./src/chess.css" />
      </head>
      <body>
        <div id='root'></div>
        <Asset name="./src/chess.js" />
      </body>
    </html>
  );
  template = await bob.build(template);
  console.log('uhhh');
  ReactNode.writeFileSync('dist.c', template);
}

main();
