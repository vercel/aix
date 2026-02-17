module.exports = function (api) {
  api.cache(true)
  return {
    plugins: ['babel-plugin-react-compiler', 'react-native-worklets/plugin'],
    presets: ['babel-preset-expo'],
  }
}
