module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './',
          },
          extensions: ['.js', '.jsx', '.json'],
        },
      ],
      // Reanimated plugin must be listed last
      'react-native-reanimated/plugin',
    ],
  };
};

