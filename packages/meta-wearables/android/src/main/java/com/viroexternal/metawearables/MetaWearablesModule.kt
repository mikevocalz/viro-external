package com.viroexternal.metawearables

import android.app.Activity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.selectors.AutoDeviceSelector
import com.meta.wearable.dat.core.session.DeviceSession
import com.meta.wearable.dat.core.session.DeviceSessionState
import com.meta.wearable.dat.core.types.Device
import com.meta.wearable.dat.core.types.LinkState
import com.meta.wearable.dat.core.types.Permission
import com.meta.wearable.dat.core.types.PermissionStatus
import com.meta.wearable.dat.core.types.RegistrationState
import com.meta.wearable.dat.camera.Camera
import com.meta.wearable.dat.camera.addCamera
import com.meta.wearable.dat.camera.types.StreamConfiguration
import com.meta.wearable.dat.camera.types.VideoQuality
import com.meta.wearable.dat.display.Display
import com.meta.wearable.dat.display.addDisplay
import com.meta.wearable.dat.display.removeDisplay
import com.meta.wearable.dat.inputs.Inputs
import com.meta.wearable.dat.inputs.addInputs
import com.meta.wearable.dat.inputs.removeInputs
import com.meta.wearable.dat.inputs.types.InputSource
import com.meta.wearable.dat.inputs.types.InputsConfiguration
import com.meta.wearable.dat.motion.Motion
import com.meta.wearable.dat.motion.addMotion
import com.meta.wearable.dat.motion.removeMotion
import com.meta.wearable.dat.motion.types.MotionConfiguration
import com.meta.wearable.dat.motion.types.MotionSamplingRate
import com.meta.wearable.dat.speech.Speech
import com.meta.wearable.dat.speech.addSpeech
import com.meta.wearable.dat.speech.removeSpeech
import com.meta.wearable.dat.mockdevice.MockDeviceKit
import com.meta.wearable.dat.mockdevice.api.GlassesModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * React Native transport for Meta's Wearables Device Access Toolkit (DAT).
 *
 * DAT is a paired-device model: the glasses connect through the Meta AI app,
 * and the phone hosts sessions that attach capabilities (camera, display,
 * inputs, motion, speech) one at a time. There is no renderer on the glasses
 * — this module is the JS-facing boundary the `MetaWearablesAdapter` and any
 * higher-level glasses UI talk through.
 *
 * Lifecycle mirrors the SDK contract:
 *   Wearables.initialize → registration (Meta AI app) → createSession →
 *   session.start() → wait for DeviceSessionState.STARTED → attach capability.
 * Capabilities attached before STARTED are rejected with SESSION_IDLE, so
 * `attachCapability` awaits the state flow rather than trusting call order.
 */
class MetaWearablesModule : Module() {

  private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
  private var initialized = false
  private var session: DeviceSession? = null
  private var sessionStateJob: Job? = null
  private var sessionErrorsJob: Job? = null
  private var devicesJob: Job? = null
  private var registrationJob: Job? = null
  private var pendingStartSession: Promise? = null

  // Attached capability handles — DAT stops capabilities via their own
  // `.stop()` (or `session.removeDisplay()`), so the refs must be kept.
  private var camera: Camera? = null
  private var display: Display? = null
  private var inputs: Inputs? = null
  private var motion: Motion? = null
  private var speech: Speech? = null

