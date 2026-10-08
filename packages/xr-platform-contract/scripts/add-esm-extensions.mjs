// The source uses extensionless relative specifiers ("./ui") because Metro
// cannot map "./ui.js" to ui.ts, and React Native apps bundle src/ directly.
// Node's ESM loader needs the extension, so the ESM build in dist/ gets ".js"
// appended to every extensionless relative specifier. dist/cjs is left alone:
// require("./ui") resolves without an extension.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dist = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../dist");
const specifier = /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']+?)\2/g;

let rewritten = 0;
for (const name of readdirSync(dist)) {
  if (!name.endsWith(".js") && !name.endsWith(".d.ts")) continue;
  const file = path.join(dist, name);
  const before = readFileSync(file, "utf8");
  const after = before.replace(specifier, (match, lead, quote, target) => {
    if (path.extname(target) !== "") return match;
    rewritten += 1;
    return `${lead}${quote}${target}.js${quote}`;
  });
  if (after !== before) writeFileSync(file, after);
}
console.log(`add-esm-extensions: rewrote ${rewritten} relative specifiers in dist/`);
