package expo.modules.audio

import androidx.media3.common.C
import androidx.media3.common.DataReader
import androidx.media3.common.Format
import androidx.media3.common.util.ParsableByteArray
import androidx.media3.extractor.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [28])
class DsfTest {
  private fun fixture(rate: Int = 2822400, channels: Int = 2, samples: Long = 16 * 32768L - 71): ByteArray {
    val blocks = (samples + 32767) / 32768
    val bytes = ByteArray((92 + blocks * 4096 * channels).toInt())
    val b = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
    b.put("DSD ".toByteArray()).putLong(28).putLong(bytes.size.toLong()).putLong(0)
    b.put("fmt ".toByteArray()).putLong(52).putInt(1).putInt(0)
      .putInt(channels).putInt(channels).putInt(rate).putInt(1)
      .putLong(samples).putInt(4096).putInt(0)
    b.put("data".toByteArray()).putLong(bytes.size - 80L)
    for (i in 92 until bytes.size) bytes[i] = (i * 17 + i / 23).toByte()
    return bytes
  }
  private fun input(bytes: ByteArray, position: Long = 0): ExtractorInput {
    var cursor = position.toInt()
    return DefaultExtractorInput(DataReader { buffer, offset, length ->
      if (cursor == bytes.size) -1
      else {
        // Exercise short provider reads rather than assuming a full block/read.
        val count = minOf(length, 271, bytes.size - cursor)
        bytes.copyInto(buffer, offset, cursor, cursor + count)
        cursor += count
        count
      }
    }, position, bytes.size.toLong())
  }
  private class Output : ExtractorOutput, TrackOutput {
    lateinit var audioFormat: Format
    lateinit var map: SeekMap
    val data = ByteArrayOutputStream()
    val times = mutableListOf<Long>()
    override fun track(id: Int, type: Int): TrackOutput {
      assertEquals(C.TRACK_TYPE_AUDIO, type)
      return this
    }
    override fun endTracks() {}
    override fun seekMap(seekMap: SeekMap) { map = seekMap }
    override fun format(format: Format) { audioFormat = format }
    override fun sampleData(source: DataReader, length: Int, allowEnd: Boolean, part: Int): Int =
      error("PCM should be delivered as a bounded buffer")
    override fun sampleData(source: ParsableByteArray, length: Int, part: Int) {
      val bytes = ByteArray(length)
      source.readBytes(bytes, 0, length)
      data.write(bytes)
    }
    override fun sampleMetadata(timeUs: Long, flags: Int, size: Int, offset: Int, crypto: TrackOutput.CryptoData?) {
      assertTrue(size > 0)
      times.add(timeUs)
    }
  }
  private fun pump(extractor: Extractor, bytes: ByteArray, start: Long = 0) {
    var source = input(bytes, start)
    val seek = PositionHolder()
    repeat(10000) {
      when (extractor.read(source, seek)) {
        Extractor.RESULT_END_OF_INPUT -> return
        Extractor.RESULT_SEEK -> source = input(bytes, seek.position)
      }
    }
    error("Extractor did not finish")
  }

  @Test fun nativeStreamingForEveryRateAndTargetHasExactLengthAndDuration() {
    assertTrue(SovelDsfDecoder.available)
    for (rate in listOf(2822400, 5644800, 11289600, 22579200)) {
      for (target in listOf(44100, 88200, 176400, 352800)) {
        for (channels in 1..2) {
          SovelDsfDecoder.configure(target)
          val bytes = fixture(rate, channels)
          val h = SovelDsfHeader.parse(bytes, bytes.size.toLong(), target)
          val extractor = SovelDsfExtractor()
          val out = Output()
          extractor.init(out)
          try {
            assertTrue(extractor.sniff(input(bytes)))
            pump(extractor, bytes)
            assertEquals(target, out.audioFormat.sampleRate)
            assertEquals(C.ENCODING_PCM_FLOAT, out.audioFormat.pcmEncoding)
            assertEquals(channels, out.audioFormat.channelCount)
            assertEquals(h.totalFrames * channels * 4, out.data.size().toLong())
            assertEquals(h.durationUs, out.map.durationUs)
            assertTrue(out.times.zipWithNext().all { it.first < it.second })
            val floats = ByteBuffer.wrap(out.data.toByteArray()).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
            while (floats.hasRemaining()) assertTrue(floats.get().let { it.isFinite() && it in -1f..1f })
          } finally { extractor.release() }
        }
      }
    }
  }

  @Test fun seekAndReplayMatchContinuousPlaybackIncludingDsd512Preroll() {
    for (rate in listOf(2822400, 22579200)) {
      SovelDsfDecoder.configure(44100)
      val bytes = fixture(rate)
      val h = SovelDsfHeader.parse(bytes, bytes.size.toLong(), 44100)
      val extractor = SovelDsfExtractor()
      val out = Output()
      extractor.init(out)
      try {
        pump(extractor, bytes)
        val continuous = out.data.toByteArray()
        val time = h.frameTime(10L * h.framesPerBlock)
        val point = out.map.getSeekPoints(time).first
        assertEquals(h.position(10), point.position)
        assertEquals(point.position, out.map.getSeekPoints(point.timeUs).first.position)
        out.data.reset()
        out.times.clear()
        extractor.seek(point.position, time)
        pump(extractor, bytes, point.position)
        // Seek-map timestamps round-trip without drifting a block backwards.
        val block = h.blockAt(time)
        assertArrayEquals(continuous.copyOfRange((block * h.framesPerBlock * 8).toInt(), continuous.size),
          out.data.toByteArray())
        assertEquals(h.frameTime(block * h.framesPerBlock), out.times.first())
        out.data.reset()
        extractor.seek(0, 0)
        pump(extractor, bytes)
        assertArrayEquals(continuous, out.data.toByteArray())
      } finally { extractor.release() }
    }
  }

  @Test fun malformedHeadersAndTruncatedAudioAreRejected() {
    val bytes = fixture()
    for ((offset, value) in listOf(40 to 2, 44 to 1, 52 to 6, 56 to 12345, 60 to 4, 72 to Int.MAX_VALUE)) {
      val invalid = bytes.copyOf()
      ByteBuffer.wrap(invalid).order(ByteOrder.LITTLE_ENDIAN).putInt(offset, value)
      assertThrows(IOException::class.java) { SovelDsfHeader.parse(invalid, invalid.size.toLong()) }
    }
    assertThrows(IOException::class.java) { SovelDsfHeader.parse(bytes, bytes.size - 1L) }
    assertThrows(IOException::class.java) { SovelDsfHeader.parse(bytes, bytes.size.toLong(), 48001) }
    val extractor = SovelDsfExtractor()
    extractor.init(Output())
    try { assertFalse(extractor.sniff(input("RIFFabcdefghWAVE".toByteArray()))) }
    finally { extractor.release() }
  }

  @Test fun existingTaggedDsfIsAcceptedWithoutReadingTagsAsAudio() {
    SovelDsfDecoder.configure(176400)
    val bytes = File(System.getProperty("sovel.repo"), "mobile/tests/tagged.dsf").readBytes()
    val h = SovelDsfHeader.parse(bytes, bytes.size.toLong())
    val extractor = SovelDsfExtractor()
    val out = Output()
    extractor.init(out)
    try {
      pump(extractor, bytes)
      assertEquals(h.totalFrames * h.channels * 4, out.data.size().toLong())
    } finally { extractor.release() }
  }
}
