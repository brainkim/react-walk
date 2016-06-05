#! /usr/bin/env node
var path = require('path');
var SystemJS = require('systemjs');

System.config({
  transpiler: 'plugin-babel',
  packageConfigPaths: ['node_modules/*/package.json'],
  paths: {
    '*': 'node_modules/*',
  },
  map: {
    'plugin-babel': 'systemjs-plugin-babel/plugin-babel.js',
    'systemjs-babel-build': 'systemjs-plugin-babel/systemjs-babel-node.js',
  },
  meta: {
    '*.js': {
      babelOptions: {
        "presets": [
          'babel-preset-react/index.js',
          // "es2015",
          // "react",
          // "stage-2",
        ],
        "plugins": [
          // "transform-runtime"
        ]
      },
    },
    '*.json': { loader: 'json-plugin' },
  },
});

System.import(path.join(process.cwd(), process.argv[2])).then((module) => {
  console.log(module());
});

process.on('unhandledRejection', function(error, p) {
  console.error(error.stack || error);
  process.exit(1);
});
