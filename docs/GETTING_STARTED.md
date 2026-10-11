# Getting started

[Handbook](README.md) · [Layouts](LAYOUTS.md) · [Status](CAPABILITIES.md)

## 1. Choose the lane

For ordinary scene UI and media, use the focused core/media/UI packages or the Premium umbrella. For native OS windows, Rive, WebRTC, drawing, or renderer extensions, first identify the required native host and its tested runtime. A TypeScript import is not an autolinking, entitlement, or presentation check.

This is a private source workspace. Publication/registry access is not established by the README; do not assume every directory is an independently installable public npm package.

## 2. Prepare sibling checkouts

Use your existing GitHub authentication; never paste credentials into commands or source files.

```sh
mkdir -p spatial-dev
cd spatial-dev
git clone https://github.com/mikevocalz/viro.git
git -C viro checkout 99b1d87c55ca9f43a6452144183a0b32a2bfb3c9
git clone https://github.com/mikevocalz/viro-external.git
cd viro-external
corepack enable
corepack prepare pnpm@12.8.1 --activate
pnpm install --frozen-lockfile --strict-peer-dependencies=false
```

The revision above is the compatible dependency selected in [CI PR #60](https://github.com/mikevocalz/viro-external/pull/60), not a claim that it is the newest Viro commit. `pnpm-workspace.yaml` overrides `@reactvision/react-viro` to `link:../viro`. Keep both folders beside each other. The repository specifies Node >=22.13; CI uses Node 24. The locked branch targets the React 19.3 / RN 0.88 prerelease / Expo 58 integration line; do not upgrade those peers independently while diagnosing compatibility.

A sibling source link may need React type resolution hydrated as CI does:

```sh
mkdir -p ../viro/node_modules/@types
ln -sfn "$PWD/packages/media/node_modules/react" ../viro/node_modules/react
ln -sfn "$PWD/packages/media/node_modules/react-native" ../viro/node_modules/react-native
ln -sfn "$PWD/packages/media/node_modules/@types/react" ../viro/node_modules/@types/react
```

Do this only in a dedicated source-workspace checkout, not over an independently configured production application's dependencies. This is type resolution, not proof that native libraries are linked.

## 3. Verify before integrating an application

```sh
pnpm typecheck
pnpm test:rive-contract
pnpm test:workspace-surface
pnpm check:metro
pnpm --filter @viro-external/ui test:world-slot
node --experimental-strip-types --test packages/pico-layout/test/windowContainerHost.test.mjs
```

For legacy binding work, run `pnpm specs` and inspect `git status`; generated changes must be intentionally committed. After #60 lands, use its generated-file guard and follow its CI security guide. Its protected environment must be configured separately; this handbook never supplies a credential.

Use your application's existing verified Viro/Expo native configuration and development build. Copy the [scene example](examples/SpatialWorkspaceExample.tsx) into that application and render it inside its Viro scene. This repository's example is not a prebuilt Expo host, a navigator replacement, or a guarantee that Expo Go contains the native integration.

## 4. Use the correct public surface

```tsx
import { SpatialPanel, PanelText } from "@viro-external/ui";
// Or use the Premium umbrella for core/media/UI:
import { SpatialPanel as PremiumPanel } from "@viro-external/premium";
```

Do not deep-import implementation files in application code. Tests in this repository may import source directly to validate dependency-free contracts. Do not import the compositor proposal as though it were a runtime module.

## Troubleshooting

| Symptom | Check first |
| --- | --- |
| `ViroExternalVideo` or `ViroExternalVideoProps` is missing | Confirm the sibling Viro commit and root override. Upstream v3.0.1 does not provide the required fork API. Do not hide the error with casts or ambient stubs. |
| Every surface remains in one app window | Check the runtime capability report, host configuration, window budget, and fallback entries. A scene panel is not a promoted native window. |
| `snapTo` throws | Supply `SpatialWorkspaceFrame` or `worldOrigin`; do not put two world-transform owners around a panel. |
| Workspace moves unexpectedly | Capture a settled origin; use a new key only when recentering. Unpinned panels billboard their orientation, not their world-space position. |
| Rive factory exists but no artboard appears | Verify the injected host actually mounts into the active renderer and reports capabilities. A mock host cannot establish GPU output. |
| Web content renders but drag/scroll fails | Verify the Viro web input bridge and ViroCore WASM build; the UI package alone cannot emit native/web input events. Test wheel input over hit-testable descendants. |
| PICO open call returns `requested` | This means a request was accepted, not that presentation completed or independent subwindows exist. |
| CI is green but native behavior is unknown | Inspect job names and skipped jobs. Portable contracts are not native builds or device verification. |

When reporting a problem, include the application commit, Viro/ViroCore revisions, platform/runtime, release versus debug mode, actual capability report, and the smallest reproducer. Keep renderer problems separate from missing deployment credentials.
