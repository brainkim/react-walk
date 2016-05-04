import path from 'path';

import React, {Component} from 'react';
import ReactDOM from 'react-dom/server';

import webpack from 'webpack';

import {preWalk, postWalk} from './react-walk';
import elementFs from './element-fs';

function Script({name}) {
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
    throw new Error(`Can\'t find asset ${chunkName}`);
  }
}

function replaceAssets(stats, element) {
  const {assetsByChunkName, publicPath} = stats.toJson();
  return postWalk(element, (element) => {
    if (element.type === Script) {
      const {name} = element.props;
      return (
        <script src={getAssetURL(assetsByChunkName, publicPath, name)} />
      );
    } else {
      return element;
    }
  });
}


const defaultConfig = require('../webpack.config.js');
class Bob {
  constructor(config=defaultConfig) {
    this.compiler = webpack(config);
  }

  build(element) {
    return new Promise((resolve, reject) => {
      this.compiler.run((err, stats) => {
        // fs.writeFileSync('./poop.json', JSON.stringify(stats.toJson(), null, 2));
        if (err) {
          reject(err);
        } else if (stats.hasErrors()) {
          console.log(`what the fuck`);
          reject(stats);
        } else {
          resolve(replaceAssets(stats, element));
        }
      });
    });
  }
}

const bob = new Bob();

async function main() {
  let template = (
    <html>
      <head>
        <title>React Chess</title>
      </head>
      <body>
        <div id='root'></div>
        <Script name={path.resolve(__dirname, "../src/chess.js")} />
      </body>
    </html>
  );
  try {
    template = await bob.build(template);
    console.log(ReactDOM.renderToStaticMarkup(template));
    elementFs.writeFileSync('./dist/index.html', template);
  } catch (err) {
    console.log(err);
  }
}

main();
