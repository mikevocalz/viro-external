//
//  RiveFileReader.cpp — @viro-external/native-panels
//

#include "RiveFileReader.hpp"

#include "RivePanelConfig.hpp"

#include <fstream>
#include <stdexcept>

namespace margelo::nitro::nativepanels::rive {

namespace {

int hexValue(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

std::string percentDecode(const std::string& text) {
  std::string out;
  out.reserve(text.size());
  for (size_t i = 0; i < text.size(); ++i) {
    if (text[i] != '%') {
      out.push_back(text[i]);
      continue;
    }
    if (i + 2 >= text.size() || hexValue(text[i + 1]) < 0 || hexValue(text[i + 2]) < 0) {
      throw std::invalid_argument("RiveFile URL has a malformed percent escape: " + text);
    }
    out.push_back(static_cast<char>(hexValue(text[i + 1]) * 16 + hexValue(text[i + 2])));
    i += 2;
  }
  return out;
}

} // namespace

std::string localPathFromFileURL(const std::string& fileURL) {
  static const std::string kScheme = "file://";
  if (fileURL.rfind(kScheme, 0) == 0) {
    const std::string rest = fileURL.substr(kScheme.size());
    if (rest.empty() || rest[0] != '/') {
      throw std::invalid_argument("RiveFile.fromFileURL needs file:///absolute/path, got " + fileURL);
    }
    return percentDecode(rest);
  }
  if (!fileURL.empty() && fileURL[0] == '/') return fileURL;
  throw std::invalid_argument("RiveFile.fromFileURL takes a file:// URL or an absolute path; fetch http(s) "
                              "in JS and use RiveFile.fromBytes. Got " +
                              fileURL);
}

std::vector<uint8_t> readRiveFile(const std::string& fileURL) {
  const std::string path = localPathFromFileURL(fileURL);
  std::ifstream stream(path, std::ios::binary | std::ios::ate);
  if (!stream) throw std::runtime_error("RiveFile cannot open " + path);
  const std::streamoff size = stream.tellg();
  if (size < 0) throw std::runtime_error("RiveFile cannot read the size of " + path);
  if (static_cast<uint64_t>(size) > kMaxRiveFileBytes) {
    throw std::invalid_argument("RiveFile " + path + " is " + std::to_string(size) + " bytes; the limit is " +
                                std::to_string(kMaxRiveFileBytes));
  }
  std::vector<uint8_t> bytes(static_cast<size_t>(size));
  stream.seekg(0);
  if (size > 0 && !stream.read(reinterpret_cast<char*>(bytes.data()), size)) {
    throw std::runtime_error("RiveFile cannot read " + path);
  }
  checkRiveFileBytes(bytes.data(), bytes.size());
  return bytes;
}

} // namespace margelo::nitro::nativepanels::rive
