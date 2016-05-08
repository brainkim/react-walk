var path = require('path');
var webpack = require('webpack');

var ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = function createWebpackConfig({extract=false, production=false}) {
  return {
    entry: {
      'chess': [
        'webpack-dev-server/client?http://localhost:1337',
        'webpack/hot/only-dev-server',
        path.resolve(__dirname, '../src/chess'),
      ],
    },
    output: {
      path: path.join(__dirname, '../dist/static/'),
      publicPath: '/static',
      filename: production ? '[name].[chunkhash].js' : '[name].js',
    },
    devtool: "source-map",
    plugins: [
      new ExtractTextPlugin('[name].[contenthash].css', {
        disable: !extract,
      }),
      new webpack.optimize.OccurrenceOrderPlugin(),
      new webpack.HotModuleReplacementPlugin(),
    ],
    module: {
      loaders: [
        {
          test: /\.js$/,
          loaders: ['react-hot-loader', 'babel-loader'],
          include: path.join(__dirname, '../src'),
        },
        {
          test: /\.css$/,
          loader: extract
            ? ExtractTextPlugin.extract('style-loader', 'css-loader')
            : 'style-loader!css-loader',
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
      ],
    },
  }
};
