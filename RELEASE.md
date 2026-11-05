# Release plan: expo-pico, react-viro fork, viro-external

Status on 2026-11-04: nothing is published, and nothing can be published until the blockers below are fixed. This file lists the version each package would ship at, the order and dist-tag for each, and the one command that publishes them all.

## Source commits

Every number below comes from a throwaway local merge of the open PRs. Neither the merges nor the version bumps were pushed.

| Repo | Merged | Result |
| --- | --- | --- |
| mikevocalz/expo-pico | #45 `fix/spatial-rail-layout-xr-entry` at `4b85dbc` (contains #43) + #44 `chore/pico-sdk-latest` at `3f7b6b6` | Merged clean. |
| mikevocalz/viro | #84 `feat/spatial-shell-autoinject` at `20269f1` + #83 `chore/expo-58-nitro-v1` at `bfbfbc7` | **Conflicts.** `plugins/withViro.ts`: both sides add an import and options to `android`. I kept both (`spatialShell` from #84, `questFeatures` / `questHorizonOsSdk` / `openxr` from #83). `dist/`: #83 stops tracking it and #84 commits a rebuilt `dist/`, so I dropped it, as #83 intends. GitHub also reports #84 as `CONFLICTING` against `main`. |
| mikevocalz/viro-external | #81 `feat/spatial-shell` at `154a075` + #80 `chore/expo-58-nitro-v1` at `50cec41` | Git merges it without conflicts, but the merged `pnpm-lock.yaml` is broken: `pnpm install --frozen-lockfile` fails with `no entry for 'zustand@5.0.16(@types/react@19.3.0)(react@19.3.1)'`. #81 resolved React 19.3.1 and #80 moved every importer to 19.3.0. Taking #80's lockfile and running `pnpm install --lockfile-only` fixes it (exit 0). |

## How the numbers were produced

- **Versions.**
  - expo-pico: computed with the repo's own changesets (`@changesets/cli` 2.29.7, `.changeset/config.json`).
  - viro and viro-external: neither has changesets, so the version is whatever `package.json` says.
- **Current published version.** From `npm view <name> dist-tags` on 2026-11-04. Every `@expo-pico/*`, `@viro-external/*` and `react-native-viro-*` name returns E404. `@reactvision/react-viro` returns `{ latest: '3.0.3' }`.
- **Tarballs.**
  - The publish dry run was **not run**. This session's permission settings deny `npm publish --dry-run` in every form I tried, and I did not try to get around that.
  - The size, file-count and manifest columns come from building and packing the real tarballs:
    - `pnpm pack` for viro-external. pnpm rewrites `workspace:*`, so this is the tarball that would ship.
    - `npm pack` for viro and expo-pico. `prepare` runs nitrogen and tsc.
  - Every pack exited 0. `scripts/release.sh --pack` reproduced all 41 tarballs (exit 0).
  - Each tarball was then checked for:
    - `main`, `types`, `module`, `exports` and `bin` targets that are missing from the tarball;
    - bundled `node_modules`;
    - leftover `workspace:` / `link:` / `file:` ranges;
    - secret-like files (`.env`, `.npmrc`, keys, keystores);
    - secret-like strings (npm, GitHub and AWS tokens, private keys);
    - agent files (`AGENTS.md`, `CLAUDE.md`, `TASKS.md`).
- **To get the real publish dry run**, run `scripts/release.sh --dry-run` from a machine where `npm publish --dry-run` is allowed. Pack checks do not cover registry-side failures, such as a scope you do not own or a version that already exists.

## Versions

### expo-pico (changesets)

`changeset version` gives every changed package **2.0.0**:

- `pico-off-without-app-id.md` is a `major` bump for `@expo-pico/core`.
- The other packages declare `@expo-pico/core` as a peer, and the `linked` group pulls them along.

This plan uses **pre mode** instead: `changeset pre enter alpha && changeset version`. Pre mode gives `2.0.0-alpha.0`, for two reasons:

- These packages peer on Nitro `>=1.0.0-alpha.nightly.120.g33ef045b96c0`. A plain `2.0.0` that needs an alpha runtime would occupy the `2.0.0` number for good.
- The repo's own `prerelease.yml` requires pre mode.

Commit the `pre.json` and the version bump before running the script.

`npm publish --dry-run` was not run for any row (see above). Pack exit code was 0 for every row.

