#!/usr/bin/env node
// Sets up a Lens Studio project for the Viro Specs runtime through the Lens
// Studio MCP server, so nothing is wired in the Inspector by hand.
//
//   pnpm specs:setup -- --project /abs/LensProject [--create] [--steps a,b] [--evidence <dir>]
//
// Steps, in order (default: all):
//   preflight  the open project is --project (--create saves a new Spectacles project there)
//   packages   installs the pinned 2.x packages (and AI Preview Agent Inspect 2.0.1) when missing
//   sync       copies the Lens runtime into Assets/ViroSpecs (specs:sync), then specs:doctor
//   device     Preview: SPECS device, Interactive input, Sunlit Room
//   recompile  TypeScript recompile; fails on any error
//   materials  creates the registry and experience-layer materials
//   wire       camera, Interaction Kit prefab, ViroSpecsRuntime with registry,
//              ViroSpecsSceneControllerHost, ViroGeneratedSceneHost and the experience layer
//   preview    refreshes Preview; fails on any error or VS5xxx error line; saves a capture
//
// The generated host (Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts)
// must exist before recompile and wire: compile it between sync and recompile
// (the viro starter's `npm run lens:setup` does).
//
// Lens Studio must be running with its MCP server enabled (AI Assistant > AI
// Model Context Protocol > Configure Server). The URL and bearer key come from
// LENS_STUDIO_MCP_URL / LENS_STUDIO_MCP_TOKEN, or from the MCP config file
// named by LENS_STUDIO_MCP_CONFIG.
//
// Evidence: this reaches lens-compiled (recompile) and a Preview run. It
// never produces hardware evidence.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "./lib/lens-runtime-manifest.mjs";
import { LensStudioMcp } from "./lib/lens-studio-mcp.mjs";
import { syncLensRuntime } from "./sync-lens-runtime.mjs";
import { runDoctor } from "./doctor-lens-project.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

// device runs before recompile and wire: switching Preview to a SPECS device
// reloads the Lens, and a reload right after wiring ran without the camera's
// new DeviceTracking component (SIK threw "main camera is currently missing a
// 'Device Tracking Component'" on the first refresh only).
export const SETUP_STEPS = ["preflight", "packages", "sync", "device", "recompile", "materials", "wire", "preview"];

/**
 * Asset Library entries for the validated 2.x line: `search` is the Asset
 * Library name, `file` the package file under Packages/ (the name the
 * runtime imports), `version` the pinned version.
 */
export const SETUP_PACKAGES = [
  { search: "SpectaclesInteractionKit", file: "SpectaclesInteractionKit", version: "2.0.0" },
  { search: "SpectaclesUIKit", file: "SpectaclesUIKit", version: "2.0.0" },
  { search: "Surface Placement", file: "SurfacePlacement", version: "2.0.0" },
  { search: "Volumetric Line", file: "VolumetricLine", version: "2.0.0" },
  { search: "Navigation Kit", file: "SpecsNavigationKit", version: "2.0.0" },
  // The preview step's capture needs AgentInspectScript. Without a copy in the
  // project, Lens Studio's MCP server installs the newest one, 4.0.0, which
  // imports the 4.0.0 UI Kit name and breaks a 2.x project's compile.
  { search: "AiPreviewAgentInspect", name: "AI Preview Agent \u2013 Inspect", file: "AiPreviewAgentInspect", version: "2.0.1" },
];

/** Materials the wire step assigns, created from Lens Studio presets. */
export const SETUP_MATERIALS = [
  { name: "ViroPlaceholder", preset: "UnlitMaterialPreset" },
  { name: "ViroDefaultMaterial", preset: "SimplePBRMaterialPreset" },
  { name: "ViroDefaultLine", preset: "UnlitMaterialPreset" },
  { name: "ViroImageMaterial", preset: "ImageMaterialPreset" },
  { name: "ViroExperiencePanel", preset: "UnlitMaterialPreset" },
];
const MATERIALS_FOLDER = "ViroSpecsSetup/Materials";

const USAGE = "Usage: specs:setup -- --project /abs/LensProject [--create] [--steps " + SETUP_STEPS.join(",") + "] [--evidence <dir>] [--room <name>]";

