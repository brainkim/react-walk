import fs from 'fs';

import React, { Component } from 'react';
import ReactDOM from 'react-dom/server';

import { Set } from 'immutable';

import webpack from 'webpack';
import config from './webpack.config';

function WebpackScript ({assetName}) {
  throw new Error('ReactWebpack did not have a replace this element');
}

function extractScripts(tree) {
  var scripts = [];
  React.Children.forEach(tree.props.children, (child) => {
    if (child.type === WebpackScript) {
      scripts.push(child);
    }
    if (child.props != null && child.props.children != null) {
      scripts = scripts.concat(extractScripts(child));
    }
  });
  return scripts;
}

function replaceScripts(statsMap, tree) {
  if (tree.type === WebpackScript) {
    const {assetName, configFilepath} = tree.props;
    const stats =  statsMap[configFilepath];
    const assets = stats.assetsByChunkName[assetName];
    if (assets == null) {
      return <script />
    } else if (Array.isArray(assets)) {
      const src = assets.filter(a => /\.js$/i.test(a))[0];
      return <script src={src} />
    } else if (typeof assets === 'string') {
      return <script src={assets} />
    }
  } else {
    return React.cloneElement(tree, {...tree.props}, React.Children.map(tree.props.children, (child) => {
      if (React.isValidElement(child)) {
        return replaceScripts(statsMap, child);
      } else {
        return null;
      }
    }));
  }
}
import path from 'path';

const compilerCache = {};
const statsCache = {};
class ReactWebpack {
  static async run(tree, callback) {
    try {
      let configFilepaths = extractScripts(tree).map((script) => {
        return path.resolve(script.props.configFilepath);
      });

      configFilepaths = Set(configFilepaths).toJS();
      configFilepaths.forEach((filepath) => {
        if (compilerCache[filepath] != null) {
          return compilerCache[filepath];
        } else {
          const compiler = webpack(require(filepath));
          compilerCache[filepath] = compiler;
          return compiler;
        }
      });

      const statsPromises = configFilepaths.map((filepath) => {
        return new Promise((resolve, reject) => { 
          if (statsCache[filepath] != null) {
            resolve(statsCache[filepath]);
          } else {
            const compiler = compilerCache[filepath];
            compiler.run((err, stats) => {
              if (err) {
                reject(err);
              } else {
                // NOTE(-_-): who the hell names a method 'toJson' when it returns a javascript object
                stats = stats.toJson();
                statsCache[filepath] = stats;
                resolve(statsCache[filepath]);
              }
            });
          }
        });
      });

      await Promise.all(statsPromises);
      if (callback != null) {
        callback(null, replaceScripts(statsCache, tree));
      }

      return replaceScripts(statsCache, tree);
    } catch (err) {
      callback(err, null);
      throw err;
    }
  }
}

function main() {
  const template = (
    <html>
      <head>
        <title>React Chess</title>
        <style></style>
      </head>
      <body>
        <div id='root'></div>
        <WebpackScript
          assetName="chess"
          configFilepath={path.resolve(__dirname, './webpack.config.js')} />
      </body>
    </html>
  );
  ReactWebpack.run(template, (err, tree) => {
    if (err) {
      console.log(err);
    }
    console.log(ReactDOM.renderToStaticMarkup(tree));
    ReactWebpack.run(template).then((tree) => {
      console.log(ReactDOM.renderToStaticMarkup(tree));
    }, (err) => {
      console.log(err);
    });
  });
}

main();

// import express from 'express';
// const app = express();
// 
// app.use('/', function(req, res) {
//   console.log('hi');
//   res.send(main());
// });
// 
// app.listen(3000);
