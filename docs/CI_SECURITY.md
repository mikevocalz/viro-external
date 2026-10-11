# CI trust boundary and private dependency setup

The three spatial workflows use one reusable workflow. **Portable PR checks are not full-workspace or device validation.** No workflow commits or pushes generated output. All installs of the complete workspace use the committed lockfile.

## Two independent validation lanes

| Lane | Runs on | Credentials and source | Checks |
| --- | --- | --- | --- |
| Portable | PRs (including forks), pushes to main, manual runs | Read-only repository checkout; no private Viro source; no environment secrets | Dependency-free Rive/world-slot/PICO tests, manifest checks, CI regressions; `all` suite also regenerates legacy bindings in an isolated registry-only tool directory |
| Private Viro | Only canonical repository main, on push or manual dispatch, after portable checks pass | Protected `spatial-dependencies` environment; pinned Viro checkout | Frozen workspace install, suite-specific typechecks, contract/build/pack checks and generated-file drift guard |

The Premium, XR and all-package callers select a suite. A skipped private job means **not run**, never proof of compatibility. Manual dispatch on a feature branch runs portable checks only. Full pre-merge validation must be done in an already-authorized local checkout until a separately reviewed protected pre-merge runner is provided; do not fetch PR code in a privileged `pull_request_target`/`workflow_run` job.

## Required administrator configuration (not created by this commit)

Before adding any credential:

1. Create the `spatial-dependencies` GitHub environment. Configure **selected deployment branches** to allow exactly `main`, and no tags or pull-request refs. Do not use the broader “protected branches” option as a substitute for that explicit rule. Use a required reviewer and prevent self-review where available.
2. Add `SPATIAL_DEPENDENCIES_TOKEN` **only as an environment secret**, with read-only Contents access to `mikevocalz/viro`. Do not store another copy as a repository or organization secret exposed to this repository. Remove any such copies before considering this boundary secured.
3. Keep fork-secret forwarding disabled. Protect changes to main and `.github/` with review. Environment rules are enforced by GitHub; YAML `if` conditions are only defense in depth because same-repository contributors can edit workflow files.
4. Run the all-package workflow from `main` after the changes are merged and approved. An absent credential fails the private preflight explicitly. Do not weaken the guard or mark the draft validated to bypass it.

An automatically created environment without these branch restrictions is not a configured security boundary. This change neither provisions an environment nor creates/rotates a token. GitHub's normal GITHUB_TOKEN cannot substitute for access to another private repository.

## Generated code must match the commit

`check-generated-clean.mjs` rejects staged or unstaged edits, deletions and untracked generated files under `packages/**/nitrogen/generated/**`, plus changes to `pnpm-lock.yaml`. It runs after generation, before full typechecking, and at the end of private validation. Regression tests exercise each failure mode. Never rely on typechecking regenerated output alone.

PR binding verification installs only exact, registry-only versions of Nitrogen, Nitro Modules and TypeScript from the legacy package manifest into the runner's temporary directory, with install scripts disabled. It does not install the workspace or fabricate Viro exports. Its transitive tools are npm-resolved, not a substitute for the frozen pnpm workspace lane. Keep the legacy generator check separate from the Nitro-free premium runtime graph.

## Run locally with existing private access

Place the compatible `viro` checkout beside `viro-external`, at the revision in `.github/actions/checkout-viro/action.yml`. Then:

```sh
corepack enable
corepack prepare pnpm@12.8.1 --activate
pnpm install --frozen-lockfile --strict-peer-dependencies=false
pnpm specs
node scripts/ci/check-generated-clean.mjs
pnpm typecheck
pnpm test:rive-contract
pnpm test:workspace-surface
pnpm check:metro
```

If generation changes bindings, commit the intended changes yourself and rerun. Validation no longer has an auto-commit/auto-refresh path on any event. Native release builds, real pixels, controller capture and headset behavior remain separate acceptance gates.

## Security references

- [GitHub: securely using pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)
- [GitHub: secrets](https://docs.github.com/en/actions/concepts/security/secrets)
- [GitHub: managing environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
