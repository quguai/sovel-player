package expo.modules.sovelaccess

import android.content.ContentResolver
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import java.io.File
import java.io.IOException

internal object SovelDirectoryReader {
  fun list(resolver: ContentResolver, value: String): List<Map<String, Any>> {
    val uri = Uri.parse(value)
    if (uri.scheme == "file") {
      val directory = File(requireNotNull(uri.path)).canonicalFile
      val children = directory.listFiles() ?: throw IOException("无法读取目录：$value")
      return children.mapNotNull { child ->
        // Don't follow symlinks outside the granted tree or back into its ancestors.
        if (child.canonicalFile != child.absoluteFile) return@mapNotNull null
        if (!child.isDirectory && !child.isFile) return@mapNotNull null
        row(child.name, Uri.fromFile(child).toString(), child.isDirectory, child.length(), child.lastModified())
      }
    }
    require(uri.scheme == "content" && DocumentsContract.isTreeUri(uri)) { "需要已授权的目录 URI" }
    val id = if (uri.pathSegments.getOrNull(2) == "document") DocumentsContract.getDocumentId(uri)
      else DocumentsContract.getTreeDocumentId(uri)
    val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(uri, id)
    val columns = arrayOf(Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME,
      Document.COLUMN_MIME_TYPE, Document.COLUMN_SIZE, Document.COLUMN_LAST_MODIFIED)
    val result = mutableListOf<Map<String, Any>>()
    // One provider query per directory supplies metadata for every child.
    val cursor = resolver.query(childrenUri, columns, null, null, null)
      ?: throw IOException("无法读取目录：$value")
    cursor.use {
      val key = it.getColumnIndexOrThrow(Document.COLUMN_DOCUMENT_ID)
      val name = it.getColumnIndexOrThrow(Document.COLUMN_DISPLAY_NAME)
      val mime = it.getColumnIndexOrThrow(Document.COLUMN_MIME_TYPE)
      val size = it.getColumnIndex(Document.COLUMN_SIZE)
      val modified = it.getColumnIndex(Document.COLUMN_LAST_MODIFIED)
      while (it.moveToNext()) {
        val childId = it.getString(key) ?: throw IOException("目录返回了无效文件标识")
        val childName = it.getString(name) ?: throw IOException("目录返回了无效文件名")
        result.add(row(childName, DocumentsContract.buildDocumentUriUsingTree(uri, childId).toString(),
          it.getString(mime) == Document.MIME_TYPE_DIR,
          if (size < 0 || it.isNull(size)) 0 else it.getLong(size),
          if (modified < 0 || it.isNull(modified)) 0 else it.getLong(modified)))
      }
      // A cloud provider's partial snapshot must never hide previously indexed files.
      if (it.extras.getBoolean(DocumentsContract.EXTRA_LOADING, false))
        throw IOException("目录尚未加载完成，请稍后重试")
    }
    return result
  }

  private fun row(name: String, uri: String, directory: Boolean, size: Long, mtime: Long) =
    mapOf("name" to name, "uri" to uri, "directory" to directory,
      "size" to size.coerceAtLeast(0), "mtime" to mtime.coerceAtLeast(0))
}
