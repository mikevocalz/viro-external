// https://github.com/react-native-community/cli/blob/main/docs/dependencies.md
module.exports = {
  dependency: {
    platforms: {
      // Android only. No Apple implementation exists yet, so there is no
      // podspec or Package.swift and iOS autolinking skips this package.
      android: {},
    },
  },
};
