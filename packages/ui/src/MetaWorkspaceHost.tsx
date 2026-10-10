import React from "react";
import type { MetaWorkspaceResolution } from "../../meta-layout/src/resolveMetaWorkspace";
import type { MetaWindowProps } from "../../meta-layout/src/metaWindowTypes";

/**
 * Presentation components are supplied by the application so it can install
 * the Meta Layout SDK as optional platform peers and configure Expo CNG.
 * Pass ViroSpatialSceneProvider and ViroSpatialWindow from the Viro fork.
 * This wrapper does not fake OS promotion on unsupported platforms.
 */
export type MetaWorkspaceHostProps = {
  plan: MetaWorkspaceResolution;
  SpatialSceneProvider: React.ComponentType<{ children?: React.ReactNode }>;
  SpatialWindow: React.ComponentType<MetaWindowProps & { children?: React.ReactNode }>;
  renderSurface: (id: string) => React.ReactNode;
};

export function MetaWorkspaceHost({
  plan, SpatialSceneProvider, SpatialWindow, renderSurface,
}: MetaWorkspaceHostProps): React.ReactElement {
  return (
    <SpatialSceneProvider>
      {plan.entries.map((entry) => {
        const children = renderSurface(entry.surface.id);
        if (entry.kind === "window") {
          return (
            <SpatialWindow key={entry.surface.id} {...entry.window}>
              {children}
            </SpatialWindow>
          );
        }
        // Main and inline fallback use the app's existing RN layout region.
        return <React.Fragment key={entry.surface.id}>{children}</React.Fragment>;
      })}
    </SpatialSceneProvider>
  );
}
