//
//  RiveFileReader.cpp — @viro-external/native-panels
//

#include "RiveFileReader.hpp"

#include "RivePanelConfig.hpp"

#include <cerrno>
#include <cstring>
#include <stdexcept>

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

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

// Rejects what a plain absolute path must not contain. A path is not
// normalised: a ".." segment is refused rather than resolved.
std::string checkedLocalPath(std::string path, const std::string& fileURL) {
  if (path.find('\0') != std::string::npos) {
    throw std::invalid_argument("RiveFile path contains a NUL byte: " + fileURL);
  }
  size_t start = 0;
  while (start <= path.size()) {
    size_t end = path.find('/', start);
    if (end == std::string::npos) end = path.size();
    if (path.compare(start, end - start, "..") == 0 && end - start == 2) {
      throw std::invalid_argument("RiveFile path must not contain a '..' segment: " + fileURL);
    }
    start = end + 1;
  }
  return path;
}

// Closes the descriptor when the read finishes or throws.
class FileDescriptor final {
public:
  explicit FileDescriptor(int fd) : _fd(fd) {}
  ~FileDescriptor() {
    if (_fd >= 0) ::close(_fd);
  }
  FileDescriptor(const FileDescriptor&) = delete;
  FileDescriptor& operator=(const FileDescriptor&) = delete;
  int get() const { return _fd; }

private:
  int _fd;
};

std::string errnoText() {
  return std::strerror(errno);
}

} // namespace

std::string localPathFromFileURL(const std::string& fileURL) {
  static const std::string kScheme = "file://";
  if (fileURL.rfind(kScheme, 0) == 0) {
    const std::string rest = fileURL.substr(kScheme.size());
    if (rest.empty() || rest[0] != '/') {
      throw std::invalid_argument("RiveFile.fromFileURL needs file:///absolute/path, got " + fileURL);
    }
    return checkedLocalPath(percentDecode(rest), fileURL);
  }
  if (!fileURL.empty() && fileURL[0] == '/') return checkedLocalPath(fileURL, fileURL);
  throw std::invalid_argument("RiveFile.fromFileURL takes a file:// URL or an absolute path; fetch http(s) "
                              "in JS and use RiveFile.fromBytes. Got " +
                              fileURL);
}

std::vector<uint8_t> readRiveFile(const std::string& fileURL) {
  const std::string path = localPathFromFileURL(fileURL);
  // stat first: opening a FIFO or a device could block or read without end.
  struct stat info {};
  if (::stat(path.c_str(), &info) != 0) throw std::runtime_error("RiveFile cannot open " + path + ": " + errnoText());
  if (!S_ISREG(info.st_mode)) throw std::invalid_argument("RiveFile " + path + " is not a regular file");
  // O_NONBLOCK keeps a file swapped for a FIFO since the stat from blocking
  // the open; the fstat below then refuses it.
  const FileDescriptor fd(::open(path.c_str(), O_RDONLY | O_CLOEXEC | O_NONBLOCK));
  if (fd.get() < 0) throw std::runtime_error("RiveFile cannot open " + path + ": " + errnoText());
  if (::fstat(fd.get(), &info) != 0) throw std::runtime_error("RiveFile cannot read " + path + ": " + errnoText());
  if (!S_ISREG(info.st_mode)) throw std::invalid_argument("RiveFile " + path + " is not a regular file");
  if (info.st_size < 0) throw std::runtime_error("RiveFile cannot read the size of " + path);
  const auto size = static_cast<uint64_t>(info.st_size);
  if (size > kMaxRiveFileBytes) {
    throw std::invalid_argument("RiveFile " + path + " is " + std::to_string(size) + " bytes; the limit is " +
                                std::to_string(kMaxRiveFileBytes));
  }
  std::vector<uint8_t> bytes(static_cast<size_t>(size));
  size_t offset = 0;
  while (offset < bytes.size()) {
    const ssize_t count = ::read(fd.get(), bytes.data() + offset, bytes.size() - offset);
    if (count < 0 && errno == EINTR) continue;
    if (count <= 0) throw std::runtime_error("RiveFile cannot read " + path + (count < 0 ? ": " + errnoText() : ""));
    offset += static_cast<size_t>(count);
  }
  checkRiveFileBytes(bytes.data(), bytes.size());
  return bytes;
}

} // namespace margelo::nitro::nativepanels::rive
