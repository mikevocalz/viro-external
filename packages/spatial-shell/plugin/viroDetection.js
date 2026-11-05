'use strict';

const fs = require('fs');
const path = require('path');

const VIRO_PACKAGE = '@reactvision/react-viro';

/**
 * @typedef {{ plugins?: unknown[], _internal?: Record<string, unknown> }} PluginConfig
 */

/**
 * The npm package a string plugin entry belongs to, or undefined.
 *
 * @param {string} entry
 * @param {string} projectRoot
 * @returns {string | undefined}
 */
function pluginPackageName(entry, projectRoot) {
  if (!entry.startsWith('.') && !path.isAbsolute(entry)) {
    const parts = entry.split('/');
    return entry.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  }
  let dir = path.resolve(projectRoot, entry);
  while (dir !== path.dirname(dir)) {
    const manifest = path.join(dir, 'package.json');
    if (fs.existsSync(manifest)) {
      try {
        return JSON.parse(fs.readFileSync(manifest, 'utf8')).name;
      } catch {
        return undefined;
      }
    }
    dir = path.dirname(dir);
  }
  return undefined;
}

/**
 * react-viro's config plugin function as the project resolves it, or undefined.
 *
 * @param {string} projectRoot
 * @returns {unknown}
 */
function viroPluginFunction(projectRoot) {
  try {
    const mod = require(require.resolve(`${VIRO_PACKAGE}/app.plugin.js`, { paths: [projectRoot] }));
    return mod.default ?? mod;
  } catch {
    return undefined;
  }
}

/**
 * True when `@reactvision/react-viro` is one of the app's config plugins,
 * which means the app has Viro's immersive `VRActivity` sharing the
 * ReactHost. Matches the package name, a subpath, a relative or absolute path
 * into the package, and the plugin function itself. Ported from
 * `@expo-pico/core`'s `usesViroVrActivity` (expo-pico #45).
 *
 * @param {PluginConfig} config
 * @returns {boolean}
 */
function usesViroVrActivity(config) {
  const root = config._internal?.projectRoot;
  const projectRoot = typeof root === 'string' ? root : process.cwd();
  return (config.plugins ?? []).some((entry) => {
    const plugin = Array.isArray(entry) ? entry[0] : entry;
    if (typeof plugin === 'string') return pluginPackageName(plugin, projectRoot) === VIRO_PACKAGE;
    if (typeof plugin === 'function') return plugin === viroPluginFunction(projectRoot);
    return false;
  });
}

module.exports = { VIRO_PACKAGE, usesViroVrActivity };
