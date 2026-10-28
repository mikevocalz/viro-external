# Actions and state in the Lens

Typed actions let a Lens run app logic standalone: no phone, no server. The
same contract carries actions to a phone app when one is connected. The
React Native side and the full contract are in viro's
`docs/specs-actions.md`; decisions are in
[ADR 0003](../../../docs/adr/0003-specs-lens-actions.md).

## Flow

1. A scene document (protocol 2) declares `actions` and puts `triggers` on
   interaction entries:
   `{ "on": "select", "actionId": "exhibit.open", "payload": { "exhibitId": "orrery" } }`.
2. The pinch reaches `ViroSpecsSceneController`. It looks up the node's
   triggers in the committed scene and queues the action for the next frame,
   owned by that scene.
3. On the next frame, if the scene is still committed, listeners from
   `addOnActionListener` receive a `ViroSpecsActionEvent`.
4. `ViroSpecsActionRuntime` checks the payload against the
   `ViroSpecsActionRegistry` declaration, runs the handler, and renders
   `view(nextState)` with `update`.

## Writing an experience

```ts
const diagnostics = host.diagnosticsChannel;
const registry = new ViroSpecsActionRegistry<State>(DECLARATIONS, diagnostics);
registry.on("exhibit.open", (state, payload) => ({ ...state, route: "details", selectedId: String(payload.exhibitId) }));
registry.on("nav.back", (state) => ({ ...state, route: "list" }));

const runtime = new ViroSpecsActionRuntime(host, { initialState, view, registry, diagnostics });
runtime.start();
```

- Handlers are pure. Return the same object for "no change"; the runtime
  then sends nothing.
- `view(state)` returns a protocol 2 document with `route` and `actions`. If
  the controller rejects it, the state rolls back to what is on screen.
- `runtime.dispatch(id, payload)` dispatches from code (LEAF, voice, timers)
  through the same checks, and runs now. Wrap it in the controller's
  `queueAction` when it must not outlive the current scene.

`ViroSpecsReferenceFlow.ts` is a complete example and `ViroSpecsActionsLab.ts`
runs it as a Lens component.

## Routes and scroll position

An `update` whose `route` differs from the committed scene's is navigation:
staged invisibly, committed, previous scene retired. The controller
remembers the scroll position of every scroll group under the route it
leaves and restores it when that route returns, so back navigation lands
where the wearer left the list. It keeps `maxRememberedRoutes` routes
(default 16; `VS5020` when it forgets one).

## Lifetimes

Actions never run synchronously inside an Interaction Kit callback. A
navigation or replacement between the pinch and the next frame retires the
scene and drops its queued actions with `VS5018`. A same-route patch keeps
them. Changing only a trigger's payload does not rebind SIK, because
triggers are read when the interaction arrives.

## Transport (optional)

`ViroSpecsActionRuntime` takes `forward(event)`, called for every accepted
action. Use it, or `addOnActionListener` directly, to send actions to a
phone app over any channel. When `forward` is set, a declared action with no
local handler is not reported (`VS5019`), because the receiver owns it.
Nothing in the runtime depends on a transport.

## Diagnostics

`VS5015` undeclared action, `VS5016` duplicate declaration or handler,
`VS5017` ill-typed payload (each rejects a scene, or drops a dispatch),
`VS5018` queued action dropped by navigation, `VS5019` no handler, `VS5020`
route memory full. See [LensHostDiagnostics.md](LensHostDiagnostics.md).

## Evidence

`portable-test-passed` only: `scripts/actions.test.mjs` (11 tests) and
`scripts/actions-fixtures.test.mjs` run the real controller, registry,
runtime and reference flow on the mock host (`pnpm specs:test-host`). Not
compiled in Lens Studio, not run in Preview, not run on SPECS hardware.
