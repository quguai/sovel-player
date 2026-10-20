package expo.modules.audio

import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

// Sony DSF 1.01: DSD(28), fmt(52), data header(12), planar 4096-byte blocks.
internal data class SovelDsfHeader(
  val channels: Int,
  val rate: Int,
  val lsbFirst: Boolean,
  val samples: Long,
  val blockCount: Long,
  val pcmRate: Int,
) {
  val outputRate: Int = if (rate % 44100 == 0) pcmRate else pcmRate / 147 * 160
  val decimation: Int = rate / outputRate
  val totalFrames: Long = samples / decimation
  val blockBytes: Int = 4096 * channels
  val framesPerBlock: Int = 32768 / decimation
  // 96 DSD taps plus cascaded 191-tap half-band histories, in DSD bytes.
  val prerollBlocks: Long = (12L + 190L * (decimation / 8 - 1) + 4095) / 4096
  val durationUs: Long = frameTime(totalFrames)
  fun frameTime(frame: Long): Long =
    frame / outputRate * 1_000_000 + frame % outputRate * 1_000_000 / outputRate
  fun blockAt(timeUs: Long): Long {
    val clamped = timeUs.coerceIn(0, durationUs)
    val frame = clamped / 1_000_000 * outputRate + clamped % 1_000_000 * outputRate / 1_000_000
    var block = (frame / framesPerBlock).coerceIn(0, blockCount - 1)
    // frameTime truncates to microseconds. Preserve exact seek-map boundaries
    // instead of drifting backwards a block when Media3 requests that time again.
    if (block + 1 < blockCount && frameTime((block + 1) * framesPerBlock) <= clamped) block++
    return block
  }
  fun position(block: Long): Long = 92L + block * blockBytes
  companion object {
    fun parse(bytes: ByteArray, inputLength: Long, pcmRate: Int = 176400): SovelDsfHeader {
      fun valid(condition: Boolean, message: String) {
        if (!condition) throw IOException(message)
      }
      valid(bytes.size >= 92, "Truncated DSF header")
      val b = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
      fun magic(offset: Int, value: String) =
        value.indices.all { bytes[offset + it] == value[it].code.toByte() }
      valid(magic(0, "DSD ") && b.getLong(4) == 28L, "Invalid DSF DSD chunk")
      val fileSize = b.getLong(12)
      val metadata = b.getLong(20)
      valid(fileSize >= 92 && (inputLength < 0 || fileSize <= inputLength), "Truncated DSF file")
      valid(magic(28, "fmt ") && b.getLong(32) == 52L, "Unsupported DSF fmt chunk")
      valid(b.getInt(40) == 1 && b.getInt(44) == 0, "Only uncompressed DSF version 1 is supported")
      val channels = b.getInt(52)
      val channelType = b.getInt(48)
      valid((channels == 1 && channelType == 1) || (channels == 2 && channelType == 2),
        "DSF software playback supports mono or stereo")
      val rate = b.getInt(56)
      valid(rate in listOf(2822400, 5644800, 11289600, 22579200, 3072000, 6144000, 12288000, 24576000),
        "DSF software playback supports DSD64, DSD128, DSD256 and DSD512")
      valid(pcmRate in listOf(44100, 88200, 176400, 352800), "Unsupported PCM target rate")
      val bits = b.getInt(60)
      valid(bits == 1 || bits == 8, "Invalid DSF bit order")
      valid(b.getInt(72) == 4096 && b.getInt(76) == 0, "Unsupported DSF block layout")
      val samples = b.getLong(64)
      // Keep frame/microsecond calculations within Long even for hostile headers.
      valid(samples in 1..Long.MAX_VALUE / 1_000_000, "Invalid DSF sample count")
      val blocks = (samples + 32767) / 32768
      val payload = blocks * 4096 * channels
      valid(magic(80, "data") && b.getLong(84) >= 12, "Invalid DSF data chunk")
      val dataSize = b.getLong(84)
      valid(dataSize <= fileSize - 80 && dataSize - 12 >= payload, "Truncated DSF audio blocks")
      valid(metadata == 0L || metadata in (80 + dataSize) until fileSize, "Invalid DSF metadata offset")
      return SovelDsfHeader(channels, rate, bits == 1, samples, blocks, pcmRate)
    }
  }
}
