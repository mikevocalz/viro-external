import { existsSync, readFileSync, readdirSync } from 'node:fs';

/** Read one package manifest; invalid JSON is a validation failure.
 * @param {string} path Repository-relative manifest path.
 * @returns {object} Parsed manifest.
 */
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
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
    }
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
if (/^---$/m.test(readFileSync('pnpm-lock.yaml', 'utf8'))) {
  throw new Error('pnpm-lock.yaml must be a single YAML document');
}
if (nitroPackages === 0) throw new Error('no package has nitrogen/generated; the Nitro peer check ran on nothing');
console.log(`${names.size} unique package manifests checked; premium runtime manifests are Nitro/Mux-free; ${nitroPackages} Nitro packages peer on their pinned Nitro.`);
