import Foundation

/// Reject a server that ignores Range before accepting its audio body.
final class SovelHttpRead: NSObject, URLSessionDataDelegate, @unchecked Sendable {
  private let offset: Int
  private let limit: Int
  private var data = Data()
  private var failure: Error?
  private var continuation: CheckedContinuation<String, Error>?
  private var session: URLSession!
  init(offset: Int, limit: Int) {
    self.offset = offset
    self.limit = limit
  }
  func read(_ url: String, _ headers: [String: String]) async throws -> String {
    guard let address = URL(string: url), ["http", "https"].contains(address.scheme),
      address.user == nil, address.password == nil, offset >= 0, limit > 0,
      limit <= 16 * 1024 * 1024
    else { throw URLError(.badURL) }
    var request = URLRequest(
      url: address, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
    headers.forEach { request.setValue($1, forHTTPHeaderField: $0) }
    request.setValue("bytes=\(offset)-\(offset + limit - 1)", forHTTPHeaderField: "Range")
    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForResource = 20
    config.httpShouldSetCookies = false
    let queue = OperationQueue()
    queue.maxConcurrentOperationCount = 1
    session = URLSession(configuration: config, delegate: self, delegateQueue: queue)
    return try await withCheckedThrowingContinuation { continuation in
      self.continuation = continuation
      session.dataTask(with: request).resume()
    }
  }
  func urlSession(
    _ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) { completionHandler(nil) }
  func urlSession(
    _ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
  ) {
    guard let http = response as? HTTPURLResponse, http.statusCode == 206,
      http.value(forHTTPHeaderField: "Content-Range")?.hasPrefix("bytes \(offset)-") == true,
      response.expectedContentLength <= limit
    else {
      failure = NSError(
        domain: "SovelNetwork", code: 3,
        userInfo: [NSLocalizedDescriptionKey: "WebDAV 服务器需要支持 HTTP Range 分段读取"])
      completionHandler(.cancel)
      return
    }
    completionHandler(.allow)
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive bytes: Data) {
    guard data.count + bytes.count <= limit else {
      failure = URLError(.dataLengthExceedsMaximum)
      dataTask.cancel()
      return
    }
    data.append(bytes)
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    if let error = failure ?? error {
      continuation?.resume(throwing: error)
    } else {
      continuation?.resume(returning: data.base64EncodedString())
    }
    continuation = nil
    session.finishTasksAndInvalidate()
    self.session = nil
  }
}
