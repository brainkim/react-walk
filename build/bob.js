const fs = require('fs');
const path = require('path');

const React = require('react');
const ReactDOM = require('react-dom/server');

const webpack = require('webpack');
const MemoryFileSystem = require('memory-fs');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const webpackNodeExternals = require('webpack-node-externals');

const ReactWalk = require('./react-walk');

const rimraf = require('rimraf');
const mkdirp = require('mkdirp');

// TODO(brian): add propTypes when api stabilizes
function Script() {
  throw new Error(`Bob didn't replace this element, sorry!`);
}

function Link() {
  throw new Error(`Bob didn't replace this element, sorry!`);
}

Fragment.defaultProps = {
  wrapper: 'div',
};
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
        // TODO(brian):
        reject(new Error(stats.toString({
          assets: false,
          chunks: false,
        })));
      } else {
        resolve(stats.toJson());
      }
    });
  });
}

// NOTE(-_-): the value of assetsByChunkName from webpack can be an array (if there are multiple assets like js, css, js.map) or a string (if there is a single asset).
function normalizeAssets(assets) {
  if (typeof assets === 'string') {
    return [assets];
  } else if (Array.isArray(assets)) {
    return assets;
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

const Module = require('module');
function requireFromString(str, filename) {
  const _module = new Module();
  _module.paths = module.paths;
  _module._compile(str, filename);
  return _module.exports;
}

function replaceFragments(fs, stats, element) {
  if (stats.children != null) {
    [stats] = stats.children.filter((child) => child.name === 'server');
  }
  const {assetsByChunkName} = stats;
  return ReactWalk.postWalk(element, (element) => {
    switch (element.type) {
      case Fragment:
        const {id, name, wrapper, entryfile, ...props} = element.props;
        const assetFilepath = path.join('/server', assetsByChunkName[name]);
        const assetSrc = fs.readFileSync(assetFilepath, 'utf8');
        require('fs').writeFileSync('poop.js', assetSrc);

        let component = requireFromString(assetSrc, entryfile);
        if (component.default != null) {
          component = component.default;
        }
        const element1 = React.createElement(component, props);
        return React.createElement(wrapper, {
          id: id,
          dangerouslySetInnerHTML: {__html: ReactDOM.renderToString(element1)},
        });
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
        return true;
    }
  });
}

function extractFragments(page) {
  return ReactWalk.flatten(page).filter((element) => {
    switch (element.type) {
      case Fragment:
        return true;
    }
  });
}

function createWebpackClientEntry(page) {
  const assets = extractAssets(page);
  const entry = {};
  assets.forEach((asset) => {
    const {name, entryfile} = asset.props;
    entry[name] = [entryfile];
  });
  return entry;
}

function createWebpackServerEntry(page) {
  const fragments = extractFragments(page);
  const entry = {};
  fragments.forEach((fragment) => {
    const {name, entryfile} = fragment.props;
    entry[name] = [entryfile];
  });
  return entry;
}

function copydirSync(fromFs, fromPath, toFs, toPath) {
  const stat = fromFs.statSync(fromPath);
  if (stat.isFile()) {
    toFs.writeFileSync(toPath, fromFs.readFileSync(fromPath));
  } else if (stat.isDirectory()) {
    mkdirp.sync(toPath);
    fromFs.readdirSync(fromPath).forEach((dir) => {
      copydirSync(
        fromFs, path.join(fromPath, dir),
        toFs, path.join(toPath, dir)
      );
    });
  }
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
    const clientOutput = {
      path: '/client',
      publicPath: publicUrl,
      filename: '[name].[chunkhash].js',
      chunkFilename: '[name].[chunkhash].js',
    };
    const serverOutput = {
      path: '/server',
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
        entry: createWebpackClientEntry(page),
        output: clientOutput,
        module,
        plugins,
      },
      {
        name: 'server',
        devtool: null,
        entry: createWebpackServerEntry(page),
        output: serverOutput,
        externals: [webpackNodeExternals()],
        module,
        plugins,
        target: 'node',
      },
    ]);
    console.time('jewels');
    const compilerFs = compiler.outputFileSystem = new MemoryFileSystem();

    // write to element tree with compiled assets
    const stats = await runCompilerAsync(compiler);
    console.timeEnd('jewels');

    copydirSync(compilerFs, '/client', fs, outputdir);
    page = replaceAssets(stats, page);
    page = replaceFragments(compilerFs, stats, page);
    return page;
  }
}

const bob = new Bob();
const template1 = (
  <html>
    <head>
      <title>React Chess</title>
      <Link
        rel="stylesheet"
        type="text/css"
        name="styles/reset"
        entryfile={path.resolve(__dirname, "../src/styles/reset.css")} />
    </head>
    <body>
      <Fragment
        id="root"
        name="app"
        entryfile={path.resolve(__dirname, "../src/components.js")} />
      <Script
        name="chess"
        async={true}
        entryfile={path.resolve(__dirname, "../src/chess.js")} />
    </body>
  </html>
);

async function main() {
  const destdir = path.join(__dirname, '../dist/');
  const staticdir = path.join(destdir, '/static/');
  rimraf.sync(destdir);
  const compiledTemplate = await bob.build(template1, staticdir, '/static/');
  const markup = ReactDOM.renderToStaticMarkup(compiledTemplate);
  fs.writeFileSync(path.resolve(destdir, 'index.html'), markup);
}
 
main();
