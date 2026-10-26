import { Android, type HybridObject } from "nitro-core";
import type { ListenerSubscription } from "./ListenerSubscription";
import type { RiveFile } from "./RiveFile.nitro";
import type { RivePanelOptions } from "./RivePanelOptions";
import type { RivePanelState } from "./RivePanelState";
import type { RivePointerPhase } from "./RivePointerPhase";
import type { RiveViewModelInstance } from "./RiveViewModelInstance.nitro";

export * from "#nitro/RivePanel";

/**
 * Draws one Rive state machine into a Viro-owned Surface (ADR 0001 route B1).
 *
 * ViroCore's `VRORivePanel` does the work on its own thread with its own EGL
 * context; this object forwards commands to it and moves the Surface in and
 * out as Viro provides and withdraws it. Output is premultiplied alpha with
 * square corners: give the `canvasSource` material `blendMode:
 * "PremultiplyAlpha"` and the panel's `cornerRadius`.
 *
 * Call the inherited `dispose()` when done. It ends the Surface
 * subscription, then stops the render thread and frees every Rive and EGL
 * object. The Surface belongs to Viro and is not released. Idempotent; every
 * other method throws afterwards.
 *
 * @platform android
 */
@Android({
  language: "c++",
  implementation: { className: "HybridRivePanel", include: '"HybridRivePanel.hpp"' },
})
export declare class RivePanel extends HybridObject {
  /**
   * Whether this build can create panels: Android arm64-v8a with a ViroCore
   * renderer built with Rive. False elsewhere; {@linkcode RivePanel.create}
   * then rejects.
   */
  static readonly isAvailable: boolean;

  /**
   * Creates a panel, loads `options.file`, and subscribes to the Viro Surface
   * for `options.surfaceId`. Resolves before the Surface may exist; the panel
   * then reports `waiting-for-surface` and starts drawing when it arrives.
   *
   * @throws Error (rejects) for invalid options or when
   * {@linkcode RivePanel.isAvailable} is false.
   */
  static create(options: RivePanelOptions): Promise<RivePanel>;

  /** Current lifecycle state. Cheap to read. */
  readonly state: RivePanelState;

  /** Writes to the artboard's default view-model instance. */
  readonly viewModelInstance: RiveViewModelInstance;

  /** Replaces the file. The current artboard and state machine names are kept. */
  setFile(file: RiveFile): void;
  /** Selects an artboard by name. An empty string selects the default. */
  selectArtboard(name: string): void;
  /** Selects a state machine by name. An empty string selects the default. */
  selectStateMachine(name: string): void;

  /**
   * Sends one pointer sample in panel pixels, origin top-left, at the size
   * the panel was created or last resized with. Mapped into the artboard
   * with the same fit and alignment Rive renders with. A press that starts
   * in a transparent rounded corner is dropped. Use a distinct `pointerId`
   * per hand, controller and pen.
   *
   * @throws Error when a coordinate is not finite or `pointerId` is not an integer.
   */
  dispatchPointer(phase: RivePointerPhase, xPx: number, yPx: number, pointerId: number): void;

  /** Starts (`true`) or stops (`false`) frame production. The Surface stays attached. */
  setActive(active: boolean): void;

  /**
   * Registers a listener for state changes. `detail` is empty for a plain
   * state change and carries a message when a command failed without
   * changing the state (bad file, unknown artboard, unknown property path).
   * Runs on the panel's render thread; delivered to JS asynchronously.
   *
   * If the panel has already reported anything, the new listener first
   * receives the last `(state, detail)` once, so a report made before JS
   * subscribed (such as a load error) is not lost. Later reports follow in
   * order.
   */
  addOnStateChangedListener(listener: (state: RivePanelState, detail: string) => void): ListenerSubscription;
}
