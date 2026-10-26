# Mobbin: pen and input settings (MusePenInput pairing, handedness)

Status: **run** 2026-10-24 through the Mobbin MCP.

| Query | Tool | Platform | Result |
| --- | --- | --- | --- |
| "stylus settings" | `search_screens` | iOS | 5 screens; 2 relevant (no stylus-specific screen returned) |
| "pair device" | `search_flows` | iOS | 3 flows; all relevant |

## References

| # | App | Link | What it shows |
| --- | --- | --- | --- |
| 1 | WHOOP | https://mobbin.com/flows/381a9375-b5c7-45fa-b2de-bf0872f17b6f | Pairing: "Check for Pairing Mode" with a picture of the light to look for, a "Not seeing the blue light?" help link, then "CONNECTING" with the device's ID |
| 2 | Withings Health Mate | https://mobbin.com/flows/fc7f5fea-6e8b-4b8f-963f-ea76d8c311f2 | Choose the product, "Pair your scale to your phone" with one Pair button, then a check on the device image |
| 3 | SmartThings | https://mobbin.com/flows/2dc9a169-0590-444c-b9b5-3cbdb75b06ae | Adding a device: available devices list, "Processing…", then "Verify your device" with an instruction on the device |
| 4 | Google Health (Fitbit) | https://mobbin.com/screens/c081035c-2d35-4087-bbe9-de8b1c37ef66 | "Wrist preference: Non-dominant" with a one-line helper |
| 5 | Mindtrip | https://mobbin.com/screens/f75c43d3-ef96-4094-8610-508689707a64 | Single-choice list where each option has a one-line description and a check |

## Adopted

- Tell the person what to do with the device and what to look for (WHOOP). Copy: "Turn your pen on and hold it near the headset."
- One primary action per step (Withings). Pairing is one button, then a result.
- A help line for the common failure (WHOOP's "Not seeing the blue light?"). Pen equivalent goes in the failure copy: "Check it's turned on, then try again."
- Handedness as a single setting with a helper that says what it changes (Fitbit, Mindtrip). Copy: "I write with my" / "Left hand" / "Right hand".

## Rejected

- Multi-step onboarding around pairing (SmartThings is 22 screens). Pairing a pen should be one panel with three states.
- Showing a device serial during connect (WHOOP): meaningless to a child.

## 2D to spatial

| 2D pattern | Spatial translation |
| --- | --- |
| Full-screen pairing flow | One settings panel in a side slot; the board stays visible and usable with controller or hand during pairing |
| Device photo | Pen illustration only if the hardware is known; otherwise text only, never a fake device |
| Connecting animation | Status line "Looking for your pen…", static when reduced motion is on |
| Handedness picker | Two large keys; changing it mirrors the strip (when that ships) without moving the paper |

Note: no pen, stylus, pairing or handedness copy exists in MoyoLearn or viro-external today. All copy for this screen is new and listed in `../copy/whiteboard-copy.md` §6.
