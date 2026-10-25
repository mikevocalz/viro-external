# Review roster

Every change under the native whiteboard, native Rive and rounded-panel work is reviewed as if the people and studios below had to sign it. A seat is a bar to meet, not a person to hire.

Tier language is fixed: seats are described at creator or spec-author tier. Do not label a seat "senior" or bare "principal".

Embed this file by reference in every sub-prompt derived from `docs/adr/0001-native-whiteboard-rive-panels.md`. All four groups are mandatory.

## Engineers

| Name | Why they are here | Reviews |
| --- | --- | --- |
| Marc Rousavy, creator of Nitro Modules, Margelo (https://github.com/mrousavy) | Nitro/Nitrogen authority | Every HybridObject boundary, Nitrogen spec, thread ownership, `memorySize`, codegen order |
| Miklós Fazekas, Margelo, author of the Nitro rewrite of Rive React Native (https://margelo.com/blog/rewriting-rive-react-native-with-nitro-modules) | Rive object model on Nitro | Rive JS surface: RiveFile and view models as HybridObjects, preload, file sharing |
| Chris Dalton, Rive, contact for the ANGLE and WebGL shader pixel-local-storage extensions (https://github.com/csmartdalton) | Rive GPU renderer | Rive GL producer, PLS/interlock/atomic/MSAA mode on Adreno, GL state hygiene, render-target choice |
| Ryan Pavlik, OpenXR Working Group spec editor, Collabora (https://github.com/rpavlik) | OpenXR spec | Swapchains, quad/cylinder layers, premultiplied alpha, sRGB, layer budget, session lifecycle |
| Christian Falch, co-creator of React Native Skia (https://github.com/chrfalch), and William Candillon, React Native Skia maintainer (https://github.com/wcandillon) | Skia GPU surfaces in React Native | Whiteboard Skia GPU producer, surface/context ownership, `clipRRect` corners |
| Raph Levien, author of kurbo, Linebender (https://github.com/raphlinus) | Curve geometry | kurbo reuse, flattening tolerances |
| Joe Neeman, author of linesweeper (https://github.com/jneem) | Boolean path ops | Stroke outlines, eraser boolean semantics |
| Behdad Esfahbod, creator of HarfBuzz (https://github.com/behdad) | Text shaping | harfrust/skrifa reuse, bidi, glyph outlines |
| Yevhenii Reizner, author of tiny-skia (https://github.com/RazrFalcon) | CPU rasterization | tiny-skia stays on reference/export paths, never the live board |
| Martin Kleppmann, Automerge, University of Cambridge (https://github.com/ept) | Collaborative editing | Local, remote and AI edits on one authority; stale revisions; no divergent native state |

## Designers

| Name | Why they are here | Reviews |
| --- | --- | --- |
| Steve Ruiz, founder of tldraw, author of perfect-freehand (https://github.com/steveruizok) | Ink feel and canvas UX | Pressure response, stroke feel, tool model, drag-vs-draw arbitration |
| Mai-Linh Barry and Sergio Riquelme Sánchez, product designers at tldraw (https://tldraw.dev/company) | Whiteboard product design | Tool palette, selection affordances, empty and error states |
| Rasmus Andersson, designer of Inter (https://github.com/rsms) | Screen typography | Board text, tool labels, legibility at headset distance |
| Apple visionOS HIG and Meta Horizon OS design guidelines (platform references, not people) | Platform design | Panel ergonomics, corner treatment, angular target sizes |

## Design agencies and labs

| Studio | Bar |
| --- | --- |
| Pentagram | Tokens, type and corner language consistent across every panel |
| IDEO | Every design choice traces to a research finding |
| Ink & Switch | Ink as a first-class medium; latency and feel over feature count |

## Dev agencies

| Agency | Bar |
| --- | --- |
| Margelo | Nitro-native APIs, measured performance claims, Rive-on-Nitro precedent |
| Software Mansion | UI-thread discipline, Horizon OS (expo-horizon) correctness |
| Callstack | Measured React Native performance, CI, library packaging, user docs |

## Lanes

| Lane | Owns | Seats |
| --- | --- | --- |
| L0 Integration | Audit, ADR, ownership, shared headers/ABI, cross-repo changes, acceptance | Rousavy, Pavlik |
| L1 Rust/vector | Geometry/text/path reuse, FFI correctness, attribution | Levien, Neeman, Esfahbod, Reizner |
| L2 Whiteboard producer | Native producer, Android Surface route, context/thread ownership, GPU sync, Apple path | Falch, Candillon, Pavlik |
| L3 Rive producer | rive-runtime build, scene and compositor routes, Rive input, Nitro surface | Dalton, Fazekas, Rousavy |
| L4 Compositor and corners | Finish pass, coverage function, eviction fallback, Expo Modules 2.0 host | Pavlik, Dalton |
| L5 Editor/XR input | QuickDraw semantics, hit mapping, capture/cancel, collaboration, continuity | Ruiz, Kleppmann |
| L6 Design | Design sequence and Mobbin passes; owns the tokens L4 reads | Ruiz, Barry, Riquelme Sánchez, Andersson; Pentagram, IDEO, Ink & Switch |
| V1 Validation | Device procedures, measurements, captures | Callstack and Software Mansion skills |
| V2 Independent review | The integrated diff and real evidence, not the implementer's summary | Whole roster |

## Device validation and #112 hardening

virocore #112 changes eye-buffer size, foveation, eye-buffer alpha, external-texture decode and external-surface sampling for every app, flags or not. The device pass runs on the supported headsets, Quest 3S and PICO 4 Ultra (decided by Mike), in two rounds A/B against baseline virocore `main` at `f5c2a728`: round 1 with every feature flag off, round 2 with flags on. Each seat signs the items below from device captures and measured numbers.

| Seat | Device-pass duty |
| --- | --- |
| Pavlik | Eye-buffer size against the runtime's recommended rect and `maxImageRect` on both headsets; foveation level and dynamic mode as applied; projection-layer alpha flags with passthrough on and off; swapchain create, destroy and recreate across session state changes |
| Dalton | Rive render mode chosen on each headset; colour parity between the Rive panel and the same artboard on a phone; texture ring and fence behaviour on device |
| Rousavy | Boundaries of the render-quality setting: native and build config only, no JS runtime API, defaults unchanged until evidence |
| Falch, Candillon | Whiteboard producer on device; surface recreation after pause, resume, recenter and scene rebuild |
| Kleppmann | One authority for board state during the device pass; no divergent native state after recreation |
| Ruiz | Ink feel and stroke latency in the headset |
| Barry, Riquelme Sánchez | Tool strip and every panel state (empty, loading, error, evicted) in the headset |
| Andersson | Smallest-text legibility at 1.0x vs 1.3x eye buffers and at LOW vs MEDIUM foveation |

## Hardening lanes

These run alongside L0-L6 and report to V2.

| Lane | Owns | Seats |
| --- | --- | --- |
| S0 Stack record | #112 PR body (per-commit behaviour, who is affected, risk, how to dial back), stack heads and baselines, this roster | Pavlik, Rousavy |
| S1 Render-quality setting | Eye-buffer scale and foveation as a setting on #112: Java setter on the OpenXR renderer class, AndroidManifest meta-data written by an Expo config-plugin option; defaults 1.3 and LOW dynamic | Pavlik, Rousavy |
| V Device validation | Two A/B rounds on Quest 3S and PICO 4 Ultra against `f5c2a728`, flags off then on; captures and GPU numbers per seat duty above | Every seat in the device-pass table; Callstack and Software Mansion skills |

## Standing review rules

1. A seat reviews before the change lands. Work that skipped its seat is reverted, not patched.
2. An objection is recorded in the PR with the rule or spec clause it cites.
3. Evidence applies to reviewers too: cite the installed file and symbol, the measured number, or the spec section. No seat approves on assertion.
4. Native graphics code is reviewed by a lane that did not write it.
5. A passing typecheck, a non-null handle or a rising frame counter is not evidence of correct rendering. Device captures are.

## Non-negotiables every seat enforces

- No placeholders, stubs, mock adapters or invented APIs on the working path. Every seam cites an installed file and symbol.
- Zustand for state; no `useState` or `useReducer` in new or touched components. React 19 `useOptimistic` and `useActionState` are allowed.
- C++ exposed to React Native is a Nitro HybridObject. The one recorded exception is the compositor panel host, which uses Expo Modules 2.0 (PR #58).
- `tsc --noEmit` passes. Nitrogen output is committed, and codegen lands before native implementations.
- No WebView, DOM canvas capture, screenshots, base64 frames, GPU readback or per-frame JS uploads on any live panel path.
- Comments state intent, not history.
