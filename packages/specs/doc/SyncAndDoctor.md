# specs:sync and specs:doctor

`specs:sync` copies the Viro Specs Lens runtime into a Lens Studio project.
`specs:doctor` checks that project before a preview or device build and exits
1 when something would break the Lens. Both read
[`lens-runtime.json`](../lens-runtime.json), so the file lists and package
minimums cannot drift between them.

```bash
pnpm --filter @viro-external/specs specs:doctor -- --project "/abs/path/MySpecsLens"
pnpm --filter @viro-external/specs specs:sync   -- --project "/abs/path/MySpecsLens"
pnpm --filter @viro-external/specs specs:doctor -- --project "/abs/path/MySpecsLens"
```

## What gets synced where

`lens-runtime.json` puts every file in `lens/` into exactly one set.
`specs:sync` refuses to run if a file is in none of them.

| Set | Files | Destination | When |
| --- | --- | --- | --- |
| `production` | the runtime, hosts, scene controller, Interaction Kit seam, typed-action runtime, experience layer (30 files) | `Assets/ViroSpecs/lens/` | every sync |
| `validation` | `ViroSpecsLeafIndex`, the two LEAF scenarios, `ViroSpecsAgentValidation`, `ViroSpecsRuntimeValidation`, `ViroSpecsPlatformLab`, and the typed-actions sample `ViroSpecsActionsLab` with its `ViroSpecsReferenceFlow` | `Assets/ViroSpecsValidation/lens/` | only with `--with-validation` |
| `notSynced` | `lens/README.md` | nowhere | never |

No production file imports a validation file or a LEAF / AiPreviewAgent
package; `scripts/lens-files.test.mjs` fails the build if one does. A default
sync therefore produces a Lens that compiles without Leaf, AiPreviewAgentInspect
or AiPreviewAgentInteract installed. Validation files import production modules
through `../../ViroSpecs/lens/`, which the sync rewrites as it copies them.

`Assets/ViroSpecs/viro-specs.dependencies.json` records the SDK version, wire
version, scene protocols, Interaction Kit line and package minimums the synced
runtime was built against.

### Flags

| Flag | Effect |
| --- | --- |
| `--project <dir>` | Required. The folder holding the `.esproj` |
| `--with-validation` | Also sync the validation set. Refuses while validation files from an older sync are still in `Assets/ViroSpecs/lens/` (see below) |
| `--interaction-kit 2\|4` | Pick the kit line. Without it, sync uses 4 when only `Packages/InteractionKit.lspkg` is installed, else 2 |
| `--force-overwrite <path>` | Replace one file you edited, for example `ViroSpecs/lens/ViroSpecsRuntimeHost.ts`. Repeatable |
| `--adopt-existing` | Take ownership of files written by a sync that predates the ledger |
| `--clean` | Removed. It now fails and says why |

## Upgrades keep Lens asset identities and your edits

Lens Studio keys every asset by the UUID in its `.meta` sidecar, and scene
references point at that UUID. Delete and recreate a script, or its `.meta`,
and every Inspector reference to it breaks. So `specs:sync`:

- replaces each file by writing a temp file in the same folder and renaming it
  over the old one, and never opens, moves or deletes a `.meta` file;
- writes `viro-specs.owned.json` in each synced folder, mapping every file it
  wrote to its sha256;
- keeps a file whose hash no longer matches the ledger (you edited it) and
  prints it under `KEPT, edited since the last sync`. `--force-overwrite`
  replaces it;
- deletes a file the SDK stopped shipping only when the ledger lists it and it
  is unmodified;
- never touches a file the ledger does not list.

### Projects synced before the ledger

Older syncs wrote everything, validation files included, into
`Assets/ViroSpecs/lens/` with no ledger.

1. Run `specs:sync --adopt-existing` once if you never edited those files.
   Otherwise run it without the flag; files whose content differs are kept and
   listed, and you resolve each one with `--force-overwrite` or by hand.
2. If the project uses LEAF, the Platform Lab or the Actions Lab, move the
   validation files it has, each with its `.meta`, from
   `Assets/ViroSpecs/lens/` to `Assets/ViroSpecsValidation/lens/`:
   `ViroSpecsActionsLab.ts`, `ViroSpecsAgentValidation.ts`,
   `ViroSpecsLeafIndex.ts`, `ViroSpecsLeafInteractionScenario.ts`,
   `ViroSpecsLeafSceneSmokeScenario.ts`, `ViroSpecsPlatformLab.ts`,
   `ViroSpecsReferenceFlow.ts`, `ViroSpecsRuntimeValidation.ts`. The doctor
   lists the ones it finds. Moving the `.meta` with the file keeps the scene
   references. Then run `specs:sync --with-validation`.
3. If the project does not use them, move those files out of `Assets/`.

Until step 2 or 3 is done, the doctor warns about them and
`--with-validation` refuses, because two copies of a `@component` class in
`Assets/` break the compile.

## What the doctor checks

