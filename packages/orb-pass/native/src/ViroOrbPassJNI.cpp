// ViroOrbPassJNI.cpp
// @viro-external/orb-pass
//
// Bridge from com.viromedia.bridge.module.ViroOrbPassModule (Java, ships in
// viro_bridge) into the C++ orb pass + multiplex registry.
//
// The Java side does the sceneNavTag → View → VRT3DSceneNavigator →
// ViroView → Renderer → getChoreographerRef() walk (mirrors ViroSplatPassModule).
// This file just receives the jlong choreographerRef and dispatches into
// the registry.

#include <jni.h>

#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>

#include "PersistentRef.h"          // virocore
#include "VROChoreographer.h"       // virocore
#include "ViroExternalPassRegistry.h"
#include "VROOrbRenderPass.h"

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

// Track orb passes so JS-side release() can find them by id even though the
// registry's detachChild is enough to unhook rendering. Kept for parity with
// splat-pass's registry pattern in case JS later needs per-orb metrics.
std::mutex g_mutex;
std::unordered_map<std::string, std::shared_ptr<viroexternal::orb::VROOrbRenderPass>> g_entries;

}  // namespace

extern "C" {

JNIEXPORT jstring JNICALL
Java_com_viromedia_bridge_module_ViroOrbPassModule_nativeAttach(
        JNIEnv *env, jclass, jlong choreographerRef, jint priority) {
    auto choreo = choreoFromJlong(choreographerRef);
    if (!choreo) {
        env->ThrowNew(env->FindClass("java/lang/IllegalStateException"),
                      "ViroOrbPass: null choreographer ref");
        return nullptr;
    }

    auto pass = std::make_shared<viroexternal::orb::VROOrbRenderPass>();
    auto result = viroexternal::renderpasses::ViroExternalPassRegistry::shared()
                      .attachChild(choreo, pass, static_cast<int32_t>(priority));

    {
        std::lock_guard<std::mutex> lock(g_mutex);
        g_entries.emplace(result.id, pass);
    }
    return env->NewStringUTF(result.id.c_str());
}

JNIEXPORT jboolean JNICALL
Java_com_viromedia_bridge_module_ViroOrbPassModule_nativeDetach(
        JNIEnv *env, jclass, jstring jId) {
    std::string id = jstringToStd(env, jId);
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        g_entries.erase(id);
    }
    return viroexternal::renderpasses::ViroExternalPassRegistry::shared()
               .detachChild(id)
        ? JNI_TRUE : JNI_FALSE;
}

// ── Reactive setters — thread-safe, no locks ─────────────────────────────
JNIEXPORT void JNICALL
Java_com_viromedia_bridge_module_ViroOrbPassModule_nativeSetTalk(
        JNIEnv *env, jclass, jstring jId, jfloat value) {
    std::string id = jstringToStd(env, jId);
    std::shared_ptr<viroexternal::orb::VROOrbRenderPass> pass;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        auto it = g_entries.find(id);
        if (it != g_entries.end()) pass = it->second;
    }
    if (pass) pass->setTalkTarget(value);
}

JNIEXPORT void JNICALL
Java_com_viromedia_bridge_module_ViroOrbPassModule_nativeSetIgnition(
        JNIEnv *env, jclass, jstring jId, jfloat value) {
    std::string id = jstringToStd(env, jId);
    std::shared_ptr<viroexternal::orb::VROOrbRenderPass> pass;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        auto it = g_entries.find(id);
        if (it != g_entries.end()) pass = it->second;
    }
    if (pass) pass->setIgnitionTarget(value);
}

JNIEXPORT void JNICALL
Java_com_viromedia_bridge_module_ViroOrbPassModule_nativeSetBreath(
        JNIEnv *env, jclass, jstring jId, jfloat value) {
    std::string id = jstringToStd(env, jId);
    std::shared_ptr<viroexternal::orb::VROOrbRenderPass> pass;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        auto it = g_entries.find(id);
        if (it != g_entries.end()) pass = it->second;
    }
    if (pass) pass->setBreathOverride(value);
}

JNIEXPORT void JNICALL
Java_com_viromedia_bridge_module_ViroOrbPassModule_nativeSetListen(
        JNIEnv *env, jclass, jstring jId, jfloat value) {
    std::string id = jstringToStd(env, jId);
    std::shared_ptr<viroexternal::orb::VROOrbRenderPass> pass;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        auto it = g_entries.find(id);
        if (it != g_entries.end()) pass = it->second;
    }
    if (pass) pass->setListenTarget(value);
}

JNIEXPORT void JNICALL
Java_com_viromedia_bridge_module_ViroOrbPassModule_nativeSetPosition(
        JNIEnv *env, jclass, jstring jId, jfloat x, jfloat y, jfloat z) {
    std::string id = jstringToStd(env, jId);
    std::shared_ptr<viroexternal::orb::VROOrbRenderPass> pass;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        auto it = g_entries.find(id);
        if (it != g_entries.end()) pass = it->second;
    }
    if (pass) pass->setWorldPosition(x, y, z);
}

}  // extern "C"
