# ADR 0003: Typed actions, routes and route memory in the Specs Lens host

**Status:** Proposed (branch `feat/specs-actions`, awaiting review)
**Date:** 2026-10-28
**Deciders:** Mike Allen
**Related:** ADR 0002 (incremental apply), viro ADR-0003 (typed actions and
the Zustand binding), viro `feat/specs-actions`

## Context

At `feat/specs-host` (`c0d69c9`):

- `ViroSpecsSceneController` delivered interaction events to listeners and
  nothing else. A Lens without a phone had no way to turn a pinch into app
  state; `queueAction` existed but each app had to build the loop.
- `update(input)` always patched. A screen change (list to details) removed
  and created nodes in place, and the list's scroll position was lost when
  it came back, because the stable-ID carry in `present` only spans one
  replacement.
- Interaction bindings were keyed on the whole interaction entry, so any
  change to it rebound SIK.

The pack (§9 WS3b) asks for a Lens handler registry, a portable action/state
contract, the list → details → setting → back flow with the scroll position
kept, and queued actions invalidated through the WS3 ownership model.

## Decision

1. **Contract in protocol 2.** Documents may carry `route`, `actions`
   (declarations: ID plus typed flat payload) and interaction `triggers`.
   The reader rejects undeclared actions (`VS5015`), duplicate declarations
   (`VS5016`), ill-typed trigger payloads (`VS5017`) and triggers on events
   the node does not enable (`VS5002`) before the live scene is touched.
   The checks live in `ViroSpecsActionContract.ts`, a copy of viro's
   `components/Specs/core/actions.ts` rules.
2. **The controller resolves triggers and owns the delivery.** On
   `select-end`, `hover-enter` or `hover-exit` it reads the node's triggers
   from the committed scene and queues each action for the next frame as
   work owned by that scene. Retiring the scene cancels it and reports
   `VS5018`. Listeners subscribe with `addOnActionListener`. Delivery is
   never synchronous: the action usually destroys the SceneObject whose
   Interactable is mid-callback.
3. **Route change is navigation.** `update` with a different `route` goes
   through the transactional `present`. Before retiring a routed scene the
   controller captures the non-empty UI state (scroll) of its nodes under
   that route; presenting a route restores it to nodes that did not carry
   over from the previous scene. Memory is LRU with `maxRememberedRoutes`
   (default 16), eviction `VS5020`. The entering route's memory is read
   before the leaving route is stored, so a full memory cannot evict the
   route being returned to (found by the bounded-memory test).
4. **Registry and runtime.** `ViroSpecsActionRegistry<S>` holds
   declarations and one pure handler per action (`VS5015` undeclared,
   `VS5016` second handler, `VS5017` ill-typed, `VS5009` handler threw).
   `ViroSpecsActionRuntime<S>` owns the state, reduces each action and
   renders `view(state)` with `update` on a narrow `ViroSpecsActionSceneHost`
   interface, implemented by the controller and by
   `ViroSpecsSceneControllerHost`. A rejected render rolls the state back.
   `forward` is an optional sink for a phone transport; with it, missing
   local handlers are not reported (`VS5019`).
5. **Bindings ignore triggers.** SIK is rebound only when `interactable`,
   `manipulation` or `events` change, so a setting that changes a button's
   payload touches no binding.

## Options considered

### A: Controller resolves triggers, runtime outside the controller (chosen)

| Dimension | Assessment |
| --- | --- |
| Lifetimes | Trigger delivery reuses the scene `Ownership`; no second lifetime system |
| Testability | Everything is Lens-global-free and runs in Node on the mock host |
| Coupling | The controller knows triggers, not state; the runtime knows state, not SIK |

### B: Runtime subscribes to interactions and resolves triggers itself

The runtime would need the committed scene's triggers and its own ownership
tracking to know whether a scene was retired between pinch and frame,
duplicating what the controller already owns. Rejected.

### C: Scroll position in app state

The Lens would have to report scroll changes back to app state on every
frame of scrolling. The controller already captures UI state for stable IDs;
extending it per route is smaller and needs no event stream. Rejected.

## Consequences

- Easier: a standalone Lens experience is declarations, pure handlers and a
  `view` function, all testable in Node.
- Harder: route is now meaningful; two screens that share a route patch
  rather than navigate.
- Changed: `ViroSpecsSceneController` gains `addOnActionListener`, `route`,
  `rememberedRoutes` and the `maxRememberedRoutes` option;
  `ViroSpecsSceneControllerHost` gains `addOnActionListener` and
  `diagnosticsChannel`. Diagnostic phase `action` and codes `VS5015`–`VS5020`
  are new.
- Revisit: route memory for focus and selection, not only scroll; a wire
  format for actions on the phone transport.

## Evidence

| Claim | Label | Where |
| --- | --- | --- |
| Reader, trigger delivery, VS5018, route memory, registry, runtime, reference flow, 100 cycles | portable-test-passed | `pnpm --filter @viro-external/specs specs:test-host` (39 tests: 27 existing, 11 in `actions.test.mjs`, 1 in `actions-fixtures.test.mjs`) |
| Documents compiled by viro drive the controller | portable-test-passed | `scripts/actions-fixtures.test.mjs`, fixtures from viro `440f93b5` |
| Lens files typecheck against Lens declarations | implemented (typechecked outside Lens Studio) | Platform Lab project `Support/StudioLib.d.ts`: no errors in changed files besides the TS1238/TS1240 decorator signatures every `@component` file shows outside Lens Studio |
| Lens Studio compile, Preview, SIK delivery, device | not verified | Lens lane |

## Action items

1. [x] Contract checks, reader, controller delivery and route memory.
2. [x] Registry, runtime, reference flow, `ViroSpecsActionsLab`.
3. [ ] Lens lane: LEAF scenarios for the reference flow, scroll retained on
   back, and a pinch queued across navigation (`VS5018`).
4. [ ] Phone transport that forwards `addOnActionListener` (WS6/WS7).
