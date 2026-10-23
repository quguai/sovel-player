#import "SovelEqualizer.h"
#import <MediaToolbox/MediaToolbox.h>
#include "SovelEqualizerDSP.h"
#import <objc/runtime.h>
@interface SovelItemGain : NSObject { @public std::shared_ptr<std::atomic<double>> gain; }
@end
@implementation SovelItemGain
- (instancetype)init { if ((self=[super init])) gain=std::make_shared<std::atomic<double>>(0); return self; }
@end
static char gainKey;
static SovelItemGain* itemGain(AVPlayerItem* item) {
  SovelItemGain* holder=objc_getAssociatedObject(item,&gainKey);
  if (!holder) { holder=[SovelItemGain new]; objc_setAssociatedObject(item,&gainKey,holder,OBJC_ASSOCIATION_RETAIN_NONATOMIC); }
  return holder;
}

struct SovelTap {
  sovel::Equalizer engine;
  bool supported=false, planar=false;
  int channels=0, bytes=0;
};
static void tapInit(MTAudioProcessingTapRef, void* info, void** storage) { *storage=info; }
static void tapFinalize(MTAudioProcessingTapRef tap) { delete static_cast<SovelTap*>(MTAudioProcessingTapGetStorage(tap)); }
static void tapPrepare(MTAudioProcessingTapRef tap, CMItemCount, const AudioStreamBasicDescription* f) {
  auto* state=static_cast<SovelTap*>(MTAudioProcessingTapGetStorage(tap));
  int format=0;
  if (f->mFormatID==kAudioFormatLinearPCM && !(f->mFormatFlags & kAudioFormatFlagIsBigEndian)) {
    if ((f->mFormatFlags & kAudioFormatFlagIsFloat) && f->mBitsPerChannel==32) format=4;
    else if (f->mFormatFlags & kAudioFormatFlagIsSignedInteger) {
      format=f->mBitsPerChannel==16 ? 1 : f->mBitsPerChannel==24 ? 2 : f->mBitsPerChannel==32 ? 3 : 0;
    }
  }
  state->channels=int(f->mChannelsPerFrame);
  state->planar=(f->mFormatFlags & kAudioFormatFlagIsNonInterleaved)!=0;
  state->bytes=sovel::sampleBytes(format);
  // Reject padded/unsupported layouts rather than treating padding as samples.
  if (f->mBytesPerFrame != state->bytes*(state->planar ? 1 : state->channels)) format=0;
  state->supported=state->engine.configure(f->mSampleRate,state->channels,format);
}
static void tapUnprepare(MTAudioProcessingTapRef tap) {
  static_cast<SovelTap*>(MTAudioProcessingTapGetStorage(tap))->engine.reset();
}
static void tapProcess(MTAudioProcessingTapRef tap, CMItemCount requested, MTAudioProcessingTapFlags,
                       AudioBufferList* buffers, CMItemCount* frames, MTAudioProcessingTapFlags* flags) {
  *frames=0;
  const OSStatus result=MTAudioProcessingTapGetSourceAudio(tap,requested,buffers,flags,nullptr,frames);
  if (result!=noErr || *frames<=0) return;
  auto* state=static_cast<SovelTap*>(MTAudioProcessingTapGetStorage(tap));
  if (!state->supported) return;
  if (*flags & kMTAudioProcessingTapFlag_StartOfStream) state->engine.reset();
  const int count=state->planar ? state->channels : 1;
  if (buffers->mNumberBuffers!=count) { sovel::runtime().supported.store(false); return; }
  uint8_t* planes[sovel::maxChannels]{};
  for (int i=0;i<count;++i) {
    const auto& b=buffers->mBuffers[i];
    const size_t required=size_t(*frames)*state->bytes*(state->planar ? 1 : state->channels);
    if (!b.mData || b.mDataByteSize<required) return;
    planes[i]=static_cast<uint8_t*>(b.mData);
  }
  state->engine.process(planes,int(*frames),state->planar);
}

@implementation SovelEqualizer
+ (void)configure:(BOOL)enabled gains:(NSArray<NSNumber *> *)gains preamp:(double)preamp headroom:(BOOL)headroom {
  double values[sovel::bands]{};
  for (int i=0;i<sovel::bands && i<gains.count;++i) values[i]=gains[i].doubleValue;
  sovel::parameters().set(enabled,values,preamp,headroom);
}
+ (void)configurePeq:(BOOL)enabled filters:(NSArray<NSNumber *> *)filters preamp:(double)preamp headroom:(BOOL)headroom {
  double values[sovel::bands*4]{};
  const int count=int(std::min(NSUInteger(sovel::bands*4),filters.count));
  for (int i=0;i<count;++i) values[i]=filters[i].doubleValue;
  sovel::parameters().setPeq(enabled,values,count,preamp,headroom);
}
+ (void)setReplayGain:(double)db forItem:(AVPlayerItem *)item { itemGain(item)->gain->store(sovel::bounded(db,-60,24)); }
+ (NSDictionary<NSString *,id> *)status {
  auto& r=sovel::runtime();
  return @{ @"available":@YES, @"supported":@(r.supported.load()), @"processing":@(r.processing.load()),
            @"frames":@(r.frames.load()), @"clipped":@(r.clipped.load()), @"sampleRate":@(r.sampleRate.load()),
            @"channels":@(r.channels.load()), @"format":@(r.format.load()), @"activeBands":@(r.activeBands.load()),
            @"effectivePreamp":@(r.preamp.load()) };
}
+ (void)attachToItem:(AVPlayerItem *)item {
  // AVPlayer keeps ownership of the mix/tap for every queued/recreated item.
  // Loading track descriptions is asynchronous and never reads full audio into JS.
  [item.asset loadTracksWithMediaType:AVMediaTypeAudio completionHandler:^(NSArray<AVAssetTrack*>* tracks, NSError* error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error || !tracks.count || item.audioMix) return;
      auto* state=new SovelTap();
      state->engine.setGainSource(itemGain(item)->gain);
      MTAudioProcessingTapCallbacks callbacks={kMTAudioProcessingTapCallbacksVersion_0,state,tapInit,tapFinalize,tapPrepare,tapUnprepare,tapProcess};
      MTAudioProcessingTapRef tap=nullptr;
      if (MTAudioProcessingTapCreate(kCFAllocatorDefault,&callbacks,kMTAudioProcessingTapCreationFlag_PostEffects,&tap)!=noErr) {
        delete state; return;
      }
      AVMutableAudioMixInputParameters* input=[AVMutableAudioMixInputParameters audioMixInputParametersWithTrack:tracks.firstObject];
      input.audioTapProcessor=tap;
      AVMutableAudioMix* mix=[AVMutableAudioMix audioMix];
      mix.inputParameters=@[input];
      item.audioMix=mix;
      CFRelease(tap);
    });
  }];
}
@end
