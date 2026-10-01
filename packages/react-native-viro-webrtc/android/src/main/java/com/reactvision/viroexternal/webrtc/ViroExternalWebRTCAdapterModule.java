package com.reactvision.viroexternal.webrtc;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.oney.WebRTCModule.ViroExternalWebRTCFrames;

public final class ViroExternalWebRTCAdapterModule extends ReactContextBaseJavaModule {
    public static final String NAME = "ViroExternalWebRTCAdapter";

    public ViroExternalWebRTCAdapterModule(ReactApplicationContext context) {
        super(context);
        ViroExternalWebRTCFrames.initialize(context);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean install() {
        ViroExternalWebRTCFrames.initialize(getReactApplicationContext());
        return true;
    }
}
