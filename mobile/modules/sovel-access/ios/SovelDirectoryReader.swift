import Foundation

enum SovelDirectoryReader {
  static func list(_ value: String) throws -> [[String: Any]] {
    guard let uri = URL(string: value), uri.isFileURL else {
      throw NSError(domain: "SovelAccess", code: 2,
        userInfo: [NSLocalizedDescriptionKey: "需要已授权的本地目录"])
    }
    let keys: Set<URLResourceKey> = [.isDirectoryKey, .isRegularFileKey,
      .isSymbolicLinkKey, .fileSizeKey, .contentModificationDateKey]
    let children = try FileManager.default.contentsOfDirectory(at: uri,
      includingPropertiesForKeys: Array(keys), options: [])
    return try children.compactMap { child in
      let info = try child.resourceValues(forKeys: keys)
      guard info.isSymbolicLink != true,
        info.isDirectory == true || info.isRegularFile == true else { return nil }
      return ["name": child.lastPathComponent, "uri": child.absoluteString,
        "directory": info.isDirectory == true, "size": info.fileSize ?? 0,
        "mtime": (info.contentModificationDate?.timeIntervalSince1970 ?? 0) * 1000]
    }
  }
}
