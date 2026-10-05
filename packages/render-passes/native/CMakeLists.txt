# CMakeLists.txt for @viro-external/render-passes
#
# Produces `libviro_external_render_passes.so`.
#
# Sibling packages (splat-pass, orb-pass) link against this library to
# reach ViroExternalPassRegistry — the C++ attach path. Java-side
# module `com.viromedia.bridge.module.ViroExternalPassModule` calls
# `System.loadLibrary("viro_external_render_passes")` for the
# diagnostics-only JNI surface (childCount, childIds).
#
# Required CMake cache vars (set from the host gradle):
#   -DVIROCORE_INCLUDE_DIR=<path-to-virocore/ViroRenderer>
#   -DVIROCORE_ANDROID_INCLUDE_DIR=<path-to-virocore/android/sharedCode/src/main/cpp>
#   -DVIROCORE_LIB_DIR=<path-to-per-abi-dir-with-libviro_renderer.so>

cmake_minimum_required(VERSION 3.22)
project(viro_external_render_passes CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 16KB-aligned ELF for Android 15+ Play Store policy.
add_link_options("-Wl,-z,max-page-size=16384")

option(VIRO_EXTERNAL_ENABLE_ESKIU
    "Build and link the optional Eskiu spatial-media math backend"
    OFF)

if(NOT DEFINED VIROCORE_INCLUDE_DIR)
    message(FATAL_ERROR
        "render-passes: VIROCORE_INCLUDE_DIR not set. "
        "Pass -DVIROCORE_INCLUDE_DIR=<path> from the host gradle.")
endif()
if(NOT DEFINED VIROCORE_ANDROID_INCLUDE_DIR)
    message(FATAL_ERROR
        "render-passes: VIROCORE_ANDROID_INCLUDE_DIR not set. "
        "Pass -DVIROCORE_ANDROID_INCLUDE_DIR=<path> from the host gradle.")
endif()
if(NOT DEFINED VIROCORE_LIB_DIR)
    message(FATAL_ERROR
        "render-passes: VIROCORE_LIB_DIR not set. "
        "Pass -DVIROCORE_LIB_DIR=<path-to-arm64-v8a-with-libviro_renderer.so> "
        "from the host gradle.")
endif()

add_library(viro_external_render_passes SHARED
    src/VROMultiplexRenderPass.cpp
    src/ViroExternalPassRegistry.cpp
    src/VRONoOpRenderPass.cpp
    src/ViroExternalPassJNI.cpp
)

target_include_directories(viro_external_render_passes
    PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    PRIVATE
    ${VIROCORE_INCLUDE_DIR}
    ${VIROCORE_INCLUDE_DIR}/capi
    ${VIROCORE_ANDROID_INCLUDE_DIR}
    ${VIROCORE_ANDROID_INCLUDE_DIR}/jni
)

find_library(log_lib log)
find_library(android_lib android)

add_library(viro_renderer SHARED IMPORTED)
set_target_properties(viro_renderer PROPERTIES
    IMPORTED_LOCATION "${VIROCORE_LIB_DIR}/libviro_renderer.so")

target_link_libraries(viro_external_render_passes
    PRIVATE
    ${log_lib}
    ${android_lib}
    viro_renderer
)

if(VIRO_EXTERNAL_ENABLE_ESKIU)
    find_program(ESKIUC_EXECUTABLE eskiuc)
    if(NOT ESKIUC_EXECUTABLE)
        message(FATAL_ERROR
            "render-passes: VIRO_EXTERNAL_ENABLE_ESKIU=ON but eskiuc was not found.")
    endif()

    set(ESKIU_SOURCE
        "${CMAKE_CURRENT_SOURCE_DIR}/eskiu/spatial_media_math.esk")
    set(ESKIU_OBJECT
        "${CMAKE_CURRENT_BINARY_DIR}/spatial_media_math.o")
    set(ESKIU_ARCHIVE
        "${CMAKE_CURRENT_BINARY_DIR}/libviro_external_eskiu_math.a")

    add_custom_command(
        OUTPUT "${ESKIU_OBJECT}"
        COMMAND "${ESKIUC_EXECUTABLE}" "${ESKIU_SOURCE}" -O2 -o "${ESKIU_OBJECT}"
        DEPENDS "${ESKIU_SOURCE}"
        COMMENT "Compiling Eskiu spatial-media math"
        VERBATIM)

    add_custom_command(
        OUTPUT "${ESKIU_ARCHIVE}"
        COMMAND "${CMAKE_AR}" qc "${ESKIU_ARCHIVE}" "${ESKIU_OBJECT}"
        COMMAND "${CMAKE_RANLIB}" "${ESKIU_ARCHIVE}"
        DEPENDS "${ESKIU_OBJECT}"
        COMMENT "Archiving Eskiu spatial-media math"
        VERBATIM)

    add_custom_target(viro_external_eskiu_math
        DEPENDS "${ESKIU_ARCHIVE}")

    add_library(viro_external_eskiu_math_archive STATIC IMPORTED)
    set_target_properties(viro_external_eskiu_math_archive PROPERTIES
        IMPORTED_LOCATION "${ESKIU_ARCHIVE}")
    add_dependencies(
        viro_external_eskiu_math_archive
        viro_external_eskiu_math)

    target_link_libraries(
        viro_external_render_passes
        PRIVATE
        viro_external_eskiu_math_archive)
endif()

target_compile_options(viro_external_render_passes PRIVATE
    -Wall
    -Wno-unused-parameter
)
