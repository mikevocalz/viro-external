import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { VIRO_REVISION } from './check-viro-access.mjs';

/** Read one package manifest; invalid JSON is a validation failure.
 * @param {string} path Repository-relative manifest path.
 * @returns {object} Parsed manifest.
 */
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

// Viro version each pinned fork revision declares in its package.json. Add the
// new SHA here when scripts/ci/check-viro-access.mjs moves the pin.
const VIRO_FORK_VERSIONS = {
  '017d5f8380efdfc88b62812c9c486d199822f6e2': '3.1.0-moyo.0',
  'c6a0dbc3033f50b74aeaba54a10ba768a1f5f275': '3.1.0-moyo.0',
};
// Stock ReactVision releases that must not satisfy the peer range, or npm and
// pnpm pick the registry package over the fork.
const STOCK_VIRO = ['3.0.1', '3.0.2', '3.0.3'];
// Agent instruction files stay in the repo and out of every published tarball.
const AGENT_FILES = new Set(['AGENTS.md', 'CLAUDE.md', 'TASKS.md']);

/** Parse `MAJOR.MINOR.PATCH[-PRERELEASE]`.
 * @param {string} text Version text.
 * @returns {{tuple: number[], pre: string[]}} Parsed version.
 */
function parseVersion(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(text);
  if (!match) throw new Error(`unsupported version "${text}"`);
  return { tuple: match.slice(1, 4).map(Number), pre: match[4] ? match[4].split('.') : [] };
}

/** Compare two parsed versions with semver precedence.
 * @returns {number} Negative, zero or positive.
 */
