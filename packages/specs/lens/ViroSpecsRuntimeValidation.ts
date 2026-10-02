import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";
import { SingleSurface } from "SurfacePlacement.lspkg/Scripts/SingleSurface";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { ViroSpecsInteractionHost } from "./ViroSpecsInteractionHost";
import { ViroSpecsRuntimeHost } from "./ViroSpecsRuntimeHost";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import {
  findSceneObjectByName,
  forEachComponentInSubtree,
  sleep,
} from "Leaf.lspkg/Utils/common/Utils";
import { VolumetricLine } from "VolumetricLine.lspkg/Scripts/VolumetricLine";
import { ViroSpecsAnimationHost } from "./ViroSpecsAnimationHost";
import { NavigationDataComponent } from "SpecsNavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent";
import { ViroSpecsAssetRegistry } from "./ViroSpecsAssetRegistry";
import { ViroSpecsNavigationRuntime } from "./ViroSpecsNavigationRuntime";
import { ViroSpecsNavigationHost } from "./ViroSpecsNavigationHost";
import { ViroSpecsWorldRuntime } from "./ViroSpecsWorldRuntime";
import type { ViroSpecsNativeAnimationPlan } from "./ViroSpecsProtocol";

/** Durable simulator conformance checks, executed by the existing smoke scenario. */
export async function validateNativeAnimation(): Promise<void> {
  const host = findSceneObjectByName("AnimationHost").getComponent(ViroSpecsAnimationHost.getTypeName()) as ViroSpecsAnimationHost;
  const title = findSceneObjectByName("viro:platform-lab-title");
  const transform = title.getTransform();
  const text = title.getComponent("Component.Text") as Text;
  const before = transform.getLocalPosition();
  let completions = 0;
  const plan: ViroSpecsNativeAnimationPlan = {
    engine: "AnimationPlayer", backendPackage: "AnimationExamples", durationSeconds: 0.8,
    delaySeconds: 0, easing: "linear", playbackMode: "single", completionEvent: "lab-complete",
    tracks: [
      {target: "transform.position.x", from: "current", to: 0.12},
      {target: "transform.scale.x", from: "current", to: 1.2},
      {target: "material.opacity", from: "current", to: 0.35},
    ],
  };
  host.play("platform-lab-title", plan, () => completions++);
  // Runtime-created native players can bind on the following render frame.
  // Observe an intermediate sample instead of assuming a fixed wall-clock tick.
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(50);
    if (transform.getLocalPosition().x > before.x + 0.1) break;
  }
  const player = title.getComponent("Component.AnimationPlayer") as AnimationPlayer;
  expect(player).toBeTruthy();
  expect(player.getActiveClips().length).toBeGreaterThan(0);
  const middle = transform.getLocalPosition().x;
  expect(middle).toBeGreaterThan(before.x + 0.1);
  expect(middle).toBeLessThan(11.9);
  expect(text.textFill.color.w).toBeLessThan(0.99);
  print("VIRO_VALIDATION animation:active " + JSON.stringify({middleCm: middle, alpha: text.textFill.color.w, activeClips: player.getActiveClips()}));
  for (let attempt = 0; attempt < 40 && completions === 0; attempt++) await sleep(50);
  expect(Math.abs(transform.getLocalPosition().x - 12)).toBeLessThan(0.01);
  expect(Math.abs(transform.getLocalScale().x - 1.2)).toBeLessThan(0.01);
  expect(Math.abs(text.textFill.color.w - 0.35)).toBeLessThan(0.01);
  expect(completions).toBe(1);
  let immediate = 0;
  host.play("platform-lab-title", {...plan, durationSeconds: 0, tracks: [
    {target: "transform.position.x", from: "current", to: before.x / 100},
    {target: "transform.scale.x", from: "current", to: 1},
    {target: "material.opacity", from: "current", to: 1},
  ]}, () => immediate++);
  expect(immediate).toBe(1);
  expect(transform.getLocalPosition().x).toBe(before.x);
  expect(text.textFill.color.w).toBe(1);
  await sleep(50);
  expect(transform.getLocalPosition().x).toBe(before.x);
  print("VIRO_VALIDATION animation:passed position=12cm scale=1.2 opacity=0.35 completion=1 immediate=1 restored=true");
}

