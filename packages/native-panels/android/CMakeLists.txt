cmake_minimum_required(VERSION 3.22.1)
project(NitroNativePanels LANGUAGES C CXX)

# The only hand-written C++ is the JNI_OnLoad adapter. The whiteboard
# renderer is Kotlin (android.graphics.Canvas on the Viro-owned Surface).
add_library(NitroNativePanels SHARED
        src/main/cpp/cpp-adapter.cpp
)
target_compile_features(NitroNativePanels PUBLIC cxx_std_20)

# Nitrogen specs: generated sources, include dirs, fbjni / NitroModules /
# ReactAndroid links and Folly definitions for the NitroNativePanels target.
include(${CMAKE_CURRENT_SOURCE_DIR}/../nitrogen/generated/android/NitroNativePanels+autolinking.cmake)

target_include_directories(NitroNativePanels PRIVATE "src/main/cpp")

find_library(LOG_LIB log)
target_link_libraries(NitroNativePanels ${LOG_LIB} android)

# 16 KB ELF page alignment (PICO, Quest, Android 15), on top of
# -DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON in build.gradle.
target_link_options(NitroNativePanels PRIVATE "-Wl,-z,max-page-size=16384")
