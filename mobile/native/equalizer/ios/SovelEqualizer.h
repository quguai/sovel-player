#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>

NS_ASSUME_NONNULL_BEGIN
@interface SovelEqualizer : NSObject
+ (void)configure:(BOOL)enabled gains:(NSArray<NSNumber *> *)gains preamp:(double)preamp headroom:(BOOL)headroom;
+ (NSDictionary<NSString *, id> *)status;
+ (void)attachToItem:(AVPlayerItem *)item;
@end
NS_ASSUME_NONNULL_END
