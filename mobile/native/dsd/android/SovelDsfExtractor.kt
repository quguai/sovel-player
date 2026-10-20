package expo.modules.audio

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.ParsableByteArray
import androidx.media3.common.util.UnstableApi
import androidx.media3.extractor.*
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

internal object SovelDsfDecoder {
  val available = runCatching { System.loadLibrary("sovel_equalizer"); true }.getOrDefault(false)
  @Volatile var pcmRate = 176400
    private set
  fun configure(rate: Int) {
    require(rate in listOf(44100, 88200, 176400, 352800)) { "Unsupported DSD PCM rate" }
    pcmRate = rate
  }
  external fun create(rate: Int, channels: Int, lsb: Boolean, pcmRate: Int): Long
  external fun reset(handle: Long)
  external fun destroy(handle: Long)
  external fun decode(handle: Long, input: ByteArray, bytes: Int, channels: Int, output: ByteBuffer): Int
}

@UnstableApi
internal class SovelExtractorsFactory : ExtractorsFactory {
  private val defaults = DefaultExtractorsFactory()
  override fun createExtractors(): Array<Extractor> =
    arrayOf<Extractor>(SovelDsfExtractor()) + defaults.createExtractors()
  override fun createExtractors(uri: Uri, responseHeaders: Map<String, List<String>>): Array<Extractor> =
    arrayOf<Extractor>(SovelDsfExtractor()) + defaults.createExtractors(uri, responseHeaders)
}

// Decode on Media3's loader thread; neither DSD bytes nor PCM traverse JavaScript.
// The regular Media3 sink handles playback, audio focus, EQ, pause and queueing.
@UnstableApi
internal class SovelDsfExtractor : Extractor {
  private lateinit var output: ExtractorOutput
  private lateinit var track: TrackOutput
  private var header: SovelDsfHeader? = null
  private var decoder = 0L
  private var block = 0L
  private var emitFromBlock = 0L
  private var requestedTimeUs = 0L
  private var inputBytes = ByteArray(0)
  private var pcm = ByteBuffer.allocateDirect(0)
  private var pcmBytes = ByteArray(0)

  override fun sniff(input: ExtractorInput): Boolean {
    val signature = ByteArray(4)
    return try {
      input.peekFully(signature, 0, 4, true) &&
        signature.contentEquals(byteArrayOf(68, 83, 68, 32))
    } finally { input.resetPeekPosition() }
  }

  override fun init(output: ExtractorOutput) {
    this.output = output
    track = output.track(0, C.TRACK_TYPE_AUDIO)
    output.endTracks()
  }

  override fun read(input: ExtractorInput, seekPosition: PositionHolder): Int {
    if (header == null) {
      if (input.position != 0L) {
        seekPosition.position = 0
        return Extractor.RESULT_SEEK
      }
      val bytes = ByteArray(92)
      input.readFully(bytes, 0, bytes.size)
      val parsed = SovelDsfHeader.parse(bytes, input.length, SovelDsfDecoder.pcmRate)
      if (!SovelDsfDecoder.available) throw IOException("DSF software decoder is unavailable in this build")
      decoder = SovelDsfDecoder.create(parsed.rate, parsed.channels, parsed.lsbFirst, parsed.pcmRate)
      inputBytes = ByteArray(parsed.blockBytes)
      pcm = ByteBuffer.allocateDirect(4096 * parsed.channels * 4).order(ByteOrder.LITTLE_ENDIAN)
      pcmBytes = ByteArray(pcm.capacity())
      track.format(Format.Builder()
        .setSampleMimeType(MimeTypes.AUDIO_RAW)
        .setPcmEncoding(C.ENCODING_PCM_FLOAT)
        .setChannelCount(parsed.channels)
        .setSampleRate(parsed.outputRate)
        .setMaxInputSize(pcm.capacity())
        .build())
      header = parsed
      output.seekMap(object : SeekMap {
        override fun isSeekable() = true
        override fun getDurationUs() = parsed.durationUs
        override fun getSeekPoints(timeUs: Long): SeekMap.SeekPoints {
          val target = parsed.blockAt(timeUs)
          return SeekMap.SeekPoints(SeekPoint(
            parsed.frameTime(target * parsed.framesPerBlock), parsed.position(target)))
        }
      })
      prepareSeek(requestedTimeUs)
    }
    val h = header!!
    if (block >= h.blockCount) return Extractor.RESULT_END_OF_INPUT
    val position = h.position(block)
    if (input.position != position) {
      seekPosition.position = position
      return Extractor.RESULT_SEEK
    }
    // Read a complete planar block even at EOF; padding is excluded by sample count.
    input.readFully(inputBytes, 0, inputBytes.size)
    val remainingBits = h.samples - block * 32768
    val bytes = minOf(4096L, (remainingBits + 7) / 8).toInt()
    pcm.clear()
    val decoded = SovelDsfDecoder.decode(decoder, inputBytes, bytes, h.channels, pcm)
    val startFrame = block * h.framesPerBlock
    val frames = minOf(decoded.toLong(), h.totalFrames - startFrame).toInt()
    if (block >= emitFromBlock && frames > 0) {
      val size = frames * h.channels * 4
      pcm.position(0)
      pcm.get(pcmBytes, 0, size)
      track.sampleData(ParsableByteArray(pcmBytes, size), size)
      track.sampleMetadata(h.frameTime(startFrame), C.BUFFER_FLAG_KEY_FRAME, size, 0, null)
    }
    block++
    return Extractor.RESULT_CONTINUE
  }

  private fun prepareSeek(timeUs: Long) {
    val h = header ?: return
    emitFromBlock = h.blockAt(timeUs)
    // Warm all FIR stages without emitting old audio, including DSD512 -> 44.1k.
    block = maxOf(0, emitFromBlock - h.prerollBlocks)
    SovelDsfDecoder.reset(decoder)
  }
  override fun seek(position: Long, timeUs: Long) {
    requestedTimeUs = timeUs
    prepareSeek(timeUs)
  }
  override fun release() {
    SovelDsfDecoder.destroy(decoder)
    decoder = 0L
    header = null
    inputBytes = ByteArray(0)
    pcmBytes = ByteArray(0)
    pcm = ByteBuffer.allocateDirect(0)
  }
}
