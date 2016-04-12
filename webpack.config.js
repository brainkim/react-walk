var path = require('path');
var webpack = require('webpack');

var ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
  entry: { 
    chess: [
      'webpack-dev-server/client?http://localhost:1337',
      'webpack/hot/only-dev-server',
      path.resolve(__dirname, './src/index'),
    ],
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    publicPath: '/static/',
  },
  devtool: "source-map",
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new ExtractTextPlugin('[name].css'),
  ],
  module: {
    loaders: [
      {
        test: /\.js$/,
        loaders: ['react-hot', 'babel'],
        include: path.join(__dirname, 'src'),
      },
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract('style-loader', 'css-loader'),
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
};
