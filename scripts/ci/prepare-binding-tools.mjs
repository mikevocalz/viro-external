import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

if (process.argv.length !== 3) throw new Error('Usage: node prepare-binding-tools.mjs <isolated-directory>');
const pkg = JSON.parse(readFileSync('packages/react-native-viro-mux/package.json', 'utf8'));
const dependencies = {};
// No workspace install and no Viro checkout: the generator only needs these
// registry packages. Install scripts are disabled by the workflow caller.
for (const name of ['nitrogen', 'react-native-nitro-modules', 'typescript']) {
  const version = pkg.devDependencies?.[name];
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`${name} must use an exact registry version`);
  }
  dependencies[name] = version;
}
const directory = resolve(process.argv[2]);
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, 'package.json'), JSON.stringify({
  name: 'viro-binding-verification-tools', version: '0.0.0', private: true, dependencies,
}, null, 2) + '\n');
