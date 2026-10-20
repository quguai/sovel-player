#include "SovelDsdDecoder.h"
#include <algorithm>
#include <cmath>
#include <mutex>
#include <stdexcept>

namespace sovel {
namespace {
// 191-tap half-band FIR. Its symmetric, alternate-zero coefficients reduce
// work while preserving the audible passband even at 44.1 kHz output.
const std::array<float, 191>& coefficients() {
  static const auto values = [] {
    std::array<float, 191> h{};
    constexpr double pi = 3.14159265358979323846;
    double sum = 0;
    for (int i = 0; i < 191; ++i) {
      const int n = i - 95;
      const double sinc = n == 0 ? 0.5 : (n % 2 == 0 ? 0.0 : std::sin(0.5 * pi * n) / (pi * n));
      const double window = 0.42 - 0.5 * std::cos(2 * pi * i / 190) +
                            0.08 * std::cos(4 * pi * i / 190);
      h[i] = static_cast<float>(sinc * window);
      sum += h[i];
    }
    for (auto& value : h) value = static_cast<float>(value / sum);
    return h;
  }();
  return values;
}
}

bool DsdDecoder::HalfRate::push(float input, float& output) {
  history[position] = input;
  position = (position + 1) % 191;
  phase ^= 1;
  if (phase) return false;
  double sum = 0;
  const auto& h = coefficients();
  for (int i = 0; i < 95; i += 2)
    sum += h[i] * (history[(position + 190 - i) % 191] + history[(position + i) % 191]);
  sum += h[95] * history[(position + 95) % 191];
  output = static_cast<float>(sum);
  return true;
}

DsdDecoder::DsdDecoder(int rate, int channels, bool lsbFirst, int pcmRate)
    : channels_(channels), stages_(0), outputRate_(rate / 8), lsbFirst_(lsbFirst) {
  if (channels < 1 || channels > 2 ||
      (rate != 2822400 && rate != 5644800 && rate != 11289600 &&
       rate != 22579200 && rate != 3072000 && rate != 6144000 &&
       rate != 12288000 && rate != 24576000))
    throw std::invalid_argument("Unsupported DSF sample rate or channel count");
  if (pcmRate != 44100 && pcmRate != 88200 && pcmRate != 176400 && pcmRate != 352800)
    throw std::invalid_argument("Unsupported PCM target rate");
  const int target = rate % 44100 == 0 ? pcmRate : pcmRate / 147 * 160;
  while (outputRate_ > target) { outputRate_ /= 2; ++stages_; }
  // Upstream's first initialization writes global tables. Serialize it across
  // player/preload threads; subsequent contexts only read the completed tables.
  static std::once_flag initialized;
  std::call_once(initialized, [] { dsd2pcm_precalc(); });
  for (int ch = 0; ch < channels_; ++ch) {
    contexts_[ch] = dsd2pcm_init();
    if (!contexts_[ch]) {
      for (auto* ctx : contexts_) dsd2pcm_destroy(ctx);
      throw std::bad_alloc();
    }
  }
}
DsdDecoder::~DsdDecoder() {
  for (auto* ctx : contexts_) dsd2pcm_destroy(ctx);
}
void DsdDecoder::reset() {
  for (int ch = 0; ch < channels_; ++ch) dsd2pcm_reset(contexts_[ch]);
  filters_ = {};
}
int DsdDecoder::process(const uint8_t* block, int bytes, int stride,
                       float* output, int capacity) {
  if (bytes < 0 || bytes > 4096 || stride < bytes || stride > 4096 ||
      capacity < (bytes + (1 << stages_) - 1) / (1 << stages_))
    throw std::invalid_argument("Invalid DSF block or PCM buffer");
  int frames = 0;
  for (int ch = 0; ch < channels_; ++ch) {
    dsd2pcm_translate(contexts_[ch], bytes, block + ch * stride, 1,
                      lsbFirst_, work_[ch].data(), 1);
    int count = 0;
    for (int i = 0; i < bytes; ++i) {
      float value = work_[ch][i];
      bool ready = true;
      for (int stage = 0; stage < stages_; ++stage) {
        if (!filters_[ch][stage].push(value, value)) { ready = false; break; }
      }
      if (ready) output[count++ * channels_ + ch] = std::clamp(value, -1.0f, 1.0f);
    }
    frames = count;
  }
  return frames;
}
}
