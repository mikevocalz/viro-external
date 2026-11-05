#!/usr/bin/env node
// @ts-check
/**
 * viro-spatial-shell-doctor: fails a headset build that would render a bottom
 * tab bar or no rail.
 *
 *   viro-spatial-shell-doctor [projectRoot] [--json] [--allow-tab-navigator]
 *
 * Reads the prebuilt `android/` project and the app's sources. Exit code 1
 * when any check fails. The shell's own layout rule (a headset never gets the
 * tab bar) is covered by the package's unit tests; this checks that an app
 * actually uses the shell and that the config plugin ran. A project with no quest or pico flavor and no Viro
 * immersive activity is a phone-only build and passes.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { placeQuestFlavorBeforeQuestDependencies } = require('../plugin/gradle.js');
const { FLAG_NAME } = require('../plugin/mainApplication.js');
const { IMMERSIVE_ACTIVITY_META, USES_HORIZONOS_SDK, USES_METAVR_SDK, VR_ACTIVITY_NAMES } = require('../plugin/manifest.js');
const { PICO_PANEL_ACTIVITY } = require('../plugin/options.js');

const SHELL_PACKAGE = '@viro-external/spatial-shell';
const SOURCE_DIRS = ['app', 'src'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const TAB_NAVIGATORS = [
  /from\s+["']@react-navigation\/bottom-tabs["']/,
  /from\s+["']expo-router\/unstable-native-tabs["']/,
  /import\s*\{[^}]*\bTabs\b[^}]*\}\s*from\s+["']expo-router["']/,
];
const SHELL_IMPORT = /import\s*\{[^}]*\bSpatialShell\b[^}]*\}\s*from\s+["']@viro-external\/spatial-shell["']/;

/**
 * @typedef {{ status: 'pass' | 'fail' | 'warn', name: string, detail: string }} Check
 */

/**
 * The `<activity>` elements of a manifest as raw text, keyed by name.
 *
 * @param {string} xml
 * @returns {Map<string, string>}
 */
function activities(xml) {
  /** @type {Map<string, string>} */
  const found = new Map();
  const pattern = /<activity\b[\s\S]*?(?:\/>|<\/activity>)/g;
  for (const match of xml.matchAll(pattern)) {
    const name = /android:name="([^"]+)"/.exec(match[0])?.[1];
    if (name !== undefined) found.set(name, match[0]);
  }
  return found;
}

/**
 * Files under `dir` whose extension is in `extensions`, skipping
 * `node_modules` and dot directories.
 *
 * @param {string} dir
 * @param {ReadonlySet<string>} extensions
 * @returns {string[]}
 */
function filesUnder(dir, extensions) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...filesUnder(full, extensions));
    else if (extensions.has(path.extname(entry))) files.push(full);
  }
  return files;
}

/**
 * @param {string} file
 * @returns {string | undefined}
 */
