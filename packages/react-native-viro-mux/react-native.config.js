// https://github.com/react-native-community/cli/blob/main/docs/dependencies.md
module.exports = {
  dependency: {
    platforms: {
      // iOS native module lands later (Metal/IOSurface path) — no podspec yet,
      // so iOS autolinking skips this package entirely.
      android: {},
    },
  },
};
