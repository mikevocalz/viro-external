'use strict';

/**
 * Pure edits to a parsed AndroidManifest (the xml2js shape
 * `@expo/config-plugins` reads and writes). Each returns true when it changed
 * the manifest, so running one twice changes nothing the second time.
 *
 * @typedef {{ $?: Record<string, string | undefined>, [key: string]: any }} XmlNode
 * @typedef {{ manifest: XmlNode }} ParsedManifest
 * @typedef {import('./options').ResolvedDetailPanel} ResolvedDetailPanel
 * @typedef {import('./options').ResolvedHorizonSdk} ResolvedHorizonSdk
 */

/**
 * Activity-level meta-data naming the renderer's immersive activity. Must
 * match `IMMERSIVE_ACTIVITY_META` in `@expo-pico/core`
 * (`Context+immersiveActivityName.kt`), whose `enterImmersiveScene()` finds
 * Viro's activity by it once the one-launcher-tile rules rename its intent
 * filter.
 */
const IMMERSIVE_ACTIVITY_META = 'expo.modules.pico.IMMERSIVE_ACTIVITY';

/** The names react-viro's plugin gives its immersive activity. */
const VR_ACTIVITY_NAMES = ['.VRActivity', 'com.viro.core.VRActivity'];

/** Namespace expo-horizon-core uses for `metavr:uses-metavr-sdk`. */
const METAVR_NAMESPACE = 'http://schemas.meta.com/metavr-sdk';
const USES_METAVR_SDK = 'metavr:uses-metavr-sdk';

/**
 * @param {XmlNode | undefined} node
 * @returns {string | undefined}
 */
function nameOf(node) {
  return node?.$?.['android:name'];
}

/**
 * @param {ParsedManifest} manifest
 * @returns {XmlNode[]}
 */
function activitiesOf(manifest) {
  return manifest.manifest.application?.flatMap((/** @type {XmlNode} */ app) => app.activity ?? []) ?? [];
}

/**
 * The detail panel `<activity>`, sized by its `<layout>` element. Its own task
 * affinity makes Horizon OS open it as its own panel beside the main one.
 *
 * @param {ResolvedDetailPanel} panel
 * @returns {XmlNode}
 */
function detailPanelActivityElement(panel) {
  return {
    $: {
      'android:name': panel.activity,
      'android:exported': 'false',
      'android:theme': '@style/AppTheme',
      'android:configChanges':
        'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|smallestScreenSize|density',
      'android:resizeableActivity': 'true',
      'android:excludeFromRecents': 'true',
      'android:taskAffinity': '${applicationId}.panel',
    },
    layout: [{ $: { 'android:defaultWidth': panel.defaultWidth, 'android:defaultHeight': panel.defaultHeight } }],
  };
}

/**
 * Declares the detail panel activity in a flavor manifest.
 *
 * - `mode: "replace"` (quest): writes this plugin's element, replacing any
 *   activity with the same name, so a size change takes effect.
 * - `mode: "keep"` (pico): adds the element only when no activity with that
 *   name exists; `@expo-pico/core` declares its own panel activity there with
 *   PICO-specific attributes.
 *
 * Never invents an `<application>`: the flavor's owner writes it.
 *
 * @param {ParsedManifest} manifest
 * @param {ResolvedDetailPanel} panel
 * @param {'replace' | 'keep'} mode
 * @returns {boolean}
 */
function applyDetailPanelActivity(manifest, panel, mode) {
  const application = manifest.manifest.application?.[0];
  if (!application) return false;
  const before = JSON.stringify(application.activity ?? []);
  /** @type {XmlNode[]} */
  const activities = application.activity ?? [];
  const exists = activities.some((activity) => nameOf(activity) === panel.activity);
  if (mode === 'keep' && exists) return false;
  const next = activities.filter((activity) => nameOf(activity) !== panel.activity);
  next.push(detailPanelActivityElement(panel));
  application.activity = next;
  return JSON.stringify(next) !== before;
}

/**
 * Puts `IMMERSIVE_ACTIVITY_META=true` on Viro's immersive activity and removes
 * it from every other activity, so exactly one activity carries it.
 *
 * @param {ParsedManifest} manifest
 * @returns {boolean}
 */
function markImmersiveActivity(manifest) {
  let changed = false;
  for (const activity of activitiesOf(manifest)) {
    const isImmersive = VR_ACTIVITY_NAMES.includes(nameOf(activity) ?? '');
    /** @type {XmlNode[]} */
    const meta = activity['meta-data'] ?? [];
    const others = meta.filter((entry) => nameOf(entry) !== IMMERSIVE_ACTIVITY_META);
    const marked = meta.filter((entry) => nameOf(entry) === IMMERSIVE_ACTIVITY_META);
    if (isImmersive) {
      if (marked.length === 1 && marked[0]?.$?.['android:value'] === 'true') continue;
      activity['meta-data'] = [...others, { $: { 'android:name': IMMERSIVE_ACTIVITY_META, 'android:value': 'true' } }];
      changed = true;
    } else if (marked.length > 0) {
      if (others.length > 0) activity['meta-data'] = others;
      else delete activity['meta-data'];
      changed = true;
    }
  }
  return changed;
}

/**
 * True when the manifest declares Viro's immersive activity.
 *
 * @param {ParsedManifest} manifest
 * @returns {boolean}
 */
function hasImmersiveActivity(manifest) {
  return activitiesOf(manifest).some((activity) => VR_ACTIVITY_NAMES.includes(nameOf(activity) ?? ''));
}

/**
 * Writes `<metavr:uses-metavr-sdk>` into the quest manifest when it has none.
 * Without it Horizon OS logs "the client's manifest does not specify a minimum
 * HzOS SDK version". An element expo-horizon-core wrote from its own
 * `horizonMinSdkVersion`/`horizonTargetSdkVersion` options is left as it is.
 *
 * @param {ParsedManifest} manifest
 * @param {ResolvedHorizonSdk} sdk
 * @returns {boolean}
 */
function ensureHorizonSdk(manifest, sdk) {
  const root = manifest.manifest;
  if (Array.isArray(root[USES_METAVR_SDK]) && root[USES_METAVR_SDK].length > 0) return false;
  root.$ = { ...(root.$ ?? {}), 'xmlns:metavr': METAVR_NAMESPACE };
  root[USES_METAVR_SDK] = [
    {
      $: {
        'metavr:minSdkVersion': String(sdk.minSdkVersion),
        'metavr:targetSdkVersion': String(sdk.targetSdkVersion),
      },
    },
  ];
  return true;
}

module.exports = {
  IMMERSIVE_ACTIVITY_META,
  METAVR_NAMESPACE,
  USES_METAVR_SDK,
  VR_ACTIVITY_NAMES,
  applyDetailPanelActivity,
  detailPanelActivityElement,
  ensureHorizonSdk,
  hasImmersiveActivity,
  markImmersiveActivity,
};
