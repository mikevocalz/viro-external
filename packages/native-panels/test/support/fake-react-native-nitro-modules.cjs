// Stand-in for react-native-nitro-modules: a registry of hybrid classes
// that tests fill through globalThis.__fakeNitro.classes.
globalThis.__fakeNitro = globalThis.__fakeNitro || { classes: new Map() };

exports.NitroModules = {
  hasHybridClass(name) {
    return globalThis.__fakeNitro.classes.has(name);
  },
  getHybridClass(name) {
    const value = globalThis.__fakeNitro.classes.get(name);
    if (value === undefined) throw new Error(`Hybrid class "${name}" is not registered`);
    return value;
  },
};
