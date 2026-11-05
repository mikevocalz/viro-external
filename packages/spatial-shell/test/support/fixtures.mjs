/**
 * Android project fixtures shaped like an Expo prebuild with react-viro
 * (`xRMode: ['QUEST', 'PICO']`), expo-horizon-core's quest flavor and
 * @expo-pico/core's pico flavor.
 */

/** Parsed main manifest: MainActivity plus Viro's `.VRActivity`. */
export function mainManifest() {
  return {
    manifest: {
      $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
      application: [
        {
          $: { "android:name": ".MainApplication" },
          activity: [
            { $: { "android:name": ".MainActivity", "android:exported": "true" } },
            { $: { "android:name": ".VRActivity", "android:exported": "true" } },
          ],
        },
      ],
    },
  };
}

/** Parsed quest flavor manifest, as expo-horizon-core writes it without SDK options. */
export function questManifest() {
  return {
    manifest: {
      $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
      application: [{ activity: [{ $: { "android:name": ".MainActivity" } }] }],
    },
  };
}

/** Parsed pico flavor manifest with @expo-pico/core's own panel activity. */
export function picoManifest({ withCorePanel = true } = {}) {
  const activity = [{ $: { "android:name": ".MainActivity" } }];
  if (withCorePanel) {
    activity.push({
      $: { "android:name": "expo.modules.pico.PicoPanelActivity", "android:exported": "false" },
      "meta-data": [{ $: { "android:name": "pico:activity.data", "android:value": "core" } }],
    });
  }
  return {
    manifest: {
      $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
      application: [{ activity }],
    },
  };
}

export const MAIN_APPLICATION_KT = `package com.example.app

import android.app.Application
import expo.modules.ApplicationLifecycleDispatcher

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }
}
`;

export const APP_BUILD_GRADLE = `apply plugin: "com.android.application"

android {
    namespace "com.example.app"
    defaultConfig { applicationId "com.example.app" }
}

dependencies {
    implementation("com.facebook.react:react-android")
}

// expo-horizon-quest: Meta VR Layout SDK
dependencies {
    questImplementation platform("com.meta.metavrx:bom:1.2026.0.0")
    questImplementation "com.meta.metavrx.layout:layout-compat"
}

// expo-horizon-quest: begin quest flavor
android {
    productFlavors {
        quest {
            dimension "device"
            minSdkVersion 29
        }
    }
}
// expo-horizon-quest: end quest flavor
`;
