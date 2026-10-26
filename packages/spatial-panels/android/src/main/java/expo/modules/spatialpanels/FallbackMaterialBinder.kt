package expo.modules.spatialpanels

import com.facebook.react.bridge.ReactApplicationContext
import com.viro.core.Texture
import com.viromedia.bridge.component.node.VRTNode
import com.viromedia.bridge.module.MaterialManager

/**
 * Puts a native texture on a material JavaScript registered by name with
 * ViroMaterials.createMaterials, then reapplies that material to every node
 * using it (geometries hold copies of their materials).
 *
 * Only public bridge API: MaterialManager.getMaterial,
 * Material.setDiffuseTexture and VRTNode.refreshNodesUsingMaterial. Main
 * thread, like every other MaterialManager and VRTNode access.
 */
internal object FallbackMaterialBinder {
  fun bind(reactContext: ReactApplicationContext, materialName: String, texture: Texture): Boolean {
    val manager = reactContext.getNativeModule(MaterialManager::class.java) ?: return false
    val material = manager.getMaterial(materialName) ?: return false
    material.setDiffuseTexture(texture)
    VRTNode.refreshNodesUsingMaterial(materialName)
    return true
  }
}
