# Integration examples

[Handbook](../README.md)

| File | What is executable | Required host |
| --- | --- | --- |
| [SpatialWorkspaceExample.tsx](SpatialWorkspaceExample.tsx) | Scene component using exported UI APIs, settled origin and selection-owned inspector | A working Viro scene, compatible fork, React and app-owned selection/recenter state |
| [workspace-contract.ts](workspace-contract.ts) | Complete newer workspace definition | No renderer for data/contract tests; a real adapter for presentation |
| [rive-session.ts](rive-session.ts) | Native-host mount/capability/cleanup wrapper with guarded methods | An actual `ViroCoreRiveNativeHost` and application-owned `.riv` asset |
| [workspace-contract.test.mjs](workspace-contract.test.mjs) | Tests against the actual workspace validator/lifecycle functions | Node with type stripping; no private renderer |

Run from the repository root:

```sh
node scripts/check-docs.mjs
node --experimental-strip-types --test docs/examples/workspace-contract.test.mjs
```

The scene and Rive examples are integration code, not standalone apps. They do not contain a fake native module, packaged `.riv` asset, or generated screenshot pretending to be renderer output. Copy them into the compatible application, wire actual state/host inputs, run its TypeScript/build checks, and record device evidence. Portable documentation CI checks links, export presence and the data example; it does not execute a scene or certify native rendering.
