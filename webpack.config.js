var path = require('path');
var webpack = require('webpack');

var ExtractTextPlugin = require('extract-text-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  entry: { 
    chess: isProduction
      ? [path.resolve(__dirname, './src/index')]
      : [
        'webpack-dev-server/client?http://localhost:1337',
        'webpack/hot/only-dev-server',
        path.resolve(__dirname, './src/index'),
      ],
  },
  output: {
    path: path.join(__dirname, 'dist'),
    publicPath: '/static',
    filename: isProduction ? '[name].[hash].js' : '[name].js',
  },
  // devtool: "source-map",
  plugins: isProduction
    ? [
      new webpack.DefinePlugin({
        'process.env': {
          'NODE_ENV': JSON.stringify('production')
        }
      }),
      new webpack.optimize.OccurrenceOrderPlugin(true),
      new webpack.optimize.UglifyJsPlugin(),
      new ExtractTextPlugin('[name].css'),
    ]
    : [
      new webpack.HotModuleReplacementPlugin(),
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
