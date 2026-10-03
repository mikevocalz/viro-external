import * as React from "react";
import { mediaSourceKey } from "./source";
import type {
  MediaSource,
  SpatialPlayerStatus,
  SpatialVideoHandle,
  SpatialVideoPlayerSnapshot,
} from "./types";

type Listener = () => void;

const idleStatus: SpatialPlayerStatus = {
  status: "idle",
  currentTime: 0,
  duration: 0,
  muted: false,
  volume: 1,
  loop: false,
};

export class SpatialVideoPlayer {
  protected sourceState?: MediaSource;
  private nativeRef: SpatialVideoHandle | null = null;
  private listeners = new Set<Listener>();
  private pendingSeek: number | null = null;
  private resumeAfterReady: number | null = null;
  private statusState: SpatialPlayerStatus = {
    ...idleStatus,
  };
  private snapshot: SpatialVideoPlayerSnapshot;
  private released = false;

  paused = true;
  muted = false;
  volume = 1;
  loop = false;

  constructor(source?: MediaSource) {
    this.sourceState = source;
    this.statusState = {
      ...idleStatus,
      status: source ? "loading" : "idle",
    };
    this.snapshot = this.createSnapshot();
  }

  get source(): MediaSource | undefined {
    return this.sourceState;
  }

  get status(): SpatialPlayerStatus["status"] {
    return this.statusState.status;
  }

  get currentTime(): number {
    return this.statusState.currentTime;
  }

  get duration(): number {
    return this.statusState.duration;
  }

  get error(): string | undefined {
    return this.statusState.error;
  }

  play(): void {
    this.assertAlive();
    this.paused = false;

    if (
      this.statusState.status === "ready" ||
      this.statusState.status === "paused" ||
      this.statusState.status === "ended"
    ) {
      if (
        this.statusState.status === "ended" &&
        this.statusState.currentTime >= this.statusState.duration
      ) {
        this.seekTo(0);
      }
      this.statusState = {
        ...this.statusState,
        status: "playing",
      };
    }

    this.commit();
  }

  pause(): void {
    this.assertAlive();
    this.paused = true;

    if (
      this.statusState.status === "playing" ||
      this.statusState.status === "ready" ||
      this.statusState.status === "buffering"
    ) {
      this.statusState = {
        ...this.statusState,
        status: "paused",
      };
    }

    this.commit();
  }

  togglePlay(): void {
    if (this.paused) this.play();
    else this.pause();
  }

  replay(): void {
    this.assertAlive();
    this.seekTo(0);
    this.play();
  }

  seekTo(seconds: number): void {
    this.assertAlive();
    const target = Math.max(
      0,
      Number.isFinite(seconds) ? seconds : 0
    );

    if (this.nativeRef) {
      this.nativeRef.seekToTime(target);
    } else {
      this.pendingSeek = target;
    }

    this.statusState = {
      ...this.statusState,
      currentTime: target,
    };
    this.commit();
  }

  seekBy(seconds: number): void {
    this.seekTo(this.statusState.currentTime + seconds);
  }

  setMuted(muted: boolean): void {
    this.assertAlive();
    this.muted = muted;
    this.statusState = {
      ...this.statusState,
      muted,
    };
    this.commit();
  }

  setVolume(volume: number): void {
    this.assertAlive();
    const next = clamp(volume, 0, 1);
    this.volume = next;
    this.statusState = {
      ...this.statusState,
      volume: next,
    };
    this.commit();
  }

  setLoop(loop: boolean): void {
    this.assertAlive();
    this.loop = loop;
    this.statusState = {
      ...this.statusState,
      loop,
    };
    this.commit();
  }

  replace(
    source: MediaSource,
    options?: { resumeAt?: number }
  ): void {
    this.assertAlive();
    this.sourceState = source;
    this.pendingSeek = null;
    this.resumeAfterReady =
      options?.resumeAt != null &&
      Number.isFinite(options.resumeAt)
        ? Math.max(0, options.resumeAt)
        : null;
    this.statusState = {
      ...idleStatus,
      status: "loading",
      muted: this.muted,
      volume: this.volume,
      loop: this.loop,
    };
    this.commit();
  }

