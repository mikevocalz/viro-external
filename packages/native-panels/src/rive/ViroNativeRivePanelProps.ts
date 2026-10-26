import type { ViroRivePanelProps } from "@reactvision/react-viro";
import type { ViroNativeRivePanel } from "./ViroNativeRivePanel";
import type { RivePanel } from "../specs/RivePanel.nitro";
import type { RivePanelState } from "../specs/RivePanelState";

/**
 * Props of {@linkcode ViroNativeRivePanel}: every `ViroRivePanel` prop, plus
 * the switch to ViroCore's native Rive producer.
 */
export type ViroNativeRivePanelProps = ViroRivePanelProps & {
  /**
   * Draw with ViroCore's `VRORivePanel` (ADR 0001 route B1) instead of
   * `ViroRivePanel`'s nitro-canvas-in-Vision runtime. Default false.
   *
   * Takes effect only with `source` and where
   * {@linkcode RivePanel.isAvailable} is true (Android arm64-v8a); otherwise
   * `ViroRivePanel` renders, unchanged. Rollback is setting it back to false.
   *
   * Native-route gaps today: `init` and `input` are not used (send pointer
   * input through the handle's `dispatchPointer`), `onRuntimeReady` is not
   * called (use `onNativePanelReady`), and `enum` and `color` bindings are
   * reported through `onError` and skipped.
   */
  nativeRive?: boolean;
  /**
   * Upper bound on frames per second while the state machine animates, on
   * the native route. A settled state machine draws nothing. Default 72.
   */
  maxFrameRateHz?: number;
  /** Native route: the {@linkcode RivePanel} exists and its file is queued. */
  onNativePanelReady?: (panel: RivePanel) => void;
  /** Native route: state changes, and failures reported with a detail message. */
  onNativeStateChange?: (state: RivePanelState, detail: string) => void;
};
