import React, { useCallback } from "react";
import { SpatialVideo, type SpatialVideoProps } from "./SpatialVideo";
import {
  SpatialVideoPlayer,
  useSpatialVideoPlayerSnapshot,
} from "./SpatialVideoPlayer";
import type {
  SpatialVideoHandle,
  SpatialVideoPlayerSnapshot,
} from "./types";

export type SpatialVideoPlayerViewProps = Omit<
  SpatialVideoProps,
  | "source"
  | "paused"
  | "muted"
  | "loop"
  | "volume"
  | "onBufferStart"
  | "onBufferEnd"
  | "onFinish"
  | "onError"
  | "onUpdateTime"
> & {
  player: SpatialVideoPlayer;
  onReady?: () => void;
  onStatusChange?: (
    snapshot: SpatialVideoPlayerSnapshot
  ) => void;
};

export function SpatialVideoPlayerView({
  player,
  onReady,
  onStatusChange,
  ...sceneProps
}: SpatialVideoPlayerViewProps): React.ReactElement | null {
  const snapshot = useSpatialVideoPlayerSnapshot(player);

  React.useEffect(() => {
    onStatusChange?.(snapshot);
  }, [onStatusChange, snapshot]);

  const attach = useCallback(
    (ref: SpatialVideoHandle | null) => {
      player.attachNativeRef(ref);
    },
    [player]
  );

  if (!snapshot.source) return null;

  return (
    <SpatialVideo
      {...sceneProps}
      ref={attach}
      source={snapshot.source}
      paused={snapshot.paused}
      muted={snapshot.muted}
      volume={snapshot.volume}
      loop={snapshot.loop}
      onBufferStart={() => player.handleBufferStart()}
      onBufferEnd={() => {
        player.handleBufferEnd();
        onReady?.();
      }}
      onFinish={() => player.handleFinish()}
      onError={(error) => player.handleError(error)}
      onUpdateTime={(time, duration) =>
        player.handleTimeUpdate(time, duration)
      }
    />
  );
}
