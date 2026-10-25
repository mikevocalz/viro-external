#!/bin/sh
# Builds and runs the host test for the Rive panel's pure C++ layer
# (RivePanelConfig, RiveFileReader) with the desktop C++ compiler.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
out=$(mktemp -d)
trap 'rm -r "$out"' EXIT
"${CXX:-c++}" -std=c++20 -Wall -Wextra -Werror \
  "$here/RivePanelConfigTest.cpp" \
  "$here/../../main/cpp/rive/RivePanelConfig.cpp" \
  "$here/../../main/cpp/rive/RiveFileReader.cpp" \
  -o "$out/rive-panel-config-test"
"$out/rive-panel-config-test"