  override fun definition() = ModuleDefinition {
    Name("MetaWearables")

    Events(
      "onRegistrationState",
      "onDevicesChanged",
      "onSessionState",
      "onSessionError"
    )

    OnCreate {
      // Registration + device presence are observable without a session;
      // start collecting immediately so JS sees the current snapshot.
      registrationJob = scope.launch {
        Wearables.registrationState.collect { state ->
          sendEvent("onRegistrationState", mapOf("state" to state.name))
        }
      }
      devicesJob = scope.launch {
        Wearables.devices.collectLatest { sendDevicesSnapshot() }
      }
    }

    OnDestroy {
      scope.cancel()
    }

    AsyncFunction("initialize") { promise: Promise ->
      val context = appContext.reactContext ?: run {
        promise.reject("ERR_NO_CONTEXT", "React context unavailable", null)
        return@AsyncFunction
      }
      Wearables.initialize(context).fold(
        onSuccess = {
          initialized = true
          promise.resolve(true)
        },
        onFailure = { error, _ ->
          promise.reject("ERR_INIT", error.description, null)
        }
      )
    }

    AsyncFunction("startRegistration") { promise: Promise ->
      val activity: Activity = appContext.currentActivity ?: run {
        promise.reject(
          "ERR_NO_ACTIVITY",
          "Registration needs a foreground activity (the Meta AI app is launched for the flow)",
          null
        )
        return@AsyncFunction
      }
      try {
        Wearables.startRegistration(activity)
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("ERR_REGISTRATION", e.message, e)
      }
    }

    AsyncFunction("getRegistrationState") { promise: Promise ->
      promise.resolve(Wearables.registrationState.value.name)
    }

    AsyncFunction("getDevices") { promise: Promise ->
      promise.resolve(deviceSnapshots())
    }

    AsyncFunction("checkPermission") { permission: String, promise: Promise ->
      val datPermission = runCatching { Permission.valueOf(permission.uppercase()) }
        .getOrElse {
          promise.reject("ERR_PERMISSION", "Unknown DAT permission: $permission", null)
          return@AsyncFunction
        }
      scope.launch {
        Wearables.checkPermissionStatus(datPermission).fold(
          onSuccess = { status ->
            promise.resolve(
              when (status) {
                is PermissionStatus.Granted -> "granted"
                is PermissionStatus.Denied -> "denied"
                else -> "unknown"
              }
            )
          },
          onFailure = { error, _ ->
            promise.reject("ERR_PERMISSION", error.description, null)
          }
        )
      }
    }

    AsyncFunction("getDeviceCapabilities") { promise: Promise ->
      promise.resolve(capabilityMap())
    }

    /**
     * Opens a session on the preferred device and resolves when it reaches
     * STARTED — matching the SDK rule that capabilities may only attach after
     * that state. Rejects on NO_ELIGIBLE_DEVICE so JS can surface
     * "no glasses linked" itself.
     */
    AsyncFunction("startSession") { promise: Promise ->
      if (!initialized) {
        promise.reject("ERR_NOT_INIT", "Call initialize() first", null)
        return@AsyncFunction
      }
      if (session != null) {
        promise.reject("ERR_SESSION_EXISTS", "A session is already open; call stopSession() first", null)
        return@AsyncFunction
      }
      Wearables.createSession(AutoDeviceSelector()).fold(
        onSuccess = { created ->
          session = created
          pendingStartSession = promise
          sessionStateJob = scope.launch {
            created.state.collectLatest { state ->
              sendEvent("onSessionState", mapOf("state" to state.name))
              if (state == DeviceSessionState.STARTED) {
                pendingStartSession?.resolve(true)
                pendingStartSession = null
              }
            }
          }
          sessionErrorsJob = scope.launch {
            created.errors.collect { error ->
              sendEvent("onSessionError", mapOf("error" to error.description))
            }
          }
          // Fire-and-forget per the SDK contract; failures arrive on errors.
          created.start()
        },
        onFailure = { error, _ ->
          promise.reject("ERR_SESSION", error.description, null)
        }
      )
    }

    AsyncFunction("stopSession") { promise: Promise ->
      val current = session ?: run {
        promise.resolve(null)
        return@AsyncFunction
      }
      session = null
      sessionStateJob?.cancel()
      sessionErrorsJob?.cancel()
      pendingStartSession?.resolve(false)
      pendingStartSession = null
      detachAll(current)
      current.stop()
      promise.resolve(null)
    }

    /**
     * Attach a capability to the live session. Awaits STARTED so callers don't
     * have to time their own calls — the SDK rejects early attaches with
     * SESSION_IDLE. Camera also starts its video stream; display attaches a
     * blank surface (content rendering is a separate layer).
     */
    AsyncFunction("attachCapability") { name: String, promise: Promise ->
      val current = session ?: run {
        promise.reject("ERR_NO_SESSION", "No active session; call startSession() first", null)
        return@AsyncFunction
      }
      scope.launch {
        current.state.first { it == DeviceSessionState.STARTED }
        when (name) {
          "camera" -> current.addCamera(
            StreamConfiguration(videoQuality = VideoQuality.MEDIUM, frameRate = 24)
          ).fold(
            onSuccess = { attached ->
              camera = attached
              attached.stream.start().fold(
                onSuccess = { promise.resolve(true) },
                onFailure = { e, _ -> promise.reject("ERR_STREAM", e.description, null) }
              )
            },
            onFailure = { e, _ -> promise.reject("ERR_CAMERA", e.description, null) }
          )
          "display" -> current.addDisplay().fold(
            onSuccess = { attached ->
              display = attached
              promise.resolve(true)
            },
            onFailure = { e, _ -> promise.reject("ERR_DISPLAY", e.description, null) }
          )
          "inputs" -> current.addInputs(
            InputsConfiguration(
              sources = setOf(
                InputSource.CAPTOUCH,
                InputSource.CAPTURE_BUTTON,
                InputSource.ACTION_BUTTON
              ),
              consumeBack = true
            )
          ).fold(
            onSuccess = { attached ->
              inputs = attached
              promise.resolve(true)
            },
            onFailure = { e, _ -> promise.reject("ERR_INPUTS", e.description, null) }
          )
          // addMotion attaches the sensor STOPPED — start() is what opens the
          // sample flow; skipping it looks exactly like a pair with no IMU.
          "motion" -> current.addMotion(
            MotionConfiguration(samplingRate = MotionSamplingRate.HZ_5)
          ).fold(
            onSuccess = { attached ->
              motion = attached
              attached.start()
              promise.resolve(true)
            },
            onFailure = { e, _ -> promise.reject("ERR_MOTION", e.description, null) }
          )
          // Same stopped-on-attach contract as motion: the recogniser is dead
          // until start(), which is itself a DatResult.
          "speech" -> current.addSpeech().fold(
            onSuccess = { attached ->
              speech = attached
              attached.start().fold(
                onSuccess = { promise.resolve(true) },
                onFailure = { e, _ -> promise.reject("ERR_SPEECH", e.description, null) }
              )
            },
            onFailure = { e, _ -> promise.reject("ERR_SPEECH", e.description, null) }
          )
          else -> promise.reject("ERR_CAPABILITY", "Unknown capability: $name", null)
        }
      }
    }

    AsyncFunction("detachCapability") { name: String, promise: Promise ->
      try {
        // Detach paths differ per capability — verified against the DAT
        // samples: inputs has no `.stop()` (session.removeInputs is the only
        // off switch); motion/speech/display take capability `.stop()` plus
        // the session-level remove; camera stops on the handle alone.
        when (name) {
          "camera" -> { camera?.stop(); camera = null }
          "display" -> { display?.stop(); session?.removeDisplay(); display = null }
          "inputs" -> { session?.removeInputs(); inputs = null }
          "motion" -> { motion?.stop(); session?.removeMotion(); motion = null }
          "speech" -> { speech?.stop(); session?.removeSpeech(); speech = null }
          else -> {}
        }
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("ERR_DETACH", e.message, e)
      }
    }

    /**
     * MockDeviceKit — drives registration, pairing and capability flows with
     * no physical glasses. Debug/testing only; the mockdevice artifact is a
     * plugin-selected module.
     */
    AsyncFunction("enableMockDevice") { model: String?, promise: Promise ->
      try {
        val context = appContext.reactContext ?: run {
          promise.reject("ERR_NO_CONTEXT", "React context unavailable", null)
          return@AsyncFunction
        }
        val kit = MockDeviceKit.getInstance(context)
        kit.enable()
        val glassesModel = runCatching {
          GlassesModel.valueOf((model ?: "RAYBAN_META").uppercase())
        }.getOrElse { GlassesModel.RAYBAN_META }
        kit.pairGlasses(glassesModel).fold(
          onSuccess = { promise.resolve(true) },
          onFailure = { e, _ -> promise.reject("ERR_MOCK", e.description, null) }
        )
      } catch (e: Exception) {
        promise.reject("ERR_MOCK", e.message, e)
      }
    }

    AsyncFunction("disableMockDevice") { promise: Promise ->
      try {
        appContext.reactContext?.let { MockDeviceKit.getInstance(it).disable() }
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("ERR_MOCK", e.message, e)
      }
    }
  }

