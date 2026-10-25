# Performance: native whiteboard, native Rive, rounded panels

[Handbook](README.md) · [Device validation](DEVICE_VALIDATION.md) · [ADR 0001](adr/0001-native-whiteboard-rive-panels.md)

The master prompt (§3.4, §14) asks for this file "with measured numbers". The only measured numbers so far are binary sizes. Nothing has run on a headset, so there is no latency, frame-time, memory or GPU figure for either producer, and none is given below. Every other section is a procedure plus a target, and a target is the bar a future result has to meet.

## Measured

### Binary size of `libviro_renderer.so` (arm64-v8a, stripped)

From virocore `docs/RIVE_RUNTIME.md` ("Binary size"), virocore `d5e219c1`, measured on `viroreact-release.aar` with the former link-check probe:

| Build | Bytes | `.text` | `.rodata` | `.eh_frame` |
| --- | ---: | ---: | ---: | ---: |
| Base (virocore 70e95fd8 build) | 7,568,144 | 4,177,272 | 494,988 | 735,568 |
| With rive-runtime 8b3ca41b | 10,547,328 | 6,234,796 | 680,588 | 1,021,504 |
| Delta | +2,979,184 (+2.84 MiB, +39.4%) | +2,057,524 | +185,600 | +285,936 |

The same file records that the base was the `.so` supplied with the task, not a rebuild of the branch with `-DVIRO_WITH_RIVE=OFF`, so the delta assumes those match.

Measured for this document from the renderer AARs committed to the viro fork (`android/viro_renderer/viro_renderer-release.aar`). Each `.so` is reported by `file` as stripped; the symbol count is `llvm-nm -D --defined-only | grep -c VRORivePanel` from NDK 27.1.12297006:

| viro commit | What the rebuild added | Bytes | Exported `VRORivePanel` symbols |
| --- | --- | ---: | ---: |
| `42367718` | static rive-runtime, `PREMULTIPLY_ALPHA` blend mode | 10,547,376 | 0 |
| `e41d43b8` | virocore `d5e219c1`: `VRORivePanel`, texture ring, B2 finish pass, coverage function, corner-aware resolve, eviction reporting | 10,684,144 | 37 |
| `f5d93c23` | virocore `48ed1ffc`: `com.viro.core.RiveCompositorPanel` and its JNI | 10,740,728 | 39 |

`42367718` to `e41d43b8` is +136,768 bytes, and that step carries more than the Rive producer, so it is an upper bound on what `VRORivePanel` alone costs. `42367718` is 48 bytes larger than virocore's 10,547,328, a separate build of the same step. To reproduce:

```sh
cd viro
git show 42367718:android/viro_renderer/viro_renderer-release.aar > r.aar
unzip -o -q r.aar 'jni/arm64-v8a/libviro_renderer.so'
stat -f %z jni/arm64-v8a/libviro_renderer.so      # macOS; stat -c %s on Linux
$NDK/toolchains/llvm/prebuilt/*/bin/llvm-nm -D --defined-only jni/arm64-v8a/libviro_renderer.so | grep -c VRORivePanel
```

The native-panels library (`libNitroNativePanels.so`) has not been built with Gradle or CMake, so its size is unknown.

### Not performance evidence

These exist and are worth having, but they say nothing about speed or memory: 16 node tests and 45 JUnit tests for the whiteboard, 15 node tests and one host C++ test for the Rive objects ([capabilities](CAPABILITIES.md)), the virocore geometry and coverage scripts, and kotlinc or NDK clang compiles. Passing them is not a frame-time result.

## Budgets

Set every budget from the refresh rate the headset runs at during the measurement, read at the start of each run. One display period is `P = 1000 / Hz` ms. Record `Hz` with each result.

| Metric | Target (not a result) | Why this target |
| --- | --- | --- |
| Rive producer frame time, worker CPU + GPU, while animating | p95 below `P` | The worker paces itself at `maxFrameRateHz` (`VRORivePanel.h`, default 72; `ViroNativeRivePanel` default 72). A frame that takes longer than a period cannot keep up with the display |
| Rive producer, settled state machine | 0 buffers queued over 10 s | virocore `RIVE_RUNTIME.md` "Needs a device": a settled state machine must produce zero swaps |
| Whiteboard, idle board | 0 buffers queued over 10 s with no input, diff, camera or overlay change | `WhiteboardRenderer` redraws only on document, camera, overlay or Surface change (`WhiteboardRenderer.nitro.ts:12-16`) |
| Whiteboard draw time per frame, render thread | p95 below `P` | `lockHardwareCanvas` to `unlockCanvasAndPost` runs on its own `HandlerThread` (`WhiteboardRenderLoop.kt:24,164,180`) and must not fall behind the input rate |
| Input-to-visible-ink latency, native board | p50 and p95 no worse than the WebView board measured the same way on the same headset | No absolute budget can be justified before a baseline exists. ADR D2 names the upgrade (EGL + Skia Ganesh) if the native board misses this |
| Viro XR frame time with panels shown | No increase in missed frames against the same scene without the panels | The panels share the GPU with Viro's eye buffers |
| JS thread per board frame (binding encode + Nitro call) | p95 well under `P`; record the absolute number | One coalesced diff per frame (`createWhiteboardRendererBinding.ts:13-20`) |
| GPU readbacks and per-frame JS uploads on a live panel | 0 | `prompts/ROSTER.md` non-negotiables |
| Memory after 20 mount/unmount cycles | Back to the first cycle's level within noise | Leaks show as steady growth |

## Measurement plan

Run each procedure on Quest 3 and PICO 4 Ultra with the build and SHAs recorded as in [device validation](DEVICE_VALIDATION.md). Debug builds distort CPU numbers; use the headset release flavor (`questRelease`, `picoRelease`) for timing and the debug flavor only for functional checks. Report p50 and p95 with the sample count.

