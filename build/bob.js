import fs from 'fs';
import path from 'path';

import React, { Component } from 'react';
import ReactDOM from 'react-dom/server';

import webpack from 'webpack';

function Script({assetName}) {
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

function getAssetURL(assetsByChunkName, publicPath, chunkName) {
  let {name, ext} = path.parse(chunkName);
  const assets = normalizeAssets(assetsByChunkName[name]);
  const test = new RegExp(`${ext}$`, 'i');
  const [asset] = assets.filter((a) => test.test(a));
  if (asset != null) {
    return publicPath + asset;
  } else {
    return '';
  }
}

function replaceAssets(stats, element) {
  const {assetsByChunkName, publicPath} = stats.toJson();
  if (element.type === Script) {
    let name = element.props.name;
    return (
      <script src={getAssetURL(assetsByChunkName, publicPath, name)} />
    );
  } else {
    return React.cloneElement(element, {...element.props}, React.Children.map(element.props.children, (child) => {
      if (React.isValidElement(child)) {
        return replaceAssets(stats, child);
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

  build(element) {
    return new Promise((resolve, reject) => {
      this.compiler.run((err, stats) => {
        fs.writeFileSync('./poop.json', JSON.stringify(stats.toJson(), null, 2));
        if (err) {
          reject(err);
        } else if (stats.hasErrors()) {
          console.log(`what the fuck ${stats.errors} ${stats.warnings}`);
          reject([stats.errors, stats.warnings]);
        } else {
          resolve(replaceAssets(stats, element));
        }
      });
    });
  }
}

import ReactNode from './react-node-utils';

const bob = new Bob();

async function main() {
  let template = (
    <html>
      <head>
        <title>React Chess</title>
      </head>
      <body>
        <div id='root'></div>
        <Script name="chess.js" />
      </body>
    </html>
  );
  try {
    template = await bob.build(template);
  } catch (err) {
    console.log(err);
  }
  console.log('uhhhh');
  ReactNode.writeFileSync('./dist/index.html', template);
}

main();
