cmake_minimum_required(VERSION 3.22.1)
project(NitroNativePanels LANGUAGES C CXX)

# The whiteboard renderer is Kotlin (android.graphics.Canvas on the
# Viro-owned Surface). The Rive HybridObjects are C++ and call ViroCore's
# VRORivePanel in libviro_renderer.so.
add_library(NitroNativePanels SHARED
        src/main/cpp/cpp-adapter.cpp
        src/main/cpp/rive/HybridRiveFile.cpp
        src/main/cpp/rive/HybridRivePanel.cpp
        src/main/cpp/rive/RiveFileReader.cpp
        src/main/cpp/rive/RivePanelConfig.cpp
)
target_compile_features(NitroNativePanels PUBLIC cxx_std_20)

# Nitrogen specs: generated sources, include dirs, fbjni / NitroModules /
# ReactAndroid links and Folly definitions for the NitroNativePanels target.
include(${CMAKE_CURRENT_SOURCE_DIR}/../nitrogen/generated/android/NitroNativePanels+autolinking.cmake)

target_include_directories(NitroNativePanels PRIVATE "src/main/cpp" "src/main/cpp/rive")

# libviro_renderer.so comes from the app's Viro install, imported the way
# packages/orb-pass/native/CMakeLists.txt does. build.gradle extracts it from
# @reactvision/react-viro's viro_renderer AAR into
# VIRO_RENDERER_LIB_DIR/<abi>/; -PviroRendererLibDir overrides that. Viro ships
# arm64-v8a and armeabi-v7a only, so other ABIs build without the Rive panel
# (RivePanel.isAvailable is false there).
set(VIRO_RENDERER_SO "${VIRO_RENDERER_LIB_DIR}/${ANDROID_ABI}/libviro_renderer.so")
if(DEFINED VIRO_RENDERER_LIB_DIR AND EXISTS "${VIRO_RENDERER_SO}")
  add_library(viro_renderer SHARED IMPORTED)
  set_target_properties(viro_renderer PROPERTIES IMPORTED_LOCATION "${VIRO_RENDERER_SO}")
  target_sources(NitroNativePanels PRIVATE
          src/main/cpp/rive/HybridRiveViewModelInstance.cpp
          src/main/cpp/rive/JRiveSurfaceLink.cpp
          src/main/cpp/rive/RivePanelListeners.cpp
          src/main/cpp/rive/RiveSurfaceLink.cpp
          src/main/cpp/rive/RiveSurfaceTarget.cpp
  )
  target_compile_definitions(NitroNativePanels PRIVATE NATIVE_PANELS_WITH_VIRO_RIVE=1)
  target_link_libraries(NitroNativePanels viro_renderer)
else()
  message(STATUS "native-panels: no libviro_renderer.so for ${ANDROID_ABI} at '${VIRO_RENDERER_SO}'; "
                 "building without the Rive panel")
  target_compile_definitions(NitroNativePanels PRIVATE NATIVE_PANELS_WITH_VIRO_RIVE=0)
endif()

find_library(LOG_LIB log)
target_link_libraries(NitroNativePanels ${LOG_LIB} android)

# 16 KB ELF page alignment (PICO, Quest, Android 15), on top of
# -DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON in build.gradle.
target_link_options(NitroNativePanels PRIVATE "-Wl,-z,max-page-size=16384")
