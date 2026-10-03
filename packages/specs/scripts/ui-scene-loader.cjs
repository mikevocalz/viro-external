/**
 * Loads a TSX scene file in Node so its JSX can be mapped to the portable
 * scene. TypeScript and JSX go through Babel. Native-only modules resolve to
 * a stub whose exports are inert components, because the mapper reads
 * elements and props and never renders them.
 */
"use strict";
const fs = require("node:fs");
const Module = require("node:module");
const babel = require("@babel/core");

const NATIVE = /^(react-native(\/|$)|react-native-|@reactvision\/|expo(-|\/|$)|@expo\/|@shopify\/|nitro-|react-native-nitro)/;

function stubComponent(name) {
  const component = () => null;
  component.displayName = name;
  return component;
}

const stub = new Proxy(
  {},
  {
    get(target, key) {
      if (key === "__esModule") return true;
      if (typeof key !== "string") return undefined;
      if (!(key in target)) {
        // Registries such as ViroMaterials are called as objects; give them no-op methods.
        target[key] = new Proxy(stubComponent(key), {
          get: (fn, prop) => (prop in fn ? fn[prop] : () => undefined),
        });
      }
      return target[key];
    },
  }
);

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (NATIVE.test(request)) return stub;
  return originalLoad.call(this, request, parent, isMain);
};

const transform = (source, filename) =>
  babel.transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    presets: [[require.resolve("@babel/preset-typescript"), { isTSX: true, allExtensions: true }]],
    plugins: [
      [require.resolve("@babel/plugin-transform-react-jsx"), { runtime: "classic" }],
      require.resolve("@babel/plugin-transform-modules-commonjs"),
    ],
  }).code;

for (const ext of [".ts", ".tsx"]) {
  Module._extensions[ext] = function compile(module, filename) {
    module._compile(transform(fs.readFileSync(filename, "utf8"), filename), filename);
  };
}

module.exports = { loadScene: (file) => require(file) };