function compare(a, b) {
  for (let i = 0; i < 3; i += 1) if (a.tuple[i] !== b.tuple[i]) return a.tuple[i] - b.tuple[i];
  if (a.pre.length === 0 || b.pre.length === 0) return b.pre.length - a.pre.length;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i += 1) {
    if (a.pre[i] === undefined) return -1;
    if (b.pre[i] === undefined) return 1;
    const [x, y] = [a.pre[i], b.pre[i]];
    const [nx, ny] = [/^\d+$/.test(x), /^\d+$/.test(y)];
    if (nx && ny && Number(x) !== Number(y)) return Number(x) - Number(y);
    if (nx !== ny) return nx ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** Whether `version` satisfies a single comparator set such as `>=1.2.3-a.0 <2.0.0`,
 * including the npm rule that a prerelease only matches a comparator that has a
 * prerelease on the same MAJOR.MINOR.PATCH.
 * @param {string} version Exact version.
 * @param {string} range Space-separated comparators (no `||`, `^`, `~` or `x`).
 * @returns {boolean} Whether the version satisfies the range.
 */
function satisfies(version, range) {
  const v = parseVersion(version);
  const comparators = range.trim().split(/\s+/).map((part) => {
    const match = /^(>=|<=|>|<|=)?(.+)$/.exec(part);
    return { op: match[1] ?? '=', version: parseVersion(match[2]) };
  });
  const allowed = comparators.every(({ op, version: c }) => {
    const order = compare(v, c);
    return { '>=': order >= 0, '<=': order <= 0, '>': order > 0, '<': order < 0, '=': order === 0 }[op];
  });
  if (!allowed || v.pre.length === 0) return allowed;
  return comparators.some(({ version: c }) => c.pre.length > 0 && c.tuple.every((n, i) => n === v.tuple[i]));
}

/** Find agent instruction files a package's `files` allowlist would publish.
 * @param {string} dir Package directory.
 * @param {string[]} files The manifest's `files` entries.
 * @returns {string[]} Offending package-relative paths.
 */
function publishedAgentFiles(dir, files) {
  const found = [];
  const walk = (rel) => {
    const abs = join(dir, rel);
    if (!existsSync(abs)) return;
    if (statSync(abs).isDirectory()) {
      if (basename(rel) === 'node_modules') return;
      for (const child of readdirSync(abs)) walk(join(rel, child));
    } else if (AGENT_FILES.has(basename(rel))) {
      found.push(rel);
    }
  };
  for (const entry of files) if (!entry.startsWith('!')) walk(entry.replace(/\/$/, ''));
  return found;
}

const viroForkVersion = VIRO_FORK_VERSIONS[VIRO_REVISION];
if (!viroForkVersion) {
  throw new Error(`scripts/ci/check-viro-access.mjs pins Viro ${VIRO_REVISION}; add the version it declares to VIRO_FORK_VERSIONS`);
}
const viroRanges = new Map();
const premium = new Set(['premium', 'media', 'ui', 'viro-external-core', 'pano']);
const forbidden = new Set(['react-native-nitro-modules', 'nitrogen', 'react-native-viro-mux']);
const names = new Set();
// Nitrogen output includes headers from the Nitro that generated it (nightly.120
// added JCallback.hpp), so a package that ships it must not accept an older Nitro.
const nitroPeers = ['react-native-nitro-modules', 'nitro-core'];
let nitroPackages = 0;
for (const entry of readdirSync('packages', { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const path = `packages/${entry.name}/package.json`;
  const pkg = read(path);
  if (!pkg.name || names.has(pkg.name)) throw new Error(`${path}: missing or duplicate package name`);
  names.add(pkg.name);
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies']) {
    for (const [name, version] of Object.entries(pkg[field] ?? {})) {
      if (premium.has(entry.name) && field !== 'devDependencies' && forbidden.has(name)) {
        throw new Error(`${path}: premium runtime graph includes ${name}`);
      }
      if (name === '@reactvision/react-viro' && /2\.(56|57)/.test(version)) {
        throw new Error(`${path}: stale Viro 2 peer/dependency`);
      }
      if (name === '@reactvision/react-viro') viroRanges.set(`${path} ${field}`, version);
    }
  }
  if (!pkg.private) {
    if (!Array.isArray(pkg.files)) throw new Error(`${path}: publishable package needs a files allowlist`);
    const leaked = publishedAgentFiles(`packages/${entry.name}`, pkg.files);
    if (leaked.length > 0) throw new Error(`${path}: files allowlist publishes ${leaked.join(', ')}`);
  }
  if (existsSync(`packages/${entry.name}/nitrogen/generated`)) {
    nitroPackages += 1;
    const pin = pkg.devDependencies?.['react-native-nitro-modules'];
    for (const dep of nitroPeers) {
      if (pkg.devDependencies?.[dep] !== pin || !/^\d+\.\d+\.\d+/.test(pin ?? '')) {
        throw new Error(`${path}: devDependencies.${dep} must pin the same Nitro as react-native-nitro-modules`);
      }
      if (pkg.peerDependencies?.[dep] !== `>=${pin}`) {
        throw new Error(`${path}: peerDependencies.${dep} must be >=${pin}, the Nitro its generated code needs`);
      }
      if (pkg.peerDependenciesMeta?.[dep]?.optional !== true) {
        throw new Error(`${path}: ${dep} must stay an optional peer`);
      }
    }
  }
}
const distinctViroRanges = new Set(viroRanges.values());
if (distinctViroRanges.size !== 1) {
  throw new Error(`every @reactvision/react-viro range must match; found ${[...viroRanges].map(([where, range]) => `${where}: ${range}`).join('; ')}`);
}
const [viroRange] = distinctViroRanges;
if (!satisfies(viroForkVersion, viroRange)) {
  throw new Error(`@reactvision/react-viro range "${viroRange}" rejects the pinned fork ${viroForkVersion}`);
}
for (const stock of STOCK_VIRO) {
  if (satisfies(stock, viroRange)) {
    throw new Error(`@reactvision/react-viro range "${viroRange}" accepts stock ReactVision ${stock}, so installs can pick it over the fork`);
  }
}
if (/^---$/m.test(readFileSync('pnpm-lock.yaml', 'utf8'))) {
  throw new Error('pnpm-lock.yaml must be a single YAML document');
}
if (nitroPackages === 0) throw new Error('no package has nitrogen/generated; the Nitro peer check ran on nothing');
console.log(`${names.size} unique package manifests checked; premium runtime manifests are Nitro/Mux-free; ${nitroPackages} Nitro packages peer on their pinned Nitro.`);
console.log(`${viroRanges.size} @reactvision/react-viro entries use "${viroRange}", which accepts fork ${viroForkVersion} and rejects stock ${STOCK_VIRO.join(', ')}; no files allowlist publishes ${[...AGENT_FILES].join(', ')}.`);