| Package | Published | `changeset version` | Pre mode (to publish) | Tag | Packed | Files | Pack findings |
| --- | --- | --- | --- | --- | --: | --: | --- |
| @expo-pico/platform-service-common | unpublished | 1.0.0 | 1.0.0 | alpha | 11.5 kB | 24 | none |
| @expo-pico/core | unpublished | 2.0.0 | 2.0.0-alpha.0 | alpha | 3.57 MB | 434 | Ships `android/app/`, a whole example app module (28 files) with the stock React Native `debug.keystore` (`androiddebugkey`, created 2013). That key is public, so it is not a leaked secret, but a library should not ship it. 7.5 MB unpacked is the staged `libviro_renderer.so` overlay. |
| @expo-pico/spatial | unpublished | 2.0.0 | 2.0.0-alpha.0 | alpha | 51.0 kB | 115 | none |
| @expo-pico/account | unpublished | 2.0.0 | 2.0.0-alpha.0 | alpha | 26.1 kB | 58 | none |
| @expo-pico/iap | unpublished | 2.0.0 | 2.0.0-alpha.0 | alpha | 22.5 kB | 57 | none |
| @expo-pico/notifications | unpublished | 2.0.0 | 2.0.0-alpha.0 | alpha | 25.9 kB | 67 | none |
| @expo-pico/rtc | unpublished | 2.0.0 | 2.0.0-alpha.0 | alpha | 25.5 kB | 83 | none |
| @expo-pico/rooms | unpublished | 2.0.0 | 2.0.0-alpha.0 | alpha | 33.1 kB | 96 | none |
| @expo-pico/subscription | unpublished | 2.0.0 | 2.0.0-alpha.0 | alpha | 25.4 kB | 60 | none |
| @expo-pico/storage | unpublished | 2.0.0 | 2.0.0-alpha.0 | alpha | 26.8 kB | 83 | none |
| @expo-pico/social | unpublished | 2.0.0 | 2.0.0-alpha.0 | alpha | 44.7 kB | 95 | none |
| @expo-pico/achievements | unpublished | 2.0.0 | 2.0.0-alpha.0 | alpha | 27.8 kB | 68 | none |
| @expo-pico/leaderboards | unpublished | 2.0.0 | 2.0.0-alpha.0 | alpha | 26.6 kB | 70 | none |
| @expo-pico/app-kit | unpublished | 2.0.0 | 2.0.0-alpha.0 | alpha | 42.8 kB | 50 | none |
| @expo-pico/template | unpublished | 0.1.1 | 0.1.2-alpha.0 | alpha | 8.1 kB | 9 | Pins `react-native-nitro-modules` to the nightly exactly. |

`expo-horizon-quest` and `@expo-pico/eskiu-runtime` are `private` and are not published.

### @reactvision/react-viro (fork, mikevocalz/viro)

`npm publish --dry-run` was not run (see above).

| Package | Published | To publish | Tag | Pack exit | Packed | Unpacked | Files | Pack findings |
| --- | --- | --- | --- | --: | --: | --: | --: | --- |
| @reactvision/react-viro | `latest` 3.0.3 (ReactVision) | 3.1.0-moyo.0 | next | 0 | 53.6 MB | 95.9 MB | 2093 | none from the checks |

- `prepare` (`tsc`, the plugins tsconfig, the specs CLI, `copy-files`) ran during pack.
- `require('./app.plugin.js')` loads under Node 26.13.0 from the packed tarball. #84 reported `ERR_MODULE_NOT_FOUND` under Node 26 on its own tree; that error did not show up in this merge.

### viro-external

No changesets, so each version is the one in `package.json`. Every package returns E404 today. `npm publish --dry-run` was not run for any row (see above).

Pack exit code was 0 for every row. "src entry" means `main`/`types` point at TypeScript source: Metro can load it, but Node and web bundlers without a TS loader cannot.

