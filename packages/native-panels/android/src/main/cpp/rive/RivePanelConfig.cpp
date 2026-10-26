//
//  RivePanelConfig.cpp — @viro-external/native-panels
//

#include "RivePanelConfig.hpp"

#include "../vendor/virocore/VROPanelCoverage.h"

#include <cmath>
#include <cstring>
#include <limits>
#include <stdexcept>
#include <string>

namespace margelo::nitro::nativepanels::rive {

namespace {

std::string describe(double value) {
  if (std::isnan(value)) return "NaN";
  if (std::isinf(value)) return value > 0 ? "Infinity" : "-Infinity";
  return std::to_string(value);
}

int32_t checkedSide(double value, const char* field) {
  const int32_t side = checkedInt32(value, field);
  if (side < 1 || side > kMaxPanelSidePx) {
    throw std::invalid_argument(std::string("RivePanel ") + field + " must be an integer from 1 to " +
                                std::to_string(kMaxPanelSidePx) + ", got " + describe(value));
  }
  return side;
}

float checkedAlignment(double value, const char* field) {
  if (!std::isfinite(value) || value < -1.0 || value > 1.0) {
    throw std::invalid_argument(std::string("RivePanel ") + field + " must be from -1 to 1, got " + describe(value));
  }
  return static_cast<float>(value);
}

float checkedPanelMeters(double value, const char* field) {
  if (!std::isfinite(value) || !(value > 0.0)) {
    throw std::invalid_argument(std::string("RivePanel cornerRadiusM needs a positive ") + field +
                                " (the quad size in meters), got " + describe(value));
  }
  return static_cast<float>(value);
}

} // namespace

int32_t checkedInt32(double value, const char* field) {
  if (!std::isfinite(value) || std::floor(value) != value || value < std::numeric_limits<int32_t>::min() ||
      value > std::numeric_limits<int32_t>::max()) {
    throw std::invalid_argument(std::string("RivePanel ") + field + " must be an integer, got " + describe(value));
  }
  return static_cast<int32_t>(value);
}

RivePanelConfig resolveRivePanelConfig(const RivePanelConfigInput& input) {
  RivePanelConfig config;
  config.surfaceId = checkedInt32(input.surfaceId, "surfaceId");
  config.widthPx = checkedSide(input.widthPx, "widthPx");
  config.heightPx = checkedSide(input.heightPx, "heightPx");
  const auto fit = static_cast<int32_t>(input.fit);
  if (fit < static_cast<int32_t>(FitMode::Fill) || fit > static_cast<int32_t>(FitMode::ScaleDown)) {
    throw std::invalid_argument("RivePanel fit is not a known value: " + std::to_string(fit));
  }
  config.fit = input.fit;
  config.alignmentX = checkedAlignment(input.alignmentX, "alignmentX");
  config.alignmentY = checkedAlignment(input.alignmentY, "alignmentY");
  if (!std::isfinite(input.maxFrameRateHz) || !(input.maxFrameRateHz > 0.0) || input.maxFrameRateHz > 1000.0) {
    throw std::invalid_argument("RivePanel maxFrameRateHz must be above 0 and at most 1000, got " +
                                describe(input.maxFrameRateHz));
  }
  config.maxFrameRateHz = static_cast<float>(input.maxFrameRateHz);
  if (!std::isfinite(input.cornerRadiusM) || input.cornerRadiusM < 0.0) {
    throw std::invalid_argument("RivePanel cornerRadiusM must be a finite number of meters >= 0, got " +
                                describe(input.cornerRadiusM));
  }
  if (input.cornerRadiusM > 0.0) {
    const float widthM = checkedPanelMeters(input.panelWidthM, "panelWidthM");
    const float heightM = checkedPanelMeters(input.panelHeightM, "panelHeightM");
    const VROPanelCornerRadii radii =
        VROPanelCornerRadiiPx(static_cast<float>(input.cornerRadiusM), widthM, heightM,
                              static_cast<float>(config.widthPx), static_cast<float>(config.heightPx));
    config.coverageRadiusXPx = radii.x;
    config.coverageRadiusYPx = radii.y;
  }
  return config;
}

void checkPointerPosition(double xPx, double yPx) {
  if (!std::isfinite(xPx) || !std::isfinite(yPx)) {
    throw std::invalid_argument("RivePanel pointer position must be finite, got (" + describe(xPx) + ", " +
                                describe(yPx) + ")");
  }
}

PointerCommands pointerCommands(PointerPhase phase, double xPx, double yPx) {
  checkPointerPosition(xPx, yPx);
  const auto x = static_cast<float>(xPx);
  const auto y = static_cast<float>(yPx);
  PointerCommands result;
  switch (phase) {
    case PointerPhase::Down: result.commands[0] = {PointerCall::Down, x, y}; result.count = 1; return result;
    case PointerPhase::Move: result.commands[0] = {PointerCall::Move, x, y}; result.count = 1; return result;
    case PointerPhase::Up: result.commands[0] = {PointerCall::Up, x, y}; result.count = 1; return result;
    case PointerPhase::Cancel:
      result.commands[0] = {PointerCall::Move, kPointerCancelPx, kPointerCancelPx};
      result.commands[1] = {PointerCall::Up, kPointerCancelPx, kPointerCancelPx};
      result.count = 2;
      return result;
  }
  throw std::invalid_argument("RivePanel pointer phase is not a known value: " +
                              std::to_string(static_cast<int32_t>(phase)));
}

float checkedViewModelNumber(const std::string& path, double value) {
  if (!std::isfinite(value) || std::fabs(value) > std::numeric_limits<float>::max()) {
    throw std::invalid_argument("Rive view-model number '" + path + "' must be finite and fit in a float, got " +
                                describe(value));
  }
  return static_cast<float>(value);
}

void checkRiveFileBytes(const uint8_t* bytes, size_t length) {
  if (bytes == nullptr || length == 0) {
    throw std::invalid_argument("RiveFile is empty");
  }
  if (length > kMaxRiveFileBytes) {
    throw std::invalid_argument("RiveFile is " + std::to_string(length) + " bytes; the limit is " +
                                std::to_string(kMaxRiveFileBytes));
  }
  if (length < 4 || std::memcmp(bytes, "RIVE", 4) != 0) {
    throw std::invalid_argument("RiveFile does not start with the RIVE signature; is this a .riv file?");
  }
}

} // namespace margelo::nitro::nativepanels::rive
