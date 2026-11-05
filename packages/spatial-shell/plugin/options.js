'use strict';

/**
 * Options of the `@viro-external/spatial-shell/plugin` config plugin.
 *
 * @typedef {'QUEST' | 'PICO'} HeadsetPlatform
 *
 * @typedef {object} DetailPanelOptions
 * @property {string} [activity] Fully qualified panel activity class.
 *   Default `expo.modules.pico.PicoPanelActivity` from `@expo-pico/core`.
 * @property {string} [defaultWidth] Panel width as `"<n>dp"`, 384-1440dp. Default `"420dp"`.
 * @property {string} [defaultHeight] Panel height as `"<n>dp"`, different from the width. Default `"600dp"`.
 *
 * @typedef {object} HorizonSdkOptions
 * @property {number} [minSdkVersion] Oldest Meta VR OS SDK the app needs. Default 207.
 * @property {number} [targetSdkVersion] Meta VR OS SDK behavior the app targets. Default 209.
 *
 * @typedef {object} SpatialShellPluginOptions
 * @property {HeadsetPlatform[]} [platforms] Headset flavors to configure. `withViro` passes the
 *   QUEST and PICO entries of `android.xRMode`. Default `['QUEST']`.
 * @property {DetailPanelOptions | false} [detailPanel] The detail panel activity. `false` skips it.
 * @property {HorizonSdkOptions | false} [horizonSdk] `metavr:uses-metavr-sdk` in the quest
 *   manifest when no other plugin wrote one. `false` skips it.
 * @property {boolean} [immersiveActivityMarker] Mark Viro's `.VRActivity` with
 *   `expo.modules.pico.IMMERSIVE_ACTIVITY`. Default true.
 * @property {boolean} [activityIdentityGuard] Keep
 *   `skipActivityIdentityAssertionOnHostPause` on in `MainApplication.kt`. Default true.
 *
 * @typedef {object} ResolvedDetailPanel
 * @property {string} activity
 * @property {string} defaultWidth
 * @property {string} defaultHeight
 * @property {number} widthDp
 * @property {number} heightDp
 *
 * @typedef {object} ResolvedHorizonSdk
 * @property {number} minSdkVersion
 * @property {number} targetSdkVersion
 *
 * @typedef {object} ResolvedSpatialShellOptions
 * @property {HeadsetPlatform[]} platforms
 * @property {ResolvedDetailPanel | null} detailPanel
 * @property {ResolvedHorizonSdk | null} horizonSdk
 * @property {boolean} immersiveActivityMarker
 * @property {boolean} activityIdentityGuard
 */

/** `@expo-pico/core`'s panel activity: a second surface on the app's one ReactHost. */
const PICO_PANEL_ACTIVITY = 'expo.modules.pico.PicoPanelActivity';

/** Meta's documented width range for a second activity panel. */
const PANEL_WIDTH_RANGE_DP = Object.freeze({ min: 384, max: 1440 });

/** The detail panel size expo-pico #45 ran on a Quest 3S and a PICO 4 Ultra. */
const DEFAULT_DETAIL_PANEL = Object.freeze({
  activity: PICO_PANEL_ACTIVITY,
  defaultWidth: '420dp',
  defaultHeight: '600dp',
});

/**
 * 207 is the first Meta VR OS SDK that reads the declaration; 209 is the SDK
 * the expo-pico example ran on (Quest 3S, 2026-11-04).
 */
const DEFAULT_HORIZON_SDK = Object.freeze({ minSdkVersion: 207, targetSdkVersion: 209 });

const HEADSET_PLATFORMS = new Set(['QUEST', 'PICO']);

/**
 * @param {string} field
 * @param {unknown} value
 * @returns {number}
 */
function parseDp(field, value) {
  const match = /^(\d+(?:\.\d+)?)dp$/.exec(String(value));
  if (!match) {
    throw new Error(
      `[@viro-external/spatial-shell] detailPanel.${field} must look like "420dp", got ${JSON.stringify(value)}.`
    );
  }
  return Number(match[1]);
}

