#import <CoreVideo/CoreVideo.h>
#import <React/RCTBridge.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTLog.h>
#import <WebRTC/RTCCVPixelBuffer.h>
#import <WebRTC/RTCI420Buffer.h>
#import <WebRTC/RTCVideoFrame.h>
#import <WebRTC/RTCVideoRenderer.h>
#import <WebRTC/RTCVideoTrack.h>

#import <FishjamReactNativeWebrtc/WebRTCModule.h>

#import <objc/message.h>

static const NSInteger kRetryMs = 250;
static const NSInteger kMaxRetries = 40;

static CVPixelBufferRef CreateBGRAFromI420(id<RTCI420Buffer> i420) {
    const int width = i420.width;
    const int height = i420.height;

    NSDictionary *attributes = @{
        (id)kCVPixelBufferMetalCompatibilityKey : @YES,
        (id)kCVPixelBufferIOSurfacePropertiesKey : @{},
    };

    CVPixelBufferRef output = nil;
    CVReturn result = CVPixelBufferCreate(
        kCFAllocatorDefault,
        width,
        height,
        kCVPixelFormatType_32BGRA,
        (__bridge CFDictionaryRef)attributes,
        &output);
    if (result != kCVReturnSuccess || !output) {
        return nil;
    }

    CVPixelBufferLockBaseAddress(output, 0);
    uint8_t *dst = (uint8_t *)CVPixelBufferGetBaseAddress(output);
    const size_t dstStride = CVPixelBufferGetBytesPerRow(output);

    const uint8_t *yPlane = i420.dataY;
    const uint8_t *uPlane = i420.dataU;
    const uint8_t *vPlane = i420.dataV;
    const int yStride = i420.strideY;
    const int uStride = i420.strideU;
    const int vStride = i420.strideV;

    for (int y = 0; y < height; ++y) {
        uint8_t *row = dst + (size_t)y * dstStride;
        const uint8_t *yRow = yPlane + y * yStride;
        const uint8_t *uRow = uPlane + (y / 2) * uStride;
        const uint8_t *vRow = vPlane + (y / 2) * vStride;

        for (int x = 0; x < width; ++x) {
            int yy = MAX(0, (int)yRow[x] - 16);
            int uu = (int)uRow[x / 2] - 128;
            int vv = (int)vRow[x / 2] - 128;

            int r = (298 * yy + 409 * vv + 128) >> 8;
            int g = (298 * yy - 100 * uu - 208 * vv + 128) >> 8;
            int b = (298 * yy + 516 * uu + 128) >> 8;

            row[x * 4 + 0] = (uint8_t)MIN(255, MAX(0, b));
            row[x * 4 + 1] = (uint8_t)MIN(255, MAX(0, g));
            row[x * 4 + 2] = (uint8_t)MIN(255, MAX(0, r));
            row[x * 4 + 3] = 255;
        }
    }

    CVPixelBufferUnlockBaseAddress(output, 0);
    return output;
}

static NSInteger DegreesForRotation(RTCVideoRotation rotation) {
    switch (rotation) {
        case RTCVideoRotation_90:  return 90;
        case RTCVideoRotation_180: return 180;
        case RTCVideoRotation_270: return 270;
        case RTCVideoRotation_0:
        default:                   return 0;
    }
}

@interface ViroExternalWebRTCFrameSink : NSObject <RTCVideoRenderer>
@property(nonatomic, weak) id consumer;
@property(nonatomic, strong) RTCVideoTrack *track;
@property(nonatomic, copy) NSString *sourceKey;
@property(nonatomic, assign) NSInteger retries;
@property(nonatomic, assign) BOOL revoked;
@end

@implementation ViroExternalWebRTCFrameSink

- (void)setSize:(CGSize)size {
    (void)size;
}

- (void)renderFrame:(RTCVideoFrame *)frame {
    id consumer = self.consumer;
    if (!consumer || self.revoked || !frame) {
        return;
    }

    CVPixelBufferRef pixelBuffer = nil;
    BOOL ownsPixelBuffer = NO;

    id<RTCVideoFrameBuffer> frameBuffer = frame.buffer;
    if ([frameBuffer isKindOfClass:[RTCCVPixelBuffer class]]) {
        pixelBuffer = ((RTCCVPixelBuffer *)frameBuffer).pixelBuffer;
    } else {
        id<RTCI420Buffer> i420 = [frameBuffer toI420];
        pixelBuffer = CreateBGRAFromI420(i420);
        ownsPixelBuffer = pixelBuffer != nil;
    }

    if (!pixelBuffer) {
        return;
    }

    SEL selector = NSSelectorFromString(
        @"consumePixelBuffer:rotationDegrees:mirrored:");
    if ([consumer respondsToSelector:selector]) {
        using ConsumeFn = void (*)(id, SEL, CVPixelBufferRef, NSInteger, BOOL);
        ((ConsumeFn)objc_msgSend)(
            consumer,
            selector,
            pixelBuffer,
            DegreesForRotation(frame.rotation),
            NO);
    }

    if (ownsPixelBuffer) {
        CVPixelBufferRelease(pixelBuffer);
    }
}