/** @param {string[]} argv */
export function parseSetupArgs(argv) {
  /** @type {{ project?: string, create: boolean, steps: string[], evidence?: string, room: string }} */
  const options = { create: false, steps: SETUP_STEPS, room: "Sunlit Room" };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const value = () => {
      const next = argv[++index];
      if (next === undefined || next.startsWith("--")) throw new Error(`${arg} requires a value.\n${USAGE}`);
      return next;
    };
    if (arg === "--") continue;
    else if (arg === "--project") options.project = path.resolve(value());
    else if (arg === "--create") options.create = true;
    else if (arg === "--evidence") options.evidence = path.resolve(value());
    else if (arg === "--room") options.room = value();
    else if (arg === "--steps") {
      const steps = value().split(",").map((step) => step.trim()).filter(Boolean);
      const unknown = steps.filter((step) => !SETUP_STEPS.includes(step));
      if (unknown.length) throw new Error(`Unknown step ${unknown.join(", ")}. Steps: ${SETUP_STEPS.join(", ")}.`);
      options.steps = SETUP_STEPS.filter((step) => steps.includes(step));
    } else throw new Error(`Unknown argument ${arg}.\n${USAGE}`);
  }
  if (!options.project) throw new Error(USAGE);
  return options;
}

/**
 * Error and VS5xxx error lines of a Preview log collection. Warnings such as
 * VS5008 (approximated maxLines) are not failures; Lens Studio's own
 * renderer notices (W lines that are not script output) are ignored.
 * @param {{ errors?: string[], prints?: string[] }} logs
 */
export function previewFailures(logs) {
  const lines = [...(logs.errors ?? []), ...(logs.prints ?? [])];
  const failures = lines.filter((line) => /\berror VS5\d{3}\b/.test(line) || /^E\s/.test(line) || /\b(TypeError|ReferenceError|SyntaxError)\b/.test(line));
  // Preview does not run scripts until TypeScript compiles; that is not a pass.
  if (/TypeScript is not compiled|a script failed to compile/.test(logs.tail ?? "")) {
    failures.push("Preview did not run the Lens scripts: TypeScript is not compiled.");
  }
  return failures;
}

