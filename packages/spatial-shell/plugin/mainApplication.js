'use strict';

/**
 * The New Architecture activity-identity guard in `MainApplication.kt`.
 *
 * react-viro launches its immersive `VRActivity` in a separate task, so
 * `MainActivity.onPause` arrives after `VRActivity.onResume` has already
 * promoted the shared ReactHost, and `ReactHostImpl.onHostPause` sees a
 * different current activity. On a Quest 3S, Enter XR crashed with
 * `AssertionError: Pausing an activity that is not the current activity`.
 * react-viro's `VRLauncherModule` sets the downgrade flag before
 * `startActivity`, but under Expo the pause runs in a coroutine and a
 * per-launch set can land too late; setting it once at startup makes the
 * ordering irrelevant. Ported from `@expo-pico/core`'s
 * `withPicoMainApplication` (expo-pico #45).
 *
 * Extending `ReactNativeNewArchitectureFeatureFlagsDefaults`, not
 * `ReactNativeFeatureFlagsDefaults`, matters: `dangerouslyForceOverride`
 * replaces the provider wholesale, and the plain defaults report
 * `enableBridgelessArchitecture` false, which reverts the app to the bridge
 * and leaves a blank screen with nothing in logcat. The call must come after
 * `loadReactNative(this)`, which maps the JNI the flag accessor needs.
 */

const GUARD_MARKER = '// @viro-external/spatial-shell: activity identity guard';
const GUARD_IMPORTS_MARKER = '// @viro-external/spatial-shell: activity identity guard imports';
const FLAG_NAME = 'skipActivityIdentityAssertionOnHostPause';
const ANCHOR = 'loadReactNative(this)';

const GUARD_BLOCK = [
  `    ${GUARD_MARKER}`,
  '    ReactNativeFeatureFlags.dangerouslyForceOverride(',
  '        object : ReactNativeNewArchitectureFeatureFlagsDefaults() {',
  `          override fun ${FLAG_NAME}(): Boolean = true`,
  '        })',
].join('\n');

const GUARD_IMPORTS = [
  GUARD_IMPORTS_MARKER,
  'import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags',
  'import com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults',
].join('\n');

/**
 * Result of {@link injectActivityIdentityGuard}.
 *
 * @typedef {{ kind: 'injected', contents: string }
 *   | { kind: 'present' }
 *   | { kind: 'no-anchor' }} GuardInjection
 */

/**
 * Adds the guard to a Kotlin `MainApplication` once.
 *
 * - `present`: the file already overrides the flag (this plugin, or
 *   `@expo-pico/core`'s own guard); nothing to do.
 * - `no-anchor`: no `loadReactNative(this)` call to place it after.
 *
 * @param {string} source `MainApplication.kt`.
 * @returns {GuardInjection}
 */
function injectActivityIdentityGuard(source) {
  if (source.includes(FLAG_NAME)) return { kind: 'present' };
  const anchorAt = source.indexOf(ANCHOR);
  if (anchorAt === -1) return { kind: 'no-anchor' };
  const lineEnd = source.indexOf('\n', anchorAt);
  const insertAt = lineEnd === -1 ? source.length : lineEnd + 1;
  let contents = `${source.slice(0, insertAt)}${GUARD_BLOCK}\n${source.slice(insertAt)}`;
  const packageLine = /^package [^\n]+\n/m.exec(contents);
  const importsAt = packageLine ? packageLine.index + packageLine[0].length : 0;
  contents = `${contents.slice(0, importsAt)}\n${GUARD_IMPORTS}\n${contents.slice(importsAt)}`;
  return { kind: 'injected', contents };
}

module.exports = { FLAG_NAME, GUARD_MARKER, injectActivityIdentityGuard };
