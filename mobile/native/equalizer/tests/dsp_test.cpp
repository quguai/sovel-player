#include "../SovelEqualizerDSP.h"
#include <cassert>
#include <iostream>
#include <vector>
#include <limits>

static double sineGain(double hz, int band, double gain, bool headroom=false, int rate=48000) {
  sovel::Parameters p; sovel::Runtime r; sovel::Equalizer eq(p,r);
  double gains[10]{}; gains[band]=gain; p.set(true,gains,0,headroom);
  assert(eq.configure(rate,2,4));
  std::vector<float> pcm(rate*2);
  for (int i=0;i<rate;++i) pcm[i*2]=float(0.05*std::sin(2*sovel::pi*hz*i/rate));
  uint8_t* data=reinterpret_cast<uint8_t*>(pcm.data()); eq.process(&data,rate);
  double power=0, dry=0;
  for (int i=rate/2;i<rate;++i) {
    power+=pcm[i*2]*pcm[i*2];
    const auto original=0.05*std::sin(2*sovel::pi*hz*i/rate); dry+=original*original;
    assert(pcm[i*2+1]==0); // channel isolation
  }
  return 10*std::log10(power/dry);
}
static void integerGain(int format) {
  sovel::Parameters p; sovel::Runtime r; sovel::Equalizer eq(p,r);
  constexpr int rate=48000;
  double gains[10]{}; gains[5]=6; p.set(true,gains,0,false);
  assert(eq.configure(rate,2,format));
  const int bytes=sovel::sampleBytes(format);
  std::vector<uint8_t> pcm(rate*2*bytes);
  for (int i=0;i<rate;++i) sovel::encode(pcm.data()+i*2*bytes,format,0.1*std::sin(2*sovel::pi*1000*i/rate));
  const auto original=pcm;
  // Exercise render-sized blocks, including a final partial block.
  for (int i=0;i<rate;i+=257) {
    auto* data=pcm.data()+i*2*bytes; eq.process(&data,std::min(257,rate-i));
  }
  double dry=0,wet=0;
  for(int i=rate/2;i<rate;++i) {
    const double a=sovel::decode(original.data()+i*2*bytes,format), b=sovel::decode(pcm.data()+i*2*bytes,format);
    dry+=a*a; wet+=b*b;
    assert(sovel::decode(pcm.data()+(i*2+1)*bytes,format)==0);
  }
  assert(std::abs(10*std::log10(wet/dry)-6)<0.03);
}
int main() {
  assert(std::abs(sineGain(1000,5,6)-6)<0.03);
  assert(std::abs(sineGain(1000,5,-9)+9)<0.03);
  assert(std::abs(sineGain(31.25,0,8)-8)<0.08);
  assert(sineGain(1000,5,6,true)<0);
  assert(std::abs(sineGain(1000,9,12,false,16000))<0.001); // above Nyquist bypass
  for(int format=1;format<=3;++format) integerGain(format);
  for (int format=1;format<=4;++format) {
    sovel::Parameters p; sovel::Runtime r; sovel::Equalizer eq(p,r);
    assert(eq.configure(192000,2,format));
    std::vector<uint8_t> data(128*2*sovel::sampleBytes(format));
    for (size_t i=0;i<data.size();++i) data[i]=uint8_t(i*7);
    const auto original=data; uint8_t* ptr=data.data(); eq.process(&ptr,128);
    assert(data==original); // disabled byte-exact, even floating-point special values
    double zeros[10]{}; p.set(true,zeros,0,true); eq.process(&ptr,128);
    assert(data==original); // neutral is also byte-exact
  }
  sovel::Parameters p; sovel::Runtime r; sovel::Equalizer eq(p,r);
  assert(!eq.configure(48000,9,4));
  assert(!eq.configure(48000,2,99));
  assert(eq.configure(96000,2,4));
  double gains[10]; for(auto& g:gains) g=12;
  p.set(true,gains,0,true);
  std::vector<float> left(96000,0.99f),right(96000,-0.5f);
  uint8_t* planes[]={reinterpret_cast<uint8_t*>(left.data()),reinterpret_cast<uint8_t*>(right.data())};
  eq.process(planes,96000,true);
  for(auto x:left) assert(std::isfinite(x) && std::abs(x)<=1);
  sovel::Equalizer queued(p,r);
  queued.configure(16000,1,1);
  eq.process(planes,128,true);
  assert(r.sampleRate==96000 && r.activeBands==10 && r.preamp<0);
  p.set(false,gains,0,true); eq.process(planes,96000,true);
  const auto original=left; eq.process(planes,96000,true); assert(left==original);
  eq.reset();
  gains[2]=std::numeric_limits<double>::quiet_NaN();
  p.set(true,gains,std::numeric_limits<double>::infinity(),true);
  for (int i=0;i<20;++i) {
    gains[0]=i%2 ? -12 : 12; p.set(true,gains,-6,false);
    eq.process(planes,128,true);
    for(int j=0;j<128;++j) assert(std::isfinite(left[j]) && std::abs(left[j])<=1);
  }
  std::cout << "PASS: measured float/integer EQ gain/cut, bass, headroom, Nyquist, 4-format byte-exact bypass, channel isolation, planar audio, disable/retune, invalid input\n";
}
