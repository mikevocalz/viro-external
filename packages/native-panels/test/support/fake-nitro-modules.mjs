// Resolves `react-native-nitro-modules` to a fake under node:test, so the
// generated `#nitro/*` runtime and resolveWhiteboardRendererFactory can load
// without React Native. Tests control it through globalThis.__fakeNitro.
import { registerHooks } from "node:module";

const fake = new URL("./fake-react-native-nitro-modules.cjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "react-native-nitro-modules") return { url: fake, format: "commonjs", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
