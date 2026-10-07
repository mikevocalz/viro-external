import React from 'react';
import { NativeModules } from 'react-native';
import {
  ViroExternalVideo,
  type ViroExternalVideoProps,
} from '@reactvision/react-viro';

export const VIRO_WEBRTC_PROVIDER = {
  android: 'com.oney.WebRTCModule.ViroExternalWebRTCFrames',
  apple: 'ViroExternalWebRTCFrames',
} as const;

let installed = false;

export function installViroWebRTCAdapter(): void {
  if (installed) return;
  installed = true;
  NativeModules.ViroExternalWebRTCAdapter?.install?.();
}

export type ViroWebRTCVideoProps = Omit<
  ViroExternalVideoProps,
  'sourceClass'
>;

/**
 * Fishjam/react-native-webrtc convenience wrapper.
 *
 * sourceKey is MediaStream.toURL(). Importing/rendering this component ensures
 * the native adapter has captured the current WebRTCModule before Viro asks the
 * provider for a sink.
 */
export function ViroWebRTCVideo(props: ViroWebRTCVideoProps) {
  installViroWebRTCAdapter();
  return (
    <ViroExternalVideo
      {...props}
      sourceClass={VIRO_WEBRTC_PROVIDER}
    />
  );
}