### Workloads

- Boards: a real board exported from the app with `Store.getSnapshot()`, plus a stress board. The stress case is documented with the run (record count, longest stroke in points, image count); it is not fixed here because no representative board has been measured yet.
- Long stroke: one continuous pen stroke of at least 10 s, drawn slowly enough to produce several thousand points. QuickDraw recomputes the active stroke's outline per batch (ADR D2), so cost can grow with point count.
- Rive: `moyo_board_chrome.riv` (artboard and state machine `BoardChrome`, 2496 x 1560), the file the app ships, plus one continuously animating state.

### Tools and their limits

| Tool | Use it for | Limits |
| --- | --- | --- |
| Perfetto (`record_android_trace` or the on-device Perfetto UI), categories `gfx`, `input`, `view`, `sched`, `freq` | Thread scheduling of the Rive worker and the `WhiteboardRenderer-<surfaceId>` thread; BufferQueue `queueBuffer` slices from the producer threads; frame cadence | Neither producer emits its own trace sections yet: there is no `ATrace` or `Trace.beginSection` call in `packages/native-panels/android` or in `VRORivePanel*.cpp`. Span-level timing (one Rive advance, one board draw) needs those markers added first. The Rive worker thread is unnamed, so find it by tid from the `pthread` that calls `eglSwapBuffers` |
| simpleperf (`simpleperf record -p <pid> --call-graph dwarf`, or `-t <tid>`) | CPU hotspots in the Rive worker, the board render thread and the JS thread | Sampling, so short frames need many seconds of data. Needs a debuggable build or root for some events |
| `adb shell dumpsys gfxinfo <package> framestats` | Nothing in this work | It reports the HWUI renderer of the app's windows. The board draws with `lockHardwareCanvas` into a Surface Viro owns, the Rive worker uses its own EGL context, and Viro renders with GL/OpenXR; none of those are window frames. Confirm once on device that its frame count does not move while drawing, then do not use it |
| `adb shell dumpsys meminfo <package>` | Java heap, native heap and `Graphics` / `GL` rows before and after cycles | Totals only; it does not attribute GL memory to a panel |
| Meta OVR Metrics Tool (Quest), PICO's performance overlay | App-level GPU and CPU utilisation, XR frame rate and stale frames during a run | Whole-app numbers; use them to see whether the panels change the scene, not to time one panel |
| Argent `argent-react-native-profiler` | JS-thread cost of `useWhiteboardRenderer`, the binding's encode and `ViroNativeRivePanel`'s `applyUpdate` | JS only. Argent's native profiler is iOS-only and does not apply to these Android producers |

### Procedures

1. **Input-to-visible-ink latency.** Record the headset with an external camera at 240 fps or faster, framing the pen tip (or controller) and the board. Draw 20 short strokes from rest. For each, count frames from the first visible motion of the pen to the first visible ink pixel. Repeat with `nativeBoard` off (WebView board) on the same build. Report p50 and p95 in ms for both. A Perfetto trace taken in the same session adds the software share: the `input` event, the JS binding frame, and the board thread's `queueBuffer`.
2. **Rive frame time.** Drive the animating state for 30 s. With the markers from the tools table added, read p50/p95 of one advance-and-draw on the worker thread from Perfetto; until then, use simpleperf CPU time of that tid divided by the number of `queueBuffer` slices. GPU time needs a GPU profiler (Snapdragon Profiler or `ovrgpuprofiler` on Quest); record which. Repeat once with the `TextureRenderTargetGL` + blit alternative virocore lists, so the two can be compared.
3. **Settled panels produce nothing.** Leave the Rive panel settled and the board untouched for 10 s. Count `queueBuffer` slices on each producer thread in Perfetto. First check the slice is visible during animation, so a zero count means zero frames and not a missing category.
4. **CPU/GPU frame time of the scene.** Run the scene with no panels, then with the board and the Rive strip, 60 s each, with OVR Metrics Tool (Quest) or the PICO overlay. Report the change in GPU utilisation and in stale or dropped XR frames.
5. **Memory and resource growth.** Take `dumpsys meminfo` after the first mount, then after 20 mount/unmount cycles of each panel, then after 5 background/resume cycles. For the compositor route, also log the swapchain count that [device validation](DEVICE_VALIDATION.md) asks for.
6. **Uploads and readbacks.** Statically, `grep -rn 'glReadPixels\|readPixels\|getBitmap\|toDataURL' packages/native-panels/android` and the `VRORivePanel*.cpp` sources must find nothing on the live path. At runtime, take one RenderDoc or Snapdragon Profiler capture per producer and confirm no readback and no texture upload per frame. Image assets decoding once on load is expected and is not a per-frame upload.
7. **Long strokes.** Draw the long stroke from the workloads list while tracing. Report JS time per binding frame and board draw time against the stroke's point count at 1,000-point intervals, so any growth shows as a slope.

## Results

Not yet run. Each row is filled from a device run with its SHAs, device, OS build and refresh rate.

| Metric | Quest 3 | PICO 4 Ultra |
| --- | --- | --- |
| Input-to-ink p50 / p95, native board | not yet run | not yet run |
| Input-to-ink p50 / p95, WebView board | not yet run | not yet run |
| Rive frame time p50 / p95 | not yet run | not yet run |
| Settled Rive panel, buffers in 10 s | not yet run | not yet run |
| Idle board, buffers in 10 s | not yet run | not yet run |
| Scene GPU utilisation change with panels | not yet run | not yet run |
| Memory after 20 cycles vs first | not yet run | not yet run |
| Readbacks / per-frame uploads | not yet run | not yet run |
| Long-stroke slope | not yet run | not yet run |
