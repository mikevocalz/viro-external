import {
  createWorkletRuntime,
  scheduleOnRuntime,
  type WorkletRuntime,
} from "react-native-worklets";

let spatialWorker: WorkletRuntime | null = null;

/**
 * One long-lived worker runtime for CPU-heavy spatial preparation.
 *
 * Worklet runtimes have independent JS heaps, so creating one per panel,
 * scene node, or feature multiplies runtime memory and serialization costs.
 */
export function getSpatialWorkerRuntime(): WorkletRuntime {
  if (spatialWorker) return spatialWorker;

  spatialWorker = createWorkletRuntime({
    name: "viro-spatial-worker",
    enableNetworking: false,
  });

  return spatialWorker;
}

export function scheduleSpatialWorklet<Args extends unknown[]>(
  worklet: (...args: Args) => void,
  ...args: Args
): void {
  scheduleOnRuntime(getSpatialWorkerRuntime(), worklet, ...args);
}
