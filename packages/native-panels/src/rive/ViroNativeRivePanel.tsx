import * as React from "react";
import { AppState } from "react-native";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { ViroMaterials, ViroNode, ViroQuad, ViroRivePanel, type ViroRivePanelHandle } from "@reactvision/react-viro";
import type { RivePanel } from "../specs/RivePanel.nitro";
import { allocateRiveSurfaceId } from "./allocateRiveSurfaceId";
import { createRiveBindingWriter } from "./createRiveBindingWriter";
import { createRivePanelPointerSink } from "./createRivePanelPointerSink";
import { mountNativeRivePanel } from "./mountNativeRivePanel";
import type { NativeRivePanelHandle } from "./NativeRivePanelHandle";
import type { NativeRiveRuntime } from "./NativeRiveRuntime";
import { resolveNativeRive } from "./resolveNativeRive";
import type { ViroNativeRivePanelProps } from "./ViroNativeRivePanelProps";

type Vec3 = [number, number, number];

/**
 * `ViroRivePanel` with an opt-in native route. With `nativeRive` false (the
 * default), without `source`, or where the native producer is unavailable,
 * it renders `ViroRivePanel` with the same props. With `nativeRive` true on
 * Android arm64-v8a it draws through ViroCore's `VRORivePanel` into a
 * `canvasSource` material with premultiplied alpha and rounded corners.
 *
 * @example
 * ```tsx
 * <ViroNativeRivePanel nativeRive source={{ rivBytes, artboard: "BoardChrome", stateMachine: "BoardChrome" }}
 *   width={0.6} height={0.375} resolution={{ width: 2496, height: 1560 }} cornerRadius={0.021}
 *   bindings={{ tool: 2, canUndo: true }} onError={report} />
 * ```
 */
export const ViroNativeRivePanel = React.forwardRef<
  ViroRivePanelHandle | NativeRivePanelHandle,
  ViroNativeRivePanelProps
>(function ViroNativeRivePanel(props, ref) {
  const { nativeRive = false, maxFrameRateHz, onNativePanelReady, onNativeStateChange, ...viroProps } = props;
  const rive = React.useMemo(
    () => (nativeRive && props.source !== undefined ? resolveNativeRive() : undefined),
    [nativeRive, props.source],
  );
  if (rive === undefined) {
    return <ViroRivePanel ref={ref as React.Ref<ViroRivePanelHandle>} {...viroProps} />;
  }
  return <NativeRivePanelBody ref={ref as React.Ref<NativeRivePanelHandle>} rive={rive} props={props} />;
});

type PanelState = { panel: RivePanel | null; materialReady: boolean };

const NativeRivePanelBody = React.forwardRef<
  NativeRivePanelHandle,
  { rive: NativeRiveRuntime; props: ViroNativeRivePanelProps }
>(function NativeRivePanelBody({ rive, props }, ref) {
  const {
    source,
    width,
    height,
    resolution = { width: 1024, height: 1024 },
    position = [0, 1.45, -2.0] as Vec3,
    rotation,
    cornerRadius = 0,
    lightingModel = "Constant",
    fallbackColor = "#ffffff",
    materialName: materialOverride,
    blendMode,
    maxFrameRateHz = 72,
    autoTick,
    bindings,
  } = props;
  const store = React.useMemo(() => createStore<PanelState>(() => ({ panel: null, materialReady: false })), []);
  const panel = useStore(store, (s) => s.panel);
  const materialReady = useStore(store, (s) => s.materialReady);
  const latest = React.useRef(props);
  latest.current = props;
  const writer = React.useMemo(() => createRiveBindingWriter(), []);
  const surfaceId = React.useMemo(() => allocateRiveSurfaceId(), [source, resolution.width, resolution.height]);
  const materialName = materialOverride ?? `viroNativeRivePanel_${surfaceId}`;

  const report = React.useCallback((error: Error) => latest.current.onError?.(error), []);

  const pushBindings = React.useCallback(
    (target: RivePanel) => {
      const { update, unsupportedPaths } = writer.diff(latest.current.bindings);
      for (const path of unsupportedPaths) {
        report(new Error(`Rive binding '${path}': enum and color values are not supported on the native route yet`));
      }
      if (update === undefined) return;
      try {
        target.viewModelInstance.applyUpdate(update);
      } catch (error) {
        report(error instanceof Error ? error : new Error(String(error)));
      }
    },
    [writer, report],
  );

  React.useEffect(() => {
    if (source === undefined) return undefined;
    if (blendMode !== undefined && blendMode !== "PremultiplyAlpha" && blendMode !== "None") {
      report(new Error(`blendMode '${blendMode}' does not fit the native route's premultiplied output; using PremultiplyAlpha`));
    }
    let foreground = AppState.currentState !== "background" && AppState.currentState !== "inactive";
    let current: RivePanel | null = null;
    const syncActive = () => {
      if (current === null) return;
      try {
        current.setActive(foreground && latest.current.autoTick !== false);
      } catch (error) {
        report(error instanceof Error ? error : new Error(String(error)));
      }
    };
    const appState = AppState.addEventListener("change", (value) => {
      foreground = value === "active";
      syncActive();
    });
    writer.reset();
    const mount = mountNativeRivePanel({
      rive,
      materials: ViroMaterials,
      rivBytes: source.rivBytes,
      artboardName: source.artboard,
      stateMachineName: source.stateMachine,
      fit: source.fit ?? "contain",
      surfaceId,
      materialName,
      widthPx: resolution.width,
      heightPx: resolution.height,
      widthM: width,
      heightM: height,
      cornerRadiusM: cornerRadius,
      lightingModel,
      fallbackColor,
      blendMode: blendMode === "None" ? "None" : "PremultiplyAlpha",
      maxFrameRateHz,
      onPanel: (created) => {
        current = created;
        store.setState({ panel: created });
        pushBindings(created);
        syncActive();
        latest.current.onNativePanelReady?.(created);
        latest.current.onReady?.();
      },
      onState: (state, detail) => latest.current.onNativeStateChange?.(state, detail),
      onError: report,
    });
    store.setState({ materialReady: true });
    return () => {
      appState.remove();
      current = null;
      store.setState({ panel: null, materialReady: false });
      mount.dispose();
    };
  }, [rive, source, surfaceId, materialName, resolution.width, resolution.height, width, height, cornerRadius,
    lightingModel, fallbackColor, blendMode, maxFrameRateHz, store, writer, pushBindings, report]);

  React.useEffect(() => {
    if (panel !== null) pushBindings(panel);
  }, [panel, bindings, pushBindings]);

  React.useEffect(() => {
    if (panel === null) return;
    try {
      panel.setActive(AppState.currentState === "active" && autoTick !== false);
    } catch (error) {
      report(error instanceof Error ? error : new Error(String(error)));
    }
  }, [panel, autoTick, report]);

  React.useImperativeHandle(
    ref,
    () => {
      const sink = panel === null ? undefined : createRivePanelPointerSink(panel, {
        widthPx: resolution.width,
        heightPx: resolution.height,
      });
      return {
        native: true as const,
        panel,
        surfaceId,
        materialName,
        dispatchPointer: (event) => {
          if (sink === undefined) return;
          try {
            sink(event);
          } catch (error) {
            report(error instanceof Error ? error : new Error(String(error)));
          }
        },
      };
    },
    [panel, surfaceId, materialName, resolution.width, resolution.height, report],
  );

  if (!materialReady) return null;
  return (
    <ViroNode position={position} rotation={rotation}>
      <ViroQuad width={width} height={height} materials={[materialName]} />
    </ViroNode>
  );
});
