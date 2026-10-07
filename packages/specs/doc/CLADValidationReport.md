# Viro SPECS Platform Lab validation

**Simulator functional conformance complete — October 2, 2026.** The Lens compiles,
both persistent LEAF scenarios pass, independent live SIK interactions work, and
Preview traces have been captured and reviewed. Final checks found no Viro
runtime exceptions. Preview tooling and profiling limitations are recorded below;
physical-device certification is outstanding.

Execution plan: [CLADFinishPrompt.md](./CLADFinishPrompt.md).
Repository: `/Users/mikevocalz/viro-external`, branch
`codex/specs-platform-lab-finish`, based on `6a962bc`.
Implementation and portable validation evidence are included with this report.

## Saved project and evidence

Repository evidence: [preview, test results and performance SQL summary](./validation/2026-10-02/README.md).
The full Lens project and raw traces remain on the validation Mac.

Project:
`/Users/mikevocalz/Documents/Lens Studio/Viro Specs Platform Lab/Viro Specs Platform Lab.esproj`

Evidence directories, relative to the saved project:

- `validation/parent-final-smoke.png`: independently inspected final lab and visible polyline.
- `validation/parent-baseline.png`, `parent-direct-drag.png`: independently inspected before/after views.
- `validation/parent-verification.json`: parent post-sync LEAF logs, runtime state and metadata checks.
- `validation/leaf-final-pass.log`, `mcp-test-evidence.json`, `runtime-source-parity.json`: builder results and exact source hashes.
- `validation/harness-intentional-failure.log`: actual negative-test failure.
- `validation/README.md`: reproduction and automation lifecycle details.
- `performance_traces/`: raw traces, JSON summaries, deep SQL results and analysis README.

Times below are America/New_York on October 2, 2026.

## Verified results

| Requirement | Result |
| --- | --- |
| SPECS initialization | Lens Studio 5.24.0.26090816, Spectacles target, SPECS 27 Interactive Preview 1, Sunlit Room. World tracking, far=100000, camera reset. Doctor passes. |
| Runtime and wiring | 19 Lens TS files match repository source. Registry/runtime/interaction/animation/navigation/Platform Lab/validation hosts wired under ViroSpecsRuntime. |
| Compilation | Forced Lens TypeScript compilation succeeded after the real launcher resync. Scenario registration and runtime startup verified. |
| Hierarchy and units | Root/panel/title/model/button/status exist. Root local/world Z=-150 cm, converting Viro -1.5 m. |
| Visual inspection | Actual Preview and runtime captures inspected. Title “Viro Specs Platform Lab,” model, panel, Select label, status and three-point line visible. |
| LEAF interaction | Parent post-sync rerun PASSED at 08:48:25. Explicit hover-enter, button:selected, canonical-root movement, magnitude bounds and stable-depth assertions. |
| LEAF smoke | Parent post-sync rerun PASSED at 08:48:30, including animation, real simulated WorldQuery hit, placement and polyline checks. |
| Negative harness proof | Wrong title assertion reported FAILED at 08:40:12. Restored correct assertion passed. Incorrect assertion is absent from final source. |
| Independent SIK | Fresh-preview coordinate hover/pinch produced actual button:selected Text. Pinch/drag moved model from [-22,-4,-150] to [-5.1283,-4.0316,-149.9835] cm and status=model:drag. Hands released afterward. No direct status mutation. |
| Native animation | Active AnimationPlayer clip plus intermediate position/alpha observed. Final x=12 cm, scale.x=1.2, alpha=.35, completion count=1. Zero-duration update applied immediately and stayed restored in a later frame. |
| Live WorldQuery | Native Sunlit Room Z=-503.298187 cm normalized to -5.03298187 m, distance=5.03298187 m. Persistent test compares raw and normalized coordinates. |
| WorldQuery failure tests | Separately labeled controlled native-boundary tests pass conversion, Ground→floor mapping, classification filtering, allocation/start/hit/stop/timeout cleanup. They do not substitute for the live surface hit. |
| Placement | Real controller starts/cancels, active=false, late poses=0. Controlled tests cover repeated cancel, supersession, late callbacks and unavailable allocation/start/stop paths. |
| ViroPolyline | Three points become [-30,-18,-138], [0,4,-138], [30,-2,-138] cm. Radius .004 m→.4 cm. Rendered mesh visually inspected. Clear destroys line and every control point. |
| Missing GPS | Actual Preview returns false gracefully without a geo fix. Controlled regression also asserts false and destruction of the previous line. |
| Logger | No final Viro exceptions. Non-Viro warnings are disclosed below. |
| Performance | Two successful interaction traces reviewed with summaries, hierarchical SQL and live component-name mapping. |

