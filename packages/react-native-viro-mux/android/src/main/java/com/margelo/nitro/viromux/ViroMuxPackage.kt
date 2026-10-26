package com.margelo.nitro.viromux

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Autolinking entry point. Loads libNitroViroMux.so (whose JNI_OnLoad
 * registers the `viromux.ViroGPUTextureModule` hybrid class with Nitro) and exposes
 * the classic [ViroMuxPlayerModule] (ExoPlayer → surface-producer bridge).
 */
class ViroMuxPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == ViroMuxPlayerModule.NAME) ViroMuxPlayerModule(reactContext) else null

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
        mapOf(
            ViroMuxPlayerModule.NAME to ReactModuleInfo(
                ViroMuxPlayerModule.NAME,
                ViroMuxPlayerModule::class.java.name,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule
                false, // isTurboModule — classic module via interop layer
            )
        )
    }

    companion object {
        init {
            NitroViroMuxOnLoad.initializeNative()
        }
    }
}
