#pragma once
#include <array>
#include <cstdint>
#include <vector>
#include "third_party/dsd2pcm/dsd2pcm.h"

namespace sovel {
// Streaming DSF channel blocks -> interleaved float PCM. No file-sized buffers.
class DsdDecoder {
 public:
  DsdDecoder(int rate, int channels, bool lsbFirst, int pcmRate = 176400);
  ~DsdDecoder();
  DsdDecoder(const DsdDecoder&) = delete;
  DsdDecoder& operator=(const DsdDecoder&) = delete;
  void reset();
  int outputRate() const { return outputRate_; }
  int channels() const { return channels_; }
  int process(const uint8_t* block, int bytesPerChannel, int stride,
              float* output, int outputCapacityFrames);
 private:
  struct HalfRate {
    std::array<float, 191> history{};
    int position = 0, phase = 0;
    bool push(float input, float& output);
  };
  int channels_, stages_, outputRate_;
  bool lsbFirst_;
  std::array<dsd2pcm_ctx*, 2> contexts_{};
  std::array<std::array<HalfRate, 6>, 2> filters_{};
  std::array<std::array<float, 4096>, 2> work_{};
};
}
