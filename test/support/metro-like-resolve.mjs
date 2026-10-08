// Loads workspace TypeScript sources under node:test the way Metro bundles
// them: package exports with the "react-native" condition (pass
// --conditions=react-native) and extensionless relative specifiers mapped to
// .ts/.tsx. Node strips the types itself, so sources must stay erasable.
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const EXTENSIONS = [".ts", ".tsx"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
    if (isRelative && context.parentURL?.startsWith("file:") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      for (const ext of EXTENSIONS) {
        const url = new URL(specifier + ext, context.parentURL);
        if (existsSync(fileURLToPath(url))) {
          return nextResolve(url.href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
