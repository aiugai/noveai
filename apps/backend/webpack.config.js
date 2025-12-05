const path = require('node:path')
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin')
const nodeExternals = require('webpack-node-externals')
const CopyPlugin = require('copy-webpack-plugin')

module.exports = {
  entry: './src/main.ts',
  target: 'node',
  externals: [nodeExternals()],
  output: {
    path: path.resolve(__dirname, '../../dist/backend'),
    filename: 'main.js',
  },
  resolve: {
    extensions: ['.js', '.json', '.ts'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
  },
  plugins: [
    new webpack.IgnorePlugin({
      checkResource(resource) {
        const lazyImports = [
          '@nestjs/microservices',
          '@nestjs/websockets/socket-module',
          'cache-manager',
          'class-validator',
          'class-transformer',
        ]
        if (!lazyImports.includes(resource)) {
          return false
        }
        try {
          require.resolve(resource)
        } catch (err) {
          return true
        }
        return false
      },
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'src/modules/ai.model/utils/tokenizers/**/*.model',
          to: 'src/modules/ai.model/utils/tokenizers/[name][ext]',
        },
        {
          from: 'src/modules/ai.model/utils/tokenizers/**/*.json',
          to: 'src/modules/ai.model/utils/tokenizers/[name][ext]',
        },
      ],
    }),
  ],
}
