#include "../SovelDsfPcmStream.h"
#include <AudioToolbox/AudioToolbox.h>
#include <cassert>
#include <cstring>
#include <iostream>

static void le(std::vector<uint8_t> &b, size_t at, uint64_t n, int bytes) {
  for (int i = 0; i < bytes; ++i)
    b[at + i] = uint8_t(n >> (8 * i));
}
static std::vector<uint8_t> fixture(int rate, int channels) {
  const uint64_t samples = rate / 20, blocks = (samples + 32767) / 32768;
  std::vector<uint8_t> b(92 + blocks * channels * 4096, 0x69);
  std::fill(b.begin(), b.begin() + 92, 0);
  std::memcpy(b.data(), "DSD ", 4);
  le(b, 4, 28, 8);
  le(b, 12, b.size(), 8);
  std::memcpy(b.data() + 28, "fmt ", 4);
  le(b, 32, 52, 8);
  le(b, 40, 1, 4);
  le(b, 48, channels, 4);
  le(b, 52, channels, 4);
  le(b, 56, rate, 4);
  le(b, 60, 1, 4);
  le(b, 64, samples, 8);
  le(b, 72, 4096, 4);
  std::memcpy(b.data() + 80, "data", 4);
  le(b, 84, b.size() - 80, 8);
  uint32_t seed = 0x12345678;
  for (size_t i = 92; i < b.size(); ++i) {
    seed = seed * 1664525u + 1013904223u;
    b[i] = uint8_t(seed >> 24);
  }
  return b;
}
struct CafReader {
  std::vector<uint8_t> bytes;
};
static OSStatus readCAF(void *client, SInt64 position, UInt32 count, void *data,
                        UInt32 *actual) {
  auto &b = static_cast<CafReader *>(client)->bytes;
  *actual = UInt32(
      std::min<size_t>(count, position < 0 || uint64_t(position) >= b.size()
                                  ? 0
                                  : b.size() - position));
  if (*actual)
    std::memcpy(data, b.data() + position, *actual);
  return noErr;
}
static SInt64 cafSize(void *client) {
  return SInt64(static_cast<CafReader *>(client)->bytes.size());
}
int main() {
  for (int rate : {2822400, 5644800, 11289600, 22579200, 3072000, 6144000,
                   12288000, 24576000})
    for (int target : {44100, 88200, 176400, 352800})
      for (int channels : {1, 2}) {
        auto file = fixture(rate, channels);
        size_t maxRead = 0;
        auto reader = [&](uint64_t offset, uint8_t *out, size_t count) {
          assert(offset + count <= file.size());
          maxRead = std::max(maxRead, count);
          std::memcpy(out, file.data() + offset, count);
        };
        sovel::DsfPcmStream stream(reader, target);
        CafReader reference;
        for (uint64_t at = 0; at < stream.size();) {
          auto bytes = stream.read(at, 8191);
          reference.bytes.insert(reference.bytes.end(), bytes.begin(),
                                 bytes.end());
          at += bytes.size();
        }
        assert(maxRead <= 8192 && stream.read(stream.size(), 128).empty());
        for (uint64_t at : {uint64_t(7), uint64_t(66), stream.size() / 2,
                            stream.size() - 15, uint64_t(69), uint64_t(68)}) {
          auto bytes = stream.read(at, 701);
          assert(std::equal(bytes.begin(), bytes.end(),
                            reference.bytes.begin() + at));
        }
        AudioFileID audio = nullptr;
        assert(AudioFileOpenWithCallbacks(&reference, readCAF, nullptr, cafSize,
                                          nullptr, kAudioFileCAFType,
                                          &audio) == noErr);
        AudioStreamBasicDescription format{};
        UInt32 size = sizeof(format);
        assert(AudioFileGetProperty(audio, kAudioFilePropertyDataFormat, &size,
                                    &format) == noErr);
        assert(format.mFormatID == kAudioFormatLinearPCM &&
               format.mChannelsPerFrame == channels &&
               format.mBitsPerChannel == 32 &&
               format.mSampleRate == stream.rate());
        assert((format.mFormatFlags & kAudioFormatFlagIsFloat) != 0 &&
               (format.mFormatFlags & kAudioFormatFlagIsBigEndian) == 0);
        AudioFileClose(audio);
      }
  auto broken = fixture(2822400, 2);
  broken[73] = 0;
  bool rejected = false;
  try {
    sovel::DsfPcmStream s(
        [&](uint64_t o, uint8_t *p, size_t n) {
          std::memcpy(p, broken.data() + o, n);
        },
        176400);
  } catch (const std::exception &) {
    rejected = true;
  }
  assert(rejected);
  std::cout << "PASS: virtual CAF decoded streaming, exact seek/preroll, "
               "bounded reads and Apple AudioFile format validation across 64 "
               "DSD/rate/channel combinations\n";
}
