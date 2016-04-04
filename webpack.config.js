var path = require('path');
var webpack = require('webpack');

module.exports = {
  devtool: 'eval',
  entry: [
    'webpack-dev-server/client?http://localhost:1337',
    'webpack/hot/only-dev-server',
    './src/index'
  ],
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/static/'
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin()
  ],
  module: {
    loaders: [
      {
        test: /\.js$/,
        loaders: ['react-hot', 'babel'],
        include: path.join(__dirname, 'src'),
      },
      {
        test: /\.svg$/,
        loaders: ['url-loader'],
      },
      {
        test: /\.pgn$/,
        loaders: ['raw-loader'],
      },
      {
        test: /\.ohm$/,
        loaders: ['raw-loader'],
      },
    ]
  },
  devtool: "source-map",
};
