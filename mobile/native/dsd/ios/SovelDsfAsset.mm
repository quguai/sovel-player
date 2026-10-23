#import "SovelDsfAsset.h"
#include "SovelDsfPcmStream.h"
#include <atomic>
#include <cerrno>
#include <cstring>
#include <fcntl.h>
#import <objc/runtime.h>
#include <unistd.h>

static NSError *dsfError(NSString *message) {
  return [NSError errorWithDomain:@"SovelDSF"
                             code:1
                         userInfo:@{NSLocalizedDescriptionKey : message}];
}

// Refuse an ignored Range before reading its body. A server must support exact
// byte ranges; a DSF file is never downloaded in full as an implicit fallback.
@interface SovelDsfRange : NSObject <NSURLSessionDataDelegate>
@property(nonatomic, strong) NSMutableData *bytes;
@property(nonatomic, strong) NSError *error;
@property(nonatomic, strong) dispatch_semaphore_t finished;
@property(nonatomic, strong) NSURLSession *session;
@property(atomic, strong) NSURLSessionDataTask *task;
@property(nonatomic) uint64_t offset;
@property(nonatomic) NSUInteger count;
- (NSData *)read:(NSURL *)url
         headers:(NSDictionary *)headers
          offset:(uint64_t)offset
           count:(NSUInteger)count;
@end
@implementation SovelDsfRange
- (NSData *)read:(NSURL *)url
         headers:(NSDictionary *)headers
          offset:(uint64_t)offset
           count:(NSUInteger)count {
  self.bytes = [NSMutableData data];
  self.offset = offset;
  self.count = count;
  self.finished = dispatch_semaphore_create(0);
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.allHTTPHeaderFields = headers;
  [request setValue:[NSString stringWithFormat:@"bytes=%llu-%llu",
                                               (unsigned long long)offset,
                                               (unsigned long long)(offset +
                                                                    count - 1)]
      forHTTPHeaderField:@"Range"];
  [request setValue:@"identity" forHTTPHeaderField:@"Accept-Encoding"];
  NSURLSessionConfiguration *config =
      NSURLSessionConfiguration.ephemeralSessionConfiguration;
  config.timeoutIntervalForRequest = 15;
  config.timeoutIntervalForResource = 20;
  config.URLCache = nil;
  self.session = [NSURLSession sessionWithConfiguration:config
                                               delegate:self
                                          delegateQueue:nil];
  self.task = [self.session dataTaskWithRequest:request];
  [self.task resume];
  if (dispatch_semaphore_wait(
          self.finished, dispatch_time(DISPATCH_TIME_NOW, 21 * NSEC_PER_SEC))) {
    self.error = dsfError(@"DSF range read timed out");
    [self.task cancel];
  }
  [self.session invalidateAndCancel];
  if (self.error || self.bytes.length != count)
    return nil;
  return self.bytes;
}
- (void)URLSession:(NSURLSession *)session
              dataTask:(NSURLSessionDataTask *)task
    didReceiveResponse:(NSURLResponse *)response
     completionHandler:(void (^)(NSURLSessionResponseDisposition))completion {
  NSHTTPURLResponse *http = [response isKindOfClass:NSHTTPURLResponse.class]
                                ? (NSHTTPURLResponse *)response
                                : nil;
  NSString *range = [http valueForHTTPHeaderField:@"Content-Range"];
  NSString *prefix = [NSString
      stringWithFormat:@"bytes %llu-%llu/", (unsigned long long)self.offset,
                       (unsigned long long)(self.offset + self.count - 1)];
  if (http.statusCode != 206 || ![range hasPrefix:prefix] ||
      (response.expectedContentLength >= 0 &&
       response.expectedContentLength != (int64_t)self.count)) {
    self.error = dsfError(@"DSF server must support exact byte ranges");
    completion(NSURLSessionResponseCancel);
    return;
  }
  completion(NSURLSessionResponseAllow);
}
- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)task
    didReceiveData:(NSData *)data {
  if (self.bytes.length + data.length > self.count) {
    self.error = dsfError(@"DSF range body exceeded its limit");
    [task cancel];
    return;
  }
  [self.bytes appendData:data];
}
- (void)URLSession:(NSURLSession *)session
                    task:(NSURLSessionTask *)task
    didCompleteWithError:(NSError *)error {
  if (!self.error)
    self.error = error;
  dispatch_semaphore_signal(self.finished);
}
- (void)URLSession:(NSURLSession *)session
                          task:(NSURLSessionTask *)task
    willPerformHTTPRedirection:(NSHTTPURLResponse *)response
                    newRequest:(NSURLRequest *)request
             completionHandler:(void (^)(NSURLRequest *))completion {
  NSURL *original = task.originalRequest.URL;
  if (![original.host isEqual:request.URL.host] ||
      ![original.scheme isEqual:request.URL.scheme] ||
      !((original.port == request.URL.port) ||
        [original.port isEqual:request.URL.port])) {
    self.error = dsfError(@"Cross-origin DSF redirects are not supported");
    completion(nil);
    return;
  }
  completion(request);
}
@end

