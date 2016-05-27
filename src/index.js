const fs = require('fs');
const path = require('path');

const React = require('react');
const ReactDOMServer = require('react-dom/server');

const webpack = require('webpack');
const MemoryFileSystem = require('memory-fs');

const ExtractTextPlugin = require('extract-text-webpack-plugin');
const WebpackNodeExternals = require('webpack-node-externals');

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
  console.warn(`fragment targeting ${entryfile} was not replaced`);
  return React.createElement(wrapper, {id});
}

// webpack utilities
function runCompilerAsync(compiler) {
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
      } else if (stats.hasErrors()) {
        // NOTE(brian): holy fucking shit webpack
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

function getNameFromEntryfile(entryfile, context) {
  return path.relative(context, path.resolve(context, entryfile));
}

// server-side rendering utils
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

const Module = require('module');
function requireFromString(str, filename) {
  const _module = new Module();
  _module.paths = module.paths;
  _module._compile(str, filename);
  return _module.exports;
}

function copydirSync(fromFs, fromPath, toFs, toPath) {
  const stat = fromFs.statSync(fromPath);
  if (stat.isFile()) {
    toFs.writeFileSync(toPath, fromFs.readFileSync(fromPath));
  } else if (stat.isDirectory()) {
    try {
      toFs.mkdirSync(toPath);
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
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

// webpack normalization functions
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

function normalizeWebpackStats(stats) {
  const {assetsByChunkName} = stats;
  return Object.keys(assetsByChunkName).reduce((normalization, filename) => {
    normalization[filename] = normalizeAssets(assetsByChunkName[filename]);
    return normalization;
  }, {});
}

function createStaticFilesObject(stats) {
  /**
   * example return value as json
   * {
   *   "client": {
   *     "./filename.js": ["0.js", "0.js.map", "0.css", 0.css.map"]
   *   },
   *   "server": {
   *     "./otherfilename.js": ["0.js"]
   *   },
   *   "options": {
   *     "context": "/home/brian/myproject/src",
   *     "publicUrl": "/static/"
   *   }
   * }
   */
  const [clientStats] = stats.children.filter((child) => child.name === 'client');
  const [serverStats] = stats.children.filter((child) => child.name === 'server');
  return {
    client: normalizeWebpackStats(clientStats),
    server: normalizeWebpackStats(serverStats),
  };
}

class Bob {
  constructor(options={}) {
    const defaultOptions = {
      context: process.cwd(),
      publicUrl: '/static/',
    };
    this.options = Object.assign({}, defaultOptions, options);
    this.compiler = null;
    this.fs = null;
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
    const {publicUrl} = this.options;
    const {clientEntry, serverEntry} = this.getEntries([page]);
    let context =  path.resolve(__dirname, '../src');

    this.compiler = webpack([
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
        module: defaultModule,
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
        externals: [WebpackNodeExternals()],
        module: defaultModule,
        plugins: [
          new webpack.BannerPlugin(`require("source-map-support/register");`, {raw: true, entryOnly: false}),
        ],
        target: 'node',
      },
    ]);

    this.fs = this.compiler.outputFileSystem = new MemoryFileSystem();
    const stats = await runCompilerAsync(this.compiler);
    this.staticfiles = {
      ...createStaticFilesObject(stats),
      options: this.options,
    };
    this.fs.writeFileSync('/staticfiles.json', JSON.stringify(this.staticfiles, null, 2));
    return this.transformPage(page);
  }

  transformPage(page) {
    page = this.replaceAssets(page);
    page = this.replaceFragments(page);
    return page;
  }

  replaceAssets(page) {
    const {context, publicUrl} = this.options;
    const {client} = this.staticfiles;
    return ReactWalk.postWalk(page, (elem) => {
      const {entryfile} = elem.props;
      let asset, url, name;
      switch (elem.type) {
        case Link:
          name = getNameFromEntryfile(entryfile, context);
          url = publicUrl + client[entryfile].filter((a) => /\.css$/.test(a))[0];
          return (
            <link {...elem.props} href={url} name={name} />
          );
        case Script:
          name = getNameFromEntryfile(entryfile, context);
          url = publicUrl + client[entryfile].filter((a) => /\.js/.test(a))[0];
          return (
            <script {...elem.props} src={url} name={name} />
          );
        default:
          return elem;
      }
    });
  }

  replaceFragments(page) {
    const {server} = this.staticfiles;
    return ReactWalk.postWalk(page, (elem) => {
      switch (elem.type) {
        case Fragment:
          const {id, wrapper, entryfile, fragmentProps} = elem.props;
          const assetPath = server[entryfile].filter((a) => /\.js/.test(a))[0];
          const assetSrc = this.fs.readFileSync(path.join('/server', assetPath), 'utf8');
          // TODO(brian): how do we require from a string in memory and not have to write sourcemaps to disk???
          let component = requireFromString(assetSrc, entryfile);
          // NOTE(brian): naive check for stupid es6 requires
          if (component.default != null) {
            component = component.default;
          }
          const elem1 = React.createElement(component, fragmentProps);
          return React.createElement(wrapper, {
            id: id,
            dangerouslySetInnerHTML: {__html: ReactDOMServer.renderToString(elem1)},
          });
        default:
          return elem;
      }
    });
  }

  saveCompilationSync(path) {
    copydirSync(this.fs, '/', fs, path);
  }

  static loadCompilationSync(path) {
    const instance = new Bob();
    instance.fs = new MemoryFileSystem();
    copydirSync(fs, path, instance.fs, '/');
    instance.staticfiles = JSON.parse(instance.fs.readFileSync('/staticfiles.json'));
    instance.options = instance.staticfiles.options;
    return instance;
  }

  saveAssetsSync(path) {
    copydirSync(this.fs, '/client', fs, path);
  }
}

const bob = new Bob({
  context: path.join(__dirname, '../src'),
  publicUrl: '/static/',
});

const page = (
  <html>
    <head>
      <title>React Chess</title>
      <Link
        rel="stylesheet"
        type="text/css"
        entryfile={require.resolve('../src/styles/reset.css')} />
    </head>
    <body>
      <Fragment id="root" entryfile={require.resolve('../src/components.js')} />
      <Script entryfile={require.resolve('../src/chess.js')} />
    </body>
  </html>
);

async function main() {
  const destdir = path.join(__dirname, '../dist/');
  const staticdir = path.join(destdir, '/static/');
  rimraf.sync(destdir);
  mkdirp.sync(staticdir);

  const page1 = await bob.compilePage(page);
  console.log(ReactDOMServer.renderToString(page1));

  rimraf.sync('./poop');
  bob.saveAssetsSync(staticdir);
  bob.saveCompilationSync('./poop');

  const bob1 = Bob.loadCompilationSync('./poop');

  fs.writeFileSync(path.resolve(destdir, 'index.html'), ReactDOMServer.renderToStaticMarkup(page1));
}

main();
