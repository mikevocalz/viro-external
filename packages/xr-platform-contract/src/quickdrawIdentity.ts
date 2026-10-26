import type { NativeQuickDrawSpatialAdapter } from "./quickdraw";

/**
 * The process that hosts the board's drawing code.
 *
 * - `esiku`: an ESIKU-compiled host renders into an ESIKU external render target.
 * - `viro-native`: native code in this app draws into a Surface Viro owns
 *   (`@viro-external/native-panels`, ADR 0001 D2).
 * - `webview`: the board runs as HTML in a WebView whose view is re-parented
 *   into a Viro texture.
 *
 * @see {@linkcode QuickDrawSurfaceIdentity.host}
 */
export type QuickDrawSurfaceHost = "esiku" | "viro-native" | "webview";

/**
 * The library and graphics path that rasterizes board content.
 *
 * - `esiku`: ESIKU's renderer.
 * - `android-hwui-canvas`: `android.graphics.Canvas` from `Surface.lockHardwareCanvas()`,
 *   GPU-rendered by HWUI.
 * - `webview-canvas2d`: QuickDraw's own Canvas2D drawing inside the WebView.
 *
 * @see {@linkcode QuickDrawSurfaceIdentity.backend}
 */
export type QuickDrawDrawingBackend = "esiku" | "android-hwui-canvas" | "webview-canvas2d";

/**
 * Who allocates and owns the GPU texture Viro samples.
 *
 * - `esiku`: an ESIKU external render target.
 * - `viro-canvas-surface`: the Surface Viro's `canvasSource` material creates
 *   and hands out through its `CanvasSurfaces` registry.
 * - `viro-android-view-texture`: `com.viro.core.AndroidViewTexture` wrapping an Android view.
 *
 * @see {@linkcode QuickDrawSurfaceIdentity.textureOwner}
 */
export type QuickDrawTextureOwner = "esiku" | "viro-canvas-surface" | "viro-android-view-texture";

/**
 * What draws a QuickDraw board and who owns what, stated separately so no
 * host can borrow another's name.
 *
 * The editor authority is always QuickDraw's `Store`: records, transactions,
 * undo and remote diffs. Hosts and backends only draw a derived copy.
 *
 * @see {@linkcode NativeQuickDrawSpatialAdapter}
 * @see {@linkcode resolveQuickDrawSurfaceIdentity}
 */
export interface QuickDrawSurfaceIdentity {
  /** The document and history authority. */
  readonly editorAuthority: "quickdraw-store";
  readonly host: QuickDrawSurfaceHost;
  readonly backend: QuickDrawDrawingBackend;
  readonly textureOwner: QuickDrawTextureOwner;
}

/** The identity the deprecated `renderer: "esiku"` declaration stands for. */
export const ESIKU_QUICKDRAW_IDENTITY: QuickDrawSurfaceIdentity = {
  editorAuthority: "quickdraw-store",
  host: "esiku",
  backend: "esiku",
  textureOwner: "esiku",
};

/** Identity of the WebView board MoyoLearn ships today (HTML in `react-native-webview`, re-parented into `AndroidViewTexture`). */
export const WEBVIEW_QUICKDRAW_IDENTITY: QuickDrawSurfaceIdentity = {
  editorAuthority: "quickdraw-store",
  host: "webview",
  backend: "webview-canvas2d",
  textureOwner: "viro-android-view-texture",
};

/** Identity of the native board in `@viro-external/native-panels` on Android. */
export const VIRO_NATIVE_QUICKDRAW_IDENTITY: QuickDrawSurfaceIdentity = {
  editorAuthority: "quickdraw-store",
  host: "viro-native",
  backend: "android-hwui-canvas",
  textureOwner: "viro-canvas-surface",
};

const HOSTS: readonly QuickDrawSurfaceHost[] = ["esiku", "viro-native", "webview"];
const BACKENDS: readonly QuickDrawDrawingBackend[] = ["esiku", "android-hwui-canvas", "webview-canvas2d"];
const OWNERS: readonly QuickDrawTextureOwner[] = ["esiku", "viro-canvas-surface", "viro-android-view-texture"];

/**
 * Returns the adapter's {@linkcode QuickDrawSurfaceIdentity}.
 *
 * An adapter with only the deprecated `renderer: "esiku"` resolves to
 * {@linkcode ESIKU_QUICKDRAW_IDENTITY}.
 *
 * @throws TypeError when the adapter declares neither field, or a field holds
 *   a value this contract does not define.
 * @throws RangeError when `renderer: "esiku"` is combined with an identity
 *   whose host, backend or texture owner is not ESIKU. Remove `renderer`.
 */
export function resolveQuickDrawSurfaceIdentity(
  adapter: Pick<NativeQuickDrawSpatialAdapter, "identity" | "renderer">,
): QuickDrawSurfaceIdentity {
  const { identity, renderer } = adapter;
  if (renderer !== undefined && renderer !== "esiku") {
    throw new TypeError(`renderer must be "esiku" or absent, got ${String(renderer)}`);
  }
  if (identity === undefined) {
    if (renderer === "esiku") return ESIKU_QUICKDRAW_IDENTITY;
    throw new TypeError("QuickDraw adapter declares no identity; set `identity`");
  }
  if (identity.editorAuthority !== "quickdraw-store") {
    throw new TypeError(`editorAuthority must be "quickdraw-store", got ${String(identity.editorAuthority)}`);
  }
  if (!HOSTS.includes(identity.host)) throw new TypeError(`unknown host ${String(identity.host)}`);
  if (!BACKENDS.includes(identity.backend)) throw new TypeError(`unknown backend ${String(identity.backend)}`);
  if (!OWNERS.includes(identity.textureOwner)) {
    throw new TypeError(`unknown textureOwner ${String(identity.textureOwner)}`);
  }
  if (
    renderer === "esiku" &&
    (identity.host !== "esiku" || identity.backend !== "esiku" || identity.textureOwner !== "esiku")
  ) {
    throw new RangeError(
      `renderer "esiku" contradicts identity { host: ${identity.host}, backend: ${identity.backend}, ` +
        `textureOwner: ${identity.textureOwner} }; remove the deprecated renderer field`,
    );
  }
  return identity;
}
