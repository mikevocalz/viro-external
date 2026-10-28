/**
 * The only file in the Viro Specs Lens runtime that imports the Spectacles
 * Interaction Kit. Everything else imports these names from here.
 *
 * Asset Library 2.x ships the kit as `SpectaclesInteractionKit.lspkg`; the
 * 4.0.0 packages renamed it `InteractionKit.lspkg`. The specifiers below are
 * the 2.x ones. `pnpm specs:sync -- --interaction-kit 4` (or auto-detection
 * of `Packages/InteractionKit.lspkg`) rewrites the package prefix in this
 * file's synced copy, and `specs:doctor` checks that every path below exists
 * in the installed kit. See doc/Compatibility.md.
 */
export { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
export { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";
export { InteractionManager } from "SpectaclesInteractionKit.lspkg/Core/InteractionManager/InteractionManager";
export { InteractorInputType } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor";
export type { Interactor } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor";
export type { InteractorEvent } from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent";
export { setTimeout, clearTimeout } from "SpectaclesInteractionKit.lspkg/Utils/FunctionTimingUtils";