| Package | To publish | Tag | Packed | Files | Pack findings |
| --- | --- | --- | --: | --: | --- |
| @viro-external/xr-contract | 0.3.0 | next | 40.7 kB | 79 | none (dist entry points via `publishConfig`) |
| @viro-external/specs | 0.3.0 | next | 699.9 kB | 182 | none (dist entry points via `publishConfig`) |
| @viro-external/meta-layout | 0.1.0 | next | 12.4 kB | 9 | src entry |
| @viro-external/spatial-shell | 0.1.0 | next | 34.9 kB | 42 | src entry. `/plugin`, `/doctor` and the `viro-spatial-shell-doctor` bin resolve. |
| react-native-viro-mux | 0.1.1 | alpha | 54.4 kB | 90 | src entry; ships `AGENTS.md`, `CLAUDE.md` |
| @viro-external/splat-pass | 0.0.1 | alpha | 36.6 kB | 27 | src entry; ships `AGENTS.md`, `CLAUDE.md`, `TASKS.md` |
| @viro-external/core | 0.1.0 | alpha | 18.7 kB | 25 | src entry; ships `AGENTS.md`, `CLAUDE.md` |
| @viro-external/media | 0.1.0 | next | 13.8 kB | 16 | src entry |
| @viro-external/ui | 0.1.0 | alpha | 59.8 kB | 62 | src entry |
| @viro-external/gui | 0.1.0 | alpha | 67.2 kB | 49 | src entry; ships `AGENTS.md`, `CLAUDE.md` |
| @viro-external/meta | 0.1.0 | alpha | 4.7 kB | 12 | src entry; ships `AGENTS.md`, `CLAUDE.md` |
| @viro-external/meta-wearables | 0.1.0 | next | 11.7 kB | 10 | src entry |
| @viro-external/native-panels | 0.1.0 | alpha | 101.9 kB | 218 | src entry |
| @viro-external/openxr | 0.1.0 | next | 2.0 kB | 3 | src entry |
| @viro-external/render-passes | 0.0.0 | alpha | 22.1 kB | 24 | src entry; ships `AGENTS.md`, `CLAUDE.md`, `TASKS.md`; version is `0.0.0` |
| @viro-external/orb-pass | 0.0.1 | alpha | 17.2 kB | 9 | src entry; ships `AGENTS.md` |
| @viro-external/pano | 0.2.0 | next | 0.7 kB | 3 | src entry |
| @viro-external/pico-layout | 0.1.0 | next | 8.7 kB | 5 | src entry |
| @viro-external/premium | 0.1.0 | alpha | 1.4 kB | 6 | src entry |
| @viro-external/spatial-panels | 0.1.0 | next | 18.0 kB | 55 | src entry |
| @viro-external/spatial-runtime | 0.1.0 | next | 4.0 kB | 8 | src entry |
| @viro-external/viture | 0.1.0 | next | 1.4 kB | 3 | src entry |
| @viro-external/web-layout | 0.1.0 | next | 6.1 kB | 5 | src entry |
| @viro-external/webspatial | 0.1.0 | next | 3.0 kB | 3 | src entry |
| react-native-viro-webrtc | 0.1.0 | next | 5.8 kB | 10 | src entry |

No tarball in any repo bundles `node_modules`, points `main`/`types`/`exports`/`bin` at a missing file, keeps a `workspace:` range, or contains a token-shaped string.

## Blockers

### All three repos

1. **The PRs are unmerged drafts.** The release has to come from merged commits, not from the throwaway merges used here.

### expo-pico

1. **The `@expo-pico` scope does not exist on npm** (`npm org ls expo-pico`: "Scope not found"). Create the org, or a user with that name, before publishing.
2. **Versions are not committed.** `changeset pre enter alpha` and `yarn version-packages` have to land on `main` first.
3. **#43 has five unresolved CodeRabbit threads**:
   - exact Nitro peer pin versus the `>=` floors;
   - documenting the `nitro-core` install requirement;
   - `release/horizon-core` wording;
   - `fileURLToPath` in `nitro-peers.test.mjs`;
   - `withQuestMetaLayout` ordering, which #45 fixed in code but the thread is still open.

   There is also an outside-diff finding to add `permissions: contents: read` to `verify` in `ci.yml`.
4. **`@expo-pico/core` ships `android/app/`.** The tarball carries the example app module and its debug keystore. Narrow `files` to the library module.
5. **The quest flavor needs a git dependency.** It now lives in the `expo-horizon-core` plugin entry from `github:mikevocalz/expo-pico#release/horizon-core`. That branch is not an npm package, so Quest users still need a git dependency. #43 says that branch is still at 57.0.3.

### react-viro fork

1. **mikevocalz cannot publish `@reactvision/react-viro`.** `npm owner ls` lists `doranteseduardo` and `oliedis` (ReactVision). Either ReactVision publishes it, or the fork moves to a scope mikevocalz owns. A rename also changes every `@reactvision/react-viro` peer range in viro-external.
2. **The viro-external peer ranges reject this version.**
   - viro-external peers are `>=3.0.1-moyo.0 <4.0.0`, and `>=3.0.3-moyo.1 <4.0.0` for `native-panels` and `spatial-panels`.
   - `semver.satisfies('3.1.0-moyo.0', …)` is `false` for both: a prerelease only matches a comparator with the same major.minor.patch.
   - ReactVision's stock `3.0.3` does satisfy them, so `npm install` would choose stock Viro over the fork.
   - Fix the ranges, for example to `>=3.1.0-moyo.0 <4.0.0`, before publishing viro-external.
