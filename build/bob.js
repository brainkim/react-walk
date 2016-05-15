const fs = require('fs');
const path = require('path');

const React = require('react');
const ReactDOM = require('react-dom/server');

const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const webpackNodeExternals = require('webpack-node-externals');

const ReactWalk = require('./react-walk');

// TODO(brian): add propTypes when api stabilizes
function Script() {
  throw new Error(`Bob didn't replace this element, sorry!`);
}

function Link() {
  throw new Error(`Bob didn't replace this element, sorry!`);
}

function Fragment() {
  throw new Error(`Bob didn't replace this element, sorry!`);
}

// webpack utilities
function runCompilerAsync(compiler) {
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
      } else if (stats.hasErrors()) {
        reject(new Error(stats.toString({chunks: false})));
      } else {
        resolve(stats.toJson());
      }
    });
  });
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
  if (stats.children != null) {
    [stats] = stats.children.filter((child) => child.name === 'client');
  }
  const {assetsByChunkName, publicPath} = stats;

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

function replaceFragments(stats, element) {
  if (stats.children != null) {
    [stats] = stats.children.filter((child) => child.name === 'server');
  }
  const {assetsByChunkName} = stats;
  return ReactWalk.postWalk(element, (element) => {
    switch (element.type) {
      case Fragment:
        const assetFilepath = path.join(__dirname, '../server-dist', assetsByChunkName[element.props.name]);
        const component = require(assetFilepath).default;
        const element1 = React.createElement(component);
        const __html = ReactDOM.renderToString(element1); 
        return (
          <div
            id={element.props.id}
            dangerouslySetInnerHTML={{__html}} />
        );
      default:
        return element;
    }
  });
}

function extractAssets(page) {
  return ReactWalk.flatten(page).filter((element) => {
    switch (element.type) {
      case Link:
      case Script:
      case Fragment:
        return true;
    }
  });
}

function createWebpackEntry(page) {
  const assets = extractAssets(page);
  const entry = {};
  assets.forEach((asset) => {
    const {name, entryfile} = asset.props;
    entry[name] = [entryfile];
  });
  return entry;
}

const defaultModule = {
  loaders: [
    {
      test: /\.js$/,
      loader: 'babel-loader',
      include: path.join(__dirname, '../src'),
    },
    {
      test: /\.css$/,
      loader: ExtractTextPlugin.extract('style-loader', 'css-loader'),
    },
    {
      test: /\.svg$/,
      loader: 'file-loader',
      query: {
        name: '[name].[ext]',
      },
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

class Bob {
  constructor() {
    this._cache = {};
  }

  async build(page, outputdir, publicUrl) {
    // read from element tree for assets
    const entry = createWebpackEntry(page);
    const clientOutput = {
      path: outputdir,
      publicPath: publicUrl,
      filename: '[name].[chunkhash].js',
      chunkFilename: '[name].[chunkhash].js',
    };
    const serverOutput = {
      path: path.join(__dirname, '../server-dist/'),
      publicPath: publicUrl,
      filename: '[name].js',
      chunkFilename: '[name].js',
      libraryTarget: 'commonjs2',
    };
    const plugins = [
      new webpack.optimize.OccurrenceOrderPlugin(),
      new ExtractTextPlugin('[name].[contenthash].css'),
    ];
    const module = defaultModule;
    const compiler = webpack([
      {
        name: 'client',
        devtool: null,
        entry,
        output: clientOutput,
        module,
        plugins,
      },
      {
        name: 'server',
        target: 'node',
        entry,
        output: serverOutput,
        externals: [webpackNodeExternals()],
        module,
        plugins,
      },
    ]);

    // write to element tree with compiled assets
    const stats = await runCompilerAsync(compiler);
    page = replaceAssets(stats, page);
    page = replaceFragments(stats, page);
    return page;
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
      <Fragment
        id="root"
        name="app"
        entryfile={path.resolve(__dirname, "../src/components.js")} />
      <Script
        name="chess"
        entryfile={path.resolve(__dirname, "../src/chess.js")} />
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
