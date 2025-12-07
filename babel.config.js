module.exports = function (api) {
  api.cache(true)
  return {
    plugins: ['babel-plugin-react-compiler'],
    presets: ['babel-preset-expo'],
  }
}
