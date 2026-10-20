#include "../SovelDsdDecoder.h"
#include <cassert>
#include <algorithm>
#include <chrono>
#include <cmath>
#include <iostream>

namespace {
constexpr double pi = 3.14159265358979323846;
std::vector<uint8_t> tone(int rate, int channels, bool lsb, double frequency = 1000) {
  constexpr int blocks = 32;
  std::vector<uint8_t> data(blocks * 4096 * channels);
  for (int ch = 0; ch < channels; ++ch) {
    double error = 0;
    for (int n = 0; n < blocks * 32768; ++n) {
      const double sample = 0.25 * std::sin(2 * pi * (frequency + ch * 2000) * n / rate);
      error += sample;
      const bool one = error >= 0;
      error -= one ? 1 : -1;
      const int byte = n / 8;
      const int at = (byte / 4096) * channels * 4096 + ch * 4096 + byte % 4096;
      if (one) data[at] |= 1 << (lsb ? n % 8 : 7 - n % 8);
    }
  }
  return data;
}
std::vector<float> decode(sovel::DsdDecoder& decoder, const std::vector<uint8_t>& input, int channels) {
  std::vector<float> output, chunk(4096 * channels);
  for (size_t position = 0; position < input.size(); position += channels * 4096) {
    const int frames = decoder.process(input.data() + position, 4096, 4096, chunk.data(), 4096);
    output.insert(output.end(), chunk.begin(), chunk.begin() + frames * channels);
  }
  return output;
}
double amplitude(const std::vector<float>& pcm, int channels, int ch, int rate, double hz) {
  double real = 0, imaginary = 0;
  int count = 0;
  for (size_t frame = 512; frame < pcm.size() / channels; ++frame) {
    const double phase = 2 * pi * hz * frame / rate;
    real += pcm[frame * channels + ch] * std::cos(phase);
    imaginary += pcm[frame * channels + ch] * std::sin(phase);
    count++;
  }
  return 2 * std::hypot(real, imaginary) / count;
}
}
int main() {
  for (int rate : {2822400, 5644800, 11289600, 22579200, 3072000, 6144000, 12288000, 24576000}) {
    for (int target : {44100, 88200, 176400, 352800}) {
    for (int channels : {1, 2}) {
      sovel::DsdDecoder decoder(rate, channels, true, target);
      const auto data = tone(rate, channels, true);
      const auto output = decode(decoder, data, channels);
      assert(output.size() == data.size() / (rate / 8 / decoder.outputRate()));
      for (int ch = 0; ch < channels; ++ch) {
        const double gain = amplitude(output, channels, ch, decoder.outputRate(), 1000 + ch * 2000);
        assert(std::abs(gain - 0.25) < 0.008);
      }
      if (channels == 2) assert(amplitude(output, 2, 0, decoder.outputRate(), 3000) < 0.008);
      sovel::DsdDecoder msb(rate, channels, false, target);
      assert(decode(msb, tone(rate, channels, false), channels) == output);
      decoder.reset();
      assert(decode(decoder, data, channels) == output);
      // Three previous blocks warm even DSD512 -> 44.1 kHz.
      decoder.reset();
      std::vector<float> chunk(4096 * channels);
      int frames = 0;
      for (int block = 3; block < 6; ++block)
        frames = decoder.process(data.data() + block * 4096 * channels, 4096, 4096, chunk.data(), 4096);
      decoder.process(data.data() + 6 * 4096 * channels, 4096, 4096, chunk.data(), 4096);
      for (int i = 0; i < frames * channels; ++i)
        assert(chunk[i] == output[6 * frames * channels + i]);
      // Partial last block and small streaming calls retain decimation phase.
      decoder.reset();
      int total = 0;
      std::vector<float> partial;
      for (int offset = 0; offset < 4096;) {
        const int count = std::min(97, 4096 - offset);
        std::vector<uint8_t> planar(channels * 4096);
        for (int ch = 0; ch < channels; ++ch)
          std::copy_n(data.data() + ch * 4096 + offset, count, planar.data() + ch * 4096);
        const int got = decoder.process(planar.data(), count, 4096, chunk.data(), 4096);
        partial.insert(partial.end(), chunk.begin(), chunk.begin() + got * channels);
        total += got;
        offset += count;
      }
      assert(total == frames);
      assert(std::equal(partial.begin(), partial.end(), output.begin()));
      std::cout << rate << " -> " << target << " Hz, " << channels << " ch: tone, bit order, reset, seek, chunking passed\n";
    }
  }
  }
  sovel::DsdDecoder decoder(2822400, 2, true);
  std::vector<uint8_t> silence(8192 * 12, 0x69);
  const auto quiet = decode(decoder, silence, 2);
  for (size_t i = 1024; i < quiet.size(); ++i) assert(std::abs(quiet[i]) < 0.00001);
  const auto high = decode(decoder, tone(2822400, 2, true, 120000), 2);
  assert(amplitude(high, 2, 0, decoder.outputRate(), 56400) < 0.0001);
  // The lowest PCM setting must preserve the audible upper band, not cut at 16 kHz.
  sovel::DsdDecoder cd(2822400, 1, true, 44100);
  const auto upper = decode(cd, tone(2822400, 1, true, 20000), 1);
  assert(std::abs(amplitude(upper, 1, 0, 44100, 20000) - 0.25) < 0.008);
  bool rejected = false;
  try { sovel::DsdDecoder bad(2822400, 6, true); }
  catch (const std::invalid_argument&) { rejected = true; }
  assert(rejected);
  rejected = false;
  std::vector<float> small(1);
  try { decoder.process(silence.data(), 4096, 4096, small.data(), 0); }
  catch (const std::invalid_argument&) { rejected = true; }
  assert(rejected);
  std::cout << "Silence, ultrasonic rejection and invalid buffer checks passed\n";
}
