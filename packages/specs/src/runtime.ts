export interface SpecsDeviceInfoSystemLike {
  isSpectacles(): boolean;
  isEditor(): boolean;
  isInternetAvailable?(): boolean;
}

export interface SpecsRuntimeGlobals {
  deviceInfoSystem?: SpecsDeviceInfoSystemLike;
  /**
   * Build-time marker set by the Specs/Lens Studio bootstrap.
   *
   * Physical Spectacles do not require the marker because isSpectacles()
   * is authoritative there. The marker exists so editor/simulator builds can
   * distinguish a Specs-targeted project from an unrelated Lens Studio lens.
   */
  __VIRO_SPECS_BUILD__?: boolean;
}

export interface SpecsRuntimeInfo {
  family: "snap-specs";
  isDevice: boolean;
  isEditor: boolean;
  isBuild: boolean;
  isRuntime: boolean;
  internetAvailable: boolean | null;
}

declare const global: SpecsRuntimeGlobals | undefined;

function getDefaultGlobals(): SpecsRuntimeGlobals | undefined {
  if (typeof global !== "undefined") {
    return global;
  }

  if (typeof globalThis !== "undefined") {
    return globalThis as unknown as SpecsRuntimeGlobals;
  }

  return undefined;
}

function readBoolean(
  reader: (() => boolean) | undefined,
  fallback = false
): boolean {
  if (!reader) {
    return fallback;
  }

  try {
    return Boolean(reader());
  } catch {
    return fallback;
  }
}

export function isSpecsDevice(
  globals: SpecsRuntimeGlobals | undefined = getDefaultGlobals()
): boolean {
  const deviceInfo = globals?.deviceInfoSystem;
  return readBoolean(
    deviceInfo ? () => deviceInfo.isSpectacles() : undefined
  );
}

export function isSpecsEditor(
  globals: SpecsRuntimeGlobals | undefined = getDefaultGlobals()
): boolean {
  const deviceInfo = globals?.deviceInfoSystem;
  return readBoolean(
    deviceInfo ? () => deviceInfo.isEditor() : undefined
  );
}

export function isSpecsBuild(
  globals: SpecsRuntimeGlobals | undefined = getDefaultGlobals()
): boolean {
  return Boolean(globals?.__VIRO_SPECS_BUILD__) || isSpecsDevice(globals);
}

export function isSpecsRuntime(
  globals: SpecsRuntimeGlobals | undefined = getDefaultGlobals()
): boolean {
  return isSpecsDevice(globals) || isSpecsEditor(globals);
}

export function getSpecsRuntime(
  globals: SpecsRuntimeGlobals | undefined = getDefaultGlobals()
): SpecsRuntimeInfo {
  const deviceInfo = globals?.deviceInfoSystem;
  const isDevice = isSpecsDevice(globals);
  const isEditor = isSpecsEditor(globals);
  const internetAvailable = deviceInfo?.isInternetAvailable
    ? readBoolean(() => deviceInfo.isInternetAvailable?.() ?? false)
    : null;

  return {
    family: "snap-specs",
    isDevice,
    isEditor,
    isBuild: Boolean(globals?.__VIRO_SPECS_BUILD__) || isDevice,
    isRuntime: isDevice || isEditor,
    internetAvailable,
  };
}

/**
 * React-friendly runtime snapshot helper.
 *
 * Specs identity is static for the lifetime of a render session, so this
 * helper intentionally has no React dependency and can also be used by
 * non-React shared TypeScript. Dynamic values such as battery/network events
 * should use a dedicated subscription API rather than this snapshot.
 */
export function useSpecs(
  globals: SpecsRuntimeGlobals | undefined = getDefaultGlobals()
): SpecsRuntimeInfo {
  return getSpecsRuntime(globals);
}

/**
 * Property-style access for code that prefers the Expo Horizon Core shape.
 */
export const SpecsRuntime = {
  get isSpecsDevice(): boolean {
    return isSpecsDevice();
  },
  get isSpecsEditor(): boolean {
    return isSpecsEditor();
  },
  get isSpecsBuild(): boolean {
    return isSpecsBuild();
  },
  get isSpecsRuntime(): boolean {
    return isSpecsRuntime();
  },
  get info(): SpecsRuntimeInfo {
    return getSpecsRuntime();
  },
} as const;