function readIfExists(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

/**
 * @param {string} androidDir
 * @returns {string | undefined}
 */
function findMainApplication(androidDir) {
  const javaRoot = path.join(androidDir, 'app', 'src', 'main', 'java');
  return filesUnder(javaRoot, new Set(['.kt', '.java'])).find((file) => /MainApplication\.(kt|java)$/.test(file));
}

/**
 * @param {string} projectRoot
 * @param {{ allowTabNavigator: boolean }} flags
 * @returns {Promise<Check[]>}
 */
export async function runDoctor(projectRoot, flags) {
  /** @type {Check[]} */
  const checks = [];
  const androidDir = path.join(projectRoot, 'android');
  const src = path.join(androidDir, 'app', 'src');
  const mainXml = readIfExists(path.join(src, 'main', 'AndroidManifest.xml'));
  const questXml = readIfExists(path.join(src, 'quest', 'AndroidManifest.xml'));
  const picoXml = readIfExists(path.join(src, 'pico', 'AndroidManifest.xml'));

  if (mainXml === undefined) {
    checks.push({ status: 'fail', name: 'android project', detail: `${androidDir} has no app manifest; run expo prebuild` });
    return checks;
  }
  const mainActivities = activities(mainXml);
  const vrActivity = VR_ACTIVITY_NAMES.map((name) => mainActivities.get(name)).find((text) => text !== undefined);
  const flavors = [questXml === undefined ? undefined : 'quest', picoXml === undefined ? undefined : 'pico'].filter(
    (flavor) => flavor !== undefined
  );
  if (flavors.length === 0 && vrActivity === undefined) {
    checks.push({ status: 'pass', name: 'headset build', detail: 'no quest or pico flavor and no Viro VRActivity: phone-only' });
    return checks;
  }
  checks.push({
    status: 'pass',
    name: 'headset build',
    detail: `flavors: ${flavors.join(', ') || 'none'}; Viro VRActivity: ${vrActivity === undefined ? 'no' : 'yes'}`,
  });

  try {
    createRequire(path.join(projectRoot, 'package.json')).resolve(`${SHELL_PACKAGE}/package.json`);
    checks.push({ status: 'pass', name: 'shell installed', detail: `${SHELL_PACKAGE} resolves from the project` });
  } catch {
    checks.push({
      status: 'fail',
      name: 'shell installed',
      detail: `${SHELL_PACKAGE} is not installed, so nothing guarantees the rail. Add it to the app's dependencies.`,
    });
  }

  if (vrActivity !== undefined) {
    const marked = vrActivity.includes(`android:name="${IMMERSIVE_ACTIVITY_META}"`);
    checks.push({
      status: marked ? 'pass' : 'fail',
      name: 'immersive activity marker',
      detail: marked
        ? 'Viro VRActivity carries the immersive marker'
        : 'Viro VRActivity has no immersive marker: the spatial-shell plugin did not run (check android.spatialShell)',
    });
    const appFile = findMainApplication(androidDir);
    const guarded = appFile !== undefined && readFileSync(appFile, 'utf8').includes(FLAG_NAME);
    checks.push({
      status: guarded ? 'pass' : 'fail',
      name: 'activity identity guard',
      detail: guarded
        ? `${path.relative(projectRoot, appFile)} keeps ${FLAG_NAME} on`
        : `MainApplication does not override ${FLAG_NAME}; entering XR can crash`,
    });
  }

  if (questXml !== undefined) {
    const declaresSdk = [questXml, mainXml].some((xml) =>
      [USES_METAVR_SDK, USES_HORIZONOS_SDK].some((element) => xml.includes(`<${element}`))
    );
    checks.push({
      status: declaresSdk ? 'pass' : 'fail',
      name: 'Horizon OS SDK',
      detail: declaresSdk
        ? 'the quest build declares a Horizon OS SDK version'
        : `neither ${USES_METAVR_SDK} nor ${USES_HORIZONOS_SDK} is declared: the spatial-shell plugin did not run`,
    });
    const panel = [...activities(questXml).values()].find((text) => /<layout\b[^>]*android:defaultWidth=/.test(text));
    checks.push({
      status: panel === undefined ? 'warn' : 'pass',
      name: 'detail panel (quest)',
      detail:
        panel === undefined
          ? `no sized panel activity in the quest manifest; detail opens as a pushed screen (install @expo-pico/core for ${PICO_PANEL_ACTIVITY})`
          : 'the quest manifest declares a sized detail panel activity',
    });
  }

  const gradle = readIfExists(path.join(androidDir, 'app', 'build.gradle'));
  if (gradle !== undefined) {
    const ordered = placeQuestFlavorBeforeQuestDependencies(gradle) === gradle;
    checks.push({
      status: ordered ? 'pass' : 'fail',
      name: 'quest flavor order',
      detail: ordered
        ? 'no quest* dependency comes before the quest flavor'
        : 'a quest* dependency comes before the quest flavor declaration; Gradle cannot resolve questImplementation',
    });
  }

  const files = SOURCE_DIRS.flatMap((dir) => filesUnder(path.join(projectRoot, dir), SOURCE_EXTENSIONS));
  const sources = files.map((file) => ({ file, text: readFileSync(file, 'utf8') }));
  const shellUser = sources.find(({ text }) => SHELL_IMPORT.test(text));
  checks.push({
    status: shellUser === undefined ? 'fail' : 'pass',
    name: 'rail rendered',
    detail:
      shellUser === undefined
        ? `no file under ${SOURCE_DIRS.join('/, ')}/ renders <SpatialShell>; a headset build would have no rail`
        : `${path.relative(projectRoot, shellUser.file)} renders <SpatialShell>`,
  });
  const tabUsers = sources.filter(({ text }) => TAB_NAVIGATORS.some((pattern) => pattern.test(text)));
  if (tabUsers.length > 0) {
    checks.push({
      status: flags.allowTabNavigator ? 'warn' : 'fail',
      name: 'no bottom tab navigator',
      detail:
        `${tabUsers.map(({ file }) => path.relative(projectRoot, file)).join(', ')} use a bottom tab navigator, which ` +
        'draws a tab bar on headsets. Use <SpatialShell>, which shows its tab bar on phones only ' +
        '(--allow-tab-navigator if it is gated off headsets).',
    });
  }
  return checks;
}

async function main() {
  const args = process.argv.slice(2);
  const projectRoot = path.resolve(args.find((arg) => !arg.startsWith('--')) ?? process.cwd());
  const checks = await runDoctor(projectRoot, { allowTabNavigator: args.includes('--allow-tab-navigator') });
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ projectRoot, checks }, null, 2)}\n`);
  } else {
    for (const check of checks) process.stdout.write(`${check.status.toUpperCase().padEnd(4)}  ${check.name}: ${check.detail}\n`);
  }
  process.exitCode = checks.some((check) => check.status === 'fail') ? 1 : 0;
}

if (process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  await main();
}
