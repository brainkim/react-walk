#! /usr/bin/env node
require('babel-register');
var path = require('path');

require(path.join(process.cwd(), process.argv[2]));

process.on('unhandledRejection', function(error, p) {
  console.error(error.stack || error);
  process.exit(1);
});
