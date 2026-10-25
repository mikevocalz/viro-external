import type { WhiteboardRenderer } from "../specs/WhiteboardRenderer.nitro";
import type { WhiteboardRendererState } from "../specs/WhiteboardRendererState";
import type { useWhiteboardRenderer } from "./useWhiteboardRenderer";

/**
 * What {@linkcode useWhiteboardRenderer} has to show for.
 *
 * - `unavailable`: no native renderer on this platform or device; keep the WebView board.
 * - `creating`: the renderer is being created.
 * - `ready`: the renderer exists and is bound to the store; `state` is its lifecycle state.
 * - `failed`: creation was rejected; `error` says why.
 */
export type WhiteboardRendererStatus =
  | { kind: "unavailable" }
  | { kind: "creating" }
  | { kind: "ready"; renderer: WhiteboardRenderer; state: WhiteboardRendererState }
  | { kind: "failed"; error: Error };
