import type { BoardPointerSample, BoardPointerSource } from "./BoardPointerSample";

const SOURCES: readonly BoardPointerSource[] = ["pen", "controller", "hand", "touch"];

export function assertPointerId(pointerId: unknown): asserts pointerId is number {
  if (typeof pointerId !== "number" || !Number.isSafeInteger(pointerId)) {
    throw new TypeError(`pointerId must be a safe integer, got ${String(pointerId)}`);
  }
}

const assertFinite = (name: string, value: unknown): void => {
  if (typeof value !== "number") throw new TypeError(`${name} must be a number, got ${typeof value}`);
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite, got ${String(value)}`);
};

/** Rejects a malformed sample before it can reach the Store. */
export function assertValidSample(sample: BoardPointerSample): void {
  if (typeof sample !== "object" || sample === null) throw new TypeError("pointer sample must be an object");
  assertPointerId(sample.pointerId);
  if (!SOURCES.includes(sample.source)) {
    throw new RangeError(`source must be one of ${SOURCES.join(", ")}, got ${String(sample.source)}`);
  }
  assertFinite("x", sample.x);
  assertFinite("y", sample.y);
  assertFinite("timestampMs", sample.timestampMs);
  if (sample.pressure !== undefined) {
    assertFinite("pressure", sample.pressure);
    if (sample.pressure < 0 || sample.pressure > 1) {
      throw new RangeError(`pressure must be within [0, 1] or undefined, got ${sample.pressure}`);
    }
  }
}

/** Rejects a sample older than the last one accepted for the same pointer. */
export function assertNotStale(sample: BoardPointerSample, lastTimestampMs: number): void {
  if (sample.timestampMs < lastTimestampMs) {
    throw new RangeError(
      `stale sample for pointer ${sample.pointerId}: timestampMs ${sample.timestampMs} < last ${lastTimestampMs}`,
    );
  }
}
