# No-device SPECS validation

A physical SPECS unit is **not required** to finish the software implementation
or the normal regression loop.

Snap's current SPECS 27 workflow supports closed-loop development in Lens
Studio Preview through CLAD, simulated SIK interaction, LEAF scenarios,
preview inspection, JavaScript debugging, and preview performance traces.

## What this repo validates without glasses

| Area | No-device validation |
| --- | --- |
| package/workspace integrity | GitHub Actions + pnpm typecheck |
| Lens runtime portability | `specs:validate-lens` |
| SPECS 27 project setup | CLAD `/specs-project-init` |
| scene creation | Platform Lab + LEAF smoke scenario |
| Viro meters -> Lens centimeters | LEAF scene assertion |
| Text/Image/model/panel hierarchy | Preview inspection + LEAF |
| hover/select/pinch | LEAF DefaultLeafInteractor |
| drag/manipulation | LEAF drag scenario |
| native Lens animations | Preview + JS debugger / verify-preview |
| WorldQuery | SPECS 27 preview environment + verify-preview |
| surface placement | SPECS 27 preview + simulated targeting |
| local ViroPolyline/VolumetricLine | Preview inspection |
| navigation rendering code | Preview with simulated/available location data |
| regressions | persistent LEAF scenarios |
| JS runtime faults | Logger + external JS debugger |
| performance regressions | preview .pftrace + Perfetto attribution |

## Persistent LEAF scenarios

The runtime ships:

- `ViroSpecsLeafSceneSmokeScenario`
- `ViroSpecsLeafInteractionScenario`
- `ViroSpecsLeafIndex`

The smoke scenario asserts the generated Platform Lab hierarchy and verifies
that Viro's `-1.5m` root position appears in Lens as approximately `-150cm`.

The interaction scenario:

1. hovers the generated button;
2. triggers it with simulated SIK input;
3. asserts the portable interaction came back through the runtime;
4. drags the generated model;
5. asserts the actual SIK target moved and the drag event was observed.

## Lens Studio / CLAD loop

After syncing the runtime into a SPECS project:

```text
/specs-project-init
/reset-preview-environment
/verify-preview
/specs-leaf-install-packages
/specs-leaf-run-in-preview
/lens-js-debugger
/specs-capture-perf-trace
/perfetto-trace-analysis
```

Use `/verify-preview` while iterating and LEAF once behavior should be locked
in as a regression test.

## Hardware-only final certification

These cannot be honestly proven by a simulator:

- optical comfort and real field-of-view judgment;
- real-world hand/pose tracking edge cases;
- true camera/depth sensor characteristics;
- real GPS/heading quality outdoors;
- radio/network behavior in actual use;
- thermal throttling and battery drain;
- physical brightness/visibility under lighting conditions;
- final on-device frame pacing and memory pressure;
- multi-user co-location accuracy between actual devices.

Those are **certification checks**, not unfinished implementation work.

## If no device is available at all

Finish the Preview/LEAF/perf loop, record a working simulator video, and keep
the hardware-only matrix explicit. Snap's current device-access program accepts
working Lens Studio 5.22.x / CLAD prototypes and specifically asks applicants
for a project link or simulator video.
