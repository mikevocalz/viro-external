const { withAndroidManifest, withAppBuildGradle } = require('@expo/config-plugins');

const DEFAULT_VERSION = '1.0.0';
const VALID_MODULES = new Set([
  'core',
  'camera',
  'display',
  'inputs',
  'motion',
  'mockdevice',
  'speech',
]);

function normalizeModules(modules) {
  const requested = modules && modules.length ? modules : [
    'core', 'camera', 'display', 'inputs', 'motion', 'speech'
  ];
  const unique = [...new Set(requested)];
  for (const name of unique) {
    if (!VALID_MODULES.has(name)) {
      throw new Error(`@viro-external/meta-wearables: unknown DAT module ${name}`);
    }
  }
  if (!unique.includes('core')) unique.unshift('core');
  return unique;
}

function addDependencies(contents, modules, version) {
  const lines = modules.map(
    (name) => `    implementation "com.meta.wearable:mwdat-${name}:${version}"`
  );
  const missing = lines.filter((line) => !contents.includes(line.trim()));
  if (!missing.length) return contents;
  const match = /dependencies\s*\{/.exec(contents);
  if (!match) {
    throw new Error('@viro-external/meta-wearables: Android app build.gradle has no dependencies block');
  }
  const insertAt = match.index + match[0].length;
  return contents.slice(0, insertAt) + '\n' + missing.join('\n') + contents.slice(insertAt);
}

function setMetaData(app, name, value) {
  if (!app['meta-data']) app['meta-data'] = [];
  const existing = app['meta-data'].find((m) => m.$?.['android:name'] === name);
  if (existing) {
    existing.$['android:value'] = String(value);
    return;
  }
  app['meta-data'].push({
    $: { 'android:name': name, 'android:value': String(value) },
  });
}

module.exports = function withMetaWearables(config, props = {}) {
  const version = props.version || DEFAULT_VERSION;
  const modules = normalizeModules(props.modules);

  config = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addDependencies(cfg.modResults.contents, modules, version);
    return cfg;
  });

  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (!app) return cfg;
    if (!props.applicationId) {
      throw new Error(
        '@viro-external/meta-wearables: applicationId is required (Wearables Developer Center application ID)'
      );
    }
    setMetaData(app, 'com.meta.wearable.mwdat.APPLICATION_ID', props.applicationId);
    if (typeof props.analyticsOptOut === 'boolean') {
      setMetaData(app, 'com.meta.wearable.mwdat.ANALYTICS_OPT_OUT', props.analyticsOptOut);
    }
    if (typeof props.crashReportingOptOut === 'boolean') {
      setMetaData(app, 'com.meta.wearable.mwdat.CRASH_REPORTING_OPT_OUT', props.crashReportingOptOut);
    }
    return cfg;
  });

  return config;
};
