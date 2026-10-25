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
   * Reads a local file, given as a `file:///` URL or an absolute path. Any
   * regular file the app process can read is accepted; in practice that is
   * the app's own files and cache directories and files bundled or
   * downloaded there. To load from `http(s)`, fetch the bytes in JS and call
   * {@linkcode RiveFile.fromBytes}; `content://` and `asset://` URLs are not
   * read either.
   *
   * Rejects under the same conditions as `fromBytes`, for a path with a NUL
   * byte or a `..` segment (escaped or not), for a directory, FIFO or
   * device, and when the file cannot be read.
   */
  static fromFileURL(fileURL: string): Promise<RiveFile>;

  /** Size of the file in bytes. */
  readonly byteLength: number;
}
