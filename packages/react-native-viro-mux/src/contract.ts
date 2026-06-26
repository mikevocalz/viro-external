/**
 * FROZEN PUBLIC CONTRACT — react-native-viro-mux
 *
 * Other packages in @viro-external/* import from here.
 * Any breaking change requires a v0.x bump AND a changelog entry at the top of doc/TextureBridge.md.
 */

import type React from "react";

// ──────────────────────────────────────────────────────────────────────────
// External texture seam
// ──────────────────────────────────────────────────────────────────────────

/**
 * Opaque handle to an externally produced GPU texture that has been registered
 * with the Viro renderer.
 *
 * - iOS:     `id` is an `IOSurfaceID` (uint32) bridged into JS as a number.
 * - Android: `id` is a GL texture name (uint) bridged into JS as a number.
 *
 * `kind` lets the native side resolve the handle without a per-platform branch
 * in JS. Producers (WebGPU/Skia/FBO/Compute) tag their output accordingly.
 */
export interface ExternalTextureHandle {
  readonly id: number;
  readonly kind: "iosurface" | "gl-2d" | "gl-external-oes";
  readonly width: number;
  readonly height: number;
  readonly colorSpace: "srgb" | "linear";
  /** Stable token the native module uses to free the wrapper on release. */
  readonly nativeToken: number;
}

export interface ViroGPUTextureProps {
  /** The named material this texture binds to. Material must be pre-registered (see createPlaceholderMaterial). */
  materialName: string;
  texture: ExternalTextureHandle;
  /** Defaults from config/defaults.json (`texture.colorSpace`). */
  colorSpace?: "srgb" | "linear";
  /** Defaults from config/defaults.json (`texture.flipY`). */
  flipY?: boolean;
  onTextureBound?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Source description for registering an external texture with the renderer.
 * The native module copies these fields, builds the substrate, and returns
 * an `ExternalTextureHandle`.
 */
export interface ExternalTextureSource {
  id: number;
  kind: ExternalTextureHandle["kind"];
  width: number;
  height: number;
  colorSpace: "srgb" | "linear";
}

export interface ViroGPUTextureModule {
  /**
   * Register an externally-owned GPU texture with the Viro renderer and bind
   * it to `materialName`'s diffuse slot. Returns a handle that must be passed
   * to `releaseExternalTexture` when the producer no longer needs the binding.
   *
   * The underlying GPU texture is NOT owned by the renderer — releasing the
   * handle does not free the producer's texture.
   */
  registerExternalTexture(materialName: string, source: ExternalTextureSource): ExternalTextureHandle;

  /** Release the wrapper. Idempotent. */
  releaseExternalTexture(handle: ExternalTextureHandle): void;
}

// ──────────────────────────────────────────────────────────────────────────
// Movability (shared across all @viro-external/* packages)
// ──────────────────────────────────────────────────────────────────────────

export type ViroDragType = "FixedDistance" | "FixedDistanceOrigin" | "FixedToWorld" | "FixedToPlane";

export type ViroDragPlane = {
  planePoint: [number, number, number];
  planeNormal: [number, number, number];
  maxDistance: number;
};

export type Vec3 = [number, number, number];
export type AxisLock = "x" | "y" | "z";

/**
 * Shared movability contract. Every downstream component spreads MovableProps
 * into <MovableNode>. NO component re-implements onDrag/onPinch wiring.
 */
export interface MovableProps {
  /** Wraps the component in a ViroNode and wires onDrag. */
  movable?: boolean;
  dragType?: ViroDragType;
  dragPlane?: ViroDragPlane;
  /**
   * Lock dragging along one or more world axes.
   * Implemented by re-clamping in JS — Viro has no native single-axis lock.
   */
  axisLock?: AxisLock[];
  onMoveStart?: () => void;
  onMove?: (worldPos: Vec3) => void;
  onMoveEnd?: (worldPos: Vec3) => void;
  /** When true, onPinch's scaleFactor commits to the wrapper node's scale on pinch end. */
  pinchToScale?: boolean;
}

/**
 * The reusable wrapper every downstream component composes. Single implementation
 * of drag / pinch / axisLock. Defined in MovableNode.tsx — re-exported here so
 * other packages can import the type from `react-native-viro-mux/contract`.
 */
export type MovableNodeComponent = React.ComponentType<MovableProps & { children: React.ReactNode }>;
