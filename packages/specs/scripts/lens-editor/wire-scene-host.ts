// Wires the Viro Specs runtime into the Lens Studio project that is open.
//
// Runs inside Lens Studio through the MCP ExecuteEditorCode tool (setup-lens-
// project.mjs passes this file as `path`). It is an async function body:
// `pluginSystem` and `args` are injected, and there are no top-level imports.
// Idempotent: objects are found by name and reused, so a rerun repairs a
// partly wired scene instead of duplicating it.
//
// args:
//   materialsFolder: string   folder under Assets/ holding the setup materials
//   experience:      boolean  attach and enable ViroSpecsExperienceHost (default true)
//   save:            boolean  save the project at the end (default true)
//
// Returns { steps: string[], inputs: {...} }.
const model = pluginSystem.findInterface(Editor.Model.IModel) as any;
const project = model.project;
const scene = project.scene;
const am = project.assetManager;
const opts = args as any;
const materialsFolder: string = String(opts.materialsFolder ?? "ViroSpecsSetup/Materials");
const steps: string[] = [];
const inputs: Record<string, Record<string, string>> = {};

function sourcePath(asset: any): string {
  try {
    return String(asset.fileMeta?.sourcePath ?? "");
  } catch {
    return "";
  }
}

function findAsset(label: string, predicate: (asset: any) => boolean): any {
  const found = am.assets.find(predicate);
  if (!found) throw new Error(`Asset not found: ${label}`);
  return found;
}

function scriptAsset(name: string): any {
  return findAsset(`script ${name}`, (a: any) => a.name === name && /ScriptAsset$/.test(String(a.type)));
}

function rootObject(name: string): any {
  return scene.rootSceneObjects.find((o: any) => o.name === name) ?? null;
}

function ensureRoot(name: string): any {
  const existing = rootObject(name);
  if (existing) return existing;
  steps.push(`create root ${name}`);
  return scene.createSceneObject(name);
}

function ensureChild(parent: any, name: string): any {
  const existing = parent.children.find((o: any) => o.name === name);
  if (existing) return existing;
  const created = scene.createSceneObject(name);
  scene.reparentSceneObject(created, parent);
  steps.push(`create ${parent.name}/${name}`);
  return created;
}

function ensureScript(object: any, name: string): any {
  const asset = scriptAsset(name);
  const existing = object.components.find(
    (c: any) => String(c.getTypeName?.() ?? "").endsWith("ScriptComponent") && c.scriptAsset && c.scriptAsset.isSame(asset)
  );
  if (existing) return existing;
  const component = object.addComponent("ScriptComponent");
  component.scriptAsset = asset;
  steps.push(`attach ${name} to ${object.name}`);
  return component;
}

function setInput(component: any, owner: string, name: string, value: any, label: string): void {
  const names: string[] = component.inputNames ?? [];
  if (!names.includes(name)) {
    throw new Error(`${owner} has no @input ${name}; inputs are [${names.join(", ")}]`);
  }
  component[name] = value;
  if (!inputs[owner]) inputs[owner] = {};
  inputs[owner][name] = label;
}

function material(name: string): any {
  return findAsset(
    `material ${name} (run the materials step)`,
    (a: any) => String(a.type) === "Material" && a.name === name && sourcePath(a).startsWith(materialsFolder + "/")
  );
}

// 1. Camera: Perspective with World device tracking, as SPECS needs.
const camera = scene.rootSceneObjects.find((o: any) => o.components.some((c: any) => String(c.getTypeName?.()).endsWith("Camera")));
if (!camera) throw new Error("No root Camera in the scene.");
const cameraComponent = camera.components.find((c: any) => String(c.getTypeName?.()).endsWith("Camera"));
if (cameraComponent.cameraType !== Editor.Components.CameraType.Perspective) {
  cameraComponent.cameraType = Editor.Components.CameraType.Perspective;
  steps.push("camera -> Perspective");
}
let tracking = camera.components.find((c: any) => String(c.getTypeName?.()).endsWith("DeviceTracking"));
if (!tracking) {
  tracking = camera.addComponent("DeviceTracking");
  steps.push("camera + DeviceTracking");
}
if (tracking.deviceTrackingMode !== Editor.Components.DeviceTrackingMode.World) {
  tracking.deviceTrackingMode = Editor.Components.DeviceTrackingMode.World;
  steps.push("DeviceTracking -> World");
}

