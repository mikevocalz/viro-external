import { ViroMaterials } from "@reactvision/react-viro";

const ONE_BY_ONE_TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const registered = new Set<string>();

/**
 * Register a safe texture-backed placeholder before a native texture producer
 * replaces the material's diffuse channel.
 */
export function createPlaceholderMaterial(name: string): void {
  if (registered.has(name)) return;

  ViroMaterials.createMaterials({
    [name]: {
      cullMode: "None",
      diffuseTexture: {
        uri:
          "data:image/png;base64," +
          ONE_BY_ONE_TRANSPARENT_PNG_BASE64,
      },
    },
  });

  registered.add(name);
}
