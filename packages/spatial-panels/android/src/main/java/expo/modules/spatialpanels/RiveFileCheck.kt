package expo.modules.spatialpanels

/**
 * The size and signature rules for a compositor panel's .riv, the same as
 * the native producer's (VRORivePanel::loadFile) and the JS validation.
 * Each check returns the problem as a message, or null when there is none.
 */
internal object RiveFileCheck {
  const val MAX_BYTES = 64 * 1024 * 1024
  const val SIGNATURE_BYTES = 4
  private val SIGNATURE = byteArrayOf(0x52, 0x49, 0x56, 0x45)

  fun sizeProblem(byteLength: Int): String? = when {
    byteLength <= 0 -> "the .riv file is empty"
    byteLength > MAX_BYTES -> "the .riv file is $byteLength bytes; the limit is 64 MiB ($MAX_BYTES bytes)"
    else -> null
  }

  /** @param header the file's first bytes, at least [SIGNATURE_BYTES] when the file has them. */
  fun signatureProblem(header: ByteArray): String? {
    val matches = header.size >= SIGNATURE.size && SIGNATURE.indices.all { header[it] == SIGNATURE[it] }
    return if (matches) null else "the file does not start with the RIVE signature; is it a .riv file?"
  }
}
