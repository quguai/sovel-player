module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "@babel/plugin-transform-unicode-sets-regex",
      "./scripts/babel-native-file-type.cjs",
    ],
  };
};