| Check | Result when it fails |
| --- | --- |
| Exactly one `.esproj` in the folder, an `Assets/` folder | error, before any other check |
| `targetPlatform: Spectacles` | error |
| Lens Studio 5.22.0 or later (`studioVersion` in the `.esproj`) | error |
| One Interaction Kit installed: `SpectaclesInteractionKit.lspkg` or `InteractionKit.lspkg`, not both | error |
| Interaction Kit and each required package installed, readable and at or above its minimum | error |
| Each validation package installed and at or above its minimum | error when `Assets/ViroSpecsValidation/` exists, validation files sit in `Assets/ViroSpecs/lens/`, or `--with-validation` is passed; warning otherwise |
| `ViroSpecsInteractionKit.ts` imports the installed kit | error |
| Every module that seam imports exists in `Cache/TypeScript/Src/Packages/<kit>/` | error; warning if Lens Studio has not filled the cache yet |
| Each synced folder matches its `viro-specs.owned.json` | missing file: error. Edited file: warning |
| `viro-specs.dependencies.json` exists and matches this SDK's wire version, scene protocols and the installed kit | error |
| Runtime synced by an older SDK version, or without a ledger | warning |

Errors exit 1. Warnings print but exit 0.

### Where versions come from

An Asset Library package is a zip archive at `Packages/<Name>.lspkg`. The
version is in `Package/Assets/package.native` inside it, a
`NativePackageDescriptor` with `VersionMajor`, `VersionMinor`, `VersionPatch`
and `VersionPrerelease` fields. The `.lspkg.meta` next to the archive carries
no version. An unpacked package is a folder, normally `Assets/<Name>.lspkg/`,
with `package.native` at its root. The doctor looks in `Packages/` first, then
`Assets/`. It reads one entry from the archive and does not unpack anything or
write to the project.

Versions compare by semver 2.0.0, so `2.0.0-beta.1` is below a `2.0.0`
minimum. A package that is present but has no readable descriptor (an empty
file, a zip64 archive, a folder without `package.native`) is an error, not a
pass.

### Minimums

From `lens-runtime.json`:

| Package | Set | Minimum |
| --- | --- | --- |
| `SpectaclesInteractionKit.lspkg` (or `InteractionKit.lspkg`) | required, one of the two | 2.0.0 (or 4.0.0) |
| `SpectaclesUIKit.lspkg` | required | 2.0.0 |
| `SurfacePlacement.lspkg` | required | 2.0.0 |
| `VolumetricLine.lspkg` | required | 2.0.0 |
| `SpecsNavigationKit.lspkg` | required | 2.0.0 |
| `Leaf.lspkg` | validation | 2.0.2 |
| `AiPreviewAgentInspect.lspkg` | validation | 2.0.1 |
| `AiPreviewAgentInteract.lspkg` | validation | 2.0.1 |

Raise a minimum in `lens-runtime.json` only when the runtime starts using
something the older version lacks, and add a test project at the old version
to `scripts/lens-doctor.test.mjs`.

### Flags

| Flag | Effect |
| --- | --- |
| `--project <dir>` | Required |
| `--with-validation` | Treat the validation packages as required before the validation files are synced |
| `--before-sync` | Check the project and packages only; skip the ledger, dependency record and seam checks that the next sync rewrites |

### Example

A project with `VolumetricLine.lspkg` missing and UI Kit at 1.9.3:

```text
Viro Specs Lens project doctor
------------------------------
Project: /abs/path/MySpecsLens
Project file: Lab.esproj
Lens Studio: 5.24.0
Target: Spectacles
Interaction Kit: SpectaclesInteractionKit.lspkg 2.0.0
SpectaclesUIKit.lspkg: 1.9.3
SurfacePlacement.lspkg: 2.0.0
VolumetricLine.lspkg: missing
...

Errors:
 - Required Lens package SpectaclesUIKit.lspkg is 1.9.3; minimum is 2.0.0. Update it from the Asset Library.
 - Required Lens package not found in Packages/ or Assets/: VolumetricLine.lspkg (minimum 2.0.0).
```

## specs:bootstrap and specs:go

The Platform Lab runs LEAF scenarios and AiPreviewAgent checks, so both
scripts need the validation set. `specs:bootstrap` runs, stopping at the
first failure:

1. `specs:doctor --with-validation --before-sync`
2. `specs:sync --with-validation`
3. `specs:doctor --with-validation`

`specs:go` runs step 1 before it touches the Codex config, then calls
`specs:bootstrap`. A half-synced `Assets/ViroSpecs/` therefore does not block
the sync that repairs it, and the full check still runs afterwards.

## Tests

`pnpm --filter @viro-external/specs specs:test-lens` runs
`scripts/lens-files.test.mjs` (the file split and what each sync writes) and
`scripts/lens-doctor.test.mjs` (version reading, every doctor failure message,
exit codes, the ledger after edits and deletions, `.meta` files surviving a
resync). The test projects in `scripts/support/lens-project-fixture.mjs` hold
real zip archives with `package.native` descriptors in the format Lens Studio
5.24 writes. `prepack` and the XR suite of `spatial-validation.yml` run it.

## Not verified

- The `InteractionKit.lspkg` 4.0.0 line. No 4.0.0 package was available, so
  the 4.0.0 fixtures are synthetic archives; see
  [Compatibility.md](./Compatibility.md#interaction-kit-2x-and-400).
- Whether UI Kit and Navigation Kit 4.0.0 kept their 2.x package file names.
  If they were renamed, the doctor reports them missing.
- Archives Lens Studio writes as zip64. The reader rejects them with an
  "unreadable" error; none of the installed packages checked so far is zip64.
