// Throwaway Lens Studio project folders for specs:sync / specs:doctor tests.
// Packages are real zip archives shaped like Asset Library .lspkg files:
// Package/Assets/package.native holds a NativePackageDescriptor with
// VersionMajor / VersionMinor / VersionPatch, as Lens Studio 5.24 writes them.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

/** Versions installed in the validated Platform Lab project, read from each package.native (doc/Compatibility.md). */
export const VALIDATED_PACKAGES = {
  "SpectaclesInteractionKit.lspkg": "2.0.0",
  "SpectaclesUIKit.lspkg": "2.0.0",
  "SurfacePlacement.lspkg": "2.0.0",
  "VolumetricLine.lspkg": "2.0.0",
  "SpecsNavigationKit.lspkg": "2.0.0",
  "Leaf.lspkg": "2.0.2",
  "AiPreviewAgentInspect.lspkg": "2.0.1",
  "AiPreviewAgentInteract.lspkg": "2.0.1",
};

/** @param {string} version `MAJOR.MINOR.PATCH[-PRERELEASE]` */
export function nativePackageDescriptor(version) {
  const dash = version.indexOf("-", 1);
  const [major, minor, patch] = (dash < 0 ? version : version.slice(0, dash)).split(".");
  const prerelease = dash < 0 ? "" : version.slice(dash + 1);
  return [
    "- !<NativePackageDescriptor/18b4474d-abe9-4f6a-ba18-ddbbd71d8a64>",
    '  PackagePath: ""',
    "  StudioVersion:",
    "    major: 5",
    "    minor: 24",
    "    patch: 0",
    `  VersionMajor: ${major}`,
    `  VersionMinor: ${minor}`,
    `  VersionPatch: ${patch}`,
    "  PackagePolicy: CanBeUnpackedTransparent",
    `  VersionPrerelease: "${prerelease}"`,
    "  AssetLibraryDependencyStructure: !<AssetLibraryDependencyStructure>",
    "    Version:",
    "      major: -1",
    "      minor: -1",
    "      patch: -1",
    "",
  ].join("\n");
}

/**
 * Minimal zip writer (deflate entries, no zip64).
 * @param {Record<string, string>} entries name -> content
 */
export function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const raw = Buffer.from(text);
    const data = deflateRawSync(raw);
    const nameBytes = Buffer.from(name);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/** A packed .lspkg archive at the given version. */
export function lspkg(version) {
  return zip({ "Package/Assets/README.md": "fixture\n", "Package/Assets/package.native": nativePackageDescriptor(version) });
}

/**
 * Creates a Lens project folder.
 * @param {{
 *   packages?: Record<string, string | Buffer>,
 *   studio?: string,
 *   prefix?: string,
 * }} [options] `packages` maps a package file name to a version string
 *   (written as a real archive) or raw bytes (for corrupt archives)
 */
export function lensProject({ packages = VALIDATED_PACKAGES, studio = "5.24.0", prefix = "viro-specs-lens-" } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  mkdirSync(path.join(root, "Assets"));
  mkdirSync(path.join(root, "Packages"));
  const [major, minor, patch] = studio.split(".");
  writeFileSync(path.join(root, "Lab.esproj"), `studioVersion:\n  major: ${major}\n  minor: ${minor}\n  patch: ${patch}\ntargetPlatform: Spectacles\n`);
  for (const [name, value] of Object.entries(packages)) {
    writeFileSync(path.join(root, "Packages", name), typeof value === "string" ? lspkg(value) : value);
    writeFileSync(path.join(root, "Packages", name + ".meta"), "- !<AssetImportMetadata/00000000-0000-0000-0000-000000000000>\n  ImporterName: NativePackageImporter\n");
  }
  return root;
}
