import type { CompositorPanelHandle } from "./CompositorPanelHandle";
import type { CompositorPanelOptions } from "./CompositorPanelOptions";
import { createFallbackStore } from "./fallback/createFallbackStore";
import { FALLBACK_MATERIAL } from "./fallback/fallbackMaterial";
import { fallbackMaterialName } from "./fallback/fallbackMaterialName";
import type { NativeCompositorPanel, NativePresentationChange } from "./native/NativeCompositorPanel";
import type { NativeSpatialPanelsModule } from "./native/NativeSpatialPanelsModule";
import type { ViroMaterialRegistry } from "./native/ViroMaterialRegistry";
import type { PanelHostCapabilities } from "./PanelHostCapabilities";
import type { PanelSubscription } from "./PanelSubscription";
import type { PresentationChange } from "./PresentationChange";
import { SpatialPanelsError } from "./SpatialPanelsError";
import type { SpatialPanelsErrorCode } from "./SpatialPanelsErrorCode";
import type { SpatialPanelsHost } from "./SpatialPanelsHost";
import type { StatusChange } from "./StatusChange";

const NATIVE_CODES: ReadonlySet<string> = new Set<SpatialPanelsErrorCode>([
  "COMPOSITOR_UNAVAILABLE",
  "CYLINDER_UNAVAILABLE",
  "PANEL_INVALID_ARGUMENT",
  "PANEL_DUPLICATE_ID",
  "PANEL_LAYER_BUDGET_EXCEEDED",
  "PANEL_SWAPCHAIN_FAILED",
  "PANEL_INVALID_RIVE_FILE",
]);

const UNAVAILABLE_CAPABILITIES: PanelHostCapabilities = {
  isSessionReady: false,
  supportsCylinder: false,
  maxPanels: 0,
  supportsRive: false,
};

