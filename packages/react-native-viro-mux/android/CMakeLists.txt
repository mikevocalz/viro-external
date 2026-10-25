cmake_minimum_required(VERSION 3.22.1)
project(NitroViroMux LANGUAGES C CXX)

# The only hand-written C++ is the JNI_OnLoad adapter; all bridge logic lives
# in Kotlin (HybridViroGPUTextureModule) on top of com.viro.core.
add_library(NitroViroMux SHARED
        src/main/cpp/cpp-adapter.cpp
)
target_compile_features(NitroViroMux PUBLIC cxx_std_20)

# Nitrogen specs: adds the generated sources, include dirs, fbjni / NitroModules
# / ReactAndroid links and Folly definitions to the NitroViroMux target.
include(${CMAKE_CURRENT_SOURCE_DIR}/../nitrogen/generated/android/NitroViroMux+autolinking.cmake)

target_include_directories(NitroViroMux PRIVATE "src/main/cpp")

find_library(LOG_LIB log)
target_link_libraries(NitroViroMux ${LOG_LIB} android)

# 16KB ELF page alignment (PICO / Android 15) — belt-and-braces on top of
# -DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON in build.gradle.
# See doc/Native-Android.md and mikevocalz/virocore scripts/verify-16kb-alignment.py.
target_link_options(NitroViroMux PRIVATE "-Wl,-z,max-page-size=16384")