## Code, scene and package changes

### Runtime

- Corrected malformed `ViroViroSpecs*` imports in AnimationHost,
  AnimationRuntime, LensTransport, NavigationHost, NavigationRuntime,
  RuntimeHost, SceneRuntime and WorldRuntime.
- `ViroSpecsRuntimeHost.ts`: call existing `compileLensRenderPlan(scene)`.
- `ViroSpecsAssetRegistry.ts`, `ViroSpecsSceneRuntime.ts`: optional registered
  font, explicit readable Text defaults and guards for already-destroyed descendants.
- `ViroSpecsPlatformLab.ts`: readable layout/render ordering, Select label,
  panel/model sizing and deferred SIK wiring after prefab/UIKit initialization.
- `ViroSpecsInteractionRuntime.ts`: tangible colliders, reuse existing
  Interactables, manipulate/emit the canonical node root and disable amplified
  depth stretching for predictable translation.
- `ViroSpecsAnimationRuntime.ts`: unique completion event per clip and removal
  of its completion registration after firing.
- `ViroSpecsNavigationHost.ts`, `ViroSpecsNavigationRuntime.ts`: graceful route
  availability, stale route/place cleanup, generated control-point ownership,
  destruction guards and no unnecessary continuous/smooth line updates.
- `ViroSpecsWorldRuntime.ts`: start sessions, independent smoothing/classification,
  native label mapping, finite-ray validation, cm/m conversion, 200 ms cold-depth
  retries bounded at 1.5 s, settled promises and cleanup on failures. Placement
  cancellation is idempotent and rejects stale callbacks. Injectable native
  boundaries enable explicit controlled failure tests.
- `ViroSpecsLeafSceneSmokeScenario.ts`,
  `ViroSpecsLeafInteractionScenario.ts`, new `ViroSpecsRuntimeValidation.ts`:
  persistent checks listed above. LEAF drag is per update, not total displacement;
  input is now 1 cm/update with bounded movement/depth assertions.

### Scene and assets

- Saved the temporary project to the durable path above.
- Added SIK prefab and complete ViroSpecsRuntime hierarchy, generated root,
  navigation structure, hosts and registry references.
- Created lightweight cube prefab, 24×12 cm UIKit BackPlate prefab, SpecsSans
  font assignment, line material and 256 px navigation icon.
- Consolidated AgentInspectScript, AgentInteractScript, ViroSpecsAgentValidation
  and ViroSpecsLeafIndex on AiPreviewAgent Handler under ViroSpecsRuntime,
  avoiding duplicate agent brokers.
- Preserved the original Custom Locations hierarchy as
  `Assets/ViroSpecs/ArchivedTemplate/OriginalCustomLocationTemplate.prefab` and
  removed it from the active scene to stop its HTTP401 template mesh downloads.
  Other unused template/example objects remain disabled.
- Selected Sunlit Room for simulated depth and reset its initially pitched camera.

| Required Lens package | Installed version |
| --- | --- |
| SpectaclesInteractionKit | 2.0.0 |
| SpectaclesUIKit | 2.0.0 |
| SurfacePlacement | 2.0.0 |
| VolumetricLine | 2.0.0 |
| SpecsNavigationKit | 2.0.0 |
| Leaf | 2.0.2 |
| AiPreviewAgentInspect | 2.0.2 |
| AiPreviewAgentInteract | 2.0.1 |

Transitive dependencies installed through Asset Library. Local package and
preview operations succeeded despite the editor's signed-out status.

### Launcher and repository support

- `scripts/go-clad.mjs`: authenticated JSON/SSE MCP initialization, idempotent
  TOML merge preserving credentials, plugin installation only when needed,
  effective Codex configuration checks and detected exec flags. No unsupported
  global config commands or overwrite of user-wide approval settings.
