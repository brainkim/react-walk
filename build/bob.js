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

// custom components
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
function Fragment(props) {
  const {wrapper, id, entryfile} = props;
  // TODO(-_-): warn about lack of replacement
  console.warn(`fragment targeting ${entryfile} was not replaced`);
  return React.createElement(wrapper, {id});
}

// webpack utilities
function runCompilerAsync(compiler) {
  return new Promise((resolve, reject) => {
    // NOTE(brian): jesus christ how do I get a sane error message from webpack
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
      } else if (stats.hasErrors()) {
        // NOTE(brian): whyyyyyy webpack
        reject(new Error('\n'+stats.toString({
          assets: false,
          version: false,
          timings: false,
          hash: false,
          children: true,
          chunks: false,
          chunkModules: false,
          errors: true,
          errorDetails: true,
          warnings: true,
          reasons: false,
          colors: true,
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

function getNameFromEntryfile(entryfile, context) {
  return path.relative(context, path.resolve(context, entryfile));
}

function getAsset(assetsByChunkName, entryfile, ext, context) {
  const assets = normalizeAssets(assetsByChunkName[entryfile]);
  return assets.filter((a) => new RegExp(`${ext}$`, 'i').test(a))[0];
}

function replaceAssets(stats, context, element) {
  if (stats.children != null) {
    [stats] = stats.children.filter((child) => child.name === 'client');
  }
  const {assetsByChunkName, publicPath} = stats;

  return ReactWalk.postWalk(element, (element) => {
    const {entryfile} = element.props;
    let name;
    switch (element.type) {
      case Link:
        const href = publicPath + getAsset(assetsByChunkName, entryfile, '.css', context);
        name = getNameFromEntryfile(entryfile, context);
        return (
          <link {...element.props} href={href} name={name} />
        );
      case Script:
        const src = publicPath + getAsset(assetsByChunkName, entryfile, '.js', context);
        name = getNameFromEntryfile(entryfile, context);
        return (
          <script {...element.props} src={src} name={name} />
        );
      default:
        return element;
    }
  });
}

// server-side rendering utils
const Module = require('module');

function requireFromString(str, filename) {
  const _module = new Module();
  _module.paths = module.paths;
  _module._compile(str, filename);
  return _module.exports;
}

function registerSourceMaps(fs, stats) {
  if (stats.children != null) {
    [stats] = stats.children.filter((child) => child.name === 'server');
  }
  const {assetsByChunkName} = stats;
  // TODO(brian): how to register source maps?
  // require('source-map-support').install({
  //   retrieveSourceMap: function(source) {
  //     return null;
  //   },
  // });
}

function replaceFragments(stats, fs, element) {
  if (stats.children != null) {
    [stats] = stats.children.filter((child) => child.name === 'server');
  }
  const {assetsByChunkName} = stats;
  return ReactWalk.postWalk(element, (element) => {
    switch (element.type) {
      case Fragment:
        const {id, wrapper, entryfile, fragmentProps} = element.props;
        const asset = getAsset(assetsByChunkName, entryfile, '.js');
        const assetSrc = fs.readFileSync(path.join('/server', asset), 'utf8');
        let component = requireFromString(assetSrc, entryfile);
        if (component.default != null) {
          component = component.default;
        }
        const element1 = React.createElement(component, fragmentProps);
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

function copydirSync(fromFs, fromPath, toFs, toPath) {
  const stat = fromFs.statSync(fromPath);
  if (stat.isFile()) {
    toFs.writeFileSync(toPath, fromFs.readFileSync(fromPath));
  } else if (stat.isDirectory()) {
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

class WebpackBackend {
  serializeToPath(path) {
    return new Promise((resolve, reject) => {
    });
  }
}

const defaultOptions = {
  context: process.cwd(),
  publicUrl: '/static/',
  module: defaultModule,
  compilerBackend: new WebpackBackend(),
};

class Bob {
  constructor(options={}) {
    this.options = Object.assign({}, defaultOptions, options);
  }

  getEntries(pages) {
    const {context} = this.options;

    const clientEntry = pages.reduce((entry, page) => {
      const assets = extractAssets(page);
      assets.forEach((asset) => {
        const {entryfile} = asset.props;
        entry[entryfile] = [entryfile];
      });
      return entry;
    }, {});
    const serverEntry = pages.reduce((entry, page) => {
      const fragments = extractFragments(page);
      fragments.forEach((fragment) => {
        const {entryfile} = fragment.props;
        entry[entryfile] = [entryfile];
      });
      return entry;
    }, {});
    return {clientEntry, serverEntry};
  }

  async compilePage(page) {
    const {publicUrl, module} = this.options;
    const {clientEntry, serverEntry} = this.getEntries([page]);
    let context =  path.resolve(__dirname, '../src');
    console.log(context);

    const compiler = webpack([
      {
        context,
        name: 'client',
        devtool: 'source-map',
        entry: clientEntry,
        output: {
          path: '/client',
          publicPath: publicUrl,
          filename: '[id].js',
          chunkFilename: '[id].js',
        },
        module,
        plugins: [
          new webpack.optimize.OccurrenceOrderPlugin(),
          new ExtractTextPlugin('[id].css'),
        ],
      },
      {
        context,
        name: 'server',
        devtool: 'source-map',
        entry: serverEntry,
        output: {
          path: '/server',
          publicPath: publicUrl,
          filename: '[id].js',
          chunkFilename: '[id].js',
          libraryTarget: 'commonjs2',
        },
        externals: [webpackNodeExternals()],
        module,
        plugins: [
          new webpack.BannerPlugin(`require("source-map-support/register");`, {raw: true, entryOnly: false}),
        ],
        target: 'node',
      },
    ]);

    const compilerFs = compiler.outputFileSystem = new MemoryFileSystem();
    this.stats = await runCompilerAsync(compiler);
    this.compilerFs = compilerFs;
    page = this.replaceAssets(page);
    page = this.replaceFragments(page);
    return page;
  }

  replaceAssets(page) {
    const {context} = this.options;
    return replaceAssets(this.stats, context, page);
  }

  replaceFragments(page) {
    return replaceFragments(this.stats, this.compilerFs, page);
  }

  writeAssetsSync(destdir) {
    copydirSync(this.compilerFs, '/client', fs, destdir);
  }

  saveCompilationSync(path) {
    this.compilerBackend.serializeTo(path);
    copydirSync(this.compilerFs, '/', fs, path);
  }
}

const bob = new Bob({});

const page = (
  <html>
    <head>
      <title>React Chess</title>
      <Link
        rel="stylesheet"
        type="text/css"
        entryfile={'./styles/reset.css'} />
    </head>
    <body>
      <Fragment id="root" entryfile={'./chess.js'} />
      <Script entryfile={'./chess.js'} />
    </body>
  </html>
);

async function main() {
  const destdir = path.join(__dirname, '../dist/');
  const staticdir = path.join(destdir, '/static/');
  rimraf.sync(destdir);
  mkdirp.sync(staticdir);

  const page1 = await bob.compilePage(page);

  fs.writeFileSync(path.resolve(destdir, 'index.html'), ReactDOM.renderToStaticMarkup(page1));
  bob.writeAssetsSync(staticdir);
}
 
main();
