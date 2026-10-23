#include "SovelDsfPcmStream.h"
#include <algorithm>
#include <cstring>
#include <limits>

namespace sovel {
namespace {
uint64_t le(const uint8_t *p, int count) {
  uint64_t v = 0;
  for (int i = 0; i < count; ++i)
    v |= uint64_t(p[i]) << (i * 8);
  return v;
}
void be(uint8_t *p, uint64_t v, int count) {
  for (int i = count - 1; i >= 0; --i) {
    p[i] = uint8_t(v);
    v >>= 8;
  }
}
void require(bool valid) {
  if (!valid)
    throw std::runtime_error("Unsupported or truncated DSF audio");
}
} // namespace
DsfPcmStream::DsfPcmStream(Reader read, int pcmRate)
    : reader_(std::move(read)) {
  std::array<uint8_t, 92> h{};
  reader_(0, h.data(), h.size());
  require(!std::memcmp(h.data(), "DSD ", 4) && le(&h[4], 8) == 28 &&
          !std::memcmp(&h[28], "fmt ", 4) && le(&h[32], 8) == 52);
  require(le(&h[40], 4) == 1 && le(&h[44], 4) == 0 &&
          !std::memcmp(&h[80], "data", 4));
  const auto fileSize = le(&h[12], 8), metadata = le(&h[20], 8),
             dataSize = le(&h[84], 8);
  channels_ = int(le(&h[52], 4));
  const auto type = le(&h[48], 4), rate = le(&h[56], 4), bits = le(&h[60], 4);
  require((channels_ == 1 && type == 1) || (channels_ == 2 && type == 2));
  require((bits == 1 || bits == 8) && le(&h[72], 4) == 4096 &&
          le(&h[76], 4) == 0);
  samples_ = le(&h[64], 8);
  require(samples_ > 0 && samples_ <= uint64_t(INT64_MAX) / 1000000);
  blockCount_ = (samples_ + 32767) / 32768;
  require(fileSize >= 92 && dataSize >= 12 && dataSize <= fileSize - 80 &&
          dataSize - 12 >= blockCount_ * 4096 * channels_);
  require(metadata == 0 || (metadata >= 80 + dataSize && metadata < fileSize));
  decoder_ =
      std::make_unique<DsdDecoder>(int(rate), channels_, bits == 1, pcmRate);
  decimation_ = int(rate) / decoder_->outputRate();
  framesPerBlock_ = 32768 / decimation_;
  totalFrames_ = samples_ / decimation_;
  require(totalFrames_ > 0);
  preroll_ = (12 + 190 * (decimation_ / 8 - 1) + 4095) / 4096;
  // CAF uses big-endian headers, with explicitly little-endian float PCM data.
  std::memcpy(header_.data(), "caff", 4);
  be(&header_[4], 1, 2);
  std::memcpy(&header_[8], "desc", 4);
  be(&header_[12], 32, 8);
  double outputRate = decoder_->outputRate();
  uint64_t rateBits;
  std::memcpy(&rateBits, &outputRate, 8);
  be(&header_[20], rateBits, 8);
  std::memcpy(&header_[28], "lpcm", 4);
  be(&header_[32], 3, 4);
  be(&header_[36], channels_ * 4, 4);
  be(&header_[40], 1, 4);
  be(&header_[44], channels_, 4);
  be(&header_[48], 32, 4);
  std::memcpy(&header_[52], "data", 4);
  be(&header_[56], size() - 64, 8);
}
void DsfPcmStream::decode(uint64_t block) {
  if (block == cachedBlock_)
    return;
  if (block != nextBlock_) {
    decoder_->reset();
    nextBlock_ = block > preroll_ ? block - preroll_ : 0;
  }
  while (nextBlock_ <= block) {
    reader_(92 + nextBlock_ * 4096 * channels_, input_.data(),
            4096 * channels_);
    const int bytes =
        int(std::min<uint64_t>(4096, (samples_ - nextBlock_ * 32768 + 7) / 8));
    const int decoded =
        decoder_->process(input_.data(), bytes, 4096, pcm_.data(), 4096);
    cachedFrames_ = int(std::min<uint64_t>(
        decoded, totalFrames_ - nextBlock_ * framesPerBlock_));
    cachedBlock_ = nextBlock_++;
  }
}
std::vector<uint8_t> DsfPcmStream::read(uint64_t offset, size_t count) {
  if (offset >= size())
    return {};
  require(count <= 128 * 1024);
  count = size_t(std::min<uint64_t>(count, size() - offset));
  std::vector<uint8_t> out(count);
  size_t done = 0;
  if (offset < 68) {
    done = std::min<size_t>(count, 68 - offset);
    std::memcpy(out.data(), header_.data() + offset, done);
  }
  while (done < count) {
    const auto pcmByte = offset + done - 68,
               block = pcmByte / (framesPerBlock_ * channels_ * 4);
    require(block < blockCount_);
    decode(block);
    const auto within = size_t(pcmByte % (framesPerBlock_ * channels_ * 4));
    require(within < size_t(cachedFrames_ * channels_ * 4));
    const auto take =
        std::min(count - done, size_t(cachedFrames_ * channels_ * 4) - within);
    std::memcpy(out.data() + done,
                reinterpret_cast<uint8_t *>(pcm_.data()) + within, take);
    done += take;
  }
  return out;
}
} // namespace sovel
