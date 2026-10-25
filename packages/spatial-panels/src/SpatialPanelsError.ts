import type { SpatialPanelsHost } from "./SpatialPanelsHost";
import type { SpatialPanelsErrorCode } from "./SpatialPanelsErrorCode";

/**
 * A failure of {@link SpatialPanelsHost.createCompositorPanel} or a handle
 * call, with a stable {@link SpatialPanelsErrorCode}.
 */
export class SpatialPanelsError extends Error {
  readonly code: SpatialPanelsErrorCode;
  /** The native error this one wraps, if any. */
  readonly cause?: unknown;

  constructor(code: SpatialPanelsErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "SpatialPanelsError";
    this.code = code;
    if (options) this.cause = options.cause;
  }
}
