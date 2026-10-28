// Reads the version of an installed Lens Studio package.
//
// Lens Studio stores an Asset Library package as a zip archive at
// Packages/<Name>.lspkg. The archive holds Package/Assets/package.native, a
// NativePackageDescriptor whose VersionMajor / VersionMinor / VersionPatch
// fields are the package version (the Packages/<Name>.lspkg.meta sidecar
// carries no version). An unpacked package is a folder with package.native at
// its root, normally Assets/<Name>.lspkg/.
import { open, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

const DESCRIPTOR_IN_ARCHIVE = "Package/Assets/package.native";

/**
 * @typedef {{ major: number, minor: number, patch: number, prerelease: (string | number)[] }} SemVer
 * @typedef {{ status: "ok", version: string, source: string }
 *   | { status: "missing" }
 *   | { status: "unreadable", source: string, reason: string }} InstalledPackage
 */

/**
 * Parses `MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]`.
 * @param {string} text
 * @returns {SemVer | undefined}
 */
export function parseSemver(text) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(text.trim());
  if (!match) return undefined;
  const prerelease = match[4]
    ? match[4].split(".").map((id) => (/^(0|[1-9]\d*)$/.test(id) ? Number(id) : id))
    : [];
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease };
}

/**
 * Semver 2.0.0 precedence: negative when a < b, 0 when equal, positive when a > b.
 * @param {string} a
 * @param {string} b
 */
export function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left) throw new Error("Not a semantic version: " + a);
  if (!right) throw new Error("Not a semantic version: " + b);
  for (const key of /** @type {const} */ (["major", "minor", "patch"])) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  // A version without a prerelease ranks above one with a prerelease.
  if (!left.prerelease.length || !right.prerelease.length) {
    return right.prerelease.length - left.prerelease.length;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index++) {
    const l = left.prerelease[index];
    const r = right.prerelease[index];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    if (l === r) continue;
    if (typeof l === "number" && typeof r === "number") return l - r;
    if (typeof l === "number") return -1;
    if (typeof r === "number") return 1;
    return l < r ? -1 : 1;
  }
  return 0;
}

/**
 * Version fields of a NativePackageDescriptor (package.native) as a semver
 * string. Throws with the reason when the fields are absent or negative.
 * @param {string} descriptor
 */
export function versionFromDescriptor(descriptor) {
  if (!/!<NativePackageDescriptor\//.test(descriptor)) {
    throw new Error("package.native is not a NativePackageDescriptor");
  }
  /** @param {string} field */
  const read = (field) => {
    const match = new RegExp("^\\s*" + field + ":\\s*(-?\\d+)\\s*$", "m").exec(descriptor);
    if (!match) throw new Error("package.native has no " + field);
    const value = Number(match[1]);
    if (value < 0) throw new Error("package.native has " + field + " " + value);
    return value;
  };
  return [read("VersionMajor"), read("VersionMinor"), read("VersionPatch")].join(".");
}

/**
 * Reads one entry from a zip archive without loading the whole archive.
 * Supports stored and deflated entries; zip64 archives are rejected.
 * @param {string} file
 * @param {string} entryName
 * @returns {Promise<Buffer>}
 */
export async function readZipEntry(file, entryName) {
  const handle = await open(file, "r");
  try {
    const { size } = await handle.stat();
    const tailLength = Math.min(size, 22 + 0xffff);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, size - tailLength);
    let eocd = -1;
    for (let index = tailLength - 22; index >= 0; index--) {
      if (tail.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
    }
    if (eocd < 0) throw new Error("not a zip archive (no end of central directory)");
    const entries = tail.readUInt16LE(eocd + 10);
    const directorySize = tail.readUInt32LE(eocd + 12);
    const directoryOffset = tail.readUInt32LE(eocd + 16);
    if (directoryOffset === 0xffffffff || entries === 0xffff) throw new Error("zip64 archives are not supported");
    const directory = Buffer.alloc(directorySize);
    await handle.read(directory, 0, directorySize, directoryOffset);
    let cursor = 0;
    for (let index = 0; index < entries; index++) {
      if (directory.readUInt32LE(cursor) !== 0x02014b50) throw new Error("corrupt zip central directory");
      const method = directory.readUInt16LE(cursor + 10);
      const compressedSize = directory.readUInt32LE(cursor + 20);
      const nameLength = directory.readUInt16LE(cursor + 28);
      const extraLength = directory.readUInt16LE(cursor + 30);
      const commentLength = directory.readUInt16LE(cursor + 32);
      const localOffset = directory.readUInt32LE(cursor + 42);
      const name = directory.toString("utf8", cursor + 46, cursor + 46 + nameLength);
      cursor += 46 + nameLength + extraLength + commentLength;
      if (name !== entryName) continue;
      const local = Buffer.alloc(30);
      await handle.read(local, 0, 30, localOffset);
      if (local.readUInt32LE(0) !== 0x04034b50) throw new Error("corrupt zip local header");
      const dataOffset = localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      const data = Buffer.alloc(compressedSize);
      await handle.read(data, 0, compressedSize, dataOffset);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error("unsupported zip compression method " + method);
    }
    throw new Error("archive has no " + entryName);
  } finally {
    await handle.close();
  }
}

/**
 * Finds a package in the project and reads its version. Looks at
 * Packages/<name> (archive or folder), then Assets/<name> (unpacked folder).
 * @param {string} project Lens Studio project folder
 * @param {string} name package file name, for example `Leaf.lspkg`
 * @returns {Promise<InstalledPackage>}
 */
export async function readInstalledPackage(project, name) {
  const candidates = [path.join(project, "Packages", name), path.join(project, "Assets", name)];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const source = path.relative(project, candidate);
    try {
      const info = await stat(candidate);
      let descriptor;
      if (info.isDirectory()) {
        const nested = [path.join(candidate, "package.native"), path.join(candidate, DESCRIPTOR_IN_ARCHIVE)];
        const found = nested.find((file) => existsSync(file));
        if (!found) throw new Error("folder has no package.native");
        descriptor = await readFile(found, "utf8");
      } else {
        descriptor = (await readZipEntry(candidate, DESCRIPTOR_IN_ARCHIVE)).toString("utf8");
      }
      return { status: "ok", version: versionFromDescriptor(descriptor), source };
    } catch (error) {
      return { status: "unreadable", source, reason: error instanceof Error ? error.message : String(error) };
    }
  }
  return { status: "missing" };
}