function invalid(message: string): SpatialPanelsError {
  return new SpatialPanelsError("PANEL_INVALID_ARGUMENT", message);
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function validate(options: CompositorPanelOptions): void {
  if (options.id.length === 0) throw invalid("id must not be empty");
  if (!isPositiveFinite(options.widthM) || !isPositiveFinite(options.heightM)) {
    throw invalid(`widthM and heightM must be positive finite metres, got ${options.widthM} x ${options.heightM}`);
  }
  for (const [name, value] of [["widthPx", options.widthPx], ["heightPx", options.heightPx]] as const) {
    if (!Number.isInteger(value) || value < 16 || value > 4096) {
      throw invalid(`${name} must be an integer from 16 to 4096, got ${value}`);
    }
  }
  const corner = options.cornerRadiusM ?? 0;
  if (!Number.isFinite(corner) || corner < 0) throw invalid(`cornerRadiusM must be finite and >= 0, got ${corner}`);
  if ((options.shape ?? "quad") === "cylinder" && !isPositiveFinite(options.cylinderRadiusM ?? 0)) {
    throw invalid("a cylinder panel needs a positive cylinderRadiusM");
  }
  const order = options.presentation ?? ["compositor", "scene"];
  if (order[0] !== "compositor") {
    throw invalid('presentation must start with "compositor"; a scene-only panel is a SpatialPanel, not a compositor panel');
  }
  if (options.content.file.byteLength === 0) {
    throw new SpatialPanelsError("PANEL_INVALID_RIVE_FILE", "the .riv file is empty");
  }
}

function fromNativeError(error: unknown): SpatialPanelsError {
  if (error instanceof SpatialPanelsError) return error;
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  if (typeof code === "string" && NATIVE_CODES.has(code)) {
    return new SpatialPanelsError(code as SpatialPanelsErrorCode, message, { cause: error });
  }
  return new SpatialPanelsError("COMPOSITOR_UNAVAILABLE", message, { cause: error });
}

function createHandle(
  native: NativeCompositorPanel,
  options: CompositorPanelOptions,
  materials: ViroMaterialRegistry,
): CompositorPanelHandle {
  const isSceneAllowed = (options.presentation ?? ["compositor", "scene"]).includes("scene");
  const materialName = fallbackMaterialName(options.id);
  const presentationListeners = new Set<(change: PresentationChange) => void>();
  const statusListeners = new Set<(change: StatusChange) => void>();
  const fallback = createFallbackStore({
    ...native.presentation,
    isPanelVisible: options.isVisible ?? true,
    isSceneAllowed,
    isDisposed: false,
    pose: options.pose,
    shape: options.shape ?? "quad",
    widthM: options.widthM,
    heightM: options.heightM,
    cylinderRadiusM: options.cylinderRadiusM ?? 0,
    materialName,
  });
  let isDisposed = false;

  if (isSceneAllowed) {
    materials.createMaterials({ [materialName]: { ...FALLBACK_MATERIAL } });
    native.bindFallbackMaterial(materialName);
  }

  const onPresentation = (event: NativePresentationChange) => {
    const change: PresentationChange = {
      presentation: event.presentation,
      reason: event.reason,
      hasFallback: event.hasFallback,
    };
    // The material registration and the bind travel on different native
    // threads; if the bind arrived first, ask again now that it is needed.
    if (isSceneAllowed && change.presentation === "evicted" && !change.hasFallback) {
      native.bindFallbackMaterial(materialName);
    }
    fallback.applyPresentation(change);
    for (const listener of presentationListeners) listener(change);
  };
  const onStatus = (event: StatusChange) => {
    const change: StatusChange = { state: event.state, detail: event.detail };
    for (const listener of statusListeners) listener(change);
  };
  const subscriptions = [
    native.addListener("presentationChange", onPresentation),
    native.addListener("statusChange", onStatus),
  ];

  const subscribe = <T>(set: Set<(value: T) => void>, listener: (value: T) => void): PanelSubscription => {
    set.add(listener);
    return { remove: () => set.delete(listener) };
  };

  return {
    id: options.id,
    fallback: fallback.store,
    getPresentation: () => {
      const state = fallback.store.getState();
      return { presentation: state.presentation, reason: state.reason, hasFallback: state.hasFallback };
    },
    setPose: (pose) => {
      if (pose.position.length !== 3 || pose.orientation.length !== 4) {
        throw invalid("pose needs 3 position and 4 orientation values");
      }
      if (isDisposed) return;
      native.setPose([...pose.position], [...pose.orientation]);
      fallback.setPose(pose);
    },
    setVisible: (isVisible) => {
      if (isDisposed) return;
      native.setVisible(isVisible);
      fallback.setPanelVisible(isVisible);
    },
    setNumber: (path, value) => !isDisposed && native.setNumber(path, value),
    setBoolean: (path, value) => !isDisposed && native.setBoolean(path, value),
    setString: (path, value) => !isDisposed && native.setString(path, value),
    fireTrigger: (path) => !isDisposed && native.fireTrigger(path),
    dispatchPointer: (event) =>
      !isDisposed && native.dispatchPointer(event.action, event.xPx, event.yPx, event.pointerId),
    setActive: (isActive) => !isDisposed && native.setActive(isActive),
    addOnPresentationChangeListener: (listener) => subscribe(presentationListeners, listener),
    addOnStatusChangeListener: (listener) => subscribe(statusListeners, listener),
    dispose: () => {
      if (isDisposed) return;
      isDisposed = true;
      for (const subscription of subscriptions) subscription.remove();
      presentationListeners.clear();
      statusListeners.clear();
      fallback.markDisposed();
      native.dispose();
      if (isSceneAllowed) materials.deleteMaterials([materialName]);
    },
  };
}

/**
 * Builds a {@link SpatialPanelsHost} over the native module and Viro's
 * material registry. `nativeModule` is null when the module is not linked
 * (iOS, visionOS, web, or an app without the package).
 */
export function createSpatialPanelsHost(
  nativeModule: NativeSpatialPanelsModule | null,
  materials: ViroMaterialRegistry,
): SpatialPanelsHost {
  return {
    isAvailable: nativeModule !== null,
    getCapabilities: async () => (nativeModule ? nativeModule.getCapabilities() : UNAVAILABLE_CAPABILITIES),
    createCompositorPanel: async (options) => {
      if (!nativeModule) {
        throw new SpatialPanelsError(
          "COMPOSITOR_UNAVAILABLE",
          "compositor panels need the ViroSpatialPanels module, which exists on Android (OpenXR, GLES) only",
        );
      }
      validate(options);
      const content = options.content;
      let native: NativeCompositorPanel;
      try {
        native = await nativeModule.createRiveCompositorPanel(
          {
            id: options.id,
            shape: options.shape ?? "quad",
            position: [...options.pose.position],
            orientation: [...options.pose.orientation],
            widthM: options.widthM,
            heightM: options.heightM,
            widthPx: options.widthPx,
            heightPx: options.heightPx,
            cylinderRadiusM: options.cylinderRadiusM ?? 0,
            cornerRadiusM: options.cornerRadiusM ?? 0,
            visible: options.isVisible ?? true,
            artboard: content.artboard ?? "",
            stateMachine: content.stateMachine ?? "",
            fit: content.fit ?? "contain",
            alignmentX: content.alignmentX ?? 0,
            alignmentY: content.alignmentY ?? 0,
            clearColor: content.clearColor ?? 0,
            maxFrameRateHz: content.maxFrameRateHz ?? 72,
          },
          content.file,
        );
      } catch (error) {
        throw fromNativeError(error);
      }
      return createHandle(native, options, materials);
    },
  };
}
