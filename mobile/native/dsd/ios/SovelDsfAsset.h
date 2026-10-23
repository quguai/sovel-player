#import <AVFoundation/AVFoundation.h>
NS_ASSUME_NONNULL_BEGIN
@interface SovelDsfAsset : NSObject
+ (void)configure:(NSInteger)rate;
+ (AVURLAsset *)assetWithURL:(NSURL *)url
                     headers:(nullable NSDictionary<NSString *, NSString *> *)
                                 headers;
@end
NS_ASSUME_NONNULL_END
