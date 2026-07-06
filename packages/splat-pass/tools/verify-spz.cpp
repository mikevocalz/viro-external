// verify-spz.cpp — host-side smoke test: decode a real SPZ file with
// SpzReader and print first/last splat. Lets us validate the encoder +
// reader contract without needing the device.
//
// Build:
//   c++ -std=c++17 -I native/include \
//       native/src/SpzReader.cpp \
//       tools/verify-spz.cpp \
//       -o /tmp/verify-spz
//
// Run:
//   /tmp/verify-spz /tmp/test-grid.spz

#include "SpzReader.h"

#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <vector>

int main(int argc, char **argv) {
    if (argc != 2) {
        std::fprintf(stderr, "usage: %s <path.spz>\n", argv[0]);
        return 1;
    }
    std::ifstream f(argv[1], std::ios::binary);
    if (!f) { std::fprintf(stderr, "open failed\n"); return 1; }
    std::vector<uint8_t> bytes((std::istreambuf_iterator<char>(f)),
                               std::istreambuf_iterator<char>());
    using namespace viroexternal::splat;

    auto h = readSpzHeader(bytes.data(), bytes.size());
    if (h.error != SpzError::Ok) {
        std::fprintf(stderr, "header: %s\n", spzErrorString(h.error));
        return 1;
    }
    std::printf("header ok: version=%u points=%u shDegree=%u fractionalBits=%u flags=0x%02x\n",
                h.header.version, h.header.numPoints, h.header.shDegree,
                h.header.fractionalBits, h.header.flags);

    std::vector<float> splats(static_cast<size_t>(h.header.numPoints) * 16, 0.0f);
    SpzError err = decodeSpzBody(h.header,
                                 bytes.data() + h.bodyOffset,
                                 bytes.size() - h.bodyOffset,
                                 splats.data());
    if (err != SpzError::Ok) {
        std::fprintf(stderr, "body: %s\n", spzErrorString(err));
        return 1;
    }
    auto dump = [&](uint32_t i, const char *label) {
        const float *s = &splats[i * 16];
        std::printf("%s [%u]: pos=(%.3f, %.3f, %.3f)  rot=(%.2f, %.2f, %.2f, %.2f)  premultipliedRGBA=(%.2f, %.2f, %.2f, %.2f)\n",
                    label, i,
                    s[0], s[1], s[2],
                    s[8], s[9], s[10], s[11],
                    s[12], s[13], s[14], s[15]);
    };
    dump(0, "first");
    dump(h.header.numPoints / 2, "mid  ");
    dump(h.header.numPoints - 1, "last ");
    return 0;
}