/**
 * @param {DetailPanelOptions | false | undefined} value
 * @returns {ResolvedDetailPanel | null}
 */
function resolveDetailPanel(value) {
  if (value === false) return null;
  const merged = { ...DEFAULT_DETAIL_PANEL, ...(value ?? {}) };
  if (typeof merged.activity !== 'string' || !/^[A-Za-z_][\w]*(\.[A-Za-z_][\w]*)+$/.test(merged.activity)) {
    throw new Error(
      `[@viro-external/spatial-shell] detailPanel.activity must be a fully qualified class name, got ${JSON.stringify(
        merged.activity
      )}.`
    );
  }
  const widthDp = parseDp('defaultWidth', merged.defaultWidth);
  const heightDp = parseDp('defaultHeight', merged.defaultHeight);
  if (widthDp < PANEL_WIDTH_RANGE_DP.min || widthDp > PANEL_WIDTH_RANGE_DP.max) {
    throw new Error(
      `[@viro-external/spatial-shell] detailPanel.defaultWidth ${widthDp}dp is outside Meta's ` +
        `${PANEL_WIDTH_RANGE_DP.min}-${PANEL_WIDTH_RANGE_DP.max}dp panel range.`
    );
  }
  if (widthDp === heightDp) {
    throw new Error(
      `[@viro-external/spatial-shell] the detail panel is ${widthDp}x${heightDp}dp. PICO OS 5 ignores a square ` +
        'launch size; make width and height differ.'
    );
  }
  return {
    activity: merged.activity,
    defaultWidth: merged.defaultWidth,
    defaultHeight: merged.defaultHeight,
    widthDp,
    heightDp,
  };
}

/**
 * @param {HorizonSdkOptions | false | undefined} value
 * @returns {ResolvedHorizonSdk | null}
 */
function resolveHorizonSdk(value) {
  if (value === false) return null;
  const merged = { ...DEFAULT_HORIZON_SDK, ...(value ?? {}) };
  for (const key of /** @type {const} */ (['minSdkVersion', 'targetSdkVersion'])) {
    if (!Number.isInteger(merged[key]) || merged[key] < 1) {
      throw new Error(
        `[@viro-external/spatial-shell] horizonSdk.${key} must be a positive integer, got ${JSON.stringify(merged[key])}.`
      );
    }
  }
  if (merged.targetSdkVersion < merged.minSdkVersion) {
    throw new Error(
      `[@viro-external/spatial-shell] horizonSdk.targetSdkVersion ${merged.targetSdkVersion} is below ` +
        `minSdkVersion ${merged.minSdkVersion}.`
    );
  }
  return { minSdkVersion: merged.minSdkVersion, targetSdkVersion: merged.targetSdkVersion };
}

/**
 * Validates options and fills defaults.
 *
 * @param {SpatialShellPluginOptions | undefined} [options]
 * @returns {ResolvedSpatialShellOptions}
 * @throws {Error} When a platform is not QUEST or PICO, a size is not a dp
 *   string, the panel width is outside 384-1440dp, the panel is square, or an
 *   SDK version is not a positive integer.
 */
function resolveSpatialShellOptions(options = {}) {
  const platforms = [...new Set(options.platforms ?? ['QUEST'])];
  for (const platform of platforms) {
    if (!HEADSET_PLATFORMS.has(platform)) {
      throw new Error(
        `[@viro-external/spatial-shell] platforms only takes "QUEST" and "PICO", got ${JSON.stringify(platform)}.`
      );
    }
  }
  return {
    platforms: /** @type {HeadsetPlatform[]} */ (platforms),
    detailPanel: resolveDetailPanel(options.detailPanel),
    horizonSdk: resolveHorizonSdk(options.horizonSdk),
    immersiveActivityMarker: options.immersiveActivityMarker !== false,
    activityIdentityGuard: options.activityIdentityGuard !== false,
  };
}

module.exports = {
  DEFAULT_DETAIL_PANEL,
  DEFAULT_HORIZON_SDK,
  PANEL_WIDTH_RANGE_DP,
  PICO_PANEL_ACTIVITY,
  resolveSpatialShellOptions,
};
