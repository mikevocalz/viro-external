# CMakeLists.txt for @viro-external/orb-pass
#
# Produces libviro_orb_pass.so.
#
# Same host-integration model as splat-pass:
#   host app add_subdirectory(render-passes) → target viro_external_render_passes
#   host app add_subdirectory(orb-pass)      → this
#   host app add_subdirectory(splat-pass)    → mirrors above
#
# Requires cache vars set by the host gradle (same three virocore paths
# splat-pass needs, plus RENDER_PASSES linkage via the CMake target):
#   -DVIROCORE_INCLUDE_DIR=<path-to-virocore/ViroRenderer>
#   -DVIROCORE_ANDROID_INCLUDE_DIR=<path-to-virocore/android/sharedCode/src/main/cpp>
#   -DVIROCORE_LIB_DIR=<path-to-per-abi-with-libviro_renderer.so>

cmake_minimum_required(VERSION 3.22)
project(viro_orb_pass CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_link_options("-Wl,-z,max-page-size=16384")

if(NOT DEFINED VIROCORE_INCLUDE_DIR)
    message(FATAL_ERROR "orb_pass: VIROCORE_INCLUDE_DIR not set.")
endif()
if(NOT DEFINED VIROCORE_ANDROID_INCLUDE_DIR)
    message(FATAL_ERROR "orb_pass: VIROCORE_ANDROID_INCLUDE_DIR not set.")
endif()
if(NOT DEFINED VIROCORE_LIB_DIR)
    message(FATAL_ERROR "orb_pass: VIROCORE_LIB_DIR not set.")
endif()

add_library(viro_orb_pass SHARED
    src/VROOrbRenderPass.cpp
    src/ViroOrbPassJNI.cpp
)

target_include_directories(viro_orb_pass
    PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${VIROCORE_INCLUDE_DIR}
    ${VIROCORE_INCLUDE_DIR}/capi
    ${VIROCORE_ANDROID_INCLUDE_DIR}
    ${VIROCORE_ANDROID_INCLUDE_DIR}/jni
)

if(NOT TARGET viro_external_render_passes)
    message(FATAL_ERROR
        "orb_pass: expected CMake target `viro_external_render_passes`. "
        "Host must add_subdirectory @viro-external/render-passes/native BEFORE orb-pass.")
endif()

find_library(log_lib log)
find_library(EGL_lib EGL)
find_library(GLESv3_lib GLESv3)

add_library(viro_renderer SHARED IMPORTED)
set_target_properties(viro_renderer PROPERTIES
    IMPORTED_LOCATION "${VIROCORE_LIB_DIR}/libviro_renderer.so")

target_link_libraries(viro_orb_pass
    PRIVATE
    ${log_lib}
    ${EGL_lib}
    ${GLESv3_lib}
    viro_renderer
    viro_external_render_passes
)

target_compile_options(viro_orb_pass PRIVATE
    -Wall
    -Wno-unused-parameter
)
