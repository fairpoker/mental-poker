const path = require('path');

module.exports = {
  entry: [
    path.resolve(__dirname, 'index.js'),
    path.resolve(__dirname, 'styles.scss'),
  ],
  output: {
    path: path.resolve(__dirname, '..', 'public', 'dist'),
    publicPath: '/',
    filename: 'bundle.js',
  },
  module: {
    rules: [{
      test: /\.(js|jsx)$/,
      include: __dirname,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: [
            [
              '@babel/preset-env',
              {
                useBuiltIns: 'usage',
                targets: 'last 1 version, > 1%, not ie <= 11, not dead',
              },
            ],
            '@babel/preset-react',
          ],
        },
      },
    }, {
      test: /\.scss$/,
      use: [
        {
          loader: 'file-loader',
          options: {
            name: 'styles/[name].css',
          },
        },
        {
          loader: 'extract-loader',
        },
        {
          loader: 'css-loader?-url',
        },
        {
          loader: 'postcss-loader',
        },
        {
          loader: 'sass-loader',
        },
      ],
    }],
  },
  watch: process.env.NODE_ENV !== 'production',
  watchOptions: {
    ignored: /node_modules/,
  },
};