export async function validatePolyline(): Promise<void> {
  const host = findSceneObjectByName("ViroNavigationHost").getComponent(ViroSpecsNavigationHost.getTypeName()) as ViroSpecsNavigationHost;
  const plan = {
    primitive: "volumetric-line" as const, backendPackage: "VolumetricLine" as const,
    points: [[-0.3, -0.18, -1.38], [0, 0.04, -1.38], [0.3, -0.02, -1.38]] as [number, number, number][],
    radiusMeters: 0.004,
  };
  host.presentPolyline(plan);
  await sleep(150);
  const root = findSceneObjectByName("viro:volumetric-line");
  expect(root).toBeTruthy();
  const line = root.getComponent(VolumetricLine.getTypeName()) as VolumetricLine;
  expect(line.pathPoints.length).toBe(3);
  expect(Math.abs(line.radius - 0.4)).toBeLessThan(0.001);
  const pointObjects = line.pathPoints.slice();
  for (let i = 0; i < pointObjects.length; i++) {
    const pos = pointObjects[i].getTransform().getWorldPosition();
    expect(pos.distance(new vec3(plan.points[i][0] * 100, plan.points[i][1] * 100, plan.points[i][2] * 100))).toBeLessThan(0.01);
  }
  const visual = root.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
  expect(visual?.mesh).toBeTruthy();
  print("VIRO_VALIDATION polyline:rendered " + JSON.stringify({pointsCm:pointObjects.map(p => {const v=p.getTransform().getWorldPosition();return [v.x,v.y,v.z]}), radiusCm:line.radius}));
  host.clearRoute();
  await sleep(50);
  expect(isNull(root)).toBe(true);
  pointObjects.forEach(point => expect(isNull(point)).toBe(true));
  const route = host.presentRoute({route:{id:"missing-gps-test",points:[{latitude:40.7,longitude:-74},{latitude:40.7001,longitude:-74.0001}]},line:{widthMeters:0.008},packages:["SpecsNavigationKit","VolumetricLine"]});
  print("VIRO_VALIDATION navigation:geo " + JSON.stringify({presented:route, missingGpsGraceful:!route}));
  host.clearRoute();
  let stopped = 0;
  const noGps = {
    getUserPosition: () => ({getGeoPosition: () => null, onUserPositionUpdated: {add: () => () => {}}}),
    stopNavigation: () => stopped++, removePlace: () => {},
  } as unknown as NavigationDataComponent;
  const controlled = new ViroSpecsNavigationRuntime(host.generatedContentRoot, noGps,
    host.assetRegistryObject.getComponent(ViroSpecsAssetRegistry.getTypeName()) as ViroSpecsAssetRegistry,
    host.defaultLineMaterial, host.routeIcon);
  controlled.presentPolyline(plan);
  await sleep(50);
  const priorLine = findSceneObjectByName("viro:volumetric-line");
  expect(controlled.presentRoute({route:{id:"controlled-missing-gps",points:[]},line:{widthMeters:0.008},packages:["SpecsNavigationKit","VolumetricLine"]})).toBe(false);
  expect(isNull(priorLine)).toBe(true);
  expect(stopped).toBeGreaterThan(0);
  print("VIRO_VALIDATION navigation:controlled-missing-gps PASS returned=false previous-line-destroyed=true");
  // Leave one local polyline visible for independent screenshot review.
  host.presentPolyline(plan);
  await sleep(100);
  print("VIRO_VALIDATION polyline:passed three-points=cm radius=0.4cm cleanup=all-children");
}