3. **The merge conflict** between #84 and #83 has to be resolved for real (see Source commits).
4. **No publish workflow.** viro has no workflow with `id-token: write`, so `--provenance` is unavailable for it unless one is added.

### viro-external

1. **The lockfile must be regenerated** after merging #81 and #80 (see Source commits).
2. **Seven tarballs ship agent instruction files.** `AGENTS.md`, `CLAUDE.md` and `TASKS.md` are in `react-native-viro-mux`, `core`, `gui`, `meta`, `orb-pass`, `render-passes` and `splat-pass`. They are listed in each package's `files` array. Remove them from `files` before publishing.
3. **The `@viro-external` scope does not exist on npm** ("Scope not found").
4. **Do not run `npm publish` from a package folder.** That ships `workspace:*` ranges and the source entry points. Publish the `pnpm pack` tarball instead, which is what `publish-specs.yml` and the script do.
5. **`@viro-external/render-passes` is at `0.0.0`.** Pick a real first version.

## Dist-tags

No package in this release should go to `latest`.

- **alpha** is for any package that peers on Nitro `1.0.0-alpha.nightly.120.g33ef045b96c0`, directly or through a dependency:
  - every `@expo-pico/*` package (`platform-service-common` rides along with the linked group);
  - `react-native-viro-mux` and `@viro-external/native-panels`, which peer on Nitro directly;
  - `splat-pass`, `core`, `ui`, `gui`, `meta`, `premium`, `render-passes` and `orb-pass`, which depend on one of those two.
- **next** covers everything else, which still depends on the prerelease fork or has never run on a device:
  - `@reactvision/react-viro` 3.1.0-moyo.0. npm refuses a prerelease without `--tag`.
  - The remaining viro-external packages.

All of these names are new to the registry. A package's first publish also gets `latest`, whatever `--tag` says. That is registry behaviour, not something tested here. After the first publish, run `npm dist-tag rm <name> latest` or point `latest` where it belongs.

## Publish order

1. `@viro-external/xr-contract`, then `@viro-external/specs`, `@viro-external/meta-layout` and `@viro-external/spatial-shell`.
   - react-viro declares `@viro-external/specs ^0.3.0` as an optional peer.
   - Its config plugin (`plugins/withViroSpatialShell.ts`) resolves `@viro-external/spatial-shell/plugin` from the app at prebuild. When the package is missing, it warns and continues.
2. `@reactvision/react-viro`. Most viro-external packages peer on it.
3. The rest of viro-external, in dependency order. Computed from the packed manifests, with no cycles:
   - `react-native-viro-mux`
   - `splat-pass`
   - `core`
   - `media`
   - `ui`
   - `gui`
   - `meta`
   - `meta-wearables`
   - `native-panels`
   - `openxr`
   - `render-passes`
   - `orb-pass`
   - `pano`
   - `pico-layout`
   - `premium`
   - `spatial-panels`
   - `spatial-runtime`
   - `viture`
   - `web-layout`
   - `webspatial`
   - `react-native-viro-webrtc`
4. expo-pico:
   - `platform-service-common`
   - `core`
   - the twelve feature packages
   - `app-kit`
   - `template`

   Nothing published from expo-pico depends on viro or viro-external; only its `example` app pins `@reactvision/react-viro` 3.0.2.

## virocore

virocore is not an npm package. It reaches npm in two places.

**Inside `@reactvision/react-viro` 3.1.0-moyo.0:**

- Android: `android/viro_renderer/viro_renderer-release.aar`, 14.8 MB.
  - sha256 `ca8711dc…5a7b12`, which matches `controller-build.json`.
  - Built from mikevocalz/virocore `881e5da89` (`sync/upstream-3.1.0`) by a local `:viroreact:assembleRelease`, not CI.
  - Also in the tarball: `android/react_viro/react_viro-release.aar`.
- iOS: `ios/dist/ViroRenderer/ViroKit.framework`.
  - sha256 `6195a69b…6b9742`, which matches `ios/dist/ios-build.json`.
  - Same virocore commit, built locally.
  - Also in the tarball: `ios/dist/lib/libViroReact.a` from viro `7fdfd239`.
