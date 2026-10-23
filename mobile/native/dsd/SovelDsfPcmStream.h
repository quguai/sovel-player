#pragma once
#include "SovelDsdDecoder.h"
#include <functional>
#include <memory>
#include <stdexcept>

namespace sovel {
// A seekable virtual CAF stream. The caller supplies exact bounded DSF reads;
// neither the encoded file nor the decoded song is cached on disk/in memory.
class DsfPcmStream {
public:
  using Reader = std::function<void(uint64_t, uint8_t *, size_t)>;
  explicit DsfPcmStream(Reader read, int pcmRate);
  uint64_t size() const { return 68 + totalFrames_ * channels_ * 4; }
  int rate() const { return decoder_->outputRate(); }
  int channels() const { return channels_; }
  std::vector<uint8_t> read(uint64_t offset, size_t count);

private:
  Reader reader_;
  int channels_, decimation_, framesPerBlock_;
  uint64_t samples_, totalFrames_, blockCount_, preroll_,
      nextBlock_ = 0, cachedBlock_ = UINT64_MAX;
  std::unique_ptr<DsdDecoder> decoder_;
  std::array<uint8_t, 68> header_{};
  std::array<uint8_t, 8192> input_{};
  std::array<float, 8192> pcm_{};
  int cachedFrames_ = 0;
  void decode(uint64_t block);
};
} // namespace sovel
