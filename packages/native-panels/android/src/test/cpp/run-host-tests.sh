#!/bin/sh
# Builds and runs the host tests for the Rive panel's pure C++ layer
# (RivePanelConfig, RiveFileReader, ReplayingListenerSet) with the desktop
# C++ compiler.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
out=$(mktemp -d)
trap 'rm -r "$out"' EXIT
cxx() { "${CXX:-c++}" -std=c++20 -Wall -Wextra -Werror "$@"; }
cxx "$here/RivePanelConfigTest.cpp" \
  "$here/../../main/cpp/rive/RivePanelConfig.cpp" \
  "$here/../../main/cpp/rive/RiveFileReader.cpp" \
  -o "$out/rive-panel-config-test"
cxx -pthread "$here/ReplayingListenerSetTest.cpp" -o "$out/replaying-listener-set-test"
"$out/rive-panel-config-test"
"$out/replaying-listener-set-test"
