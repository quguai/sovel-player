// Exercise the production resource-loader HTTP reader with local network
// fixtures.
#import "../ios/SovelDsfAsset.mm"
#include <cassert>
#include <iostream>
int main(int argc, char **argv) {
  @autoreleasepool {
    assert(argc == 2);
    NSString *base = [NSString stringWithUTF8String:argv[1]];
    SovelDsfRange *range = [SovelDsfRange new];
    NSData *bytes = [range
           read:[NSURL URLWithString:
                           [base stringByAppendingString:@"/dav/sample.wav"]]
        headers:@{@"Authorization" : @"Basic ZGVtbzpkZW1v"}
         offset:0
          count:92];
    assert(bytes.length == 92 && std::memcmp(bytes.bytes, "RIFF", 4) == 0);
    SovelDsfRange *ignored = [SovelDsfRange new];
    assert([ignored read:[NSURL URLWithString:[base stringByAppendingString:
                                                        @"/ignores-range"]]
                 headers:@{}
                  offset:0
                   count:92] == nil);
    assert(ignored.bytes.length == 0);
    SovelDsfRange *unauthorized = [SovelDsfRange new];
    assert([unauthorized
                  read:[NSURL URLWithString:[base stringByAppendingString:
                                                      @"/dav/sample.wav"]]
               headers:@{}
                offset:0
                 count:92] == nil);
    assert(unauthorized.bytes.length == 0);
    std::cout << "PASS: DSF native authenticated range read; ignored Range and "
                 "unauthorized response rejected before body\n";
  }
}
