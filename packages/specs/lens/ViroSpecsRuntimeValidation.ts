import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
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
