#include <jni.h>
#include "SovelEqualizerDSP.h"
extern "C" {
JNIEXPORT void JNICALL Java_expo_modules_audio_SovelEqualizer_configure(JNIEnv* env,jobject,jboolean enabled,jdoubleArray gains,jdouble preamp,jboolean headroom) {
  double values[sovel::bands]{};
  const int count=std::min(sovel::bands,int(env->GetArrayLength(gains)));
  env->GetDoubleArrayRegion(gains,0,count,values);
  sovel::parameters().set(enabled,values,preamp,headroom);
}
JNIEXPORT jdoubleArray JNICALL Java_expo_modules_audio_SovelEqualizer_readStatus(JNIEnv* env,jobject) {
  auto& r=sovel::runtime();
  double values[]={double(r.supported.load()),double(r.processing.load()),double(r.frames.load()),double(r.clipped.load()),
                   double(r.sampleRate.load()),double(r.channels.load()),double(r.format.load()),double(r.activeBands.load()),r.preamp.load()};
  auto result=env->NewDoubleArray(9); env->SetDoubleArrayRegion(result,0,9,values); return result;
}
JNIEXPORT jlong JNICALL Java_expo_modules_audio_SovelEqualizer_create(JNIEnv*,jobject,jint rate,jint channels,jint format) {
  auto* engine=new sovel::Equalizer();
  if (!engine->configure(rate,channels,format)) { delete engine; return 0; }
  return reinterpret_cast<jlong>(engine);
}
JNIEXPORT void JNICALL Java_expo_modules_audio_SovelEqualizer_process(JNIEnv* env,jobject,jlong handle,jobject buffer,jint frames) {
  if (!handle) return;
  auto* ptr=static_cast<uint8_t*>(env->GetDirectBufferAddress(buffer));
  if (ptr) reinterpret_cast<sovel::Equalizer*>(handle)->process(&ptr,frames);
}
JNIEXPORT void JNICALL Java_expo_modules_audio_SovelEqualizer_reset(JNIEnv*,jobject,jlong handle) {
  if (handle) reinterpret_cast<sovel::Equalizer*>(handle)->reset();
}
JNIEXPORT void JNICALL Java_expo_modules_audio_SovelEqualizer_destroy(JNIEnv*,jobject,jlong handle) {
  delete reinterpret_cast<sovel::Equalizer*>(handle);
}
}
