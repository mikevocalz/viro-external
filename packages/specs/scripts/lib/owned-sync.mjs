// Writes SDK-owned files into a Lens Studio Assets folder without disturbing
// what Lens Studio or the user owns there.
//
// Lens Studio keeps each asset's identity (its UUID, which scene references
// point at) in the sidecar `<file>.meta`. Deleting and recreating a script, or
// deleting its .meta, gives it a new identity and breaks every reference. So:
//
// - each file is replaced by writing a temp file in the same folder and
//   renaming it over the old one; the .meta next to it is never opened;
// - a ledger (viro-specs.owned.json) records the sha256 of every file the SDK
//   wrote; a file whose current hash differs from the ledger was edited by the
//   user and is kept unless the caller forces that path;
// - a file the SDK no longer ships is deleted only when the ledger lists it and
//   it is unmodified. Unlisted files and .meta files are never touched.
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { LEDGER_FILE } from "./lens-runtime-manifest.mjs";

/**
 * @typedef {{
 *   schemaVersion: 1,
 *   generatedBy: string,
 *   sdkVersion: string,
 *   profile: string,
 *   files: Record<string, string>,
 * }} OwnershipLedger
 *
 * @typedef {{
 *   written: string[],
 *   unchanged: string[],
 *   adopted: string[],
 *   forced: string[],
 *   keptModified: string[],
 *   keptUnowned: string[],
 *   removed: string[],
 *   keptStaleModified: string[],
 * }} SyncReport
 */

/** @param {string | Buffer} content */
export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Replaces `file` with `content` through a same-folder temp file and rename,
 * so readers never see a partial file and the path is never absent.
 * @param {string} file
 * @param {string | Buffer} content
 */
export async function writeFileAtomic(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`);
  try {
    await writeFile(temporary, content);
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

/**
 * @param {string} root synced folder, for example <project>/Assets/ViroSpecs
 * @returns {Promise<OwnershipLedger | undefined>} undefined when no ledger exists
 */
export async function readLedger(root) {
  const file = path.join(root, LEDGER_FILE);
  if (!existsSync(file)) return undefined;
  let ledger;
  try {
    ledger = JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new Error(`${file} is not valid JSON. Restore it from version control, or delete it and resync with --adopt-existing.`);
  }
  if (ledger?.schemaVersion !== 1 || typeof ledger.files !== "object" || ledger.files === null) {
    throw new Error(`${file} has an unsupported format (schemaVersion ${ledger?.schemaVersion}).`);
  }
  return ledger;
}

/**
 * Hash of the file at `root/relative`, or undefined when absent.
 * @param {string} root
 * @param {string} relative
 */
async function currentHash(root, relative) {
  const file = path.join(root, relative);
  return existsSync(file) ? sha256(await readFile(file)) : undefined;
}

/**
 * Brings `root` in line with `desired`.
 * @param {{
 *   root: string,
 *   desired: Map<string, string | Buffer>,
 *   sdkVersion: string,
 *   profile: string,
 *   forceOverwrite?: Set<string>,
 *   adoptExisting?: boolean,
 * }} options `desired` maps paths relative to `root` (forward slashes) to content
 * @returns {Promise<SyncReport>}
 */
export async function syncOwnedFolder({ root, desired, sdkVersion, profile, forceOverwrite = new Set(), adoptExisting = false }) {
  for (const relative of desired.keys()) {
    if (relative === LEDGER_FILE || relative.endsWith(".meta") || relative.includes("..") || path.isAbsolute(relative)) {
      throw new Error("Refusing to sync reserved or unsafe path: " + relative);
    }
  }
  const previous = (await readLedger(root))?.files ?? {};
  /** @type {Record<string, string>} */
  const next = {};
  /** @type {SyncReport} */
  const report = { written: [], unchanged: [], adopted: [], forced: [], keptModified: [], keptUnowned: [], removed: [], keptStaleModified: [] };

  for (const [relative, content] of [...desired.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const target = path.join(root, relative);
    const wanted = sha256(content);
    const found = await currentHash(root, relative);
    const recorded = previous[relative];
    if (found === undefined) {
      await writeFileAtomic(target, content);
      next[relative] = wanted;
      report.written.push(relative);
    } else if (found === wanted) {
      next[relative] = wanted;
      (recorded === undefined ? report.adopted : report.unchanged).push(relative);
    } else if (forceOverwrite.has(relative)) {
      await writeFileAtomic(target, content);
      next[relative] = wanted;
      report.forced.push(relative);
    } else if (recorded !== undefined && found === recorded) {
      await writeFileAtomic(target, content);
      next[relative] = wanted;
      report.written.push(relative);
    } else if (recorded === undefined && adoptExisting) {
      await writeFileAtomic(target, content);
      next[relative] = wanted;
      report.adopted.push(relative);
    } else if (recorded !== undefined) {
      // Edited by the user. Keep it, and keep the old hash so the next sync
      // and specs:doctor still see the edit.
      next[relative] = recorded;
      report.keptModified.push(relative);
    } else {
      // A file at an SDK path that no ledger ever recorded: a project synced
      // before the ledger existed, or the user's own file.
      report.keptUnowned.push(relative);
    }
  }

  for (const [relative, recorded] of Object.entries(previous)) {
    if (desired.has(relative)) continue;
    const found = await currentHash(root, relative);
    if (found === undefined) continue;
    if (found === recorded) {
      await unlink(path.join(root, relative));
      report.removed.push(relative);
    } else {
      // The SDK dropped it, but the user changed it: it is theirs now.
      report.keptStaleModified.push(relative);
    }
  }

  /** @type {OwnershipLedger} */
  const ledger = {
    schemaVersion: 1,
    generatedBy: "@viro-external/specs",
    sdkVersion,
    profile,
    files: Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b))),
  };
  await writeFileAtomic(path.join(root, LEDGER_FILE), JSON.stringify(ledger, null, 2) + "\n");
  return report;
}

/**
 * Compares a synced folder with its ledger.
 * @param {string} root
 * @returns {Promise<{ ledger: OwnershipLedger | undefined, missing: string[], modified: string[] }>}
 */
export async function auditOwnedFolder(root) {
  const ledger = await readLedger(root);
  const missing = [];
  const modified = [];
  for (const [relative, recorded] of Object.entries(ledger?.files ?? {})) {
    const found = await currentHash(root, relative);
    if (found === undefined) missing.push(relative);
    else if (found !== recorded) modified.push(relative);
  }
  return { ledger, missing, modified };
}
