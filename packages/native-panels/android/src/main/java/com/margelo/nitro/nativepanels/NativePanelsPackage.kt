package com.margelo.nitro.nativepanels

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Autolinking entry point. Loads libNitroNativePanels.so, whose JNI_OnLoad
 * registers the `nativepanels.*` hybrid classes with Nitro. Exposes no
 * classic React Native modules.
 */
class NativePanelsPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider { emptyMap() }

  companion object {
    init {
      NitroNativePanelsOnLoad.initializeNative()
    }
  }
}
