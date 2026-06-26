# CMakeLists.txt for @viro-external/splat-pass
#
# Produces `libsplat_pass.so`. The Java module
# `com.viromedia.bridge.module.ViroSplatPassModule` calls
# `System.loadLibrary("splat_pass")` on class-init to load this binary.
#
# Required CMake cache vars (set from the host gradle):
#   -DVIROCORE_INCLUDE_DIR=<path-to-virocore/ViroRenderer>
#   -DVIROCORE_ANDROID_INCLUDE_DIR=<path-to-virocore/android/sharedCode/src/main/cpp>
#
# These supply VRORenderPass.h, VROChoreographer.h, PersistentRef.h, and
# the rest of virocore's render-pass surface. We DO NOT vendor virocore
# here — the host app build sees both repos via the workspace layout.

cmake_minimum_required(VERSION 3.22)
project(splat_pass CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 16KB-aligned ELF for Android 15+ Play Store policy.
add_link_options("-Wl,-z,max-page-size=16384")

if(NOT DEFINED VIROCORE_INCLUDE_DIR)
    message(FATAL_ERROR
        "splat_pass: VIROCORE_INCLUDE_DIR not set. "
        "Pass -DVIROCORE_INCLUDE_DIR=<path> from the host gradle.")
endif()

if(NOT DEFINED VIROCORE_ANDROID_INCLUDE_DIR)
    message(FATAL_ERROR
        "splat_pass: VIROCORE_ANDROID_INCLUDE_DIR not set. "
        "Pass -DVIROCORE_ANDROID_INCLUDE_DIR=<path> from the host gradle.")
endif()

add_library(splat_pass SHARED
    src/GLStateScope.cpp
    src/SplatBuffers.cpp
    src/VROSplatRenderPass.cpp
    src/ViroSplatPassRegistry.cpp
    src/ViroSplatPassJNI.cpp
    src/SpzReader.cpp
)

target_include_directories(splat_pass
    PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${VIROCORE_INCLUDE_DIR}
    ${VIROCORE_INCLUDE_DIR}/capi
    ${VIROCORE_ANDROID_INCLUDE_DIR}
    ${VIROCORE_ANDROID_INCLUDE_DIR}/jni
)

find_library(log_lib log)
find_library(android_lib android)
find_library(EGL_lib EGL)
find_library(GLESv3_lib GLESv3)

# Link against the prebuilt libviro_renderer.so. The host gradle must
# pass VIROCORE_LIB_DIR pointing at the per-ABI dir that contains it
# (typically the virocore build output, NOT the host's merged jniLibs
# which doesn't exist yet at this link step).
if(NOT DEFINED VIROCORE_LIB_DIR)
    message(FATAL_ERROR
        "splat_pass: VIROCORE_LIB_DIR not set. "
        "Pass -DVIROCORE_LIB_DIR=<path-to-arm64-v8a-with-libviro_renderer.so> "
        "from the host gradle.")
endif()
add_library(viro_renderer SHARED IMPORTED)
set_target_properties(viro_renderer PROPERTIES
    IMPORTED_LOCATION "${VIROCORE_LIB_DIR}/libviro_renderer.so")

target_link_libraries(splat_pass
    PRIVATE
    ${log_lib}
    ${android_lib}
    ${EGL_lib}
    ${GLESv3_lib}
    viro_renderer
)

target_compile_options(splat_pass PRIVATE
    -Wall
    -Wno-unused-parameter
)
