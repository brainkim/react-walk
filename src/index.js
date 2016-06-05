import React from 'react'

import fs from 'fs'
import path from 'path'
import ReactDOMServer from 'react-dom/server'

import * as ReactWalk from './react-walk'
import * as components from './components'

function extractAssets(page) {
  return ReactWalk.flatten(page).filter((element) => {
    switch (element.type) {
      case Link:
      case Script:
        return true;
    }
  });
}

// function extractFragments(page) {
//   return ReactWalk.flatten(page).filter((element) => {
//     switch (element.type) {
//       case Fragment:
//         return true;
//     }
//   });
// }

import rimraf from 'rimraf'
import mkdirp from 'mkdirp'

/* webpack utilities
import webpack from 'webpack'
import MemoryFileSystem from 'memory-fs'
import ExtractTextPlugin from 'extract-text-webpack-plugin'
import WebpackNodeExternals from 'webpack-node-externals'

// write to webpack
function getModule(context) {
  const defaultModule = {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
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
}

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


// read from webpack
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

function getNameFromEntryfile(entryfile, context) {
  return path.relative(context, path.resolve(context, entryfile));
}


function createStaticFilesObject(stats) {
  
  // NOTE(brian): example return value as json
  // {
  //   "client": {
  //     "./filename.js": ["0.js", "0.js.map", "0.css", 0.css.map"]
  //   },
  //   "server": {
  //     "./otherfilename.js": ["0.js"]
  //   },
  //   "options": {
  //     "context": "/home/brian/myproject/src",
  //     "publicUrl": "/static/"
  //   }
  // }
  
  const [clientStats] = stats.children.filter((child) => child.name === 'client');
  const [serverStats] = stats.children.filter((child) => child.name === 'server');
  return {
    client: normalizeWebpackStats(clientStats),
    server: normalizeWebpackStats(serverStats),
  };
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
*/

// consequences of that old webpack build
const Module = require('module');
function requireFromString(str, filename) {
  const _module = new Module();
  _module.paths = module.paths;
  _module._compile(str, filename);
  return _module.exports;
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

  getClientCode(pages) {
    const result = {};
    pages.forEach((page) => {
      const assets = extractAssets(page);
      assets.forEach((asset) => {
      });
    });
    return result;
  }

  async compilePage(page) {
    const clientCode = this.getClientCode(page);
    const entries = getEntries(pages);

    this.staticfiles = {
      ...createStaticFilesObject(stats),
      options: this.options,
    };
    this.fs.writeFileSync('/staticfiles.json', JSON.stringify(this.staticfiles, null, 2));
    return this.transformPage(page);
  }

  transformPage(page) {
    page = this.replaceAssets(page);
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
}

const bob = new Bob({
  context: path.join(__dirname, '../../react-chess/src'),
  publicUrl: '/static/',
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
      <Script entryfile="./chess.js" />
    </body>
  </html>
);

export default async function main() {
  const destdir = path.join(__dirname, 'dist/');
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
