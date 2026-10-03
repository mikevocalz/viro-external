# Consumer Babel / Expo notes

TypeGPU + Worklets require build-time configuration in the consuming Expo/React Native app.

Use Bundle Mode for Worklets and forward TypeGPU modules according to current TypeGPU documentation.

Conceptually:

```js
const workletsPluginOptions = {
  bundleMode: true,
  strictGlobal: true,
  importForwarding: {
    moduleNames: ["typegpu"],
    relativePaths: ["src/spatial-gpu"],
  },
};

module.exports = {
  presets: ["babel-preset-expo"],
  plugins: [
    "unplugin-typegpu/babel",
    ["react-native-worklets/plugin", workletsPluginOptions],
  ],
};
```

React Native WebGPU requires a native development build; it is not an Expo Go feature. Put any native setup in config plugins/CNG-safe configuration.
