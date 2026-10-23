import expo.modules.sovelnetwork.SovelHttp
import expo.modules.sovelnetwork.SovelSmb
import java.net.HttpURLConnection
import java.net.URI
import org.junit.Assert.*
import org.junit.Test

class NetworkTests {
  @Test
  fun smbReadsAndProxyRanges() {
    val smb = SovelSmb()
    try {
      val login = smb.connect("test", "127.0.0.1", 1445, "demo", "demo", "MUSIC")
      assertTrue(smb.list("test", "").any { it["name"] == "sample.wav" })
      val bytes = smb.read("test", "sample.wav", 0, 64)
      assertEquals("RIFF", String(bytes.copyOf(4)))
      for (range in listOf("bytes=0-63", "bytes=-64", "bytes=64-", "bytes=9999999999-")) {
        val c = URI(login + "sample.wav").toURL().openConnection() as HttpURLConnection
        try {
          c.setRequestProperty("Range", range)
          assertEquals(if (range == "bytes=9999999999-") 416 else 206, c.responseCode)
          if (c.responseCode == 206) {
            val data = c.inputStream.use { it.readBytes() }
            if (range == "bytes=0-63") assertArrayEquals(bytes, data)
            if (range == "bytes=-64") assertEquals(64, data.size)
          }
        } finally {
          c.disconnect()
        }
      }
      try {
        smb.list("test", "../secret")
        fail("Traversal allowed")
      } catch (_: IllegalArgumentException) {}
    } finally {
      smb.closeAll()
    }
  }

  @Test
  fun boundedHTTPReadRejectsIgnoredRange() {
    val data =
      SovelHttp.read(
        "http://127.0.0.1:18768/dav/sample.wav",
        mapOf("Authorization" to "Basic ZGVtbzpkZW1v"),
        0,
        64,
      )
    assertEquals("RIFF", String(data.copyOf(4)))
    try {
      SovelHttp.read("http://127.0.0.1:18768/ignores-range", emptyMap(), 0, 64)
      fail("Range ignored")
    } catch (_: IllegalArgumentException) {}
  }
}
