require('babel-register');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const config = require('./build/webpack.config.js')({
  extract: false,
});

new WebpackDevServer(webpack(config), {
  stats: 'errors-only',
  publicPath: config.output.publicPath,
  hot: true,
  historyApiFallback: true
}).listen(1337, 'localhost', function (err, result) {
  if (err) {
    return console.log(err);
  }
  console.log('Listening at http://localhost:1337/');
});
