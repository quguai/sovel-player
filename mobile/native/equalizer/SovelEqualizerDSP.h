#pragma once
#include <algorithm>
#include <array>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <mutex>
#include <memory>

// Sovel's streaming graphic EQ. Peaking biquads use the W3C Audio EQ Cookbook
// equations.
namespace sovel {
constexpr int bands = 10;
constexpr int filters = bands * 2;
struct ParametricBand { int type = 0; double frequency = 1000, gain = 0, q = 1; };
constexpr int maxChannels = 8;
constexpr double frequencies[bands] = {31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000};
constexpr double pi = 3.14159265358979323846;
struct Settings {
  bool enabled = false;
  bool headroom = true;
  double preamp = 0;
  std::array<double, bands> gains{};
  bool peqEnabled = false, peqHeadroom = true;
  double peqPreamp = 0;
  double replayGain = 0;
  std::array<ParametricBand, bands> peq{};
  uint64_t revision = 1;
};
inline double bounded(double v, double low, double high) {
  return std::isfinite(v) ? std::clamp(v, low, high) : 0;
}
struct Parameters {
  std::mutex mutex;
  Settings value;
  void set(bool enabled, const double* gains, double preamp, bool headroom) {
    std::lock_guard<std::mutex> guard(mutex);
    value.enabled = enabled;
    value.headroom = headroom;
    value.preamp = bounded(preamp, -24, 0);
    for (int i = 0; i < bands; ++i) value.gains[i] = bounded(gains[i], -12, 12);
    ++value.revision;
  }
  void setReplayGain(double db) {
    std::lock_guard<std::mutex> guard(mutex);
    value.replayGain=bounded(db,-60,24); ++value.revision;
  }
  void setPeq(bool enabled, const double* flat, int count, double preamp, bool headroom) {
    std::lock_guard<std::mutex> guard(mutex);
    value.peqEnabled = enabled; value.peqHeadroom = headroom;
    value.peqPreamp = bounded(preamp, -24, 0); value.peq = {};
    for (int i=0; i<std::min(bands,count/4); ++i) {
      const double* b=flat+i*4;
      value.peq[i]={int(bounded(b[0],0,3)), bounded(b[1],10,24000), bounded(b[2],-24,24), bounded(b[3],0.1,20)};
    }
    ++value.revision;
  }
  // The render thread never waits on the settings/UI thread.
  bool read(Settings& output) {
    if (!mutex.try_lock()) return false;
    output = value;
    mutex.unlock();
    return true;
  }
};
Parameters& parameters();
struct Runtime {
  std::atomic<uint64_t> frames{0}, clipped{0};
  std::atomic<int> sampleRate{0}, channels{0}, format{0}, activeBands{0};
  std::atomic<bool> processing{false}, supported{false};
  std::atomic<double> preamp{0};
};
Runtime& runtime();

struct Coefficients {
  double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
};
inline Coefficients peak(double frequency, double gain, double rate, double q=std::sqrt(2.0)) {
  if (frequency >= rate * 0.49 || std::abs(gain) < 1e-9) return {};
  const double a = std::pow(10.0, gain / 40.0);
  const double w = 2 * pi * frequency / rate;
  const double alpha = std::sin(w) / (2 * q);
  const double a0 = 1 + alpha / a;
  return {(1 + alpha * a) / a0, -2 * std::cos(w) / a0,
          (1 - alpha * a) / a0, -2 * std::cos(w) / a0, (1 - alpha / a) / a0};
}
inline Coefficients parametric(const ParametricBand& b, double rate) {
  if (!b.type || b.frequency >= rate*0.49 || std::abs(b.gain)<1e-9) return {};
  if (b.type==1) return peak(b.frequency,b.gain,rate,b.q);
  const double a=std::pow(10.0,b.gain/40), w=2*pi*b.frequency/rate, c=std::cos(w);
  const double beta=std::sqrt(a)*std::sin(w)/b.q;
  if (b.type==2) {
    const double a0=(a+1)+(a-1)*c+beta;
    return {a*((a+1)-(a-1)*c+beta)/a0, 2*a*((a-1)-(a+1)*c)/a0,
      a*((a+1)-(a-1)*c-beta)/a0, -2*((a-1)+(a+1)*c)/a0, ((a+1)+(a-1)*c-beta)/a0};
  }
  const double a0=(a+1)-(a-1)*c+beta;
  return {a*((a+1)+(a-1)*c+beta)/a0, -2*a*((a-1)+(a+1)*c)/a0,
    a*((a+1)+(a-1)*c-beta)/a0, 2*((a-1)-(a+1)*c)/a0, ((a+1)-(a-1)*c-beta)/a0};
}
inline double magnitudeSquared(const Coefficients& c, double w) {
  const double x = std::cos(w), y = std::sin(w), xx = std::cos(2*w), yy = std::sin(2*w);
  const double nr = c.b0 + c.b1*x + c.b2*xx, ni = -c.b1*y-c.b2*yy;
  const double dr = 1 + c.a1*x+c.a2*xx, di = -c.a1*y-c.a2*yy;
  return (nr*nr+ni*ni) / std::max(1e-30, dr*dr+di*di);
}
// Formats: 1 = little-endian signed 16, 2 = packed 24, 3 = signed 32,
// 4 = float32. Bit depth and sample rate are never reduced by this stage.
inline int sampleBytes(int format) { return format == 1 ? 2 : format == 2 ? 3 : 4; }
inline double decode(const uint8_t* p, int format) {
  if (format == 4) { float v; std::memcpy(&v,p,4); return std::isfinite(v) ? v : 0; }
  if (format == 1) { int16_t v; std::memcpy(&v,p,2); return v / 32768.0; }
  if (format == 3) { int32_t v; std::memcpy(&v,p,4); return v / 2147483648.0; }
  int32_t v = int32_t(p[0]) | (int32_t(p[1])<<8) | (int32_t(p[2])<<16);
  if (v & 0x800000) v |= int32_t(0xff000000);
  return v / 8388608.0;
}
inline void encode(uint8_t* p, int format, double value) {
  value = std::clamp(std::isfinite(value) ? value : 0, -1.0, 1.0);
  if (format == 4) { float v = float(value); std::memcpy(p,&v,4); return; }
  if (format == 1) { int16_t v = int16_t(std::clamp(std::round(value*32768), -32768.0,32767.0)); std::memcpy(p,&v,2); return; }
  if (format == 3) { int32_t v = int32_t(std::clamp(std::round(value*2147483648), -2147483648.0,2147483647.0)); std::memcpy(p,&v,4); return; }
  int32_t v = int32_t(std::clamp(std::round(value*8388608), -8388608.0,8388607.0));
  p[0] = uint8_t(v); p[1] = uint8_t(v>>8); p[2] = uint8_t(v>>16);
}

class Equalizer {
  Parameters& parameters_;
  Runtime& runtime_;
  Settings settings_;
  double rate_ = 0, wet_ = 0, wetTarget_ = 0, gain_ = 1, gainTarget_ = 1;
  int channels_ = 0, format_ = 0, ramp_ = 0, activeBands_ = 0;
  double effectivePreamp_ = 0;
  std::shared_ptr<std::atomic<double>> itemGain_;
  double lastItemGain_ = 0;
  std::array<Coefficients,filters> coefficients_{}, targets_{};
  struct Delay { double z1 = 0, z2 = 0; };
  std::array<std::array<Delay,filters>,maxChannels> state_{};
  uint64_t revision_ = 0;
  void update() {
    Settings next;
    if (!parameters_.read(next)) return;
    const double itemGain=itemGain_ ? itemGain_->load() : next.replayGain;
    if (next.revision == revision_ && itemGain == lastItemGain_) return;
    lastItemGain_=itemGain;
    revision_ = next.revision; settings_ = next;
    double maxBoost = 0;
    const double preamp=(next.enabled ? next.preamp : 0)+(next.peqEnabled ? next.peqPreamp : 0)+itemGain;
    bool changed = std::abs(preamp)>1e-9;
    for (int i = 0; i < bands; ++i) {
      targets_[i] = next.enabled ? peak(frequencies[i], next.gains[i], rate_) : Coefficients{};
      targets_[bands+i] = next.peqEnabled ? parametric(next.peq[i],rate_) : Coefficients{};
      if (next.enabled && frequencies[i]<rate_*0.49) changed |= std::abs(next.gains[i])>1e-9;
      const auto& p=next.peq[i];
      if (next.peqEnabled && p.type && p.frequency<rate_*0.49) changed |= std::abs(p.gain)>1e-9;
    }
    if ((next.enabled && next.headroom) || (next.peqEnabled && next.peqHeadroom)) {
      // Estimate combined response, not just the highest individual slider.
      for (int i=0; i<512; ++i) {
        const double f = 10 * std::pow(rate_*0.049, i/511.0);
        double power=1;
        for (const auto& c: targets_) power *= magnitudeSquared(c,2*pi*f/rate_);
        maxBoost=std::max(maxBoost,10*std::log10(std::max(power,1e-30)));
      }
      if (maxBoost > 0.01) maxBoost += 0.5; // small measurement-grid margin
    }
    effectivePreamp_ = preamp-maxBoost;
    gainTarget_ = std::pow(10.0,effectivePreamp_/20.0);
    wetTarget_ = changed ? 1 : 0;
    ramp_ = std::max(1,int(rate_*0.04));
  }
public:
  explicit Equalizer(Parameters& p=parameters(), Runtime& r=runtime()): parameters_(p),runtime_(r) {}
  void setGainSource(std::shared_ptr<std::atomic<double>> gain) { itemGain_=std::move(gain); }
  bool configure(double rate, int channels, int format) {
    rate_=rate; channels_=channels; format_=format;
    const bool valid=std::isfinite(rate) && rate>=8000 && rate<=768000 && channels>0 && channels<=maxChannels && format>=1 && format<=4;
    runtime_.supported.store(valid);
    runtime_.processing.store(false);
    runtime_.sampleRate.store(valid ? int(rate) : 0);
    runtime_.channels.store(valid ? channels : 0);
    runtime_.format.store(valid ? format : 0);
    int count=0; for (auto f:frequencies) if (f<rate*0.49) ++count;
    activeBands_=valid ? count : 0;
    runtime_.activeBands.store(activeBands_);
    if (!valid) { format_=0; return false; }
    reset(); return true;
  }
  void reset() {
    state_={}; coefficients_={}; targets_={}; wet_=0; gain_=1; revision_=0; ramp_=0;
  }
  // Called once per PCM block. Planes contains either one interleaved buffer
  // or one buffer per channel. No per-frame allocations or locks.
  void process(uint8_t** planes, int frames, bool planar=false) {
    if (!format_ || frames<=0) return;
    update();
    runtime_.sampleRate.store(int(rate_)); runtime_.channels.store(channels_);
    runtime_.format.store(format_); runtime_.supported.store(true);
    // Queued items can prepare ahead: report the engine processing this block.
    runtime_.activeBands.store(activeBands_); runtime_.preamp.store(effectivePreamp_);
    runtime_.processing.store(wetTarget_>0 || wet_>0);
    runtime_.frames.fetch_add(frames);
    if (wet_==0 && wetTarget_==0) { state_={}; return; }
    const int bytes=sampleBytes(format_);
    uint64_t clipped=0;
    for (int frame=0; frame<frames; ++frame) {
      if (ramp_>0) {
        const double step=1.0/ramp_--;
        wet_+=(wetTarget_-wet_)*step; gain_+=(gainTarget_-gain_)*step;
        for (int i=0;i<filters;++i) {
          auto& c=coefficients_[i]; const auto& t=targets_[i];
          c.b0+=(t.b0-c.b0)*step; c.b1+=(t.b1-c.b1)*step; c.b2+=(t.b2-c.b2)*step;
          c.a1+=(t.a1-c.a1)*step; c.a2+=(t.a2-c.a2)*step;
        }
      }
      if (wet_==0 && wetTarget_==0) continue;
      for (int channel=0;channel<channels_;++channel) {
        auto* p=planar ? planes[channel]+frame*bytes : planes[0]+(frame*channels_+channel)*bytes;
        const double input=decode(p,format_);
        double output=input*gain_;
        for (int i=0;i<filters;++i) {
          const auto& c=coefficients_[i]; auto& d=state_[channel][i];
          const double y=c.b0*output+d.z1;
          d.z1=c.b1*output-c.a1*y+d.z2; d.z2=c.b2*output-c.a2*y;
          // Avoid subnormal tails in quiet passages.
          if (std::abs(d.z1)<1e-24) d.z1=0;
          if (std::abs(d.z2)<1e-24) d.z2=0;
          output=y;
        }
        output=input+(output-input)*wet_;
        if (std::abs(output)>1) ++clipped;
        encode(p,format_,output);
      }
    }
    runtime_.clipped.fetch_add(clipped);
  }
};
}
