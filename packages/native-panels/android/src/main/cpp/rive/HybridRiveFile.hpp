//
//  HybridRiveFile.hpp — @viro-external/native-panels
//
//  Immutable bytes of one .riv file. Each RivePanel parses its own copy on
//  its render thread, so a file can feed several panels.
//

#pragma once

#include <NitroNativePanels/HybridRiveFileSpec.hpp>

#include <cstdint>
#include <memory>
#include <vector>

namespace margelo::nitro::nativepanels {

class HybridRiveFile final : public HybridRiveFileSpec {
public:
  explicit HybridRiveFile(std::vector<uint8_t> bytes);

  static Promise<std::shared_ptr<HybridRiveFileSpec>> fromBytes(const ArrayBuffer& bytes);
  static Promise<std::shared_ptr<HybridRiveFileSpec>> fromFileURL(const std::string& fileURL);

  // The bytes behind a RiveFile from JS. Throws std::invalid_argument when
  // the object is not a HybridRiveFile.
  static const std::vector<uint8_t>& bytesOf(const std::shared_ptr<HybridRiveFileSpec>& file);

  double getByteLength() override;

protected:
  size_t getExternalMemorySize() noexcept override;

private:
  const std::vector<uint8_t> _bytes;
};

} // namespace margelo::nitro::nativepanels