- `scripts/bootstrap-platform-lab.mjs`: removed destructive `--clean` resync.
- New `scripts/go-clad.test.mjs`: all 13 regressions pass, including config/auth,
  failure handling, metadata preservation, plugin installation and CLI flags.
  Tests use a mock CLI, not real nested AI runs.
- `package.json`: `specs:test-runner` and pinned `smol-toml@1.9.0`.
  `pnpm-lock.yaml`: missing Specs/XR importers and that dependency restored;
  unrelated packages retained.
- `doc/OneCommandCLAD.md`: corrected CLI behavior and troubleshooting.
- Filtered frozen install, portable Specs/XR TypeScript checks, 19-file Lens
  portability validation and `git diff --check` pass.
- Real `specs:go` preparation succeeded against this project. MCP authenticated
  initialize passed; all 30 preexisting Viro `.meta` hashes remained identical.
- Installed Codex 0.154.0 uses `--approve-for-me`; `--full-auto` is only selected
  for a CLI advertising it. This task completed the live loop directly, without
  launching a second simultaneous Codex worker against the same scene.

## Preview performance review

Reviewed files:

- `platform_lab_clean_2026-10-02T12-51-29-679Z_preview0.pftrace` and
  `platform_lab_clean_summary.json`: 14.739 s capture.
- `platform_lab_repeat_2026-10-02T12-55-20-947Z_preview0.pftrace`,
  `platform_lab_repeat_summary.json`, `platform_lab_repeat_deep.json`:
  14.397 s repeat without screenshot/query traffic during capture.

Both captures exercised actual SIK dragging. The first capture's 78.163 ms
Select-label Visual spike did not reproduce: repeat max=9.133 ms, median=.466 ms.

| Repeat instrumented section | Median | p90 | Maximum |
| --- | ---: | ---: | ---: |
| ProcessFrame | 13.163 ms | 16.226 ms | 123.114 ms |
| CoreManagerRender | 5.864 ms | 8.331 ms | 83.070 ms |

These are separate recorded sections, **not whole-frame pacing or device FPS**.
The repeat retains long Preview processing intervals, including 115.011 ms in
Track and broad ProcessFrame/ScnFrame intervals without a proven Viro function
cause. No sustained Viro-specific bottleneck was established, and no renderer
change was justified by the non-reproducing text spike.

The analyzer's low-confidence mobile detection, FPS heuristic and approximated
activation time are unsuitable for this known SPECS desktop Preview. There is
one unnamed execution track and no scheduler data. No CPU scheduling, actual
device FPS or Lens activation-time claim is made. Attribution uncertainty and
Preview outliers remain disclosed, not relabeled as hardware-only issues.

## Simulator and tool limitations

- Refresh Preview when switching from LEAF to puppet interactions, rediscover
  IDs, warm up with hover and verify scene state. Post-LEAF commands encountered
  `HostFunction Object is null`; refresh recovered them. Package inspection
  suggests stale cached native hand references, but the exact trigger is unproven.
- Name/UID-targeted Hover timed out in installed CLAD tooling. Coordinate fallback
  works. An early short pinch acknowledged success without changing state;
  warmed hover/pinch produced verified selection.
- Sunlit Room supplied an unknown native semantic label. Enum mapping/filtering
  has separately labeled controlled coverage; real semantic reliability is untested.
- Preview has no actual GPS fix. Graceful missing-GPS behavior passes; outdoor
  accuracy and permission behavior remain untested.
- Non-Viro warnings: Depth24→Depth32 fallback; LEAF state-save skipped for
  instances destroyed by reload. Trace tooling also warns about its deprecated
  workspace API and a stopped-session flush. None is a Viro runtime exception.
- Performance outliers and attribution limits above remain Preview observations.

## Hardware-only certification — not tested

| Area | Required physical-device check |
| --- | --- |
| Optics and comfort | Real field of view, stereo comfort and readability |
| Tracking and ergonomics | Real hand/pose tracking, hand comfort, edge cases and recovery |
| Camera and depth | Sensor quality, noise, occlusion, calibration and semantic reliability |
| GPS and heading | Outdoor accuracy, route alignment and permission behavior |
| Radios and networking | Actual connectivity, loss and recovery |
| Thermals and power | Sustained throttling and battery drain |
| Brightness | Physical visibility under varied real lighting |
| Performance | On-device frame pacing and memory pressure |
| Co-location | Alignment accuracy between physical devices |
