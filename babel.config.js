module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: { '@': './src' },
        },
      ],
      // Must be listed last — react-native-reanimated requirement.
      'react-native-reanimated/plugin',
    ],
  };
};
