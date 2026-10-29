/**
 * The only file in the Viro Specs Lens runtime that imports the Navigation
 * Kit. Everything else imports these names from here.
 *
 * Asset Library 2.x ships the kit as `SpecsNavigationKit.lspkg`; the 4.0.0
 * packages renamed it `NavigationKit.lspkg`. The specifiers below are the 2.x
 * ones. `pnpm specs:sync` rewrites the package prefix in this file's synced
 * copy together with ViroSpecsInteractionKit.ts, and `specs:doctor` checks
 * that every path below exists in the installed kit. See doc/Compatibility.md.
 */
export { GeoLocationPlace } from "SpecsNavigationKit.lspkg/NavigationDataComponent/GeoLocationPlace";
export { NavigationDataComponent } from "SpecsNavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent";
