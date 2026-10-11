import React from "react";
import {
  PanelText,
  SpatialPanel,
  SpatialWorkspaceFrame,
  type SpatialWorkspaceOrigin,
} from "@viro-external/ui";

type Props = {
  origin: SpatialWorkspaceOrigin;
  epoch: number;
  selectedTitle: string | null;
  onCloseDetails: () => void;
};

/** Render inside the application's existing Viro scene. State remains app-owned. */
export function SpatialWorkspaceExample({
  origin, epoch, selectedTitle, onCloseDetails,
}: Props): React.ReactElement {
  return (
    <SpatialWorkspaceFrame key={epoch} {...origin}>
      <SpatialPanel title="Discover" curved snapTo="left" showCloseAction={false}>
        <PanelText text="Choose an item in your application" width={1.3} height={0.6} />
      </SpatialPanel>
      <SpatialPanel title="Workspace" snapTo="center" showCloseAction={false}>
        <PanelText text="Primary task" width={1.3} height={0.6} />
      </SpatialPanel>
      {selectedTitle !== null ? (
        <SpatialPanel
          key={selectedTitle}
          title="Inspector"
          curved
          curvature={0.24}
          snapTo="right"
          onClose={onCloseDetails}
        >
          <PanelText text={selectedTitle} width={1.3} height={0.6} />
        </SpatialPanel>
      ) : null}
    </SpatialWorkspaceFrame>
  );
}