export async function validateWorldPlacement(): Promise<void> {
  let nativeRaw: WorldQueryHitTestResult | null = null;
  let callbacks = 0;
  const nativeModule = require("LensStudio:WorldQueryModule") as WorldQueryModule;
  const world = new ViroSpecsWorldRuntime({createHitTestSession: options => {
    const session = nativeModule.createHitTestSessionWithOptions(options);
    return {start:()=>session.start(), stop:()=>session.stop(), hitTest:(origin,end,callback)=>{
      session.hitTest(origin,end,result=>{ callbacks++; nativeRaw=result; callback(result); });
    }};
  }});
  const ray = {origin:[0,0,0] as [number,number,number],direction:[0,0,-1] as [number,number,number],maxDistance:10};
  let liveHit = false;
  for (const direction of [[0,0,-1], [0,-0.15,-1], [0,-0.4,-1]] as [number,number,number][]) {
    const hits = await world.hitTest({...ray,direction});
    if (hits.length) {
      const hit = hits[0];
      const raw = nativeRaw;
      expect(raw).toBeTruthy();
      expect(Math.abs(hit.position[0] * 100 - raw.position.x)).toBeLessThan(0.001);
      expect(Math.abs(hit.position[1] * 100 - raw.position.y)).toBeLessThan(0.001);
      expect(Math.abs(hit.position[2] * 100 - raw.position.z)).toBeLessThan(0.001);
      expect(Math.abs(hit.distance * 100 - raw.position.length)).toBeLessThan(0.001);
      expect(hit.distance).toBeGreaterThan(0);
      expect(hit.distance).toBeLessThan(10.01);
      print("VIRO_VALIDATION world:live-hit " + JSON.stringify({rawCm:[raw.position.x,raw.position.y,raw.position.z],normalizedMeters:hit,direction,callbacks}));
      liveHit = true;
      break;
    }
  }
  if (!liveHit) print("VIRO_VALIDATION world:live-no-hit " + JSON.stringify({rays:3,callbacks,reason:world.lastUnavailableReason ?? "Native callbacks returned null for current simulated scene"}));
  // The Platform Lab fixture uses the SPECS 27 Sunlit Room simulated surface.
  expect(liveHit).toBe(true);
  let poses = 0;
  const cancel = world.startPlacement("horizontal", () => poses++);
  const started = world.isPlacementActive;
  cancel();
  cancel();
  await sleep(100);
  expect(world.isPlacementActive).toBe(false);
  expect(poses).toBe(0);
  print("VIRO_VALIDATION placement:cancelled " + JSON.stringify({started, active:world.isPlacementActive, latePoses:poses, unavailable:world.lastUnavailableReason}));
  await validateWorldCapabilityFailures();
}

/** Controlled native-boundary regressions, distinct from the live hit probe above. */
async function validateWorldCapabilityFailures(): Promise<void> {
  const ray = {origin:[1,2,3] as [number,number,number],direction:[0,0,-2] as [number,number,number],maxDistance:2,classifications:["floor" as const]};
  let starts=0, stops=0, calls=0;
  const raw = {position:new vec3(100,200,100),normal:vec3.up(),classification:SurfaceClassification.Ground} as WorldQueryHitTestResult;
  const conversion = new ViroSpecsWorldRuntime({createHitTestSession:options=>{
    expect(options.filter).toBe(false);
    expect(options.classification).toBe(true);
    return {start:()=>{starts++}, stop:()=>{stops++}, hitTest:(origin,end,callback)=>{
      expect(origin.distance(new vec3(100,200,300))).toBeLessThan(0.001);
      expect(end.distance(new vec3(100,200,100))).toBeLessThan(0.001);
      calls++;
      callback(calls===1 ? null : raw);
    }};
  }});
  const hits=await conversion.hitTest(ray);
  expect(hits.length).toBe(1);
  expect(hits[0].position[0]).toBe(1);
  expect(hits[0].position[1]).toBe(2);
  expect(hits[0].position[2]).toBe(1);
  expect(hits[0].distance).toBe(2);
  expect(hits[0].surface).toBe("floor");
  expect(starts).toBe(1);expect(stops).toBe(1);expect(calls).toBe(2);
  expect((await conversion.hitTest({...ray,classifications:["wall"]})).length).toBe(0);
  print("VIRO_VALIDATION world:controlled-conversion PASS cm=[100,200,100] meters=[1,2,1] distance=2 Ground=floor filter-independent=true cold-null-retry=true");
  for (const stage of ["allocate","start","hit","stop","timeout"]) {
    let stopCalls=0;
    const unavailable = new ViroSpecsWorldRuntime({createHitTestSession:()=>{
      if(stage==="allocate") throw new Error("controlled allocation unavailable");
      return {start:()=>{if(stage==="start")throw new Error("controlled start unavailable")},
        stop:()=>{stopCalls++;if(stage==="stop")throw new Error("controlled stop unavailable")},
        hitTest:(_origin,_end,callback)=>{
          if(stage==="hit")throw new Error("controlled hit unavailable");
          if(stage!=="timeout")callback(raw);
        }};
    }});
    const result=await unavailable.hitTest(ray);
    expect(result.length).toBe(stage==="stop"?1:0);
    expect(Boolean(unavailable.lastUnavailableReason)).toBe(true);
    expect(stopCalls).toBe(stage==="allocate"?0:1);
  }
  let nativeCallback: (position:vec3,rotation:quat)=>void;
  let cancelled=0, poses=0;
  const placement = new ViroSpecsWorldRuntime({getPlacementController:()=>({
    startSurfacePlacement:(_settings,callback)=>{nativeCallback=callback},stopSurfacePlacement:()=>{cancelled++},
  })});
  const cancel=placement.startPlacement("horizontal",()=>poses++);
  expect(placement.isPlacementActive).toBe(true);
  cancel();cancel();nativeCallback(new vec3(100,200,300),quat.quatIdentity());
  expect(placement.isPlacementActive).toBe(false);expect(poses).toBe(0);expect(cancelled).toBe(1);
  placement.startPlacement("horizontal",()=>poses++);
  const staleCallback=nativeCallback;
  const cancelLatest=placement.startPlacement("vertical",pose=>{poses++;expect(pose.position[0]).toBe(1);expect(pose.surface).toBe("wall")});
  staleCallback(new vec3(100,200,300),quat.quatIdentity());
  expect(poses).toBe(0);
  nativeCallback(new vec3(100,200,300),quat.quatIdentity());
  cancelLatest();expect(poses).toBe(1);expect(placement.isPlacementActive).toBe(false);
  for(const stage of ["allocate","start","stop"]) {
    const unavailable=new ViroSpecsWorldRuntime({getPlacementController:()=>{
      if(stage==="allocate")throw new Error("controlled placement allocation unavailable");
      return {startSurfacePlacement:()=>{if(stage==="start")throw new Error("controlled placement start unavailable")},
        stopSurfacePlacement:()=>{if(stage==="stop")throw new Error("controlled placement stop unavailable")}};
    }});
    unavailable.startPlacement("horizontal",()=>poses++)();
    expect(unavailable.isPlacementActive).toBe(false);
    expect(Boolean(unavailable.lastUnavailableReason)).toBe(true);
  }
  print("VIRO_VALIDATION world:controlled-unavailable PASS allocation/start/hit/stop/timeout settle+cleanup; placement allocation/start/stop/cancel/supersession late-callback guarded");
}


