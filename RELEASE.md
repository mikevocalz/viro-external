# Release plan: virocore, react-viro fork, viro-external, expo-pico

None of these packages go to npm. Apps install them from GitHub: expo-pico from its `release/*` branches, the react-viro fork from a tag or SHA of mikevocalz/viro, viro-external from a pinned checkout or tarballs packed from one, and virocore only as the renderer binaries that ship inside the other two.

Status on 2026-11-04: every PR in the merge order below is an open draft. `scripts/release.sh` checks them and previews the cut; nothing has been merged or tagged.

## Packages and install specs

| Package | GitHub source | Spec an app uses |
| --- | --- | --- |
| `@expo-pico/core` and the other `@expo-pico/*` packages | mikevocalz/expo-pico, branch `release/<name>` (scope dropped: `release/core`, `release/spatial`, `release/account`, ...) | `"github:mikevocalz/expo-pico#release/core"`, or pinned: `"github:mikevocalz/expo-pico#<release-commit-sha>"` or `#@expo-pico/core@<version>+<source-sha>` |
| `expo-horizon-core` (quest flavor) | mikevocalz/expo-pico, branch `release/horizon-core` | `"github:mikevocalz/expo-pico#release/horizon-core"` |
| `@reactvision/react-viro` 3.1.0-moyo.0 | mikevocalz/viro, tag `v3.1.0-moyo.0` (created by `release.sh --push` on the merge commit), or a `main` SHA | `"github:mikevocalz/viro#v3.1.0-moyo.0"` or `"github:mikevocalz/viro#<sha>"`. Always give a ref: the repo's default branch is `decax9-three-panel`, not `main`. |
| `@viro-external/*`, `react-native-viro-mux`, `react-native-viro-webrtc` | mikevocalz/viro-external, tag `release-<date>` (created by `release.sh --push`) | No `github:` spec works yet (see below). Check out the tag next to the app and use `link:`, or vendor `pnpm pack` tarballs built at the tag and use `file:`. |
| virocore | mikevocalz/virocore `main` SHA, pinned by viro-external's `scripts/sync-viro-3-1.sh` (#78) | None. Apps get the renderer from react-viro (`android/viro_renderer/viro_renderer-release.aar`, `ios/dist/ViroRenderer/ViroKit.framework`) and from `@expo-pico/core` (`plugin/assets/jniLibs/arm64-v8a/libviro_renderer.so`). |
| `react-native-nitro-modules` | npm (third party) | `1.0.0-alpha.nightly.120.g33ef045b96c0`, the build expo-pico pins. It pulls `nitro-core` at the same version. |

### expo-pico

[`docs/INSTALL-FROM-GITHUB.md`](https://github.com/mikevocalz/expo-pico/blob/main/docs/INSTALL-FROM-GITHUB.md) is the consumer guide. On every push to `main`, `.github/workflows/release-branches.yml` runs `yarn build` and then `scripts/build-release-branches.mjs --push`, which packs each package and commits the packed tree to its `release/<name>` branch. Release branches only move forward. Each release commit is `release <name>@<version> from <source-sha>` and gets an annotated tag `<name>@<version>+<source-short-sha>`. The packed manifests have no `scripts`, so nothing builds at install time.

List every expo-pico package the app uses plus their peers (`@expo-pico/core`, `@expo-pico/platform-service-common`, Nitro) in the app's own `package.json`. The release manifests turn workspace dependencies into peers because pnpm 12 refuses a git dependency below the top level (`ERR_PNPM_EXOTIC_SUBDEP`).

`release/core` is currently cut from `9be55e4` (`@expo-pico/core` 1.0.0). The first push to `main` after #43, #44 and #45 merge recuts every branch, and moves `release/horizon-core` from 57.0.3 to 58.0.1.

### react-viro fork

`dist/` is gitignored on `main`, #83 and #84. A git install still gets it: npm clones the repo, installs its devDependencies, runs `prepare` (`npm run build`: `tsc`, the plugins tsconfig, the specs CLI, `copy-files`), and packs the result. Checked on 2026-11-04 with npm 12.2.1 against #84 (`feat/spatial-shell-autoinject`) in an empty project:

- `npm install github:mikevocalz/viro#feat/spatial-shell-autoinject --legacy-peer-deps=false` exits 1 with `EALLOWGIT`. npm 12 defaults `allow-git` to `none`. With `--allow-git=all` it exits 0 and the installed package has `dist/plugins/withViro.js`.
- `require('@reactvision/react-viro/app.plugin.js')` then fails on `@expo/config-plugins`, which an Expo app gets from `expo` (an optional peer). With `NODE_PATH` pointing at an app's `node_modules` (MoyoLearn's, `@expo/config-plugins` 58.0.10) it loads, and applying the plugin to a config with `_internal.projectRoot` set returns `ios` and `android` mods (exit 0).

Not checked: a pnpm or yarn git install of the fork, and whether pnpm's build-script approval blocks `prepare` for it.

### viro-external

