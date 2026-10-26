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
// relative paths, file://host/ URLs, a NUL byte (raw or %00) and any ".."
// segment (raw or %2E%2E). The path is not otherwise restricted: any
// regular file the app process can read is accepted.
std::string localPathFromFileURL(const std::string& fileURL);

// Reads the whole file and checks it with checkRiveFileBytes. Throws
// std::invalid_argument when the path is not a regular file (directory,
// FIFO, device) or is over kMaxRiveFileBytes, and std::runtime_error when
// it cannot be opened or read.
std::vector<uint8_t> readRiveFile(const std::string& fileURL);

} // namespace margelo::nitro::nativepanels::rive
