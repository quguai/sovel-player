import ExpoModulesCore
import UIKit
import UniformTypeIdentifiers

public final class SovelAccessModule: Module {
  private var pickerDelegate: AccessPickerDelegate?
  private var scopes: [String: URL] = [:]

  public func definition() -> ModuleDefinition {
    Name("SovelAccess")

    AsyncFunction("listDirectory") { (uri: String) -> [[String: Any]] in
      try SovelDirectoryReader.list(uri)
    }.runOnQueue(.global(qos: .utility))

    AsyncFunction("pick") { (directory: Bool, promise: Promise) in
      guard self.pickerDelegate == nil else {
        promise.reject("PICKER_BUSY", "文件选择器已经打开")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("NO_PRESENTER", "无法打开文件选择器")
        return
      }
      let picker = UIDocumentPickerViewController(
        forOpeningContentTypes: directory ? [.folder] : [.item], asCopy: false
      )
      picker.allowsMultipleSelection = !directory
      let delegate = AccessPickerDelegate { [weak self] urls in
        guard let self else { return }
        defer { self.pickerDelegate = nil }
        do { promise.resolve(try urls.map { try self.retain($0) }) }
        catch { promise.reject("ACCESS_FAILED", error.localizedDescription) }
      }
      self.pickerDelegate = delegate
      picker.delegate = delegate
      picker.presentationController?.delegate = delegate
      presenter.present(picker, animated: true)
    }.runOnQueue(.main)

    AsyncFunction("restore") { (bookmark: String) -> [String: String] in
      guard let data = Data(base64Encoded: bookmark) else {
        throw NSError(domain: "SovelAccess", code: 1, userInfo: [NSLocalizedDescriptionKey: "文件授权记录已损坏，请重新选择来源"])
      }
      var stale = false
      let url = try URL(resolvingBookmarkData: data, options: [.withoutUI],
                        relativeTo: nil, bookmarkDataIsStale: &stale)
      return try self.retain(url)
    }.runOnQueue(.main)

    OnDestroy {
      for url in self.scopes.values { url.stopAccessingSecurityScopedResource() }
      self.scopes.removeAll()
    }
  }

  private func retain(_ url: URL) throws -> [String: String] {
    // Keep the root's scope alive for both metadata reads and native audio playback.
    if scopes[url.absoluteString] == nil && url.startAccessingSecurityScopedResource() {
      scopes[url.absoluteString] = url
    }
    let bookmark = try url.bookmarkData(options: [.minimalBookmark],
                                      includingResourceValuesForKeys: nil, relativeTo: nil)
    return ["uri": url.absoluteString, "name": url.lastPathComponent,
            "bookmark": bookmark.base64EncodedString()]
  }
}

private final class AccessPickerDelegate: NSObject, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
  private let completion: ([URL]) -> Void
  private var completed = false
  init(completion: @escaping ([URL]) -> Void) { self.completion = completion }
  private func finish(_ urls: [URL]) {
    guard !completed else { return }
    completed = true
    completion(urls)
  }
  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) { finish(urls) }
  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { finish([]) }
  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { finish([]) }
}