  release(): void {
    if (this.released) return;
    this.released = true;
    this.nativeRef = null;
    this.pendingSeek = null;
    this.resumeAfterReady = null;
    this.sourceState = undefined;
    this.paused = true;
    this.statusState = { ...idleStatus };
    this.commit();
    this.listeners.clear();
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SpatialVideoPlayerSnapshot =>
    this.snapshot;

  attachNativeRef(ref: SpatialVideoHandle | null): void {
    this.nativeRef = ref;
    if (ref && this.pendingSeek != null) {
      ref.seekToTime(this.pendingSeek);
      this.pendingSeek = null;
    }
  }

  handleBufferStart(): void {
    if (!this.sourceState || this.released) return;
    this.statusState = {
      ...this.statusState,
      status: "buffering",
    };
    this.commit();
  }

  handleBufferEnd(): void {
    if (!this.sourceState || this.released) return;

    if (this.resumeAfterReady != null) {
      const resumeAt = this.resumeAfterReady;
      this.resumeAfterReady = null;

      if (this.nativeRef) {
        this.nativeRef.seekToTime(resumeAt);
      } else {
        this.pendingSeek = resumeAt;
      }

      this.statusState = {
        ...this.statusState,
        currentTime: resumeAt,
      };
    }

    this.statusState = {
      ...this.statusState,
      status: this.paused ? "ready" : "playing",
    };
    this.commit();
  }

  handleTimeUpdate(
    currentTime: number,
    duration: number
  ): void {
    if (this.released) return;
    const status = this.paused
      ? this.statusState.status === "loading"
        ? "ready"
        : "paused"
      : "playing";
    // Viro reports time many times a second. Re-rendering the panel and
    // re-sending props to the native video on each tick made playback judder;
    // the UI shows whole seconds, so commit only when one of those changes.
    if (
      Math.floor(currentTime) === Math.floor(this.statusState.currentTime) &&
      duration === this.statusState.duration &&
      status === this.statusState.status
    ) {
      return;
    }
    this.statusState = {
      ...this.statusState,
      currentTime,
      duration,
      status: this.paused
        ? this.statusState.status === "loading"
          ? "ready"
          : "paused"
        : "playing",
    };
    this.commit();
  }

  handleFinish(): void {
    if (this.released) return;
    this.paused = !this.loop;
    this.statusState = {
      ...this.statusState,
      status: this.loop ? "playing" : "ended",
      currentTime: this.loop ? 0 : this.statusState.duration,
    };
    this.commit();
  }

  handleError(error: unknown): void {
    if (this.released) return;
    this.paused = true;
    this.statusState = {
      ...this.statusState,
      status: "error",
      error: extractErrorMessage(error),
    };
    this.commit();
  }

  private commit(): void {
    this.snapshot = this.createSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }

  private createSnapshot(): SpatialVideoPlayerSnapshot {
    return {
      source: this.sourceState,
      paused: this.paused,
      muted: this.muted,
      volume: this.volume,
      loop: this.loop,
      status: this.statusState,
    };
  }

  private assertAlive(): void {
    if (this.released) {
      throw new Error(
        "SpatialVideoPlayer has been released."
      );
    }
  }
}

export function createSpatialVideoPlayer(
  source?: MediaSource
): SpatialVideoPlayer {
  return new SpatialVideoPlayer(source);
}

export function useSpatialVideoPlayer(
  source?: MediaSource,
  setup?: (player: SpatialVideoPlayer) => void
): SpatialVideoPlayer {
  const playerRef = React.useRef<SpatialVideoPlayer | null>(
    null
  );

  if (playerRef.current === null) {
    const player = new SpatialVideoPlayer(source);
    setup?.(player);
    playerRef.current = player;
  }

  const player = playerRef.current;
  const sourceKey = mediaSourceKey(source);
  const sourceKeyRef = React.useRef(sourceKey);

  React.useEffect(() => {
    if (sourceKeyRef.current === sourceKey) return;
    sourceKeyRef.current = sourceKey;
    if (source != null) {
      player.replace(source);
    }
  }, [player, source, sourceKey]);

  React.useEffect(
    () => () => {
      player.release();
    },
    [player]
  );

  return player;
}

export function useSpatialVideoPlayerSnapshot(
  player: SpatialVideoPlayer
): SpatialVideoPlayerSnapshot {
  return React.useSyncExternalStore(
    player.subscribe,
    player.getSnapshot,
    player.getSnapshot
  );
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "nativeEvent" in error
  ) {
    const nativeEvent = (
      error as { nativeEvent?: { error?: string } }
    ).nativeEvent;
    if (nativeEvent?.error) return nativeEvent.error;
  }
  return String(error);
}
