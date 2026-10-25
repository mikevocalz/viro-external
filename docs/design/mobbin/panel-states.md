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
