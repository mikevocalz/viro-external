# SPECS compatibility

## Validated release line

| Package | Version | Target | Lens Studio | Upstream Specs packages | Status |
| --- | --- | --- | --- | --- | --- |
| @viro-external/specs | 0.2.0-rc.1 | SPECS 27 | 5.22.0+; validated on 5.24.0.26090816 | 2.0.x family / pinned source manifest | Simulator validated |
| @viro-external/xr-contract | 0.2.0-rc.1 | renderer-neutral | n/a | n/a | TypeScript contract |

The detailed October 2, 2026 validation evidence is in
`doc/CLADValidationReport.md`.

## Renderer boundary

SPECS uses Lens Studio. It does not embed or execute ViroCore.

Applications can share Viro-facing scene semantics while each renderer owns its
native implementation:

- ViroCore for its native/OpenXR/Apple/Web targets;
- Lens Studio + SIK/WorldQuery/Navigation Kit for SPECS.

## Physical-device status

This release candidate is simulator validated. Physical SPECS certification is
still required for optics, real tracking/depth, outdoor GPS, radio/network
behavior, thermals/power, lighting visibility, final frame pacing/memory and
multi-device co-location.