- The build notes say ReactVisionCCA is not linked on either platform, and that no headset run was done with this build.
- None of virocore #116, #118 or #119 is in this renderer:
  - #118 and #119 are 5 commits ahead of `881e5da` (merged into nothing yet).
  - #116 has diverged from it: 14 ahead, 463 behind, based on `moyo/renderer-73c6a92`.
  - Shipping those fixes means rebuilding the AAR and framework after they merge, then bumping the fork version.

**Inside `@expo-pico/core`:**

- `plugin/assets/jniLibs/arm64-v8a/libviro_renderer.so`, 7.5 MB, sha256 `0d6d8ee1…46938f`.
- Built from virocore `main` at `a346988f` (PRs #103 to #109), per `plugin/assets/jniLibs/README.md`. It is staged into an app's PICO and Quest flavors at prebuild.
- #43 says this overlay is built against react-viro 3.0.2, which is why the example app stays on 3.0.2.
- The OpenXR loader staged next to it is Khronos 1.1.65 (from #44).

## The single command

`scripts/release.sh` in this repository. Clone `viro` and `expo-pico` next to it, check out the merged release commits, then:

```bash
scripts/release.sh --pack       # install, build and pack all 41 tarballs, check name@version, no registry contact
scripts/release.sh --dry-run    # same, then npm publish --dry-run per tarball (the default)
scripts/release.sh --publish    # same, then npm publish for real, in the order above
```

What the script does:

- Runs under `set -euo pipefail` and stops at the first failure.
- Packs viro-external with `pnpm pack`, and viro and expo-pico with `npm pack`.
- Refuses a tarball whose name or version differs from the plan, or whose manifest still has a `workspace:`, `link:` or `file:` range.
- Publishes the tarball, never the folder, with `--access public` and the tag from the plan.
- Adds `--provenance` only when `GITHUB_ACTIONS=true`, because provenance needs an OIDC token. expo-pico (`release.yml`, `prerelease.yml`) and viro-external (`publish-specs.yml`) have `id-token: write` workflows today; viro does not.
- On a rerun, skips any `name@version` the registry already has, so a failed run resumes where it stopped.

Two environment flags exist for local rehearsal only:

- `SKIP_INSTALL=1` reuses existing `node_modules`.
- `ALLOW_DIRTY=1` skips the clean-tree check.

`--pack` ran against the throwaway merges and exited 0. `--dry-run` and `--publish` have never run.

## Status

**Verified on device:**

- expo-pico #45 layout. The user confirmed it on 2026-11-04 on a Quest 3S (Horizon OS v209, `UP1A.231005.007.A1`) and a PICO 4 Ultra (OS 5.15.7): the rail, the rounded selected tab, and the aspect frame on resize. Those runs used the questDebug and picoDebug APKs with JS from Metro at `9438535`.
- On Quest, Enter XR held `XR_SESSION_STATE_FOCUSED` in an earlier build (working tree of `0fe95b7`, then `191207f` for about 54 s). On PICO, Enter XR was not re-run on those builds.
- #45's PR body still says no APK containing `dd6adb8` or later is installed. The device comments after it supersede that line, and the body should be updated.

**Verified only in CI or locally, never on a device from these packages:**

- expo-pico #44 (PPS pins, OpenXR loader 1.1.65).
- viro #83 and #84.
- viro-external #80 and #81.
- virocore #118 and #119, whose CI is green, including `build-aar`.
- The renderer AAR and ViroKit framework inside react-viro 3.1.0-moyo.0 (local release builds, "No headset run").
- Every tarball in this file, which was packed but never installed into an app.

**Blocked or not run:**

- Android XR: deferred, no device.
- MX Ink stylus (virocore #116): never run with a stylus. The one trial used a Logitech Muse and failed to pair. Tip force, haptics and tip pose are unverified.
- Meta VR Glasses: not tested.
- virocore #116, #118 and #119: not run on a headset from those branches. #116's device notes come from an older build (`0ea78070`).
- Nitro V1: still `1.0.0-alpha.nightly.120`. npm `latest` for `react-native-nitro-modules` is 0.37.2, so every Nitro-dependent package here can only ship under `alpha`.
- Controller ray and hand pinch on the rail: only exercised with `adb input`.
- PICO with a registered app ID: CI uses `expo-pico-ci-unregistered`.
- `npm publish --dry-run`: denied in the session that wrote this file. Run `scripts/release.sh --dry-run` to get it.
