// ViroSplatPassJNI.cpp
//
// JNI symbols for `com.viromedia.bridge.module.ViroSplatPassModule`.
// These ship in `libsplat_pass.so`. The Java module loads the lib on
// class-init; if the lib is absent in the build, the module reports
// `isAvailable() == false` and never reaches into this TU.
//
// The choreographer reference passed in `nativeAttach` is a virocore
// `PersistentRef<VROChoreographer> *` opaque handle; we unwrap it via
// the same template type — that requires virocore's `PersistentRef.h`
// on the include path.

#include <jni.h>

#include <memory>
#include <string>

#include "PersistentRef.h"        // virocore
#include "VROChoreographer.h"     // virocore
#include "ViroSplatPassRegistry.h"
#include "VROSplatRenderPass.h"
#include "SpzReader.h"

#include <vector>

namespace {

std::shared_ptr<VROChoreographer> choreoFromJlong(jlong ref) {
    if (ref == 0) return nullptr;
    auto *persisted = reinterpret_cast<PersistentRef<VROChoreographer> *>(ref);
    return persisted->get();
}

std::string jstringToStd(JNIEnv *env, jstring js) {
    if (!js) return {};
    const char *cstr = env->GetStringUTFChars(js, nullptr);
    std::string out = cstr ? std::string(cstr) : std::string{};
    if (cstr) env->ReleaseStringUTFChars(js, cstr);
    return out;
}

viroexternal::splat::SplatSourceFormat parseFormat(const std::string &s) {
    using F = viroexternal::splat::SplatSourceFormat;
    if (s == "spz")    return F::SPZ;
    if (s == "splat")  return F::Splat;
    if (s == "ply")    return F::Ply;
    if (s == "ksplat") return F::KSplat;
    return F::SPZ;
}

}  // namespace

extern "C" {

JNIEXPORT jstring JNICALL
Java_com_viromedia_bridge_module_ViroSplatPassModule_nativeAttach(
        JNIEnv *env, jclass, jlong choreographerRef,
        jstring jUri, jstring jFormat,
        jint maxSplats, jint priority, jboolean has4D,
        jbyteArray jSpzBytes) {
    auto choreo = choreoFromJlong(choreographerRef);
    if (!choreo) {
        env->ThrowNew(env->FindClass("java/lang/IllegalStateException"),
                      "ViroSplatPass: null choreographer ref");
        return nullptr;
    }
    viroexternal::splat::SplatPassConfig cfg{};
    cfg.uri          = jstringToStd(env, jUri);
    cfg.format       = parseFormat(jstringToStd(env, jFormat));
    cfg.maxSplats    = static_cast<uint32_t>(maxSplats);
    cfg.priority     = static_cast<int32_t>(priority);
    cfg.has4D        = has4D == JNI_TRUE;

    auto result = viroexternal::splat::ViroSplatPassRegistry::shared().attach(choreo, cfg);

    // Decode + stage the SPZ bytes if Java handed us any.
    if (jSpzBytes != nullptr) {
        const jsize len = env->GetArrayLength(jSpzBytes);
        if (len > 0) {
            jbyte *raw = env->GetByteArrayElements(jSpzBytes, nullptr);
            if (raw) {
                auto bytes = reinterpret_cast<const uint8_t *>(raw);
                auto hdr = viroexternal::splat::readSpzHeader(bytes, static_cast<size_t>(len));
                if (hdr.error == viroexternal::splat::SpzError::Ok) {
                    auto staged = std::make_shared<std::vector<uint8_t>>(
                        static_cast<size_t>(hdr.header.numPoints) *
                        viroexternal::splat::DECODED_SPLAT_BYTES);
                    auto *outFloats = reinterpret_cast<float *>(staged->data());
                    viroexternal::splat::decodeSpzBody(
                        hdr.header,
                        bytes + hdr.bodyOffset,
                        static_cast<size_t>(len) - hdr.bodyOffset,
                        outFloats);
                    result.pass->stagePendingSource(
                        staged, static_cast<int>(hdr.header.numPoints));
                }
                env->ReleaseByteArrayElements(jSpzBytes, raw, JNI_ABORT);
            }
        }
    }
    return env->NewStringUTF(result.id.c_str());
}

JNIEXPORT void JNICALL
Java_com_viromedia_bridge_module_ViroSplatPassModule_nativeDetach(
        JNIEnv *env, jclass, jstring jId) {
    viroexternal::splat::ViroSplatPassRegistry::shared().detach(jstringToStd(env, jId));
}

JNIEXPORT jint JNICALL
Java_com_viromedia_bridge_module_ViroSplatPassModule_nativeSplatCount(
        JNIEnv *env, jclass, jstring jId) {
    auto pass = viroexternal::splat::ViroSplatPassRegistry::shared().find(jstringToStd(env, jId));
    return pass ? static_cast<jint>(pass->splatCount()) : 0;
}

JNIEXPORT jdouble JNICALL
Java_com_viromedia_bridge_module_ViroSplatPassModule_nativeLastFrameMs(
        JNIEnv *env, jclass, jstring jId) {
    auto pass = viroexternal::splat::ViroSplatPassRegistry::shared().find(jstringToStd(env, jId));
    return pass ? pass->lastFrameMs() : 0.0;
}

JNIEXPORT jint JNICALL
Java_com_viromedia_bridge_module_ViroSplatPassModule_nativeDroppedFrames(
        JNIEnv *env, jclass, jstring jId) {
    auto pass = viroexternal::splat::ViroSplatPassRegistry::shared().find(jstringToStd(env, jId));
    return pass ? static_cast<jint>(pass->droppedFrames()) : 0;
}

JNIEXPORT jstring JNICALL
Java_com_viromedia_bridge_module_ViroSplatPassModule_nativeDeviceProfile(
        JNIEnv *env, jclass) {
    return env->NewStringUTF(
        viroexternal::splat::VROSplatRenderPass::detectedDeviceProfileId());
}

JNIEXPORT jint JNICALL
Java_com_viromedia_bridge_module_ViroSplatPassModule_nativeMaxSplats(
        JNIEnv *env, jclass) {
    return 1500000;
}

JNIEXPORT jint JNICALL
Java_com_viromedia_bridge_module_ViroSplatPassModule_nativeSortWorkgroupSize(
        JNIEnv *env, jclass) {
    return 64;
}

JNIEXPORT jint JNICALL
Java_com_viromedia_bridge_module_ViroSplatPassModule_nativeExpectedFps(
        JNIEnv *env, jclass) {
    return 90;
}

}  // extern "C"