@end

@interface ViroExternalWebRTCFrames : NSObject
+ (void)setWebRTCModule:(WebRTCModule *)module;
+ (void)provideVideoFramesForSourceKey:(NSString *)sourceKey
                              consumer:(id)consumer
                                 width:(NSInteger)width
                                height:(NSInteger)height;
+ (void)revokeVideoFramesForSourceKey:(NSString *)sourceKey
                             consumer:(id)consumer;
@end

@implementation ViroExternalWebRTCFrames

static __weak WebRTCModule *sModule = nil;
static NSMapTable<id, ViroExternalWebRTCFrameSink *> *sSinks = nil;

+ (void)initialize {
    if (self == [ViroExternalWebRTCFrames class]) {
        sSinks = [NSMapTable weakToStrongObjectsMapTable];
    }
}

+ (void)setWebRTCModule:(WebRTCModule *)module {
    sModule = module;
}

+ (void)provideVideoFramesForSourceKey:(NSString *)sourceKey
                              consumer:(id)consumer
                                 width:(NSInteger)width
                                height:(NSInteger)height {
    (void)width;
    (void)height;
    if (!sourceKey.length || !consumer) {
        return;
    }

    [self revokeVideoFramesForSourceKey:sourceKey consumer:consumer];

    ViroExternalWebRTCFrameSink *sink =
        [[ViroExternalWebRTCFrameSink alloc] init];
    sink.consumer = consumer;
    sink.sourceKey = sourceKey;
    sink.retries = 0;
    sink.revoked = NO;
    [sSinks setObject:sink forKey:consumer];

    [self attachSink:sink];
}

+ (void)attachSink:(ViroExternalWebRTCFrameSink *)sink {
    WebRTCModule *module = sModule;
    if (!module || sink.revoked || !sink.consumer) {
        [self retrySink:sink reason:@"WebRTCModule not ready"];
        return;
    }

    dispatch_async(module.workerQueue, ^{
        if (sink.revoked || !sink.consumer) {
            return;
        }

        RTCMediaStream *stream =
            [module streamForReactTag:sink.sourceKey];
        RTCVideoTrack *track = stream.videoTracks.firstObject;
        if (!track) {
            [self retrySink:sink reason:@"stream/video track not ready"];
            return;
        }

        sink.track = track;
        [track addRenderer:sink];
        RCTLogInfo(
            @"[ViroExternalWebRTC] attached %@",
            sink.sourceKey);
    });
}

+ (void)retrySink:(ViroExternalWebRTCFrameSink *)sink
           reason:(NSString *)reason {
    if (sink.revoked || !sink.consumer) {
        return;
    }
    if (sink.retries++ >= kMaxRetries) {
        RCTLogError(
            @"[ViroExternalWebRTC] giving up on %@: %@",
            sink.sourceKey,
            reason);
        return;
    }

    dispatch_after(
        dispatch_time(
            DISPATCH_TIME_NOW,
            (int64_t)(kRetryMs * NSEC_PER_MSEC)),
        dispatch_get_main_queue(),
        ^{
            [self attachSink:sink];
        });
}

+ (void)revokeVideoFramesForSourceKey:(NSString *)sourceKey
                             consumer:(id)consumer {
    (void)sourceKey;
    if (!consumer) {
        return;
    }

    ViroExternalWebRTCFrameSink *sink = [sSinks objectForKey:consumer];
    if (!sink) {
        return;
    }

    sink.revoked = YES;
    [sSinks removeObjectForKey:consumer];

    RTCVideoTrack *track = sink.track;
    WebRTCModule *module = sModule;
    if (track && module) {
        dispatch_async(module.workerQueue, ^{
            [track removeRenderer:sink];
            sink.track = nil;
        });
    }
}

@end

@interface ViroExternalWebRTCAdapter : NSObject <RCTBridgeModule>
@property(nonatomic, weak) RCTBridge *bridge;
@end

@implementation ViroExternalWebRTCAdapter

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
    WebRTCModule *module =
        [self.bridge moduleForClass:[WebRTCModule class]];
    [ViroExternalWebRTCFrames setWebRTCModule:module];
    return @YES;
}

@end
