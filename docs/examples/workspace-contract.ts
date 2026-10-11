import type { WorkspaceDefinition } from "@viro-external/xr-contract";

export const exampleWorkspace = {
  id: "explorer",
  maxPromotedSurfaces: 2,
  surfaces: [
    {
      id: "main", role: "main", presentation: { kind: "main" },
      fallback: { kind: "inline", region: "overlay" },
      requires: { kind: "none" },
      focus: { focus: "primary", back: "exit" },
      lifecycle: { owner: "workspace" },
    },
    {
      id: "discover", role: "discover",
      presentation: {
        kind: "window", size: { unit: "dp", width: 360, height: 600 },
        anchor: { side: "start", depth: "flush" }, priority: 30,
      },
      fallback: { kind: "inline", region: "leading" },
      requires: { kind: "none" },
      focus: { focus: "passive", back: "return-to-main" },
      lifecycle: { owner: "workspace" },
    },
    {
      id: "detail", role: "detail",
      presentation: {
        kind: "window", size: { unit: "dp", width: 420, height: 600 },
        anchor: { side: "end", depth: "near" }, priority: 20,
      },
      fallback: { kind: "inline", region: "trailing" },
      requires: { kind: "none" },
      focus: { focus: "take-on-open", back: "close" },
      lifecycle: { owner: "selection", selectionKey: "place" },
    },
  ],
} as const satisfies WorkspaceDefinition;
