import type { RivePanel } from "../specs/RivePanel.nitro";
import type { NativeRivePanelMount } from "./NativeRivePanelMount";
import type { NativeRivePanelMountOptions } from "./NativeRivePanelMountOptions";

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/**
 * Creates the `canvasSource` material at once, then the native file and
 * panel asynchronously. `onPanel` runs when the panel exists; a dispose
 * before that disposes the late panel as soon as it arrives.
 */
export function mountNativeRivePanel(options: NativeRivePanelMountOptions): NativeRivePanelMount {
  const { rive, materials, materialName } = options;
  let isDisposed = false;
  let panel: RivePanel | undefined;
  let stateSubscription: { remove: () => void } | undefined;

  materials.createMaterials({
    [materialName]: {
      diffuseTexture: {
        canvasSource: options.surfaceId,
        width: options.widthPx,
        height: options.heightPx,
        ...(options.cornerRadiusM > 0
          ? { cornerRadius: options.cornerRadiusM, panelWidth: options.widthM, panelHeight: options.heightM }
          : null),
      },
      diffuseColor: options.fallbackColor,
      lightingModel: options.lightingModel,
      // VRORivePanel writes premultiplied alpha (ADR 0001 D6).
      blendMode: options.blendMode,
    },
  });

  const run = async () => {
    const file = await rive.RiveFile.fromBytes(options.rivBytes);
    if (isDisposed) {
      file.dispose();
      return;
    }
    const created = await rive.RivePanel.create({
      surfaceId: options.surfaceId,
      widthPx: options.widthPx,
      heightPx: options.heightPx,
      file,
      artboardName: options.artboardName,
      stateMachineName: options.stateMachineName,
      fit: options.fit,
      alignmentX: 0,
      alignmentY: 0,
      cornerRadiusM: options.cornerRadiusM,
      panelWidthM: options.widthM,
      panelHeightM: options.heightM,
      maxFrameRateHz: options.maxFrameRateHz,
    });
    // The panel copied the bytes; the file object is no longer needed.
    file.dispose();
    if (isDisposed) {
      created.dispose();
      return;
    }
    panel = created;
    stateSubscription = created.addOnStateChangedListener((state, detail) => {
      if (!isDisposed) options.onState(state, detail);
    });
    options.onPanel(created);
  };

  run().catch((error: unknown) => {
    if (!isDisposed) options.onError(toError(error));
  });

  return {
    dispose() {
      if (isDisposed) return;
      isDisposed = true;
      try {
        stateSubscription?.remove();
        panel?.dispose();
      } finally {
        panel = undefined;
        materials.deleteMaterials([materialName]);
      }
    },
  };
}
