module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { 
        reanimated: false  // Disable auto-loading reanimated plugin
      }]
    ],
    plugins: []
  };
};
