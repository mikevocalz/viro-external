//
//  RivePanelConfig.hpp — @viro-external/native-panels
//
//  Validates RivePanel options and converts them to the values VRORivePanel
//  takes. No Nitro, JNI or EGL dependency, so the host test in
//  android/src/test/cpp builds it with a desktop compiler.
//

#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

namespace margelo::nitro::nativepanels::rive {

// Same order and values as VRORivePanelFit and the generated RiveFit.
enum class FitMode : int32_t { Fill = 0, Contain = 1, Cover = 2, FitWidth = 3, FitHeight = 4, None = 5, ScaleDown = 6 };

enum class PointerPhase : int32_t { Down = 0, Move = 1, Up = 2, Cancel = 3 };

struct RivePanelConfigInput {
  double surfaceId = 0;
  double widthPx = 0;
  double heightPx = 0;
  FitMode fit = FitMode::Contain;
  double alignmentX = 0;
  double alignmentY = 0;
  double cornerRadiusM = 0;
  double panelWidthM = 0;
  double panelHeightM = 0;
  double maxFrameRateHz = 0;
};

struct RivePanelConfig {
  int32_t surfaceId = 0;
  int32_t widthPx = 0;
  int32_t heightPx = 0;
  FitMode fit = FitMode::Contain;
  float alignmentX = 0;
  float alignmentY = 0;
  // The radii the Viro consumer rounds with (VROPanelCornerRadiiPx), for hit testing.
  float coverageRadiusXPx = 0;
  float coverageRadiusYPx = 0;
  float maxFrameRateHz = 0;
};

// Largest panel side VRORivePanel accepts.
inline constexpr int32_t kMaxPanelSidePx = 8192;
// Largest file VRORivePanel::loadFile accepts.
inline constexpr size_t kMaxRiveFileBytes = 64u * 1024u * 1024u;

// Throws std::invalid_argument naming the bad field.
RivePanelConfig resolveRivePanelConfig(const RivePanelConfigInput& input);

// Throws std::invalid_argument unless value is an integer in int32 range.
int32_t checkedInt32(double value, const char* field);

// Throws std::invalid_argument unless both coordinates are finite.
void checkPointerPosition(double xPx, double yPx);

// Converts a view-model number to the float Rive stores. Throws
// std::invalid_argument when it is not finite or does not fit in a float.
float checkedViewModelNumber(const std::string& path, double value);

// Throws std::invalid_argument when the bytes are empty, larger than
// kMaxRiveFileBytes, or do not start with the "RIVE" signature.
void checkRiveFileBytes(const uint8_t* bytes, size_t length);

} // namespace margelo::nitro::nativepanels::rive