// 2. Interaction Kit root prefab: SpectaclesInteractionKit (2.x) or InteractionKit (4.0.0).
const kitPrefab = findAsset(
  "Interaction Kit root prefab",
  (a: any) => String(a.type) === "ObjectPrefab" && (a.name === "SpectaclesInteractionKit" || a.name === "InteractionKit")
);
if (!rootObject(kitPrefab.name)) {
  scene.instantiatePrefab(kitPrefab, null);
  steps.push(`instantiate ${kitPrefab.name} prefab at root`);
}

// Installing SurfacePlacement, VolumetricLine and the Navigation Kit through
// the Asset Library drops their demo content at the scene root. Disable it so
// it cannot cover the generated scene (reversible; nothing is deleted).
const DEMO_ROOTS = ["SurfacePlacement", "VolumetricLine", "NavigationKit", "Example Surface", "VolumetricLineExample"];
for (const root of scene.rootSceneObjects) {
  if (DEMO_ROOTS.includes(root.name) && root.enabled) {
    root.enabled = false;
    steps.push(`disable package demo root ${root.name}`);
  }
}

// 3. Runtime hierarchy: registry, scene controller host, generated host.
const runtime = ensureRoot("ViroSpecsRuntime");
const registryObject = ensureChild(runtime, "AssetRegistry");
const contentObject = ensureChild(runtime, "ViroGeneratedContent");
const sceneHostObject = ensureChild(runtime, "SceneHost");
const generatedHostObject = ensureChild(runtime, "GeneratedHost");

const registry = ensureScript(registryObject, "ViroSpecsAssetRegistry");
const placeholder = material("ViroPlaceholder");
const base = material("ViroDefaultMaterial");
const line = material("ViroDefaultLine");
const image = material("ViroImageMaterial");
setInput(registry, "AssetRegistry", "placeholderMaterial", placeholder, placeholder.name);
setInput(registry, "AssetRegistry", "defaultMaterial", base, base.name);
setInput(registry, "AssetRegistry", "defaultLineMaterial", line, line.name);
setInput(registry, "AssetRegistry", "defaultImageMaterial", image, image.name);

const sceneHost = ensureScript(sceneHostObject, "ViroSpecsSceneControllerHost");
setInput(sceneHost, "SceneHost", "assetRegistryObject", registryObject, registryObject.name);
setInput(sceneHost, "SceneHost", "root", contentObject, contentObject.name);

const generatedHost = ensureScript(generatedHostObject, "ViroGeneratedSceneHost");
const hostInputs: string[] = generatedHost.inputNames ?? [];
if (!hostInputs.includes("sceneHostObject")) {
  throw new Error(
    "ViroGeneratedSceneHost has no sceneHostObject input; it was compiled for scene protocol 1. Recompile it with viro-specs-compile --format lens-ts."
  );
}
setInput(generatedHost, "GeneratedHost", "sceneHostObject", sceneHostObject, sceneHostObject.name);

// 4. Experience layer: lifecycle panels, panel backings and button states
// around the same scene controller.
if (opts.experience !== false) {
  const experienceObject = ensureChild(runtime, "ExperienceHost");
  // The script asset is named after its file; the component class is ViroSpecsExperienceHost.
  const experience = ensureScript(experienceObject, "ViroSpecsExperienceLensView");
  setInput(experience, "ExperienceHost", "sceneHostObject", sceneHostObject, sceneHostObject.name);
  setInput(experience, "ExperienceHost", "cameraObject", camera, camera.name);
  // The UI Kit's unit plane, from the folder of the package that ships ScrollWindow.
  const scrollWindow = sourcePath(scriptAsset("ScrollWindow")).split("/");
  const uiKitFolder = scrollWindow.slice(0, 4).join("/") + "/";
  const unitPlane = findAsset(
    "UI Kit Unit Plane mesh",
    (a: any) => /Mesh$/.test(String(a.type)) && a.name === "Unit Plane" && sourcePath(a).startsWith(uiKitFolder + "Data/Meshes/")
  );
  setInput(experience, "ExperienceHost", "panelMesh", unitPlane, unitPlane.name);
  const panelMaterial = material("ViroExperiencePanel");
  setInput(experience, "ExperienceHost", "panelMaterial", panelMaterial, panelMaterial.name);
  if (!experienceObject.enabled) {
    experienceObject.enabled = true;
    steps.push("enable ExperienceHost");
  }
}

if (opts.save !== false) {
  project.save();
  steps.push("save");
}

return { steps, inputs };