  private fun detachAll(current: DeviceSession) {
    camera?.stop(); camera = null
    display?.stop(); runCatching { current.removeDisplay() }; display = null
    runCatching { current.removeInputs() }; inputs = null
    motion?.stop(); runCatching { current.removeMotion() }; motion = null
    speech?.stop(); runCatching { current.removeSpeech() }; speech = null
  }

  private fun sendDevicesSnapshot() {
    sendEvent("onDevicesChanged", mapOf("devices" to deviceSnapshots()))
  }

  private fun deviceSnapshots(): List<Map<String, Any?>> {
    val identifiers = Wearables.devices.value
    return identifiers.map { id ->
      val device: Device? = Wearables.devicesMetadata[id]?.value
      mapOf(
        "id" to id.toString(),
        "deviceType" to device?.deviceType?.name,
        "linkState" to device?.linkState?.name,
        "donState" to device?.donState?.name,
        "compatibility" to device?.compatibility?.name,
        "displayCapable" to (device?.isDisplayCapable() == true),
        "connected" to (device?.linkState == LinkState.CONNECTED)
      )
    }
  }

  /**
   * Hardware capabilities from the live device snapshot — capability-first,
   * never name-based: `display` comes from Device.isDisplayCapable() rather
   * than matching a product name. With no linked+registered device the map is
   * empty, and the adapter reports everything "unverified".
   */
  private fun capabilityMap(): Map<String, Boolean> {
    val devices = Wearables.devices.value
      .mapNotNull { Wearables.devicesMetadata[it]?.value }
    if (devices.isEmpty()) return emptyMap()
    if (Wearables.registrationState.value != RegistrationState.REGISTERED) {
      return emptyMap()
    }

    return mapOf(
      "camera" to true,
      "microphone" to true,
      "audio" to true,
      "display" to devices.any { it.isDisplayCapable() },
      "inputs" to true,
      "motion" to true,
      "speech" to true
    )
  }
}
