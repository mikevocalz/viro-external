// ViroExternalPassJNI.cpp
// @viro-external/render-passes
//
// Diagnostics-only JNI. Attach / detach happen through the C++ registry
// API called by sibling packages (splat-pass, orb-pass) that already link
// against libviro_external_render_passes.so — the child pass objects
// (shared_ptr<VRORenderPass>) cannot cross JNI cleanly, so this file
// deliberately does NOT expose an attach path from Java.
//
// Ships in `libviro_external_render_passes.so`. The Expo module
// `expo.modules.renderpasses.RenderPassesNative` (a Kotlin object, so no
// `_00024Companion` mangling) calls `System.loadLibrary` on class-init and
// declares matching `external fun` decls that bind to these symbols.

#include <jni.h>

#include <memory>
#include <string>
#include <vector>

#include "PersistentRef.h"          // virocore
#include "VROChoreographer.h"       // virocore
#include "ViroExternalPassRegistry.h"
#include "VRONoOpRenderPass.h"

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

}  // namespace

extern "C" {

JNIEXPORT jint JNICALL
Java_expo_modules_renderpasses_RenderPassesNative_childCount(
        JNIEnv *env, jclass, jlong choreographerRef) {
    auto choreo = choreoFromJlong(choreographerRef);
    if (!choreo) return 0;
    return static_cast<jint>(
        viroexternal::renderpasses::ViroExternalPassRegistry::shared()
            .childCount(choreo));
}

JNIEXPORT jobjectArray JNICALL
Java_expo_modules_renderpasses_RenderPassesNative_childIds(
        JNIEnv *env, jclass, jlong choreographerRef) {
    auto choreo = choreoFromJlong(choreographerRef);
    jclass stringCls = env->FindClass("java/lang/String");
    if (!choreo) return env->NewObjectArray(0, stringCls, nullptr);

    auto ids = viroexternal::renderpasses::ViroExternalPassRegistry::shared()
                   .childIdsOrdered(choreo);
    jobjectArray out =
        env->NewObjectArray(static_cast<jsize>(ids.size()), stringCls, nullptr);
    for (jsize i = 0; i < static_cast<jsize>(ids.size()); ++i) {
        env->SetObjectArrayElement(out, i, env->NewStringUTF(ids[i].c_str()));
    }
    return out;
}

// ── Canary NoOp pass (spec §6 gate 5 verification) ─────────────────────────
// Attaches a VRONoOpRenderPass as a multiplex child. Diagnostic use only —
// when a real orb-pass package lands, JS should stop calling this.

JNIEXPORT jstring JNICALL
Java_expo_modules_renderpasses_RenderPassesNative_attachNoOp(
        JNIEnv *env, jclass, jlong choreographerRef, jint priority) {
    auto choreo = choreoFromJlong(choreographerRef);
    if (!choreo) return env->NewStringUTF("");
    auto pass = std::make_shared<viroexternal::renderpasses::VRONoOpRenderPass>();
    auto result = viroexternal::renderpasses::ViroExternalPassRegistry::shared()
                      .attachChild(choreo, pass, static_cast<int32_t>(priority));
    return env->NewStringUTF(result.id.c_str());
}

JNIEXPORT jboolean JNICALL
Java_expo_modules_renderpasses_RenderPassesNative_detachNoOp(
        JNIEnv *env, jclass, jstring jId) {
    return viroexternal::renderpasses::ViroExternalPassRegistry::shared()
               .detachChild(jstringToStd(env, jId))
        ? JNI_TRUE : JNI_FALSE;
}

}  // extern "C"
