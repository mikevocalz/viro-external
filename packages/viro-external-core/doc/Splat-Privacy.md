# Splat Privacy

A Gaussian splat is a photographic reconstruction of a real space and the people in it. Even rendering one is privacy-sensitive. Rules:

1. **Default to tabletop mode.** Full-scale (1:1) is opt-in via an explicit user action with a comfortable fade.
2. **First-view privacy notice** when a scan represents a real space/people. Notice is non-dismissible until acknowledged.
3. **Never log signed source URLs.** A signed URL can grant access by itself. Keep it out of analytics, crash reports, console output, and any persisted state.
4. **No silent persistence or upload.** Screenshots / re-export require explicit user action.
5. **Inspector honesty.** `SplatInspector` reports splat count, bounds, format, and confirms what is being rendered IS the real splat (there is no quality-degraded fallback that pretends to be).
6. **Tabletop in `primary` zone, full-scale = environment.** Full-scale never overlaps body-locked chrome (dock/status bar).

These apply to the viewer that hosts `ViroGaussianSplat`; this package enforces #3 internally (the component does not stringify or log its `source.uri`).
