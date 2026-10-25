//
//  RivePanelConfigTest.cpp — host test for the Rive panel's pure C++ layer.
//
//  Run from packages/native-panels:
//    sh android/src/test/cpp/run-host-tests.sh
//

#include "../../main/cpp/rive/RiveFileReader.hpp"
#include "../../main/cpp/rive/RivePanelConfig.hpp"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <functional>
#include <limits>
#include <stdexcept>
#include <string>
#include <unistd.h>

using namespace margelo::nitro::nativepanels::rive;

namespace {

int failures = 0;

void check(bool condition, const char* what) {
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", what);
    ++failures;
  }
}

void expectThrows(const std::function<void()>& run, const char* needle, const char* what) {
  try {
    run();
  } catch (const std::exception& error) {
    if (std::string(error.what()).find(needle) == std::string::npos) {
      std::fprintf(stderr, "FAIL: %s: message '%s' lacks '%s'\n", what, error.what(), needle);
      ++failures;
    }
    return;
  }
  std::fprintf(stderr, "FAIL: %s: did not throw\n", what);
  ++failures;
}

RivePanelConfigInput validInput() {
  RivePanelConfigInput input;
  input.surfaceId = 7;
  input.widthPx = 2496;
  input.heightPx = 1560;
  input.fit = FitMode::Contain;
  input.maxFrameRateHz = 72;
  return input;
}

bool near(float a, float b) {
  return std::fabs(a - b) < 1e-3f;
}

} // namespace

int main() {
  {
    const RivePanelConfig config = resolveRivePanelConfig(validInput());
    check(config.surfaceId == 7 && config.widthPx == 2496 && config.heightPx == 1560, "valid sizes pass through");
    check(config.coverageRadiusXPx == 0 && config.coverageRadiusYPx == 0, "no radius gives square hit test");
  }
  {
    // Chrome strip from panel-tokens.md: 0.021 m on a 0.6 x 0.375 m quad at 2496 x 1560.
    RivePanelConfigInput input = validInput();
    input.cornerRadiusM = 0.021;
    input.panelWidthM = 0.6;
    input.panelHeightM = 0.375;
    const RivePanelConfig config = resolveRivePanelConfig(input);
    check(near(config.coverageRadiusXPx, 0.021f * 2496 / 0.6f), "x radius is meters * px / m");
    check(near(config.coverageRadiusYPx, 0.021f * 1560 / 0.375f), "y radius is meters * px / m");
  }
  {
    // Pixel aspect differs from the panel aspect: the radii differ per axis.
    RivePanelConfigInput input = validInput();
    input.heightPx = 1248;
    input.cornerRadiusM = 0.021;
    input.panelWidthM = 0.6;
    input.panelHeightM = 0.375;
    const RivePanelConfig config = resolveRivePanelConfig(input);
    check(near(config.coverageRadiusXPx, 87.36f), "x radius per axis");
    check(near(config.coverageRadiusYPx, 69.888f), "y radius per axis");
  }
  {
    // Radius larger than half the short side clamps in meters first.
    RivePanelConfigInput input = validInput();
    input.cornerRadiusM = 5;
    input.panelWidthM = 1.6;
    input.panelHeightM = 1.0;
    const RivePanelConfig config = resolveRivePanelConfig(input);
    check(near(config.coverageRadiusYPx, 1560 / 2.0f), "clamped radius is half the short side");
  }
  expectThrows([] { auto i = validInput(); i.surfaceId = 1.5; resolveRivePanelConfig(i); }, "surfaceId", "fractional id");
  expectThrows([] { auto i = validInput(); i.widthPx = 0; resolveRivePanelConfig(i); }, "widthPx", "zero width");
  expectThrows([] { auto i = validInput(); i.heightPx = 8193; resolveRivePanelConfig(i); }, "heightPx", "huge height");
  expectThrows([] { auto i = validInput(); i.alignmentX = 1.5; resolveRivePanelConfig(i); }, "alignmentX", "alignment range");
  expectThrows([] { auto i = validInput(); i.maxFrameRateHz = 0; resolveRivePanelConfig(i); }, "maxFrameRateHz", "zero fps");
  expectThrows([] { auto i = validInput(); i.cornerRadiusM = -0.1; resolveRivePanelConfig(i); }, "cornerRadiusM", "negative radius");
  expectThrows([] { auto i = validInput(); i.cornerRadiusM = 0.02; resolveRivePanelConfig(i); }, "panelWidthM", "radius without size");
  expectThrows([] { auto i = validInput(); i.fit = static_cast<FitMode>(9); resolveRivePanelConfig(i); }, "fit", "bad fit");
  expectThrows([] { checkedInt32(std::numeric_limits<double>::quiet_NaN(), "pointerId"); }, "pointerId", "NaN pointer id");
  expectThrows([] { checkPointerPosition(1, std::numeric_limits<double>::infinity()); }, "finite", "infinite pointer");
  expectThrows([] { checkedViewModelNumber("tool", 1e40); }, "tool", "number beyond float");
  check(checkedViewModelNumber("tool", 2) == 2.0f, "number in range converts");

  const uint8_t rive[] = {'R', 'I', 'V', 'E', 7, 0};
  const uint8_t png[] = {0x89, 'P', 'N', 'G'};
  checkRiveFileBytes(rive, sizeof(rive));
  expectThrows([&] { checkRiveFileBytes(png, sizeof(png)); }, "RIVE signature", "non-riv bytes");
  expectThrows([&] { checkRiveFileBytes(rive, 0); }, "empty", "empty bytes");
  expectThrows([&] { checkRiveFileBytes(rive, kMaxRiveFileBytes + 1); }, "limit", "oversized bytes");

  check(localPathFromFileURL("file:///data/a%20b.riv") == "/data/a b.riv", "file URL decodes");
  check(localPathFromFileURL("/data/x.riv") == "/data/x.riv", "absolute path passes");
  expectThrows([] { localPathFromFileURL("https://x/y.riv"); }, "fromBytes", "http rejected");
  expectThrows([] { localPathFromFileURL("file://host/y.riv"); }, "absolute", "file host rejected");
  expectThrows([] { localPathFromFileURL("rel/y.riv"); }, "absolute", "relative rejected");

  {
    char path[] = "/tmp/rive-host-test-XXXXXX";
    const int fd = mkstemp(path);
    check(fd >= 0, "temp file");
    close(fd);
    { std::ofstream out(path, std::ios::binary); out.write(reinterpret_cast<const char*>(rive), sizeof(rive)); }
    check(readRiveFile(std::string("file://") + path).size() == sizeof(rive), "reads a .riv file");
    { std::ofstream out(path, std::ios::binary); out.write(reinterpret_cast<const char*>(png), sizeof(png)); }
    expectThrows([&] { readRiveFile(path); }, "RIVE signature", "reads and rejects a non-riv file");
    std::remove(path);
    expectThrows([&] { readRiveFile(path); }, "cannot open", "missing file");
  }

  if (failures == 0) std::printf("RivePanelConfigTest: all checks passed\n");
  return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
