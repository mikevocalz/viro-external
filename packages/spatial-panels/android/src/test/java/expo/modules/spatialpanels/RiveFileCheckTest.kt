package expo.modules.spatialpanels

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RiveFileCheckTest {
  private val rive = byteArrayOf(0x52, 0x49, 0x56, 0x45)

  @Test
  fun acceptsARiveHeaderWithinTheLimit() {
    assertNull(RiveFileCheck.sizeProblem(4))
    assertNull(RiveFileCheck.sizeProblem(RiveFileCheck.MAX_BYTES))
    assertNull(RiveFileCheck.signatureProblem(rive))
  }

  @Test
  fun rejectsEmptyAndOversizedFilesBeforeAnyCopy() {
    assertTrue(RiveFileCheck.sizeProblem(0)!!.contains("empty"))
    assertTrue(RiveFileCheck.sizeProblem(RiveFileCheck.MAX_BYTES + 1)!!.contains("64 MiB"))
    assertEquals(64 * 1024 * 1024, RiveFileCheck.MAX_BYTES)
  }

  @Test
  fun rejectsFilesWithoutTheRiveSignature() {
    assertTrue(RiveFileCheck.signatureProblem(byteArrayOf(0x89.toByte(), 0x50, 0x4e, 0x47))!!.contains("RIVE"))
    assertTrue(RiveFileCheck.signatureProblem(byteArrayOf(0x52, 0x49, 0x56))!!.contains("RIVE"))
  }
}