type GeneratedHost = ScriptComponent & {restartGeneratedScene(): void; stopGeneratedScene(): void};

/**
 * The compiler owns the generated host's scene-object name, so find it by its
 * lifecycle API across the whole scene. Matching a fixed name would silently
 * drop the suite back to the hand-written lab whenever the emitter renamed it.
 */
export function generatedHost(): GeneratedHost | undefined {
  let found: GeneratedHost | undefined;
  for (let index = 0; index < global.scene.getRootObjectsCount(); index++) {
    forEachComponentInSubtree<ScriptComponent>(
      global.scene.getRootObject(index),
      ["ScriptComponent"],
      component => {
        if (found) return;
        const candidate = component as GeneratedHost;
        if (
          typeof candidate.restartGeneratedScene === "function" &&
          typeof candidate.stopGeneratedScene === "function"
        ) {
          found = candidate;
        }
      }
    );
    if (found) break;
  }
  return found;
}

export async function validateGeneratedInteraction(): Promise<void> {
  const interactor = new DefaultLeafInteractor();
  const host = findSceneObjectByName("InteractionHost").getComponent(ViroSpecsInteractionHost.getTypeName()) as ViroSpecsInteractionHost;
  const model = findInteractableByName("viro-interactable:platform-lab-model");
  const object = findSceneObjectByName("viro:platform-lab-model");
  expect(model).toBeTruthy();
  const events: {phase: string; position?: [number, number, number]}[] = [];
  const unsubscribe = host.subscribe(event => { if (event.targetId === "platform-lab-model") events.push(event); });
  const manipulation = model.getSceneObject().getComponent(InteractableManipulation.getTypeName()) as InteractableManipulation;
  let starts=0, ends=0;
  const removeStart=manipulation.onManipulationStart.add(()=>starts++);
  const removeEnd=manipulation.onManipulationEnd.add(()=>ends++);
  try {
    await interactor.hover(model, 300);
    await interactor.trigger(model);
    const before = object.getTransform().getWorldPosition();
    await interactor.drag(model, new vec3(1, 0, 0), 400);
    await sleep(80);
    const after = object.getTransform().getWorldPosition();
    expect(events.some(e => e.phase === "hover-enter")).toBe(true);
    expect(events.some(e => e.phase === "select-start")).toBe(true);
    expect(events.some(e => e.phase === "select-end")).toBe(true);
    const drags = events.filter(e => e.phase === "drag");
    expect(drags.length).toBeGreaterThan(2);
    expect(after.x - before.x).toBeGreaterThan(1);
    expect(after.x - before.x).toBeLessThan(35);
    expect(Math.abs(after.z - before.z)).toBeLessThan(2);
    expect(starts).toBeGreaterThan(0);
    expect(ends).toBe(starts);
    const afterReleaseCount=events.length;
    await sleep(150);
    expect(events.length).toBe(afterReleaseCount);
    const last = drags[drags.length - 1].position;
    expect(Math.abs(last[0] * 100 - after.x)).toBeLessThan(0.5);
    print("VIRO_GENERATED interaction PASS " + JSON.stringify({manipulationStarts:starts,manipulationEnds:ends,noLateEvents:true,phases: events.map(e=>e.phase), beforeCm:[before.x,before.y,before.z], afterCm:[after.x,after.y,after.z], portableLastMeters:last, boundary:"ViroSpecsInteractionHost.subscribe", reactClosuresExecuted:false}));
  } finally { unsubscribe(); removeStart(); removeEnd(); }
}

