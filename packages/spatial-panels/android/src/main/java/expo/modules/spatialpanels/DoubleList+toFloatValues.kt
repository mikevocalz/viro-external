package expo.modules.spatialpanels

/** JS numbers to the float array com.viro.core takes for poses. */
internal fun List<Double>.toFloatValues(): FloatArray = FloatArray(size) { this[it].toFloat() }
