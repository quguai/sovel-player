#include <jni.h>
#include <exception>
#include "../SovelDsdDecoder.h"

static void failure(JNIEnv* env, const char* message) {
  env->ThrowNew(env->FindClass("java/io/IOException"), message);
}
extern "C" {
JNIEXPORT jlong JNICALL Java_expo_modules_audio_SovelDsfDecoder_create(
    JNIEnv* env, jobject, jint rate, jint channels, jboolean lsb, jint pcmRate) {
  try { return reinterpret_cast<jlong>(new sovel::DsdDecoder(rate, channels, lsb, pcmRate)); }
  catch (const std::exception& e) { failure(env, e.what()); return 0; }
}
JNIEXPORT void JNICALL Java_expo_modules_audio_SovelDsfDecoder_reset(JNIEnv*, jobject, jlong handle) {
  if (handle) reinterpret_cast<sovel::DsdDecoder*>(handle)->reset();
}
JNIEXPORT void JNICALL Java_expo_modules_audio_SovelDsfDecoder_destroy(JNIEnv*, jobject, jlong handle) {
  delete reinterpret_cast<sovel::DsdDecoder*>(handle);
}
JNIEXPORT jint JNICALL Java_expo_modules_audio_SovelDsfDecoder_decode(
    JNIEnv* env, jobject, jlong handle, jbyteArray input, jint bytes, jint channels, jobject output) {
  auto* target = static_cast<float*>(env->GetDirectBufferAddress(output));
  const auto capacity = env->GetDirectBufferCapacity(output);
  if (!handle || !target || channels < 1 || channels > 2 ||
      bytes < 0 || bytes > 4096 || env->GetArrayLength(input) < channels * 4096 ||
      capacity < 4096 * channels * static_cast<int>(sizeof(float)) ||
      reinterpret_cast<sovel::DsdDecoder*>(handle)->channels() != channels) {
    failure(env, "Invalid DSF decode buffers"); return 0;
  }
  auto* source = env->GetByteArrayElements(input, nullptr);
  if (!source) return 0; // VM has raised an allocation error.
  int frames = 0;
  try {
    frames = reinterpret_cast<sovel::DsdDecoder*>(handle)->process(
        reinterpret_cast<uint8_t*>(source), bytes, 4096, target,
        static_cast<int>(capacity / (channels * sizeof(float))));
  } catch (const std::exception& e) { failure(env, e.what()); }
  env->ReleaseByteArrayElements(input, source, JNI_ABORT);
  return frames;
}
}