export async function validateGeneratedScene(): Promise<void> {
  const generated = generatedHost();
  const runtime = findSceneObjectByName("RuntimeHost").getComponent(ViroSpecsRuntimeHost.getTypeName()) as ViroSpecsRuntimeHost;
  for (let cycle=0; cycle<3; cycle++) {
    const oldRoot = runtime.getNode("platform-lab-root");
    generated.restartGeneratedScene();
    await sleep(250);
    expect(isNull(oldRoot)).toBe(true);
    const root=runtime.getNode("platform-lab-root");
    const title=runtime.getNode("platform-lab-title");
    const model=runtime.getNode("platform-lab-model");
    expect(title.getParent()).toBe(root);
    expect(model.getParent()).toBe(root);
    expect(root.getTransform().getWorldPosition().z).toBe(-150);
    expect(model.getTransform().getLocalPosition().x).toBe(-20);
    const text=title.getComponent("Component.Text") as Text;
    expect(text.text).toBe("Viro Cross-Platform Lab");
    const player=title.getComponent("Component.AnimationPlayer") as AnimationPlayer;
    expect(player.getActiveClips().length).toBe(1);
    const clip=player.getActiveClips()[0];
    let previous=player.getClipCurrentTime(clip), resets=0;
    const samples:number[]=[];
    for(let sample=0;sample<16;sample++) {
      await sleep(50);
      const time=player.getClipCurrentTime(clip);
      if(time<previous)resets++;
      previous=time;
      samples.push(title.getTransform().getLocalScale().x);
    }
    expect(resets).toBeGreaterThan(0);
    expect(Math.max(...samples)).toBeGreaterThan(1.1);
    expect(Math.min(...samples)).toBeLessThan(1.08);
    expect(player.clips.length).toBe(1);
    print("VIRO_GENERATED animation-loop PASS " + JSON.stringify({cycle, clip, duration:0.5, easing:"ease-in-out", resets, minScale:Math.min(...samples),maxScale:Math.max(...samples),clips:player.clips.length}));
    const generatedLine=findSceneObjectByName("viro:volumetric-line").getComponent(VolumetricLine.getTypeName()) as VolumetricLine;
    const expectedPoints=[[-30,-20,-138],[0,2,-138],[30,-8,-138]];
    expect(generatedLine.pathPoints.length).toBe(3);
    expect(generatedLine.radius).toBe(0.4);
    generatedLine.pathPoints.forEach((point,index)=>expect(point.getTransform().getWorldPosition().distance(new vec3(...expectedPoints[index] as [number,number,number]))).toBeLessThan(0.001));
    print("VIRO_GENERATED polyline PASS " + JSON.stringify({cycle,pointsCm:expectedPoints,radiusCm:generatedLine.radius,source:"compiler-generated-host",rootChildren:runtime.root.children.length}));
    await validateGeneratedInteraction();
    await validatePolyline();
    generated.stopGeneratedScene();
    await sleep(80);
    expect(isNull(root)).toBe(true);
    expect(runtime.getNode("platform-lab-root")).toBe(null);
    expect(findSceneObjectByName("viro:volumetric-line")).toBe(undefined);
    expect(runtime.root.children.length).toBe(0);
    print("VIRO_GENERATED lifecycle PASS " + JSON.stringify({cycle, rootDestroyed:true,generatedChildren:runtime.root.children.length}));
  }
  generated.restartGeneratedScene();
  await sleep(200);
  await validateNativeAnimation();
  await validateWorldPlacement();
  await validateLivePlacement();
  generated.restartGeneratedScene();
  await sleep(200);
  print("VIRO_GENERATED smoke PASS canonical-jsx=true reloadCycles=3 native-loop=true");
}


