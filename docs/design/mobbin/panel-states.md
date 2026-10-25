# Mobbin: panel states (loading, empty, error, surface lost, layer evicted)

Status: **run** 2026-10-24 through the Mobbin MCP.

| Query | Tool | Platform | Result |
| --- | --- | --- | --- |
| "empty state canvas" | `search_screens` | web | 5 screens; 2 relevant |
| "error state retry" | `search_screens` | iOS | 5 screens; 3 relevant |

No 2D reference exists for "surface lost" or "layer evicted"; those are spatial-only states, specified in the handoff doc.

## References

| # | App | Link | What it shows |
| --- | --- | --- | --- |
| 1 | fal | https://mobbin.com/screens/67e82d0f-ef86-4de0-9fe5-12edb9ac347e | Quiet empty canvas: small icon, "No generations yet", one line of instruction, input below |
| 2 | Delphi | https://mobbin.com/screens/09d6905d-2811-4380-b5c5-5e7f1ec352d8 | Empty state with one title, one line and one action |
| 3 | Bevel | https://mobbin.com/screens/ce3d6d39-0356-43a0-be24-cd8bcf302c6f | Inline error inside the content ("Something Went Wrong", cause, Retry) while the rest of the screen stays usable |
| 4 | Fly Delta | https://mobbin.com/screens/d230011e-a4a3-4daa-8ec1-08d9a38bbc52 | Error that names the action ("Passport Scan Unsuccessful"), says what to change, and offers "Retry Scan" |
| 5 | Noom | https://mobbin.com/screens/46a84752-17ac-441b-b955-02f3a9ac5f34 | "We couldn't process your photo", what to check, "Try again" |

## Adopted

- The empty state is quiet and lives on the canvas (fal). Empty board copy: "Write anywhere on the paper." on the paper, nothing else.
- Errors stay inside the panel that failed and leave everything else live (Bevel). A lost surface replaces only the paper; the strip and grip keep working.
- The retry names what it retries (Fly Delta). "Try again" is fine when the panel title already says what failed.

## Rejected

- Illustrations in empty states (Delphi, Higgsfield from the same run). They compete with the learner's first mark and add a texture to sample at 2.6 m.
- Full-screen error takeovers (Noom). In a headset a full takeover hides the room and the learner's work.

## 2D to spatial

| 2D state | Spatial translation |
| --- | --- |
| Empty | Plain paper with one line of copy, removed on the first mark |
| Loading | `'Getting your board ready'` on the face, no spinner over the paper |
| Inline error + retry | Error copy on the paper window; strip stays live; retry key in the strip |
| (none) Surface lost | "Redrawing your board…" on the paper while it rebuilds from the Store |
| (none) Layer evicted | No visible change: scene-mesh fallback with identical texture and corners |

## Pass 2 (2026-10-25)

Re-run of the same queries through the Mobbin MCP for the device-validation lane. The five references above still apply.

| Query | Tool | Platform | Result |
| --- | --- | --- | --- |
| "empty state canvas" | `search_screens` | web | 6 screens; fal and Delphi repeat; no new relevant screen (Plane, Recraft, Higgsfield and MagicPath use illustrations or start-cards, already rejected) |
| "error state retry" | `search_screens` | iOS | 6 screens; 1 new and relevant (Perplexity); Bevel, Fly Delta and Noom repeat |

| # | App | Link | What it shows |
| --- | --- | --- | --- |
| 6 | Perplexity | https://mobbin.com/screens/53c1cd17-3832-45bf-adcc-d86bd15c7a15 | Error as a small card in the content area, one sentence and a "Try again" link, the search field above it still live |

Adopted: the error sits where the content failed and the controls around it stay usable (Perplexity), the same rule as Bevel in the first pass.

Rejected from this run: bottom-sheet errors (Trainline, Klarna). A sheet rising over the board covers the learner's work, the same reason Noom's full-screen error was rejected.

## Held up on device?

**Not yet run.** Checks run in `../../validation/session-plan.md` on Quest 3S and PICO 4 Ultra. Surface lost and layer evicted have no 2D reference, so they are checked against the handoff spec.

| State | Device check | Quest 3S | PICO 4 Ultra |
| --- | --- | --- | --- |
| Empty | One line on the paper, readable at 2.6 m, gone after the first mark | not yet run | not yet run |
| Loading | Copy on the face, no spinner over the paper | not yet run | not yet run |
| Inline error + retry | Error on the paper window; strip and grip still work | not yet run | not yet run |
| Surface lost | "Redrawing your board…" shows, then the same document returns | not yet run | not yet run |
| Layer evicted | No visible change across the eviction (continuous video) | not yet run | not yet run |
