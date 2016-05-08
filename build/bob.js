const path = require('path');
const url = require('url');

const React = require('react');
const ReactDOM = require('react-dom/server');

const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const ReactWalk = require('./react-walk');

Script.propTypes = {
  src: React.PropTypes.string.isRequired,
};
function Script({src}) {
  throw new Error(`Bob didn't replace this element, sorry!`);
}

Link.propTypes = {
  href: React.PropTypes.string.isRequired,
};
function Link({href}) {
  throw new Error(`Bob didn't replace this element, sorry!`);
}

// NOTE(-_-): the value of assetsByChunkName from webpack can be an array (if there are multiple assets like js, css, js.map) or a string (if there is a single asset).
function normalizeAssets(assets) {
  if (Array.isArray(assets)) {
    return assets;
  } else if (typeof assets === 'string') {
    return [assets];
  } else {
    return [];
  }
}

function getAssetURL(assetsByChunkName, publicPath, filename) {
  let {name, ext} = path.parse(filename);
  const assets = normalizeAssets(assetsByChunkName[name]);
  const [asset] = assets.filter((a) => new RegExp(`${ext}$`, 'i').test(a));
  if (asset != null) {
    return `${publicPath}/${asset}`;
  } else {
    throw new Error(`Can't find asset ${filename}`);
  }
}

function replaceAssets(stats, element) {
  const {assetsByChunkName, publicPath} = stats.toJson();
  return ReactWalk.postWalk(element, (element) => {
    switch (element.type) {
      case Link:
        let {href} = element.props;
        href = getAssetURL(assetsByChunkName, publicPath, href);
        return (
          <link {...element.props} href={href} />
        );
      case Script:
        let {src} = element.props;
        src = getAssetURL(assetsByChunkName, publicPath, src);
        return (
          <script {...element.props} src={src} />
        );
      default:
        return element;
    }
  });
}

function extractAssets(element) {
  let assets = ReactWalk.flatten(element).map((element) => {
    switch (element.type) {
      case Link:
        return element.props.href;
      case Script:
        return element.props.src;
    }
  });
  return assets.filter((asset) => asset);
}

function createWebpackEntry(assets, assetdir) {
  const entry = {};
  assets.forEach((asset) => {
    const {name} = path.parse(asset);
    entry[name] = [path.resolve(assetdir, asset)];
  });
  return entry;
}

const fs = require('fs');
const defaultConfig = require('./webpack.config.js')({
  extract: true,
});
class Bob {
  constructor(config=defaultConfig) {
    this.config = config;
  }

  build(element, assetdir, outputdir, publicPath='/static') {
    // read from element tree for assets
    const assets = extractAssets(element);
    const entry = createWebpackEntry(assets, assetdir);
    const output = {
      path: path.join(outputdir, publicPath),
      publicPath,
      filename: '[name].[chunkhash].js',
      chunkFilename: '[name].[chunkhash].js',
    };
    const plugins = [
      new webpack.optimize.OccurrenceOrderPlugin(),
      new ExtractTextPlugin('[name].[contenthash].css'),
    ];
    const compiler = webpack({
      ...this.config,
      context: assetdir,
      entry,
      output,
      plugins,
    });
    // write to element tree with compiled assets
    return new Promise((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) {
          reject(err);
        } else if (stats.hasErrors()) {
          reject(new Error(stats));
        } else {
          resolve(replaceAssets(stats, element));
        }
      });
    });
  }
}

const bob = new Bob();
const template = (
  <html>
    <head>
      <title>React Chess</title>
      <Link rel="stylesheet" type="text/css" href="chess.css" />
    </head>
    <body>
      <div id="root" />
      <Script src="chess.js" />
    </body>
  </html>
);

const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
async function main() {
  const assetdir = path.resolve(__dirname, '../src');
  const destdir = path.resolve(__dirname, '../dist');
  rimraf.sync(destdir);
  const compiledTemplate = await bob.build(template, assetdir, destdir);
  const markup = ReactDOM.renderToStaticMarkup(compiledTemplate);
  console.log(markup);
  fs.writeFileSync(path.resolve(destdir, 'index.html'), markup);
}

main();
