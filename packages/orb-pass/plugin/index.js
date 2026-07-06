// @viro-external/orb-pass — Expo config plugin
//
// Appends an `add_subdirectory(orb-pass/native)` line to the app CMakeLists
// that splat-pass's plugin generates. Must run AFTER splat-pass so the base
// CMakeLists exists.
//
// Order dependency: splat-pass's plugin regenerates the file from scratch;
// this plugin post-processes it. If a future refactor makes splat-pass and
// orb-pass independent, this must be revisited.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

function ensureOrbPassSubdirectory(projectRoot) {
  const jniDir = path.join(projectRoot, 'android/app/src/main/jni');
  const cmakePath = path.join(jniDir, 'CMakeLists.txt');
  if (!fs.existsSync(cmakePath)) {
    throw new Error(
      '@viro-external/orb-pass plugin: ' + cmakePath + ' not found. ' +
      'Ensure @viro-external/splat-pass plugin runs before orb-pass in app.json plugins list.'
    );
  }
  let cmake = fs.readFileSync(cmakePath, 'utf8');
  if (cmake.includes('orb-pass/native')) return;
  cmake += `\nadd_subdirectory(\n  \${CMAKE_CURRENT_SOURCE_DIR}/../../../../../node_modules/@viro-external/orb-pass/native\n  orb_pass_build\n)\n`;
  fs.writeFileSync(cmakePath, cmake);
}

module.exports = function withOrbPass(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      ensureOrbPassSubdirectory(cfg.modRequest.projectRoot);
      return cfg;
    },
  ]);
};
