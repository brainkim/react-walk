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
function Fragment(props) {
  const {wrapper, id, entryfile} = props;
  // TODO(-_-): warn about lack of replacement
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

function getNameFromEntryfile(entryfile, context) {
  const relative = path.relative(context, path.resolve(context, entryfile));
  const {dir, name} = path.parse(relative);
  return path.join(dir, name);
}

function getAsset(assetsByChunkName, entryfile, ext, context) {
  const name = getNameFromEntryfile(entryfile, context);
  const assets = normalizeAssets(assetsByChunkName[name]);
  const [asset] = assets.filter((a) => new RegExp(`${ext}$`, 'i').test(a));
  return asset;
}

function replaceAssets(stats, element, context) {
  if (stats.children != null) {
    [stats] = stats.children.filter((child) => child.name === 'client');
  }
  const {assetsByChunkName, publicPath} = stats;

  return ReactWalk.postWalk(element, (element) => {
    const {entryfile} = element.props;
    let name;
    switch (element.type) {
      case Link:
        name = getNameFromEntryfile(entryfile, context);
        const href = publicPath + getAsset(assetsByChunkName, entryfile, '.css', context);
        return (
          <link {...element.props} href={href} name={name} />
        );
      case Script:
        name = getNameFromEntryfile(entryfile, context);
        const src = publicPath + getAsset(assetsByChunkName, entryfile, '.js', context);
        return (
          <script {...element.props} src={src} name={name} />
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

function replaceFragments(fs, stats, element, context) {
  if (stats.children != null) {
    [stats] = stats.children.filter((child) => child.name === 'server');
  }
  const {assetsByChunkName} = stats;
  return ReactWalk.postWalk(element, (element) => {
    switch (element.type) {
      case Fragment:
        const {id, wrapper, entryfile, fragmentProps} = element.props;
        const asset = getAsset(assetsByChunkName, entryfile, '.js', context);
        const assetSrc = fs.readFileSync(path.join('/server', asset), 'utf8');
        require('fs').writeFileSync('poop.js', assetSrc)
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

function createWebpackClientEntry(page, context) {
  const assets = extractAssets(page);
  const entry = {};
  assets.forEach((asset) => {
    const {entryfile} = asset.props;
    const name = getNameFromEntryfile(entryfile, context);
    entry[name] = [entryfile];
  });
  return entry;
}

function createWebpackServerEntry(page, context) {
  const fragments = extractFragments(page);
  const entry = {};
  fragments.forEach((fragment) => {
    const {entryfile} = fragment.props;
    const name = getNameFromEntryfile(entryfile, context);
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

const defaultOptions = {
  context: process.cwd(),
  publicUrl: '/static/',
  module: defaultModule,
};

class Bob {
  constructor(options={}) {
    this.options = Object.assign({}, defaultOptions, options);
    this.pages = new Map();
  }

  setPage(name, page) {
    this.pages.set(name, page);
  }

  getPage(name) {
    return this.pages.get(name);
  }

  getCompiledPage(name) {
    const {context} = this.options;
    let page = this.getPage(name);
    page = replaceAssets(this.stats, page, context);
    return page;
  }

  async compile() {
    const {context, publicUrl, module} = this.options;
    const {clientEntry, serverEntry} = this.getEntries();
    const compiler = webpack([
      {
        context,
        name: 'client',
        devtool: null,
        entry: clientEntry,
        output: {
          path: '/client',
          publicPath: publicUrl,
          filename: '[name].js',
        },
        module,
        plugins: [
          new webpack.optimize.OccurrenceOrderPlugin(),
          new ExtractTextPlugin('[name].css'),
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
          filename: '[name].js',
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
    const stats = await runCompilerAsync(compiler);
    this.stats = stats;
    this.compilerFs = compilerFs;
    return {stats, compilerFs};
  }

  getEntries() {
    const {context} = this.options;
    const pages = Array.from(this.pages.values());
    const clientEntry = pages.reduce((entry, page) => {
      const assets = extractAssets(page);
      assets.forEach((asset) => {
        const {entryfile} = asset.props;
        const name = getNameFromEntryfile(entryfile, context);
        entry[name] = [entryfile];
      });
      return entry;
    }, {});
    const serverEntry = pages.reduce((entry, page) => {
      const fragments = extractFragments(page);
      fragments.forEach((fragment) => {
        const {entryfile} = fragment.props;
        const name = getNameFromEntryfile(entryfile, context);
        entry[name] = [entryfile];
      });
      return entry;
    }, {});
    return {clientEntry, serverEntry};
  }
}

const bob = new Bob({
  context: path.join(__dirname, '../src'),
});

const page = (
  <html>
    <head>
      <title>React Chess</title>
      <Link
        rel="stylesheet"
        type="text/css"
        entryfile="./styles/reset.css" />
    </head>
    <body>
      <Fragment id="root" entryfile="./components.js" />
      <Script entryfile="./chess.js" />
    </body>
  </html>
);

async function main() {
  const destdir = path.join(__dirname, '../dist/');
  const staticdir = path.join(destdir, '/static/');
  rimraf.sync(destdir);

  bob.setPage('home', page);
  await bob.compile();

  let compiledTemplate = bob.getCompiledPage('home');
  // compiledTemplate = replaceFragments(bob.compilerFs, bob.stats, compiledTemplate, bob.options.context);
  console.log(ReactDOM.renderToStaticMarkup(compiledTemplate));
  // fs.writeFileSync(path.resolve(destdir, 'index.html'), compiledTemplate);
}
 
main();
