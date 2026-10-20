import Foundation

let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: root) }
try Data([1, 2, 3]).write(to: root.appendingPathComponent("音乐.wav"))
try FileManager.default.createDirectory(at: root.appendingPathComponent("album"), withIntermediateDirectories: true)
try FileManager.default.createSymbolicLink(at: root.appendingPathComponent("cycle"), withDestinationURL: root)
let rows = try SovelDirectoryReader.list(root.absoluteString)
precondition(Set(rows.compactMap { $0["name"] as? String }) == Set(["音乐.wav", "album"]))
let audio = rows.first { $0["name"] as? String == "音乐.wav" }!
precondition(audio["size"] as? Int == 3)
precondition((audio["mtime"] as? Double ?? 0) > 1_000_000_000_000)
precondition(URL(string: audio["uri"] as! String)?.lastPathComponent == "音乐.wav")
do {
  _ = try SovelDirectoryReader.list(root.appendingPathComponent("missing").absoluteString)
  fatalError("A failed read must not produce an empty snapshot")
} catch {}
print("Swift directory discovery tests passed")
