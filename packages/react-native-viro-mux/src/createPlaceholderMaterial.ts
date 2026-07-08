import { ViroMaterials } from "@reactvision/react-viro";

/**
 * 1×1 transparent PNG, base64-encoded — the smallest legal diffuseTexture.
 *
 * Per virocore issue #436, registering a material with no diffuseTexture can
 * crash on first run. Always seed with this placeholder before the native swap.
 */
const ONE_BY_ONE_TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const registered = new Set<string>();

/**
 * Registers a Viro material called `name` with a 1×1 transparent placeholder
 * diffuseTexture. Safe to call multiple times — idempotent per name.
 *
 * cullMode "None": the SAME material feeds both the flat/curved panel mesh
 * and the inward-facing 360 sphere (which needs a scaleY −1 V-flip that
 * reverses triangle winding) — double-sided keeps both paths visible.
 */
export function createPlaceholderMaterial(name: string): void {
  if (registered.has(name)) return;
  ViroMaterials.createMaterials({
    [name]: {
      cullMode: "None",
      // Opaque bucket: video must sort BEFORE alpha chrome on nearby planes —
      // the default Alpha blend puts it in the transparent bucket where it
      // sorts ambiguously against the control bar / header (chrome "fades
      // over video"). PLAYER-ARCHITECTURE.md Q1 lever.
      blendMode: "None",
      diffuseTexture: {
        uri: `data:image/png;base64,${ONE_BY_ONE_TRANSPARENT_PNG_BASE64}`,
      },
    },
  });
  registered.add(name);
}
