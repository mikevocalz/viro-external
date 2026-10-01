import type { XRCapabilityReport, XRPlatformAdapter } from "@viro-external/xr-contract";

export type MetaWearablesCapability =
  | "camera"
  | "microphone"
  | "audio"
  | "display"
  | "inputs"
  | "motion"
  | "speech";

export type MetaWearablesDeviceCapabilities = Partial<
  Record<MetaWearablesCapability, boolean>
>;

/**
 * Transport boundary implemented by the native React Native module in the next
 * PR. Keeping it injectable lets Mock Device Kit and unit tests use the exact
 * same high-level adapter.
 */
export interface MetaWearablesTransport {
  getDeviceCapabilities():
    | Promise<MetaWearablesDeviceCapabilities>
    | MetaWearablesDeviceCapabilities;
  dispose(): Promise<void> | void;
}

export class MetaWearablesAdapter implements XRPlatformAdapter {
  readonly family = "meta-wearables" as const;

  constructor(private readonly transport: MetaWearablesTransport) {}

  async getCapabilities(): Promise<XRCapabilityReport> {
    const caps = await this.transport.getDeviceCapabilities();
    const state = (value: boolean | undefined) =>
      value === true ? "supported" as const :
      value === false ? "unsupported" as const :
      "unverified" as const;

    return {
      camera: state(caps.camera),
      microphone: state(caps.microphone),
      "audio-output": state(caps.audio),
      display: state(caps.display),
      motion: state(caps.motion),
      "immersive-rendering": "unsupported",
      "spatial-web": "unsupported",
    };
  }

  dispose(): Promise<void> | void {
    return this.transport.dispose();
  }
}
