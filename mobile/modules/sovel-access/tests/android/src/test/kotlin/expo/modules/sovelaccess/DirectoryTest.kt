package expo.modules.sovelaccess

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.Bundle
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowContentResolver
import java.nio.file.Files

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], manifest = Config.NONE)
class DirectoryTest {
  class Provider : ContentProvider() {
    var queries = 0
    var lastUri = ""
    var loading = false
    var fail = false
    override fun onCreate() = true
    override fun query(uri: Uri, projection: Array<out String>?, selection: String?,
      selectionArgs: Array<out String>?, sortOrder: String?): Cursor? {
      queries++; lastUri = uri.toString()
      if (fail) return null
      return MatrixCursor(projection).apply {
        addRow(arrayOf<Any?>("disk:音 乐/a.flac", "a.flac", "audio/flac", 1234L, 5678L))
        addRow(arrayOf<Any?>("disk:音 乐/album", "album", Document.MIME_TYPE_DIR, null, null))
        if (loading) extras = Bundle().apply { putBoolean(DocumentsContract.EXTRA_LOADING, true) }
      }
    }
    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?) = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?) = 0
  }

  @Test fun safUsesOneQueryAndPreservesOpaqueIdsAndMetadata() {
    val provider = Provider()
    ShadowContentResolver.registerProviderInternal("test.documents", provider)
    val resolver = RuntimeEnvironment.getApplication().contentResolver
    val tree = DocumentsContract.buildTreeDocumentUri("test.documents", "disk:音 乐")
    val rows = SovelDirectoryReader.list(resolver, tree.toString())
    assertEquals(1, provider.queries)
    assertEquals(2, rows.size)
    assertEquals(1234L, rows[0]["size"])
    assertEquals(5678L, rows[0]["mtime"])
    assertEquals("disk:音 乐/a.flac", DocumentsContract.getDocumentId(Uri.parse(rows[0]["uri"] as String)))
    assertEquals(true, rows[1]["directory"])
    assertEquals(0L, rows[1]["mtime"])
    SovelDirectoryReader.list(resolver, rows[1]["uri"] as String)
    assertTrue(Uri.parse(provider.lastUri).pathSegments.contains("disk:音 乐/album"))
  }

  @Test fun incompleteAndFailedDirectoriesAreErrorsNotEmptySnapshots() {
    val provider = Provider()
    ShadowContentResolver.registerProviderInternal("test.documents", provider)
    val resolver = RuntimeEnvironment.getApplication().contentResolver
    val tree = DocumentsContract.buildTreeDocumentUri("test.documents", "root").toString()
    provider.loading = true
    assertThrows(java.io.IOException::class.java) { SovelDirectoryReader.list(resolver, tree) }
    provider.loading = false; provider.fail = true
    assertThrows(java.io.IOException::class.java) { SovelDirectoryReader.list(resolver, tree) }
  }

  @Test fun localDirectoriesSkipSymlinksAndReportMillis() {
    val dir = Files.createTempDirectory("sovel-scan").toFile()
    try {
      val song = dir.resolve("a.wav").apply { writeBytes(byteArrayOf(1, 2, 3)) }
      dir.resolve("album").mkdir()
      Files.createSymbolicLink(dir.resolve("cycle").toPath(), dir.toPath())
      val rows = SovelDirectoryReader.list(RuntimeEnvironment.getApplication().contentResolver, dir.toURI().toString())
      assertEquals(setOf("a.wav", "album"), rows.map { it["name"] }.toSet())
      val audio = rows.first { it["name"] == "a.wav" }
      assertEquals(3L, audio["size"])
      assertEquals(song.lastModified(), audio["mtime"])
    } finally { dir.deleteRecursively() }
  }
}
