//
//  RiveFileReader.hpp — @viro-external/native-panels
//
//  Reads a local .riv file named by a file:// URL or an absolute path. No
//  Nitro dependency; tested on the host.
//

#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace margelo::nitro::nativepanels::rive {

// "file:///a/b.riv" and "/a/b.riv" give "/a/b.riv". Percent escapes in a
// file:// URL are decoded. Throws std::invalid_argument for other schemes,
// relative paths and file://host/ URLs.
std::string localPathFromFileURL(const std::string& fileURL);

// Reads the whole file and checks it with checkRiveFileBytes. Throws
// std::runtime_error when it cannot be read.
std::vector<uint8_t> readRiveFile(const std::string& fileURL);

} // namespace margelo::nitro::nativepanels::rive
