import type { XRPlatformFamily } from "@viro-external/xr-contract";

/**
 * Which system opens the shell's rail window.
 *
 * - `meta-horizon-layout`: the Meta VR Layout SDK, in the `quest` flavor.
 * - `pico-spatial`: a strip of the PICO main window, in the `pico` flavor.
 *   PICO OS 5 cannot attach one activity window to another.
 * - `none`: no rail window; the rail draws inside the main panel or becomes
 *   the phone tab bar.
 *
 * @see {@linkcode ShellPlatform.windowBackend}
 */
export type ShellWindowBackend = Extract<XRPlatformFamily, "meta-horizon-layout" | "pico-spatial"> | "none";

/**
 * What the shell knows about the device and build.
 *
 * @see {@linkcode resolveShellPlatform}
 */
export interface ShellPlatform {
  /** Headset hardware or a headset build. A headset never shows the bottom tab bar. */
  readonly isHeadset: boolean;
  /** The backend that would open the rail window on this build. */
  readonly windowBackend: ShellWindowBackend;
}

/** The `Platform.constants` fields Android reports from `android.os.Build`. */
export interface DeviceConstants {
  readonly Manufacturer?: string;
  readonly Brand?: string;
  readonly Model?: string;
}

const HEADSET_MAKERS = new Set(["oculus", "meta", "pico", "bytedance"]);

/**
 * True on headset hardware whatever flavor was installed. Quest 1/2/Pro report
 * Oculus, Quest 3/3S report Oculus or Meta (a Quest 3S reported Oculus /
 * oculus / "Quest 3S"), a PICO 4 Ultra reports Pico / Pico / A9210. The same
 * signal as react-viro's `isQuest`.
 */
export function isHeadsetDevice(os: string, constants: DeviceConstants | undefined): boolean {
  if (os !== "android" || constants === undefined) return false;
  const maker = (constants.Manufacturer ?? "").toLowerCase();
  const brand = (constants.Brand ?? "").toLowerCase();
  if (HEADSET_MAKERS.has(maker) || HEADSET_MAKERS.has(brand)) return true;
  return /\bquest\b/i.test(constants.Model ?? "");
}

/**
 * Input to {@linkcode resolveShellPlatform}.
 *
 * - `isHorizonBuild`: `ExpoHorizon.isHorizonBuild` from expo-horizon-core,
 *   true in the `quest` flavor only.
 * - `isPicoBuild`: true in the `pico` flavor (for example `isPicoBuild()` from
 *   `@expo-pico/core`).
 * - `os` and `deviceConstants`: `Platform.OS` and `Platform.constants`.
 */
export interface ShellPlatformInput {
  readonly isHorizonBuild: boolean;
  readonly isPicoBuild: boolean;
  readonly os: string;
  readonly deviceConstants?: DeviceConstants;
}

/**
 * Resolves the device and build into a {@linkcode ShellPlatform}. The device
 * check means a headset that installed a phone variant (a misresolved
 * flavor) still gets the headset layout, never the phone tab bar. Pure.
 */
export function resolveShellPlatform(input: ShellPlatformInput): ShellPlatform {
  const windowBackend: ShellWindowBackend = input.isHorizonBuild
    ? "meta-horizon-layout"
    : input.isPicoBuild
      ? "pico-spatial"
      : "none";
  return {
    isHeadset:
      input.isHorizonBuild || input.isPicoBuild || isHeadsetDevice(input.os, input.deviceConstants),
    windowBackend,
  };
}