export async function validateLivePlacement(): Promise<void> {
  const world=new ViroSpecsWorldRuntime();
  const runtime=findSceneObjectByName("RuntimeHost").getComponent(ViroSpecsRuntimeHost.getTypeName()) as ViroSpecsRuntimeHost;
  let completed=false;
  let poseResult: any;
  const cancel=world.startPlacement("vertical",pose=>{
    poseResult=pose;
    runtime.applyRenderPlan({version:1,commands:[{op:"transform",id:"platform-lab-root",position:pose.position,rotation:pose.rotation}],diagnostics:[]});
    completed=true;
  });
  try {
    await sleep(900);
    const controller=findSceneObjectByName("SurfacePlacementController");
    const find=(object:SceneObject):SingleSurface|undefined=>{
      const surface=object.getComponent(SingleSurface.getTypeName()) as SingleSurface;
      if(surface)return surface;
      for(const child of object.children){const found=find(child);if(found)return found;}
    };
    const surface=find(controller);
    expect(surface).toBeTruthy();
    const rawPosition=surface.desiredPosition;
    const rawRotation=surface.desiredRotation;
    print("VIRO_GENERATED placement:pending " + JSON.stringify({positionCm:[rawPosition.x,rawPosition.y,rawPosition.z],rotation:[rawRotation.x,rawRotation.y,rawRotation.z,rawRotation.w],interactable:surface.interactable.getSceneObject().name}));
    const interactor=new DefaultLeafInteractor();
    await interactor.hover(surface.interactable,300);
    await interactor.trigger(surface.interactable);
    for(let attempt=0;attempt<40&&!completed;attempt++)await sleep(100);

    // Vertical placement only confirms once SurfacePlacement's second calibration
    // step is enabled, and Vertical.updateCalibration enables it on
    // Math.abs(normal.y) < 0.15 && Math.abs(normal.y) > 0.0001. Preview's
    // simulated wall is exactly axis-aligned, so its normal.y lands around 1e-7
    // and falls under that lower bound. A real wall is never that exact. So on
    // hardware this confirms, and in Preview it provably cannot — assert what
    // Viro owns either way, and never claim the native confirmation we did not get.
    if (completed) {
      const placed=runtime.getNode("platform-lab-root").getTransform();
      expect(placed.getWorldPosition().distance(new vec3(poseResult.position[0]*100,poseResult.position[1]*100,poseResult.position[2]*100))).toBeLessThan(0.01);
      const rotation=placed.getWorldRotation();
      expect(Math.abs(rotation.w-poseResult.rotation[3])).toBeLessThan(0.001);
      expect(Math.abs(rotation.x-poseResult.rotation[0])).toBeLessThan(0.001);
    }

    cancel();
    await sleep(100);
    expect(world.isPlacementActive).toBe(false);
    expect(controller.children.some(child=>Boolean(find(child)))).toBe(false);
    const posesAfterCancel=completed;
    await sleep(150);
    expect(completed).toBe(posesAfterCancel);

    print("VIRO_GENERATED placement:live " + (completed ? "PASS " : "PARTIAL ") + JSON.stringify({
      nativeConfirmation: completed,
      nativeConfirmationUnavailableReason: completed ? null
        : "SurfacePlacement Vertical requires |hit normal.y| > 0.0001; Preview's axis-aligned wall reports ~1e-7",
      pose: completed ? poseResult : null,
      sceneUpdated: completed,
      sessionStarted: true,
      active: world.isPlacementActive,
      detectorDisposed: true,
      lateCallbacksAfterCancel: 0,
    }));
  } finally {cancel();}
}
