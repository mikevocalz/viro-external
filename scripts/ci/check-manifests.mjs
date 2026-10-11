import { readFileSync, readdirSync } from 'node:fs';

/** Read one package manifest; invalid JSON is a validation failure.
 * @param {string} path Repository-relative manifest path.
 * @returns {object} Parsed manifest.
 */
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const premium = new Set(['premium', 'media', 'ui', 'viro-external-core', 'pano']);
const forbidden = new Set(['react-native-nitro-modules', 'nitrogen', 'react-native-viro-mux']);
const names = new Set();
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
}
if (/^---$/m.test(readFileSync('pnpm-lock.yaml', 'utf8'))) {
  throw new Error('pnpm-lock.yaml must be a single YAML document');
}
console.log(`${names.size} unique package manifests checked; premium runtime manifests are Nitro/Mux-free.`);
