import {
  createRiveSpatialSurface,
  disposeRiveSpatialSurface,
  ViroCoreRiveSpatialAdapter,
  type ViroCoreRiveNativeHost,
} from "@viro-external/ui";

type Config = Parameters<typeof createRiveSpatialSurface>[1];

/** The host and real .riv asset/config must come from the application. */
export function openRiveSession(host: ViroCoreRiveNativeHost, config: Config) {
  const adapter = new ViroCoreRiveSpatialAdapter(host);
  const handle = createRiveSpatialSurface(adapter, config);
  try {
    const caps = handle.getCapabilities();
    if (config.interactive && !caps.pointerInput) {
      throw new Error("This host does not provide Rive pointer input");
    }
    if (config.stateMachine && !caps.stateMachines) {
      throw new Error("This host does not provide Rive state machines");
    }
    if (config.fit && caps.supportedFits && !caps.supportedFits.includes(config.fit)) {
      throw new Error(`This host does not support fit=${config.fit}`);
    }
  } catch (error) {
    disposeRiveSpatialSurface(adapter, handle);
    throw error;
  }
  let disposed = false;
  return {
    play() { if (!disposed) handle.play(); },
    pause() { if (!disposed) handle.pause(); },
    setInput(name: string, value: boolean | number | string) {
      if (!disposed) handle.setStateMachineInput(name, value);
    },
    dispatchPointer(event: Parameters<typeof handle.dispatchPointer>[0]) {
      if (!disposed) handle.dispatchPointer(event);
    },
    dispose() {
      if (disposed) return;
      // Unsubscribe application input before calling this method.
      disposed = true;
      try { handle.cancelDrag(); }
      finally { disposeRiveSpatialSurface(adapter, handle); }
    },
  };
}
