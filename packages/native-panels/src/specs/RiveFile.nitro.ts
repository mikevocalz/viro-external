import { Android, type HybridObject } from "nitro-core";
import type { RivePanel } from "./RivePanel.nitro";
import type { RivePanelOptions } from "./RivePanelOptions";

export * from "#nitro/RiveFile";

/**
 * The bytes of one `.riv` file, ready to hand to {@linkcode RivePanel.create}
 * through {@linkcode RivePanelOptions.file} or to
 * {@linkcode RivePanel.setFile}. Parsing happens on each panel's render
 * thread, so one file can feed several panels.
 *
 * Rive's object model beyond artboard, state machine and the default
 * view-model instance (view-model enumeration, enums, lists, images) is not
 * exposed by the native producer yet.
 *
 * @platform android
 */
@Android({
  language: "c++",
  implementation: { className: "HybridRiveFile", include: '"HybridRiveFile.hpp"' },
})
export declare class RiveFile extends HybridObject {
  /**
   * Copies `bytes`. Rejects when the buffer is empty, larger than 64 MiB, or
   * does not start with the `RIVE` file signature.
   */
  static fromBytes(bytes: ArrayBuffer): Promise<RiveFile>;

  /**
   * Reads a local file, given as a `file://` URL or an absolute path. To load
   * from `http(s)`, fetch the bytes in JS and call
   * {@linkcode RiveFile.fromBytes}. Rejects under the same conditions as
   * `fromBytes`, or when the file cannot be read.
   */
  static fromFileURL(fileURL: string): Promise<RiveFile>;

  /** Size of the file in bytes. */
  readonly byteLength: number;
}