@interface SovelDsfLoader : NSObject <AVAssetResourceLoaderDelegate> {
  std::unique_ptr<sovel::DsfPcmStream> stream;
  int fd;
}
@property(nonatomic, strong) NSURL *original;
@property(nonatomic, strong) NSDictionary *headers;
@property(nonatomic) int pcmRate;
@property(nonatomic, strong) dispatch_queue_t queue;
@property(atomic, strong) SovelDsfRange *activeRead;
@property(atomic, strong) AVAssetResourceLoadingRequest *activeRequest;
@end
@implementation SovelDsfLoader
- (instancetype)init {
  if ((self = [super init])) {
    fd = -1;
    self.queue =
        dispatch_queue_create("cn.quguai.sovel.dsf", DISPATCH_QUEUE_SERIAL);
  }
  return self;
}
- (void)dealloc {
  if (fd >= 0)
    close(fd);
}
- (BOOL)resourceLoader:(AVAssetResourceLoader *)loader
    shouldWaitForLoadingOfRequestedResource:
        (AVAssetResourceLoadingRequest *)request {
  dispatch_async(self.queue, ^{
    if (request.isCancelled)
      return;
    self.activeRequest = request;
    @try {
      try {
        if (!self->stream) {
          if (self.original.isFileURL) {
            self->fd = open(self.original.fileSystemRepresentation, O_RDONLY);
            if (self->fd < 0)
              throw std::runtime_error("File unavailable");
          }
          // This reader is owned by the loader's stream and never outlives it.
          __unsafe_unretained SovelDsfLoader *owner = self;
          self->stream = std::make_unique<sovel::DsfPcmStream>(
              [owner](uint64_t offset, uint8_t *target, size_t count) {
                if (owner.activeRequest.isCancelled)
                  throw std::runtime_error("Cancelled");
                if (owner->fd >= 0) {
                  size_t done = 0;
                  while (done < count) {
                    ssize_t n = pread(owner->fd, target + done, count - done,
                                      off_t(offset + done));
                    if (n < 0 && errno == EINTR)
                      continue;
                    if (n <= 0)
                      throw std::runtime_error("Truncated DSF");
                    done += n;
                  }
                } else {
                  SovelDsfRange *read = [SovelDsfRange new];
                  owner.activeRead = read;
                  NSData *bytes = [read read:owner.original
                                     headers:owner.headers
                                      offset:offset
                                       count:count];
                  if (!bytes)
                    throw std::runtime_error("DSF range read failed");
                  std::memcpy(target, bytes.bytes, count);
                  owner.activeRead = nil;
                }
              },
              self.pcmRate);
        }
        AVAssetResourceLoadingContentInformationRequest *info =
            request.contentInformationRequest;
        info.contentType = @"com.apple.coreaudio-format";
        info.contentLength = int64_t(self->stream->size());
        info.byteRangeAccessSupported = YES;
        AVAssetResourceLoadingDataRequest *data = request.dataRequest;
        if (data) {
          int64_t cursor = MAX(data.requestedOffset, data.currentOffset);
          if (cursor < 0 || uint64_t(cursor) > self->stream->size())
            throw std::runtime_error("Invalid DSF seek");
          const uint64_t end =
              data.requestsAllDataToEndOfResource
                  ? self->stream->size()
                  : std::min(self->stream->size(),
                             uint64_t(data.requestedOffset) +
                                 uint64_t(data.requestedLength));
          while (uint64_t(cursor) < end && !request.isCancelled) {
            auto bytes = self->stream->read(
                uint64_t(cursor),
                size_t(std::min<uint64_t>(128 * 1024, end - cursor)));
            if (bytes.empty())
              throw std::runtime_error("Short DSF PCM read");
            [data respondWithData:[NSData dataWithBytes:bytes.data()
                                                 length:bytes.size()]];
            cursor += bytes.size();
          }
        }
        if (!request.isCancelled)
          [request finishLoading];
      } catch (const std::exception &) {
        if (!request.isCancelled)
          [request
              finishLoadingWithError:
                  dsfError(@"Unsupported, unavailable or truncated DSF audio")];
      }
    } @catch (NSException *exception) {
      if (!request.isCancelled)
        [request
            finishLoadingWithError:
                dsfError(@"DSF source could not supply the requested audio")];
    }
    self.activeRead = nil;
    self.activeRequest = nil;
  });
  return YES;
}
- (void)resourceLoader:(AVAssetResourceLoader *)loader
    didCancelLoadingRequest:(AVAssetResourceLoadingRequest *)request {
  if (self.activeRequest == request)
    [self.activeRead.task cancel];
}
@end

@implementation SovelDsfAsset
static std::atomic<int> pcmRate{176400};
static char loaderKey;
+ (void)configure:(NSInteger)rate {
  if (rate != 44100 && rate != 88200 && rate != 176400 && rate != 352800)
    @throw [NSException exceptionWithName:@"SovelDSF"
                                   reason:@"Unsupported PCM target rate"
                                 userInfo:nil];
  pcmRate.store(int(rate));
}
+ (AVURLAsset *)assetWithURL:(NSURL *)url
                     headers:(NSDictionary<NSString *, NSString *> *)headers {
  SovelDsfLoader *loader = [SovelDsfLoader new];
  loader.original = url;
  loader.headers = headers ?: @{};
  loader.pcmRate = pcmRate.load();
  NSURL *virtualURL = [NSURL
      URLWithString:[NSString stringWithFormat:@"sovel-dsf://%@/audio.caf",
                                               NSUUID.UUID.UUIDString]];
  AVURLAsset *asset = [AVURLAsset URLAssetWithURL:virtualURL options:nil];
  [asset.resourceLoader setDelegate:loader queue:dispatch_get_main_queue()];
  objc_setAssociatedObject(asset, &loaderKey, loader,
                           OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  return asset;
}
@end
