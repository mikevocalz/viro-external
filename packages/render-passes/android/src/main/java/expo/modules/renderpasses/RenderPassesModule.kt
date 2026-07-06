package expo.modules.renderpasses

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Expo module — diagnostics surface for the render-passes multiplex.
 *
 * Exposes `childCount` and `childIds` to JS so the six-gate verification
 * (spec §6) can observe what's attached to a given choreographer without
 * having to parse logcat.
 *
 * The choreographer ref is a `jlong` opaque handle obtained on the JS side
 * via `Renderer.getChoreographerRef()` (virocore `Renderer.java:385`).
 */
class RenderPassesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RenderPasses")

    Function("childCount") { choreographerRef: Double ->
      RenderPassesNative.childCount(choreographerRef.toLong())
    }

    Function("childIds") { choreographerRef: Double ->
      RenderPassesNative.childIds(choreographerRef.toLong()).toList()
    }

    Function("attachNoOp") { choreographerRef: Double, priority: Int ->
      RenderPassesNative.attachNoOp(choreographerRef.toLong(), priority)
    }

    Function("detachNoOp") { id: String ->
      RenderPassesNative.detachNoOp(id)
    }
  }
}
