import type { XRCapabilityReport, XRPlatformAdapter } from "@viro-external/xr-contract";

export type VitureDeviceFamily =
  | "luma-ultra" | "luma-pro" | "luma" | "cyber" | "beast" | "unknown";

export interface VitureNativeTransport {
  getDeviceFamily(): Promise<VitureDeviceFamily> | VitureDeviceFamily;
  getCapabilities(): Promise<{
    display?: boolean; stereo?: boolean; headPose?: boolean; camera?: boolean;
    microphone?: boolean; audio?: boolean; input?: boolean;
  }> | {
    display?: boolean; stereo?: boolean; headPose?: boolean; camera?: boolean;
    microphone?: boolean; audio?: boolean; input?: boolean;
  };
  beginSession?(): Promise<void> | void;
  endSession?(): Promise<void> | void;
  dispose(): Promise<void> | void;
}

const state = (value: boolean | undefined) =>
  value === true ? "supported" as const :
  value === false ? "unsupported" as const : "unverified" as const;

export class EsikuVitureAdapter implements XRPlatformAdapter {
  readonly family = "viro-openxr" as const;

  constructor(private readonly transport: VitureNativeTransport) {}

  async getCapabilities(): Promise<XRCapabilityReport> {
    const caps = await this.transport.getCapabilities();
    return {
      display: state(caps.display),
      "immersive-rendering": state(caps.stereo),
      motion: state(caps.headPose),
      camera: state(caps.camera),
      microphone: state(caps.microphone),
      "audio-output": state(caps.audio),
      controller: state(caps.input),
    };
  }

  beginSession(): Promise<void> | void { return this.transport.beginSession?.(); }
  endSession(): Promise<void> | void { return this.transport.endSession?.(); }
  dispose(): Promise<void> | void { return this.transport.dispose(); }
}
