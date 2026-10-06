import { NativeModulesProxy, EventEmitter } from "expo-modules-core";
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
 * Transport boundary between the adapter and the native module. Injectable so
 * Mock Device Kit and unit tests drive the same adapter; production callers use
 * `createNativeTransport()`.
 */
export interface MetaWearablesTransport {
  getDeviceCapabilities():
    | Promise<MetaWearablesDeviceCapabilities>
    | MetaWearablesDeviceCapabilities;
  dispose(): Promise<void> | void;
}

/** Snapshot of one linked glasses pair as reported by DAT device metadata. */
export interface MetaWearablesDevice {
  id: string;
  deviceType: string | null;
  linkState: string | null;
  donState: string | null;
  compatibility: string | null;
  displayCapable: boolean;
  connected: boolean;
}

export type MetaWearablesRegistrationState =
  | "UNREGISTERED"
  | "REGISTERING"
  | "REGISTERED"
  | string;

export type MetaWearablesSessionState =
  | "IDLE"
  | "STARTED"
  | "STOPPING"
  | "STOPPED"
  | string;

interface NativeMetaWearablesModule {
  initialize(): Promise<boolean>;
  startRegistration(): Promise<void>;
  getRegistrationState(): Promise<string>;
  getDevices(): Promise<MetaWearablesDevice[]>;
  checkPermission(permission: string): Promise<string>;
  getDeviceCapabilities(): Promise<MetaWearablesDeviceCapabilities>;
  startSession(): Promise<boolean>;
  stopSession(): Promise<void>;
  attachCapability(name: string): Promise<boolean>;
  detachCapability(name: string): Promise<void>;
  enableMockDevice(model?: string): Promise<boolean>;
  disableMockDevice(): Promise<void>;
}

const nativeModule = NativeModulesProxy.MetaWearables as
  | NativeMetaWearablesModule
  | undefined;

export const isMetaWearablesAvailable: boolean = nativeModule != null;

/**
 * The production transport — wraps the Kotlin `MetaWearablesModule` that talks
 * to `com.meta.wearable:mwdat-*`. Throws when the native side is absent (web,
 * iOS, or an app built without the plugin), which is the correct answer:
 * capability questions about glasses must not silently succeed.
 */
export function createNativeTransport(): MetaWearablesTransport {
  if (!nativeModule) {
    throw new Error(
      "@viro-external/meta-wearables: native module not found — " +
        "add the app.plugin and rebuild with prebuild"
    );
  }
  const mod = nativeModule;
  let initialized = false;
  return {
    async getDeviceCapabilities() {
      if (!initialized) {
        await mod.initialize();
        initialized = true;
      }
      return mod.getDeviceCapabilities();
    },
    async dispose() {
      await mod.stopSession();
    },
  };
}

/** Direct module access for flows richer than the transport contract
 *  (registration UX, session lifecycle, mock devices, event streams). */
export const MetaWearables = {
  async initialize(): Promise<boolean> {
    return requireNative().initialize();
  },
  async startRegistration(): Promise<void> {
    return requireNative().startRegistration();
  },
  async getRegistrationState(): Promise<MetaWearablesRegistrationState> {
    return requireNative().getRegistrationState();
  },
  async getDevices(): Promise<MetaWearablesDevice[]> {
    return requireNative().getDevices();
  },
  async checkPermission(permission: string): Promise<string> {
    return requireNative().checkPermission(permission);
  },
  async startSession(): Promise<boolean> {
    return requireNative().startSession();
  },
  async stopSession(): Promise<void> {
    return requireNative().stopSession();
  },
  async attachCapability(name: MetaWearablesCapability): Promise<boolean> {
    return requireNative().attachCapability(name);
  },
  async detachCapability(name: MetaWearablesCapability): Promise<void> {
    return requireNative().detachCapability(name);
  },
  async enableMockDevice(model?: string): Promise<boolean> {
    return requireNative().enableMockDevice(model);
  },
  async disableMockDevice(): Promise<void> {
    return requireNative().disableMockDevice();
  },
};

function requireNative(): NativeMetaWearablesModule {
  if (!nativeModule) {
    throw new Error(
      "@viro-external/meta-wearables: native module not found — " +
        "add the app.plugin and rebuild with prebuild"
    );
  }
  return nativeModule;
}

export type MetaWearablesEvents = {
  onRegistrationState: (event: { state: MetaWearablesRegistrationState }) => void;
  onDevicesChanged: (event: { devices: MetaWearablesDevice[] }) => void;
  onSessionState: (event: { state: MetaWearablesSessionState }) => void;
  onSessionError: (event: { error: string }) => void;
};

export function addMetaWearablesListener<K extends keyof MetaWearablesEvents>(
  event: K,
  listener: MetaWearablesEvents[K]
) {
  // Native module proxies are already EventEmitters as of SDK 52 — the wrapper
  // just carries the typed events map.
  const emitter = new EventEmitter<MetaWearablesEvents>(
    requireNative() as unknown as EventEmitter<MetaWearablesEvents>
  );
  return emitter.addListener(event, listener);
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