viro-external has no release branches. On `main`, every package except `@viro-external/specs` points `main` at TypeScript source, and most depend on each other through `workspace:*`, which only resolves inside this workspace. A `github:` spec (with or without pnpm's `&path:`) would install those ranges unresolved. That leaves the two ways the apps already use:

- **Sibling checkout plus `link:`** (Harlem-Might). Check out the release tag next to the app; `scripts/sync-viro-3-1.sh` does the same for viro and virocore at their pinned SHAs.
- **Vendored tarballs plus `file:`** (MoyoLearn). Run `pnpm pack` in each package at the release tag (pnpm rewrites `workspace:*` and applies `publishConfig`), commit the tarballs to the app, and name the source SHA in the file name.

Porting expo-pico's release-branch workflow here would give viro-external real `github:` specs. Nobody has done that.

After #80, every viro-external package that peers on react-viro asks for `>=3.1.0-moyo.0 <4.0.0`. An app on an older fork build (MoyoLearn's vendored 3.0.1-moyo.1) fails that peer check until it moves to 3.1.0-moyo.0.

### What the apps use today

Read from the working trees on 2026-11-04 (Harlem-Might on `main`, MoyoLearn on `feat/motion-03-signatures`):

- **Harlem-Might** `apps/mobile/package.json`:
  - `"@expo-pico/core": "github:mikevocalz/expo-pico#release/core"`
  - `"expo-horizon-core": "github:mikevocalz/expo-pico#release/horizon-core"`
  - `"@reactvision/react-viro": "link:../../../viro"`
  - `"@viro-external/core": "link:../../../viro-external/packages/viro-external-core"`, and the same for `media`, `meta-layout`, `ui` and `xr-contract` (`packages/xr-platform-contract`)
  - `packages/spatial` and `apps/web` take `"@reactvision/react-viro": "catalog:"`, which `pnpm-workspace.yaml` sets to `3.0.2` from npm.
- **MoyoLearn** root `package.json`, `pnpm.overrides`:
  - `"@reactvision/react-viro": "file:./vendors/reactvision-react-viro-3.0.1-moyo.1.tgz"`
  - `"@viro-external/core": "file:./vendors/viro-external-core-0.1.0-4dc2775.tgz"`, and the same pattern for `media`, `meta-layout`, `native-panels`, `spatial-panels`, `ui` and `xr-contract-0.3.0`
  - `"@expo-pico/core": "file:./vendors/expo-pico-core-1.0.0-nitro-v1.tgz"`
  - `apps/mobile` declares `"expo-horizon-core": "57.0.2"` (upstream, from npm).

## Merge order

Each step needs the previous one merged and its CI green.

1. **virocore**: #116 into `moyo/renderer-73c6a92`; #118 and #119 into `main`.
2. **viro**: #83, then #84. #84's head contains #83's (the merge in `343a3d7`), so merging #84 after #83 adds only #84's commits.
3. **viro-external**: #80, then #81. #81's head contains #80's.
4. **expo-pico**: #43, then #44 and #45. #45 is stacked on #43 (its base is `chore/expo-58-nitro-v1`, and its head contains `e501aa2`); retarget it to `main` once #43 merges. #44 targets `main` directly.

#78 pins viro-external's Viro source (`VIRO_SHA` in `scripts/sync-viro-3-1.sh`, `VIRO_REVISION` in `scripts/ci/check-viro-access.mjs`, the protected CI checkout in `.github/actions/checkout-viro/action.yml`) to viro `main` `8075d97`, the commit tagged `v3.1.0-moyo.0`, and `VIROCORE_SHA` to virocore `main` `8a5bdc4`. Move them together the next time viro or virocore `main` advances, and add the new Viro SHA to `VIRO_FORK_VERSIONS` in `scripts/ci/check-manifests.mjs`.

## What CI produces after each merge

| Repo | On push to `main` | Output |
| --- | --- | --- |
| virocore | `Build PICO renderer AAR` (also on `v*-pico*` tags) | Artifact `viro_renderer-release-aar`. Nothing in viro or expo-pico picks it up automatically. |
| virocore | `Release with changelog`, on any tag push | A GitHub release. `release.sh` does not tag virocore for this reason. |
| viro | `Viro convergence`, `Engine contract facade`, `Specs public API` (path-filtered) | Tests, build, plugin-load check, `npm pack --dry-run`, uploaded artifacts. No branch or tag. The `v3.1.0-moyo.0` tag comes from `release.sh --push`. |
| viro-external | `Premium spatial stack`, `Viro 3 / Expo 58 validation`, `XR platform adapters`, `SPECS release gates` (path-filtered) | Checks only. The protected spatial validation, including `check-viro-access.mjs`, runs only on trusted `main` pushes with the dependency token. The `release-<date>` tag comes from `release.sh --push`. |
| expo-pico | `CI`, `Release branches`, `Version Packages` | `Release branches` recuts every `release/*` branch and tags each package. `Version Packages` opens a PR when changesets are pending. |

`publish-specs.yml` (viro-external) and `release.yml` / `prerelease.yml` (expo-pico) publish to npm and only run on manual dispatch. This release does not use them.

## virocore binaries

A virocore merge does not change what apps run until the binaries are rebuilt and committed. What ships today:

- **In react-viro 3.1.0-moyo.0**: `android/viro_renderer/viro_renderer-release.aar` (14.8 MB, sha256 `ca8711dc…5a7b12`, matching `controller-build.json`) and `ios/dist/ViroRenderer/ViroKit.framework` (sha256 `6195a69b…6b9742`, matching `ios/dist/ios-build.json`). Both were built locally from virocore `881e5da89` (`sync/upstream-3.1.0`), not by CI. The build notes say ReactVisionCCA is not linked and no headset run was done with this build.
- **In `@expo-pico/core`**: `plugin/assets/jniLibs/arm64-v8a/libviro_renderer.so` (7.5 MB, sha256 `0d6d8ee1…46938f`), built from virocore `main` at `a346988f` per `plugin/assets/jniLibs/README.md`, next to the Khronos OpenXR loader 1.1.65 from #44.
- None of #116, #118 or #119 is in either binary. Shipping them means rebuilding the AAR, the framework and the `.so` after they merge, committing them to viro and expo-pico, and cutting again.

## `scripts/release.sh`

```bash
scripts/release.sh          # check only, pushes nothing (default)
scripts/release.sh --push   # after every PR has merged: create the tags, dispatch release-branches.yml
```

It reads everything through the GitHub API with `gh`, so it needs no clones. In order:

1. Lists every PR in the merge order with its state, base, head, mergeability and check results. A conflict or a failing check fails the run.
2. Confirms the stacked PRs contain their dependencies (viro #84 ⊇ #83, viro-external #81 ⊇ #80, expo-pico #45 ⊇ #43).
3. Picks the release source per repo: `main` once every PR has merged, otherwise the PR heads, as a preview.
4. Compares viro-external's Viro and ViroCore pins with those sources, and checks that the sync script and `check-viro-access.mjs` pin the same Viro commit.
5. Lists the tags it would create: `v<version>` on viro and `release-<UTC date>` on viro-external (`VX_TAG` overrides it). It never moves an existing tag.
6. Compares expo-pico's `release/core` source commit with the release source.

`--push` refuses to run until every PR in the merge order is merged. It then creates the annotated tags through the API and, if `release/*` is behind `main`, dispatches `release-branches.yml`. Without `--push` it writes nothing.

Run on 2026-11-04 against the current PR heads, check mode exited 0:

```text
==> 2. Stacked PRs
  viro #84 (46487c7) contains #83 (bfbfbc7)
  viro-external #81 (49575b4) contains #80 (55f29c5)
  expo-pico #45 (41aa84b) contains #43 (e501aa2)

==> 4. viro-external source pins (Viro / ViroCore)
  #78 not merged; reading pins from its head 1f1252d
  viro pin c6a0dbc is behind the release source 46487c7: bump it after the viro merge
  virocore pin 29a8512 = virocore main

==> 5. Tags
  viro v3.1.0-moyo.0 -> 46487c7 (would create)
  viro-external release-2026-11-05 -> 49575b4 (would create)

==> 6. expo-pico release branches
  release/core was cut from 9be55e4; release source is 41aa84b
```

`--push` against the same heads exited 1 with `refusing --push: not every PR in the merge order is merged`, and created no tag.

## Resolved blockers

| Blocker | Fixed in |
| --- | --- |
| viro-external peer ranges rejected react-viro 3.1.0-moyo.0; agent files in package tarballs | viro-external `55f29c5` (#80) |
| viro-external lockfile broken after merging #80 and #81 | viro-external `49575b4` (#81) |
| viro #84 conflicted with #83 | viro `343a3d7` (#84) |
| `@expo-pico/core` packed the example Android app and its debug keystore | expo-pico `5b1562a` (#43) |
| #43's CodeRabbit threads: script paths, Meta Layout ordering, `release/horizon-core` wording | expo-pico `3e27559`, `e17b60b`, `e501aa2` (#43) |

## Status

**Verified on device:**

- expo-pico #45 layout. The user confirmed it on 2026-11-04 on a Quest 3S (Horizon OS 209) and a PICO 4 Ultra (OS 5.15.7): the rail, the rounded selected tab and the aspect frame on resize, with the questDebug and picoDebug APKs and JS from Metro at `9438535`.

**Verified only in CI or locally:**

- expo-pico #43 and #44; viro #83 and #84; viro-external #80 and #81; virocore #116, #118 and #119.
- The react-viro git install described above (npm 12 only).

**Blocked or not run:**

- Android XR: deferred, no device.
- MX Ink stylus (virocore #116): never run with a stylus.
- Meta VR Glasses: not tested.
- virocore #116, #118 and #119: not run on a headset from their branches.
- Nitro V1 is still the alpha nightly (`1.0.0-alpha.nightly.120.g33ef045b96c0`).
