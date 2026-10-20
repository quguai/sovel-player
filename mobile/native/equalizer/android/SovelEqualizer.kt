package expo.modules.audio

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.AudioOffloadSupport
import androidx.media3.exoplayer.audio.ForwardingAudioSink
import java.nio.ByteBuffer
import java.nio.ByteOrder

internal object SovelEqualizer {
  val available = runCatching { System.loadLibrary("sovel_equalizer"); true }.getOrDefault(false)
  external fun configure(enabled: Boolean, gains: DoubleArray, preamp: Double, headroom: Boolean)
  private external fun readStatus(): DoubleArray
  external fun create(rate: Int, channels: Int, format: Int): Long
  external fun process(handle: Long, buffer: ByteBuffer, frames: Int)
  external fun reset(handle: Long)
  external fun destroy(handle: Long)
  fun status(): Map<String, Any> {
    if (!available) return mapOf("available" to false)
    val s=readStatus()
    return mapOf("available" to true,"supported" to (s[0]>0),"processing" to (s[1]>0),
      "frames" to s[2],"clipped" to s[3],"sampleRate" to s[4],"channels" to s[5],
      "format" to s[6],"activeBands" to s[7],"effectivePreamp" to s[8])
  }
}

@UnstableApi
internal class SovelEqualizerRenderers(context: Context): DefaultRenderersFactory(context) {
  override fun buildAudioSink(context: Context, enableFloatOutput: Boolean, enableAudioOutputPlaybackParams: Boolean): AudioSink? {
    val sink=super.buildAudioSink(context, enableFloatOutput, enableAudioOutputPlaybackParams) ?: return null
    return if (SovelEqualizer.available) SovelEqualizerSink(sink) else sink
  }
}

// Wrap decoded PCM without forcing a 16-bit AudioProcessor conversion.
@UnstableApi
internal class SovelEqualizerSink(sink: AudioSink): ForwardingAudioSink(sink) {
  private var handle=0L
  private var frameBytes=0
  private var output=ByteBuffer.allocateDirect(0).order(ByteOrder.nativeOrder())
  private var pending: ByteBuffer?=null
  // Decoders must deliver PCM: hardware offload/passthrough would skip this DSP.
  override fun supportsFormat(format: Format): Boolean =
    format.sampleMimeType == MimeTypes.AUDIO_RAW && super.supportsFormat(format)
  override fun getFormatSupport(format: Format): Int =
    if (format.sampleMimeType == MimeTypes.AUDIO_RAW) super.getFormatSupport(format) else AudioSink.SINK_FORMAT_UNSUPPORTED
  override fun getFormatOffloadSupport(format: Format): AudioOffloadSupport = AudioOffloadSupport.DEFAULT_UNSUPPORTED
  override fun configure(inputFormat: Format, specifiedBufferSize: Int, outputChannels: IntArray?) {
    SovelEqualizer.destroy(handle); handle=0; pending=null
    val format=when(inputFormat.pcmEncoding) {
      C.ENCODING_PCM_16BIT -> 1
      C.ENCODING_PCM_24BIT -> 2
      C.ENCODING_PCM_32BIT -> 3
      C.ENCODING_PCM_FLOAT -> 4
      else -> 0
    }
    frameBytes=inputFormat.channelCount*(if(format==1) 2 else if(format==2) 3 else 4)
    handle=SovelEqualizer.create(inputFormat.sampleRate,inputFormat.channelCount,format)
    super.configure(inputFormat,specifiedBufferSize,outputChannels)
  }
  override fun handleBuffer(buffer: ByteBuffer, presentationTimeUs: Long, encodedAccessUnitCount: Int): Boolean {
    if (handle==0L || frameBytes<=0) return super.handleBuffer(buffer,presentationTimeUs,encodedAccessUnitCount)
    if (pending==null) {
      val size=buffer.remaining()
      if (size%frameBytes!=0) return super.handleBuffer(buffer,presentationTimeUs,encodedAccessUnitCount)
      if (output.capacity()<size) output=ByteBuffer.allocateDirect(size).order(ByteOrder.nativeOrder())
      output.clear(); output.put(buffer.duplicate()); output.flip()
      SovelEqualizer.process(handle,output,size/frameBytes)
      pending=buffer
    }
    // Media3 retries the same source buffer on back-pressure. Never filter twice.
    if (!super.handleBuffer(output,presentationTimeUs,encodedAccessUnitCount)) return false
    buffer.position(buffer.limit()); pending=null
    return true
  }
  override fun flush() { pending=null; SovelEqualizer.reset(handle); super.flush() }
  override fun handleDiscontinuity() { SovelEqualizer.reset(handle); super.handleDiscontinuity() }
  override fun reset() { pending=null; SovelEqualizer.destroy(handle); handle=0; super.reset() }
  override fun release() { pending=null; SovelEqualizer.destroy(handle); handle=0; super.release() }
}
