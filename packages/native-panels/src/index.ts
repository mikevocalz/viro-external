// Public surface for @viro-external/native-panels.
// Specs are imported as types only: their decorators are not parseable by the
// stock React Native Babel preset, and the runtime classes come from the
// nitrogen-generated `#nitro/*` modules.
import "react-native-nitro-modules";

export type { WhiteboardRenderer } from "./specs/WhiteboardRenderer.nitro";
export type { WhiteboardRendererFactory } from "./specs/WhiteboardRendererFactory.nitro";
export type { BoardCamera } from "./specs/BoardCamera";
export type { ListenerSubscription } from "./specs/ListenerSubscription";
export type { WhiteboardRendererOptions } from "./specs/WhiteboardRendererOptions";
export type { WhiteboardRendererState } from "./specs/WhiteboardRendererState";

export { resolveWhiteboardRendererFactory } from "./whiteboard/resolveWhiteboardRendererFactory";
export { createWhiteboardRendererBinding } from "./whiteboard/createWhiteboardRendererBinding";
export { createInkOutlineEncoder, type InkOutlineEncoder } from "./whiteboard/createInkOutlineEncoder";
export { useWhiteboardRenderer } from "./whiteboard/useWhiteboardRenderer";
export type { UseWhiteboardRendererOptions } from "./whiteboard/UseWhiteboardRendererOptions";
export type { WhiteboardRendererBinding } from "./whiteboard/WhiteboardRendererBinding";
export type { WhiteboardRendererBindingOptions } from "./whiteboard/WhiteboardRendererBindingOptions";
export type { WhiteboardRendererStatus } from "./whiteboard/WhiteboardRendererStatus";
export type { WhiteboardRendererTarget } from "./whiteboard/WhiteboardRendererTarget";
