project(NitroViroMux)
cmake_minimum_required(VERSION 3.9.0)

set (PACKAGE_NAME NitroViroMux)
set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)

# The only hand-written C++ is the JNI_OnLoad adapter; all bridge logic lives
# in Kotlin (HybridViroGPUTextureModule) on top of com.viro.core.
add_library(${PACKAGE_NAME} SHARED
        src/main/cpp/cpp-adapter.cpp
)

# Add Nitrogen specs
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NitroViroMux+autolinking.cmake)

include_directories(
        "src/main/cpp"
)

find_library(LOG_LIB log)

target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
)

# 16KB ELF page alignment (PICO / Android 15) — belt-and-braces on top of
# -DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON in build.gradle.
# See doc/Native-Android.md and mikevocalz/virocore scripts/verify-16kb-alignment.py.
target_link_options(${PACKAGE_NAME} PRIVATE "-Wl,-z,max-page-size=16384")
