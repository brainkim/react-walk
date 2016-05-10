const fs = require('fs');
const path = require('path');

const React = require('react');
const ReactDOM = require('react-dom/server');

const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const ReactWalk = require('./react-walk');

// TODO(brian): add propTypes when api stabilizes
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
  fs.writeFileSync('poop.json', JSON.stringify(stats.toJson(), null, 2));

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

function extractAssetElements(element) {
  return ReactWalk.flatten(element).filter((element) => {
    switch (element.type) {
      case Link:
      case Script:
        return true;
    }
  });
}

function createWebpackEntry(element) {
  const assetElements = extractAssetElements(element);
  const entry = {};
  assetElements.forEach((asset) => {
    const {name, entryfile} = asset.props;
    entry[name] = `babel-loader!${entryfile}`;
  });
  return entry;
}

function createWebpackModule() {
  return {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        include: path.join(__dirname, '../src'),
      },
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract('css-loader'),
      },
      {
        test: /\.svg$/,
        loader: 'file-loader',
      },
      {
        test: /\.pgn$/,
        loader: 'raw-loader',
      },
      {
        test: /\.ohm$/,
        loader: 'raw-loader',
      },
    ],
  };
}

class Bob {
  constructor() {
    this.cache = {};
  }

  build(element, outputdir, publicUrl) {
    // read from element tree for assets
    const entry = createWebpackEntry(element);
    const output = {
      path: outputdir,
      publicPath: publicUrl,
      filename: '[name].[chunkhash].js',
      chunkFilename: '[name].[chunkhash].js',
    };
    const plugins = [
      new webpack.optimize.OccurrenceOrderPlugin(),
      new ExtractTextPlugin('[name].[contenthash].css'),
    ];
    const module = createWebpackModule();
    const compiler = webpack({
      devtool: null,
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

const bob = new Bob({});
const template1 = (
  <html>
    <head>
      <title>React Chess</title>
      <Link
        rel="stylesheet"
        type="text/css"
        name="reset"
        entryfile={path.resolve(__dirname, "../src/styles/reset.css")} />
    </head>
    <body>
      <div id="root" />
      <Script
        name="chess"
        entryfile={path.resolve(__dirname, "../src/chess.js")} />
    </body>
  </html>
);

const template2 = (
  <html>
    <head>
      <title>React Chess</title>
      <Link
        rel="stylesheet"
        type="text/css"
        entryfile={path.join(__dirname, "../src/chess.js")}
        name="chess" />
    </head>
    <body>
      <div id="root" />
      <Script entryfile={path.join(__dirname, "../src/chess2.js")} name="chess" />
    </body>
  </html>
);

const rimraf = require('rimraf');
const mkdirp = require('mkdirp');

async function main() {
  const destdir = path.join(__dirname, '../dist/');
  const staticdir = path.join(destdir, '/static/');
  rimraf.sync(destdir);
  const compiledTemplate = await bob.build(template1, staticdir, '/static/');
  const markup = ReactDOM.renderToStaticMarkup(compiledTemplate);
  console.log(markup);
  fs.writeFileSync(path.resolve(destdir, 'index.html'), markup);
}
 
main();
