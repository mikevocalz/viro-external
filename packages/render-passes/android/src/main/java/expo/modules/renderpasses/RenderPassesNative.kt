package expo.modules.renderpasses

/**
 * JNI binding surface for libviro_external_render_passes.so.
 *
 * The attach path stays in C++ — sibling packages (splat-pass, orb-pass) call
 * [ViroExternalPassRegistry::attachChild] directly from their own JNI, since
 * `shared_ptr<VRORenderPass>` cannot cross JNI cleanly.
 *
 * This surface is diagnostics-only: what's currently attached to a given
 * choreographer, in what order. Used by the six-gate verification in
 * doc/DECA-unified-render-pass-spec.md §6.
 *
 * A top-level `object` (not a companion) so JNI symbol names avoid Kotlin's
 * companion-object mangling (`_00024Companion`).
 */
internal object RenderPassesNative {
  init {
    System.loadLibrary("viro_external_render_passes")
  }

  @JvmStatic
  external fun childCount(choreographerRef: Long): Int

  @JvmStatic
  external fun childIds(choreographerRef: Long): Array<String>

  // Six-gate verification canary — attaches a diagnostic no-op child.
  // Delete once a real orb-pass package lands and JS stops calling.
  @JvmStatic
  external fun attachNoOp(choreographerRef: Long, priority: Int): String

  @JvmStatic
  external fun detachNoOp(id: String): Boolean
}
