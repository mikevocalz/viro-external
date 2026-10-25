//
//  HybridRiveFile.cpp — @viro-external/native-panels
//

#include "HybridRiveFile.hpp"

#include "RiveFileReader.hpp"
#include "RivePanelConfig.hpp"

#include <stdexcept>
#include <utility>

namespace margelo::nitro::nativepanels {

using FilePromise = Promise<std::shared_ptr<HybridRiveFileSpec>>;

HybridRiveFile::HybridRiveFile(std::vector<uint8_t> bytes) : _bytes(std::move(bytes)) {}

FilePromise HybridRiveFile::fromBytes(const ArrayBuffer& bytes) {
  // data() is only valid on the JS thread, so copy before anything else.
  try {
    const uint8_t* data = bytes.data();
    const size_t size = data == nullptr ? 0 : bytes.size();
    rive::checkRiveFileBytes(data, size);
    std::shared_ptr<HybridRiveFileSpec> file = std::make_shared<HybridRiveFile>(std::vector<uint8_t>(data, data + size));
    return FilePromise::resolved(std::move(file));
  } catch (...) {
    return FilePromise::rejected(std::current_exception());
  }
}

FilePromise HybridRiveFile::fromFileURL(const std::string& fileURL) {
  return FilePromise::async([fileURL]() -> std::shared_ptr<HybridRiveFileSpec> {
    return std::make_shared<HybridRiveFile>(rive::readRiveFile(fileURL));
  });
}

const std::vector<uint8_t>& HybridRiveFile::bytesOf(const std::shared_ptr<HybridRiveFileSpec>& file) {
  const auto concrete = std::dynamic_pointer_cast<HybridRiveFile>(file);
  if (concrete == nullptr) {
    throw std::invalid_argument("Expected a RiveFile from RiveFile.fromBytes or RiveFile.fromFileURL");
  }
  return concrete->_bytes;
}

double HybridRiveFile::getByteLength() {
  return static_cast<double>(_bytes.size());
}

size_t HybridRiveFile::getExternalMemorySize() noexcept {
  return _bytes.size();
}

} // namespace margelo::nitro::nativepanels
