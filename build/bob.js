const path = require('path');
const url = require('url');

const React = require('react');
const ReactDOM = require('react-dom/server');

const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const ReactWalk = require('./react-walk');

function Script() {
  throw new Error(`Bob didn't replace this element, sorry!`);
}

function Link() {
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

function getAssetURL(assetsByChunkName, publicPath, name, ext) {
  const assets = normalizeAssets(assetsByChunkName[name]);
  const [asset] = assets.filter((a) => new RegExp(`\.${ext}$`, 'i').test(a));
  if (asset != null) {
    return `${publicPath}${asset}`;
  } else {
    // throw new Error(`Can't find asset ${filename}`);
    return null;
  }
}

function replaceAssets(stats, element) {
  const {assetsByChunkName, publicPath} = stats.toJson();
  return ReactWalk.postWalk(element, (element) => {
    switch (element.type) {
      case Link:
        const href = getAssetURL(assetsByChunkName, publicPath, element.props.name, 'css');
        return (
          <link {...element.props} href={href} />
        );
      case Script:
        const src = getAssetURL(assetsByChunkName, publicPath, element.props.name, 'js');
        return (
          <script {...element.props} src={src} />
        );
      default:
        return element;
    }
  });
}

function extractAssets(element) {
  return ReactWalk.flatten(element).filter((element) => {
    switch (element.type) {
      case Link:
      case Script:
        return true;
    }
  });
}

function createWebpackEntry(assets) {
  const entry = {};
  assets.forEach((asset) => {
    const {name, entryfile} = asset.props;
    entry[name] = [entryfile];
  });
  return entry;
}

function createWebpackModule({cssExtractor}) {
  return {
    loaders: [
      {
        test: /\.js$/,
        loaders: ['babel-loader'],
        include: path.join(__dirname, '../src'),
      },
      {
        test: /\.css$/,
        loader: cssExtractor.extract('style-loader', 'css-loader'),
      },
      {
        test: /\.svg$/,
        loaders: ['file-loader'],
      },
      {
        test: /\.pgn$/,
        loaders: ['raw-loader'],
      },
      {
        test: /\.ohm$/,
        loaders: ['raw-loader'],
      },
    ],
  };
}

const fs = require('fs');
const defaultConfig = require('./webpack.config.js')({
  extract: true,
});
class Bob {
  constructor(config=defaultConfig) {
    this.config = config;
  }

  build(element, outputdir, publicPath='/static/') {
    // read from element tree for assets
    const assets = extractAssets(element);
    const entry = createWebpackEntry(assets);
    console.log(entry);
    const output = {
      path: path.join(outputdir, publicPath),
      publicPath,
      filename: '[name].[chunkhash].js',
      chunkFilename: '[name].[chunkhash].js',
    };
    const cssExtractor = new ExtractTextPlugin('css', '[name].[contenthash].css');
    const plugins = [
      new webpack.optimize.OccurrenceOrderPlugin(),
      cssExtractor,
    ];
    const module = createWebpackModule({
      cssExtractor,
    });
    const compiler = webpack({
      ...this.config,
      entry,
      output,
      plugins,
      module,
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
      <Link
        rel="stylesheet"
        type="text/css"
        entryfile={path.resolve(__dirname, "../src/styles/reset.css")}
        name="reset" />
    </head>
    <body>
      <div id="root" />
      <Script entryfile={path.resolve(__dirname, "../src/chess.js")} name="chess" />
    </body>
  </html>
);

const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
async function main() {
  const destdir = path.resolve(__dirname, '../dist');
  rimraf.sync(destdir);
  const compiledTemplate = await bob.build(template, destdir);
  const markup = ReactDOM.renderToStaticMarkup(compiledTemplate);
  console.log(markup);
  fs.writeFileSync(path.resolve(destdir, 'index.html'), markup);
}

main();
