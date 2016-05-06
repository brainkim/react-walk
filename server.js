var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var config = require('./build/webpack.config.js');

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