/** @param {ReturnType<typeof parseSetupArgs>} options */
export async function runSetup(options, log = (line) => console.log(line)) {
  const project = /** @type {string} */ (options.project);
  const evidence = options.evidence ?? path.join(project, "ViroSpecsSetupEvidence");
  mkdirSync(evidence, { recursive: true });
  const save = (name, data) => writeFileSync(path.join(evidence, name), typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n");
  const esproj = () => {
    const file = existsSync(project) ? readdirSync(project).find((name) => name.endsWith(".esproj")) : undefined;
    return file ? path.join(project, file) : path.join(project, path.basename(project) + ".esproj");
  };

  const mcp = await new LensStudioMcp().connect();
  const tools = (await mcp.listTools()).map((tool) => tool.name);

  /** @type {Record<string, () => Promise<unknown>>} */
  const handlers = {
    async preflight() {
      const missing = ["ExecuteEditorCode", "InstallLensStudioPackage", "SearchLensStudioAssetLibrary", "RecompileTypeScriptTool", "RunAndCollectLogsTool"].filter(
        (name) => !tools.includes(name)
      );
      if (missing.length) throw new Error(`The Lens Studio MCP server lacks ${missing.join(", ")}. Update Lens Studio.`);
      const hasProject = existsSync(project) && readdirSync(project).some((name) => name.endsWith(".esproj"));
      if (options.create && !hasProject) {
        mkdirSync(project, { recursive: true });
        await mcp.editor(
          "const m = pluginSystem.findInterface(Editor.Model.IModel) as any;" +
            "m.setDefaultProject();" +
            "m.project.targetPlatform = Editor.TargetPlatform.Spectacles;" +
            "m.project.saveTo(new Editor.Path((args as any).file));" +
            "return String(m.project.projectFile);",
          { file: esproj() },
          600000
        );
      }
      const open = await mcp.editor(
        "const m = pluginSystem.findInterface(Editor.Model.IModel) as any;" +
          "return { file: String(m.project.projectFile), target: String(m.project.targetPlatform) };"
      );
      if (path.resolve(open.file) !== esproj()) {
        throw new Error(
          `Lens Studio has ${open.file} open; expected ${esproj()}. Open that project in Lens Studio` +
            (hasProject ? "." : ", or pass --create to save a new Spectacles project there.")
        );
      }
      return { project: open.file, target: open.target };
    },

    async packages() {
      const out = [];
      for (const pkg of SETUP_PACKAGES) {
        if (existsSync(path.join(project, "Packages", pkg.file + ".lspkg"))) {
          out.push(`${pkg.file}: present`);
          continue;
        }
        const search = await mcp.call("SearchLensStudioAssetLibrary", { keywordFilter: [pkg.search], onlyMostRecent: false });
        const asset = (search.data.assets ?? []).find(
          (a) => a.type === "AssetPackage" && (pkg.name ? a.name === pkg.name : a.name.replace(/\s/g, "") === pkg.search.replace(/\s/g, ""))
        );
        const resource = asset?.resources.find((r) => `${r.version.major}.${r.version.minor}.${r.version.patch}` === pkg.version);
        if (!resource) throw new Error(`The Asset Library has no ${pkg.search} ${pkg.version}.`);
        // One install at a time: Lens Studio rejects a second while one runs.
        const installed = await mcp.call("InstallLensStudioPackage", { packageUri: resource.uri, assetName: pkg.file });
        if (installed.isError) throw new Error(`Installing ${pkg.file} ${pkg.version} failed: ${installed.text.slice(0, 500)}`);
        out.push(`${pkg.file}: installed ${pkg.version}`);
      }
      return out;
    },

    async sync() {
      const synced = await syncLensRuntime({ project, forceOverwrite: [], withValidation: false, adoptExisting: false });
      const report = await runDoctor(project);
      save("doctor.json", report);
      if (report.errors.length) throw new Error("specs:doctor failed:\n - " + report.errors.join("\n - "));
      return { kit: synced.kitPackage, doctorWarnings: report.warnings.length };
    },

    async recompile() {
      const generated = path.join(project, "Assets", "ViroSpecs", "generated", "ViroGeneratedSceneHost.ts");
      if (!existsSync(generated)) throw new Error(`${generated} is missing. Compile the scene with viro-specs-compile --format lens-ts first.`);
      const result = await mcp.call("RecompileTypeScriptTool", {});
      save("recompile.json", result.data);
      if (result.data?.status !== "succeeded") {
        throw new Error("TypeScript recompile failed: " + JSON.stringify(result.data?.errors ?? result.data).slice(0, 2000));
      }
      return "lens-compiled";
    },

    async materials() {
      const out = [];
      for (const m of SETUP_MATERIALS) {
        const found = await mcp.call("asset-graphql", { query: `{ assetsByName(name: "${m.name}", exactMatch: true) { id name path } }` });
        const existing = (found.data?.data?.assetsByName ?? []).find((a) => String(a.path ?? "").includes(MATERIALS_FOLDER));
        if (existing) {
          out.push(`present ${m.name}`);
          continue;
        }
        const created = await mcp.call("asset-graphql", {
          query: `mutation { createAssetFromPreset(presetName: "${m.preset}", name: "${m.name}", destinationPath: "${MATERIALS_FOLDER}") { id name } }`,
        });
        if (!created.data?.data?.createAssetFromPreset?.id) {
          throw new Error(`Creating material ${m.name} from ${m.preset} failed: ${JSON.stringify(created.data).slice(0, 600)}`);
        }
        out.push(`created ${m.name}`);
      }
      return out;
    },

    async wire() {
      const result = await mcp.call("ExecuteEditorCode", {
        path: path.join(here, "lens-editor", "wire-scene-host.ts"),
        args: { materialsFolder: MATERIALS_FOLDER },
        timeoutMs: 600000,
      });
      const data = result.data;
      if (typeof data !== "object" || data?.status !== "Execution Succeeded") {
        throw new Error("Wiring failed: " + JSON.stringify(typeof data === "object" ? data.errors ?? data.error ?? data : data).slice(0, 1500));
      }
      save("wire.json", data.returnValue);
      return data.returnValue.steps;
    },

    async device() {
      if (!tools.includes("PreviewPanelTool")) return "skipped: no PreviewPanelTool; set the Preview to a SPECS device by hand";
      const sources = await mcp.call("PreviewPanelTool", { action: "listSources" });
      const scene = (sources.data?.scenes ?? []).find((p) => String(p).endsWith("/" + options.room));
      if (!scene) throw new Error(`No Interactive Preview scene named ${options.room}.`);
      await mcp.call("PreviewPanelTool", { action: "setConfig", deviceCategory: "stereo", inputType: "Interactive", sourcePath: scene });
      const config = await mcp.call("PreviewPanelTool", { action: "getConfig" });
      save("preview-config.json", config.data);
      if (config.data?.inputType !== "Interactive") throw new Error(`Preview input is ${config.data?.inputType}, expected Interactive.`);
      return { device: config.data.deviceName, room: options.room };
    },

    async preview() {
      // Wiring and materials change the project; compile before the refresh so
      // Preview runs the current scripts.
      const compiled = await mcp.call("RecompileTypeScriptTool", {});
      if (compiled.data?.status !== "succeeded") {
        throw new Error("TypeScript recompile failed: " + JSON.stringify(compiled.data?.errors ?? compiled.data).slice(0, 2000));
      }
      // A refresh issued while Preview still holds the scene from before the
      // wire step runs that old scene: a run of the new starter threw from the
      // Navigation Kit demo the wire step had disabled, on a camera without the
      // DeviceTracking it had added. Refresh (at most three times) until the
      // runtime holds the wired ViroSpecsRuntime/GeneratedHost, then judge the
      // next refresh only.
      const wired = async () => {
        if (!tools.includes("QueryRuntimeSceneTool")) return true;
        const found = await mcp.call("QueryRuntimeSceneTool", {
          query: '{ sceneObjects(filter: {nameContains: "GeneratedHost"}) { matches { summary } } }',
          timeoutMs: 15000,
        });
        const matches = found.data?.data?.sceneObjects?.matches ?? [];
        return matches.some((m) => m.summary?.name === "GeneratedHost" && m.summary?.parentName === "ViroSpecsRuntime" && m.summary?.enabled);
      };
      let settled = 0;
      while (!(await wired())) {
        if (++settled > 3) throw new Error("Preview never loaded the wired scene (no ViroSpecsRuntime/GeneratedHost at runtime after three refreshes).");
        await mcp.call("RunAndCollectLogsTool", { mode: "refresh", settleMaxMs: 6000, settleQuietMs: 1500 });
      }
      const logs = await mcp.call("RunAndCollectLogsTool", { mode: "refresh", settleMaxMs: 6000, settleQuietMs: 1500 });
      save("preview-logs.json", logs.data);
      const capture = await mcp.call("CaptureRuntimeViewTool", { center: { x: 0, y: 0, z: -150 }, distance: 120, viewAngle: "front", detail: "high" });
      capture.images.forEach((image, index) =>
        writeFileSync(path.join(evidence, `preview${index ? "-" + index : ""}.png`), Buffer.from(image.data, "base64"))
      );
      const failures = previewFailures(logs.data ?? {});
      if (failures.length) throw new Error("Preview reported errors:\n - " + failures.join("\n - "));
      if (logs.data?.firstActivityAtMs === null) throw new Error("The Lens did not run after the Preview refresh.");
      return { prints: (logs.data?.prints ?? []).length, capture: path.join(evidence, "preview.png") };
    },
  };

  const report = {};
  for (const step of options.steps) {
    log(`[specs:setup] ${step}`);
    report[step] = await handlers[step]();
    log(`[specs:setup] ${step}: ${JSON.stringify(report[step])}`);
  }
  save("setup.json", report);
  return report;
}

/** @param {string[]} argv */
export async function main(argv = process.argv.slice(2)) {
  await runSetup(parseSetupArgs(argv));
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error("[specs:setup] " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  });
}
