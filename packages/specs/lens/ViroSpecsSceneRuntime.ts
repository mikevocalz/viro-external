import type {
  ViroSpecsRenderCommand,
  ViroSpecsRenderPlan,
  ViroSpecsRenderPrimitive,
} from "./ViroSpecsProtocol";
import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame";
import {
  GradientParameters,
  RoundedRectangle,
} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle";
import { ScrollWindow } from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { ViroSpecsAssetRegistry } from "./ViroSpecsAssetRegistry";

type ScrollBarParts = {
  root: SceneObject;
  hit: BoxShape;
  collider: ColliderComponent;
  track: RoundedRectangle;
  knob: RoundedRectangle;
  up: SceneObject;
  down: SceneObject;
};

type NodeRecord = {
  object: SceneObject;
  primitive: ViroSpecsRenderPrimitive;
  text?: Text;
  image?: Image;
  instantiatedModel?: SceneObject;
  scroll?: ScrollWindow;
  scrollBar?: ScrollBarParts;
  videoControls?: SceneObject;
  /** Requested video box in cm; the video fits its source aspect inside it. */
  videoBox?: vec2;
  wantsVideoControls?: boolean;
  parentId?: string;
  /** True when this node sits inside a scroll or panel, i.e. a UI layout context. */
  /** Scroll content height in cm, once a content command has set it. */
  scrollContentHeight?: number;
  frame?: Frame;
  surface?: RoundedRectangle;
  video?: Image;
};

/**
 * Executes ViroSpecsRenderPlan against live Lens Studio SceneObjects.
 *
 * This class deliberately owns only renderer mechanics. Scene compilation,
 * Viro semantics, and diagnostics stay in the portable TypeScript package.
 */
/** Flat surfaces sit above panel chrome but below scene content. */
const SURFACE_RENDER_ORDER = 50;

/** Draw text, images and video above any panel surface beneath them. */
const CONTENT_RENDER_ORDER = 100;
/** Video control bar height and its gap under the video, in cm. */
const VIDEO_BAR_HEIGHT = 5;
const VIDEO_BAR_GAP = 1;

export class ViroSpecsSceneRuntime {
  private readonly nodes = new Map<string, NodeRecord>();

  constructor(
    private readonly root: SceneObject,
    private readonly assets: ViroSpecsAssetRegistry
  ) {}

  apply(plan: ViroSpecsRenderPlan): void {
    const errors = plan.diagnostics.filter((diagnostic) => diagnostic.level === "error");
    if (errors.length > 0) {
      throw new Error(
        "Specs render plan contains errors: " +
          errors.map((diagnostic) => diagnostic.message).join(" ")
      );
    }

    for (const command of plan.commands) {
      this.applyCommand(command);
    }
  }

  removeNode(id: string): void {
    const record = this.nodes.get(id);
    if (!record) {
      return;
    }

    if (!isNull(record.object)) record.object.destroy();
    this.nodes.delete(id);
  }

  clear(): void {
    for (const record of this.nodes.values()) {
      if (!isNull(record.object)) record.object.destroy();
    }
    this.nodes.clear();
  }

  getSceneObject(id: string): SceneObject | null {
    return this.nodes.get(id)?.object ?? null;
  }

  private applyCommand(command: ViroSpecsRenderCommand): void {
    switch (command.op) {
      case "create":
        this.createNode(
          command.id,
          command.primitive,
          command.parentId
        );
        return;

      case "transform":
        this.applyTransform(command);
        return;

      case "content":
        this.applyContent(command);
        return;

      case "visibility":
        this.requireNode(command.id).object.enabled = command.visible;
        return;
    }
  }

  private createNode(
    id: string,
    primitive: ViroSpecsRenderPrimitive,
    parentId?: string
  ): void {
    if (this.nodes.has(id)) {
      this.removeNode(id);
    }

    const parentRecord = parentId ? this.requireNode(parentId) : null;
    // A Frame keeps its children under its own `content` object, which it
    // creates on OnStartEvent and fills with whatever is already parented to
    // the Frame. Children created after that go into `content` directly.
    const frameContent = parentRecord?.frame?.content;
    const parent = frameContent && !isNull(frameContent)
      ? frameContent
      : parentRecord
        ? parentRecord.object
        : this.root;

    const object = global.scene.createSceneObject("viro:" + id);
    object.setParent(parent);

    const record: NodeRecord = { object, primitive, parentId };
    // Panel and scroll children stay plain 3D objects. A ScrollWindow scrolls
    // and masks whatever sits under its internal scroller, and `addObject` is
    // the public way in once it is initialized (as in specs-devs/samples Agent
    // Manager ChatMessageList).
    if (parentRecord?.scroll) parentRecord.scroll.addObject(object);

    switch (primitive) {
      case "text":
        record.text = object.createComponent("Component.Text") as Text;
        if (this.assets.defaultFont) record.text.font = this.assets.defaultFont;
        record.text.depthTest = true;
        record.text.size = 48;
        record.text.horizontalAlignment = HorizontalAlignment.Center;
        record.text.horizontalOverflow = HorizontalOverflow.Overflow;
        record.text.layoutRect = Rect.create(-36, 36, -4, 4);
        record.text.setRenderOrder(CONTENT_RENDER_ORDER);
        break;

      case "image":
        record.image = object.createComponent("Component.Image") as Image;
        if (this.assets.defaultImageMaterial) {
          record.image.mainMaterial = this.assets.defaultImageMaterial.clone();
        }
        record.image.setRenderOrder(CONTENT_RENDER_ORDER);
        break;

      // UIKit's Frame is what gives a panel visible chrome and situates it in
      // AR space. Unlike ScrollWindow it has no public initialize() in the
      // installed 0.18.0 — it self-initializes on OnStartEvent, and its onAwake
      // adds a collider, an Interactable and an InteractableManipulation, so a
      // panel is grabbable without extra wiring.
      case "ui-frame": {
        record.frame = object.createComponent(Frame.getTypeName()) as Frame;
        // Content is laid out in meters from the panel's centre. Frame's
        // auto-scale would stretch it by innerSize/defaultSize every time the
        // runtime sizes the panel (as in specs-devs/samples Agent Manager
        // HorizontalFrame, which turns it off for the same reason).
        record.frame.autoScaleContent = false;
        // No backplate prefab: Frame draws the panel chrome, and the old
        // placeholder prefab showed as a second box inside it.
        break;
      }

      // Per the SPECS UIKit ScrollWindow docs, the component is created at
      // runtime and then explicitly initialized; window and scroll extents are
      // local-space centimetres. Children scroll directly as its SceneObject
      // children, so no separate content object is needed.
      // A plain tinted rectangle: no Frame, so no glass, collider, billboard or
      // interaction plane, and no extra floating pane in the scene.
      case "flat-surface": {
        const surface = object.createComponent(
          RoundedRectangle.getTypeName()
        ) as RoundedRectangle;
        surface.initialize();
        surface.renderMeshVisual.setRenderOrder(SURFACE_RENDER_ORDER);
        record.surface = surface;
        break;
      }

      case "scroll-window": {
        // The node's object is a holder that takes the transform. ScrollWindow
        // lays itself out with anchors around its own origin, so it sits on a
        // child at identity (as in specs-devs/samples ChatMessageList), and
        // the scrollbar sits beside it in the same holder.
        const windowObject = global.scene.createSceneObject("viro:scroll-window");
        windowObject.setParent(object);
        windowObject.layer = object.layer;
        const scroll = windowObject.createComponent(
          ScrollWindow.getTypeName()
        ) as ScrollWindow;
        scroll.initialize();
        scroll.vertical = true;
        scroll.horizontal = false;
        // Without masking, rows draw outside the viewport instead of clipping.
        scroll.maskingEnabled = true;
        record.scroll = scroll;
        // A ScrollBar would give the region a visible affordance, but the
        // installed SpectaclesUIKit 0.18.0 keeps ScrollBar.scrollWindow and
        // .slider private and ships no initialize(), unlike its docs. It has to
        // be wired from the editor, so a scroll node stays bar-less for now.
        break;
      }

      case "video-surface":
        record.video = object.createComponent("Component.Image") as Image;
        if (this.assets.defaultImageMaterial) {
          record.video.mainMaterial = this.assets.defaultImageMaterial.clone();
        }
        record.video.setRenderOrder(CONTENT_RENDER_ORDER);
        break;

      case "scene-object":
      case "render-mesh":
        break;
    }

    this.nodes.set(id, record);
  }

  private applyTransform(
    command: Extract<ViroSpecsRenderCommand, { op: "transform" }>
  ): void {
    const record = this.requireNode(command.id);
    const transform = record.object.getTransform();

    if (command.position) {
      // Viro spatial positions are meters; Lens Studio world units are cm.
      const position = new vec3(
        command.position[0] * 100,
        command.position[1] * 100,
        command.position[2] * 100
      );
      transform.setLocalPosition(position);
    }

    if (command.rotation) {
      transform.setLocalRotation(
        new quat(
          command.rotation[3],
          command.rotation[0],
          command.rotation[1],
          command.rotation[2]
        )
      );
    }

    // Surfaces are measured, not scaled: Lens lays an Image, a Frame and a
    // ScrollWindow out from a width and a height, so SceneObject scale would
    // leave them at the component's own default size.
    if (command.sizeMeters) {
      this.applySurfaceSize(
        record,
        command.sizeMeters[0],
        command.sizeMeters[1]
      );
    }

    if (command.scale) {
      transform.setLocalScale(
        new vec3(
          command.scale[0],
          command.scale[1],
          command.scale[2]
        )
      );
    }
  }

  /**
   * Size a Frame, then make the new size its 1x baseline and let it scale its
   * content. A corner pinch then resizes the panel and everything in it
   * uniformly (Frame's allowNonUniformScaling is off), so content keeps its
   * aspect ratio. Auto-scale stays off until the baseline is synced, or the
   * runtime's own sizing would stretch content by innerSize / default size.
   */
  private resizeFrame(frame: Frame, innerSize: vec2): void {
    frame.autoScaleContent = false;
    frame.innerSize = innerSize;
    frame.syncScaleBaseline();
    frame.autoScaleContent = true;
  }

  /**
   * Fit the video to its source's aspect ratio inside the requested box, then
   * rebuild its controls and, when it sits in a panel, wrap the panel around
   * the video and its control bar. Runs once the source reports its size.
   */
  private adaptVideo(record: NodeRecord): void {
    const texture = record.video?.mainPass.baseTex;
    const box = record.videoBox;
    if (!texture || !box) return;
    const sourceW = texture.getWidth();
    const sourceH = texture.getHeight();
    if (sourceW <= 0 || sourceH <= 0) return;

    const aspect = sourceW / sourceH;
    const width = Math.min(box.x, box.y * aspect);
    const height = width / aspect;
    record.object.getTransform().setLocalScale(new vec3(width, height, 1));

    if (record.videoControls && !isNull(record.videoControls)) {
      record.videoControls.destroy();
    }
    record.videoControls = undefined;
    const barHeight = record.wantsVideoControls ? VIDEO_BAR_HEIGHT + VIDEO_BAR_GAP : 0;
    if (record.wantsVideoControls) this.createVideoControls(record);

    const parent = record.parentId ? this.nodes.get(record.parentId) : undefined;
    const frame = parent?.frame;
    if (!frame || isNull(frame)) return;
    // Centre video plus bar in the panel.
    const position = record.object.getTransform().getLocalPosition();
    record.object
      .getTransform()
      .setLocalPosition(new vec3(position.x, barHeight / 2, position.z));
    frame.onInitialized.add(() => {
      if (!isNull(frame)) this.resizeFrame(frame, new vec2(width, height + barHeight));
    });
  }

  private applySurfaceSize(
    record: NodeRecord,
    widthMeters: number,
    heightMeters: number
  ): void {
    const width = widthMeters * 100;
    const height = heightMeters * 100;

    if (record.frame) {
      // Frame's innerSize setter calls scaleFrame(), which reads state the
      // component only builds in its own OnStartEvent — assigning it in the
      // same frame throws "Cannot read property 'setSize' of undefined". The
      // installed 0.18.0 exposes no readiness event, so apply the size on the
      // next frame, once every OnStartEvent has run. ViroSpecsPlatformLab
      // defers its SIK wiring for the same reason.
      // Frame builds the state innerSize touches during its own OnStartEvent.
      // onInitialized is a ReplayEvent, so this is safe whether the Frame is
      // already up or not.
      const frame = record.frame;
      frame.onInitialized.add(() => {
        if (isNull(frame)) return;
        this.resizeFrame(frame, new vec2(width, height));
      });
      return;
    }

    if (record.scroll) {
      // The ScrollWindow docs call setWindowSize/setScrollDimensions, but those
      // are private in the installed SpectaclesUIKit 0.18.0 — it exposes the
      // windowSize/scrollDimensions setters instead.
      record.scroll.windowSize = new vec2(width, height);
      this.applyScrollContent(record);
      return;
    }

    // RoundedRectangle is measured in cm by its own `size`; scaling its object
    // like the Image quad below would multiply its default size instead.
    if (record.surface) {
      record.surface.size = new vec2(width, height);
      return;
    }

    if (record.video) record.videoBox = new vec2(width, height);

    // Images and video are sized by scaling the Image component's own 1 cm
    // quad (measured in Preview: scale 0.45 drew a 0.45 cm thumbnail), so they
    // stay plain 3D objects that a Frame grab or a ScrollWindow can move.
    record.object
      .getTransform()
      .setLocalScale(new vec3(width, height, 1));

    // An Image reports no mesh bounds, so a fitVisual collider comes out
    // degenerate and no ray ever hits it. Give the surface a box matching the
    // quad it draws, in local units, so it can be hovered and grabbed.
    const existingCollider = record.object.getComponent(
      "ColliderComponent"
    ) as ColliderComponent | null;
    const collider =
      existingCollider ??
      (record.object.createComponent(
        "ColliderComponent"
      ) as ColliderComponent);
    const shape = Shape.createBoxShape();
    shape.size = new vec3(1, 1, 1);
    collider.shape = shape;
    collider.fitVisual = false;
  }

  /**
   * Content taller than the window scrolls. ScrollWindow centres content on
   * its scroller, so the region opens at its top edge, -content/2 + window/2.
   */
  private applyScrollContent(record: NodeRecord): void {
    const scroll = record.scroll;
    if (!scroll) return;
    const window = scroll.windowSize;
    const content = Math.max(record.scrollContentHeight ?? window.y, window.y);
    scroll.scrollDimensions = new vec2(window.x, content);
    scroll.scrollPosition = new vec2(0, -content / 2 + window.y / 2);
    this.updateScrollBar(record);
  }

  /**
   * A side scrollbar just outside the window's right edge: a track, a knob you can pinch and drag up or down,
   * and up/down buttons at the ends that page by one window. Built from
   * RoundedRectangles the way specs-devs/samples Agent Manager
   * `createVerticalScrollBar` does, because the installed UI Kit 0.18.0
   * ScrollBar can only be wired in the editor.
   */
  private updateScrollBar(record: NodeRecord): void {
    const scroll = record.scroll;
    if (!scroll) return;
    const bar = record.scrollBar ?? (record.scrollBar = this.createScrollBar(record, scroll));
    const window = scroll.windowSize;
    const content = scroll.scrollDimensions.y;
    const thickness = 0.8;
    const button = 2.4;

    const visible = content > window.y + 0.01;
    bar.root.enabled = visible;
    if (!visible) return;

    // Just outside the window, as the sample does (windowWidth / 2 + gap):
    // inside it, ScrollWindow's own collider swallowed the pinch.
    const x = window.x / 2 + button / 2 + 0.6;
    bar.root.getTransform().setLocalPosition(new vec3(x, 0, 1));
    const trackHeight = window.y - button * 2 - 1.6;
    bar.track.size = new vec2(thickness, trackHeight);
    bar.track.cornerRadius = thickness / 2;
    bar.hit.size = new vec3(button, trackHeight, 1);
    bar.collider.shape = bar.hit;
    bar.up.getTransform().setLocalPosition(new vec3(0, window.y / 2 - button / 2 - 0.4, 0.2));
    bar.down.getTransform().setLocalPosition(new vec3(0, -window.y / 2 + button / 2 + 0.4, 0.2));

    // scrollPositionNormalized.y is position / topEdge: 1 at the top of the
    // content, -1 at the bottom. t is 0 at the top.
    const knobHeight = Math.max(3, (trackHeight * window.y) / content);
    const t = (1 - scroll.scrollPositionNormalized.y) / 2;
    bar.knob.size = new vec2(thickness, knobHeight);
    bar.knob.cornerRadius = thickness / 2;
    bar.knob.sceneObject
      .getTransform()
      .setLocalPosition(
        new vec3(0, trackHeight / 2 - knobHeight / 2 - t * (trackHeight - knobHeight), 0.2)
      );
  }

  /**
   * A control bar under a video: play/pause, a seek track you can pinch or
   * drag, a progress fill with a knob, and elapsed / total time.
   *
   * It is a child of the video so a grab carries it. The video object is
   * scaled to its size in cm (the Image quad is 1 cm), so the bar's root
   * undoes that scale and everything inside is laid out in cm.
   */
  private createVideoControls(record: NodeRecord): void {
    const texture = record.video?.mainPass.baseTex;
    const control = texture?.control as VideoTextureProvider | undefined;
    if (!control || record.videoControls) return;

    const size = record.object.getTransform().getLocalScale();
    const width = size.x;
    const barHeight = VIDEO_BAR_HEIGHT;
    const gap = VIDEO_BAR_GAP;
    const root = global.scene.createSceneObject("viro:video-controls");
    root.setParent(record.object);
    root.layer = record.object.layer;
    root.getTransform().setLocalScale(new vec3(1 / size.x, 1 / size.y, 1));
    // Local y of the quad's bottom edge is -0.5, which is -height/2 in cm.
    root.getTransform().setLocalPosition(
      new vec3(0, -0.5 - (gap + barHeight / 2) / size.y, 0.01)
    );
    record.videoControls = root;

    const rect = (name: string, w: number, h: number, color: vec4, order: number, x = 0, z = 0) => {
      const object = global.scene.createSceneObject(name);
      object.setParent(root);
      object.layer = root.layer;
      object.getTransform().setLocalPosition(new vec3(x, 0, z));
      const r = object.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle;
      r.initialize();
      r.size = new vec2(w, h);
      r.cornerRadius = h / 2;
      r.backgroundColor = color;
      r.setBackgroundGradient({
        enabled: true, type: "Linear", start: new vec2(0, 1), end: new vec2(0, -1),
        stop0: { enabled: true, percent: 0, color }, stop1: { enabled: true, percent: 1, color },
      });
      r.renderMeshVisual.setRenderOrder(order);
      r.renderMeshVisual.mainPass.blendMode = BlendMode.PremultipliedAlphaAuto;
      return r;
    };
    const label = (name: string, parent: SceneObject, value: string, size: number, x = 0) => {
      const object = global.scene.createSceneObject(name);
      object.setParent(parent);
      object.layer = parent.layer;
      object.getTransform().setLocalPosition(new vec3(x, 0, 0.2));
      const text = object.createComponent("Component.Text") as Text;
      if (this.assets.defaultFont) text.font = this.assets.defaultFont;
      text.text = value;
      text.size = size;
      text.horizontalAlignment = HorizontalAlignment.Center;
      text.verticalAlignment = VerticalAlignment.Center;
      text.setRenderOrder(CONTENT_RENDER_ORDER + 1);
      return text;
    };
    const hitBox = (object: SceneObject, w: number, h: number) => {
      const box = Shape.createBoxShape();
      box.size = new vec3(w, h, 1);
      const collider = object.createComponent("ColliderComponent") as ColliderComponent;
      collider.fitVisual = false;
      collider.shape = box;
      return object.createComponent(Interactable.getTypeName()) as Interactable;
    };

    rect("viro:video-bar", width, barHeight, new vec4(0.06, 0.07, 0.09, 0.85), SURFACE_RENDER_ORDER);

    // Play / pause.
    const buttonX = -width / 2 + barHeight / 2 + 0.5;
    const button = rect("viro:video-play", 3.6, 3.6, new vec4(1, 1, 1, 0.16), CONTENT_RENDER_ORDER, buttonX, 0.1);
    const glyph = label("viro:video-play-label", button.sceneObject, "❚❚", 44);
    const playing = () => control.status === VideoStatus.Playing;
    hitBox(button.sceneObject, 3.6, 3.6).onTriggerEnd.add(() => {
      if (playing()) control.pause();
      else if (control.status === VideoStatus.Paused) control.resume();
      else control.play(-1);
    });

    // Time readout on the right; the seek track fills the space between.
    const timeWidth = 11;
    const timeX = width / 2 - timeWidth / 2 - 0.5;
    const time = label("viro:video-time", root, "0:00 / 0:00", 34, timeX);
    const trackLeft = buttonX + 3.6 / 2 + 1.5;
    const trackRight = timeX - timeWidth / 2 - 1;
    const trackWidth = Math.max(4, trackRight - trackLeft);
    const trackX = trackLeft + trackWidth / 2;
    const track = rect("viro:video-track", trackWidth, 0.6, new vec4(1, 1, 1, 0.22), CONTENT_RENDER_ORDER, trackX, 0.1);
    const fill = rect("viro:video-progress", 0.6, 0.6, new vec4(0.36, 0.62, 0.98, 1), CONTENT_RENDER_ORDER + 1, trackLeft, 0.15);
    const knob = rect("viro:video-knob", 1.6, 1.6, new vec4(1, 1, 1, 1), CONTENT_RENDER_ORDER + 2, trackLeft, 0.2);

    // Seek: pinch anywhere on the track, or drag along it.
    const seekHit = global.scene.createSceneObject("viro:video-seek");
    seekHit.setParent(root);
    seekHit.layer = root.layer;
    seekHit.getTransform().setLocalPosition(new vec3(trackX, 0, 0.3));
    const seek = hitBox(seekHit, trackWidth, barHeight);
    seek.enableInstantDrag = true;
    let scrubbing = false;
    const seekTo = (point: vec3 | null | undefined) => {
      if (!point) return;
      const local = root.getTransform().getInvertedWorldTransform().multiplyPoint(point);
      const t = Math.min(1, Math.max(0, (local.x - trackLeft) / trackWidth));
      if (control.totalDuration > 0) control.seek(t * control.totalDuration);
    };
    seek.onTriggerStart.add((event) => {
      scrubbing = true;
      seekTo(event.interactor.planecastPoint);
    });
    seek.onDragUpdate.add((event) => seekTo(event.interactor.planecastPoint));
    const endScrub = () => { scrubbing = false; };
    seek.onTriggerEnd.add(endScrub);
    seek.onTriggerCanceled.add(endScrub);

    const clock = (seconds: number) => {
      const whole = Math.max(0, Math.floor(seconds));
      return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
    };
    const driver = root.createComponent("Component.ScriptComponent") as ScriptComponent;
    driver.createEvent("UpdateEvent").bind(() => {
      if (isNull(root)) return;
      const total = control.totalDuration;
      const t = total > 0 ? Math.min(1, control.currentTime / total) : 0;
      const filled = Math.max(0.6, t * trackWidth);
      fill.size = new vec2(filled, 0.6);
      fill.sceneObject.getTransform().setLocalPosition(new vec3(trackLeft + filled / 2, 0, 0.15));
      knob.sceneObject.getTransform().setLocalPosition(
        new vec3(trackLeft + t * trackWidth, 0, 0.2)
      );
      knob.size = scrubbing ? new vec2(2.2, 2.2) : new vec2(1.6, 1.6);
      knob.cornerRadius = knob.size.x / 2;
      glyph.text = playing() ? "❚❚" : "▶";
      time.text = clock(control.currentTime) + " / " + clock(total);
    });
  }

  private createScrollBar(record: NodeRecord, scroll: ScrollWindow): ScrollBarParts {
    // A sibling of the ScrollWindow, as in the sample: ScrollWindow toggles
    // every collider in its own subtree and its Interactable takes the pinch,
    // so a child bar was never hit and dragging it scrolled the content in
    // touch direction instead.
    const root = global.scene.createSceneObject("viro:scroll-bar");
    root.setParent(record.object);
    root.layer = record.object.layer;

    const fill = (bar: RoundedRectangle, color: vec4) => {
      bar.backgroundColor = color;
      bar.setBackgroundGradient({
        enabled: true,
        type: "Linear",
        start: new vec2(0, 1),
        end: new vec2(0, -1),
        stop0: { enabled: true, percent: 0, color },
        stop1: { enabled: true, percent: 1, color },
      });
    };
    const rect = (name: string, parent: SceneObject, color: vec4, order: number) => {
      const object = global.scene.createSceneObject(name);
      object.setParent(parent);
      object.layer = parent.layer;
      const bar = object.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle;
      bar.initialize();
      fill(bar, color);
      bar.renderMeshVisual.setRenderOrder(order);
      // Without this the track's low alpha draws opaque and hides the knob.
      bar.renderMeshVisual.mainPass.blendMode = BlendMode.PremultipliedAlphaAuto;
      bar.renderMeshVisual.mainPass.colorMask = new vec4b(true, true, true, true);
      return bar;
    };
    const KNOB = new vec4(1, 1, 1, 0.7);
    const KNOB_ACTIVE = new vec4(1, 1, 1, 0.95);
    const track = rect("viro:scroll-track", root, new vec4(1, 1, 1, 0.12), SURFACE_RENDER_ORDER);
    const knob = rect("viro:scroll-knob", root, KNOB, CONTENT_RENDER_ORDER);

    // Knob drag: map the pinch point on the track to a scroll position.
    const hit = Shape.createBoxShape();
    const collider = root.createComponent("ColliderComponent") as ColliderComponent;
    collider.fitVisual = false;
    collider.shape = hit;
    const drag = root.createComponent(Interactable.getTypeName()) as Interactable;
    drag.enableInstantDrag = true;
    drag.onTriggerStart.add(() => {
      scroll.isControlledExternally = true;
      fill(knob, KNOB_ACTIVE);
    });
    drag.onDragUpdate.add((event) => {
      const point = event.interactor.planecastPoint;
      if (!point) return;
      const local = root.getTransform().getInvertedWorldTransform().multiplyPoint(point);
      const half = track.size.y / 2;
      const normalized = Math.min(1, Math.max(-1, local.y / half));
      scroll.scrollPositionNormalized = new vec2(scroll.scrollPositionNormalized.x, normalized);
    });
    const endDrag = () => {
      scroll.isControlledExternally = false;
      fill(knob, KNOB);
    };
    drag.onDragEnd.add(endDrag);
    drag.onTriggerCanceled.add(endDrag);

    // Up/down page by one window, clamped to the ends.
    const page = (direction: number) => {
      const window = scroll.windowSize.y;
      const travel = scroll.scrollDimensions.y - window;
      if (travel <= 0) return;
      const step = (2 * window) / travel;
      const next = Math.min(1, Math.max(-1, scroll.scrollPositionNormalized.y + direction * step));
      scroll.scrollPositionNormalized = new vec2(scroll.scrollPositionNormalized.x, next);
    };
    const arrow = (name: string, label: string, direction: number) => {
      const object = global.scene.createSceneObject(name);
      object.setParent(root);
      object.layer = root.layer;
      const face = object.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle;
      face.initialize();
      face.size = new vec2(2.4, 2.4);
      face.cornerRadius = 1.2;
      fill(face, new vec4(1, 1, 1, 0.18));
      face.renderMeshVisual.setRenderOrder(SURFACE_RENDER_ORDER);
      face.renderMeshVisual.mainPass.blendMode = BlendMode.PremultipliedAlphaAuto;
      const glyph = global.scene.createSceneObject(name + "-label");
      glyph.setParent(object);
      glyph.layer = object.layer;
      glyph.getTransform().setLocalPosition(new vec3(0, 0, 0.1));
      const text = glyph.createComponent("Component.Text") as Text;
      if (this.assets.defaultFont) text.font = this.assets.defaultFont;
      text.text = label;
      text.size = 60;
      text.horizontalAlignment = HorizontalAlignment.Center;
      text.verticalAlignment = VerticalAlignment.Center;
      text.setRenderOrder(CONTENT_RENDER_ORDER);
      const box = Shape.createBoxShape();
      box.size = new vec3(2.4, 2.4, 1);
      const hitArea = object.createComponent("ColliderComponent") as ColliderComponent;
      hitArea.fitVisual = false;
      hitArea.shape = box;
      const press = object.createComponent(Interactable.getTypeName()) as Interactable;
      press.onTriggerEnd.add(() => page(direction));
      return object;
    };
    const up = arrow("viro:scroll-up", "▲", 1);
    const down = arrow("viro:scroll-down", "▼", -1);

    scroll.onScrollPositionUpdated.add(() => this.updateScrollBar(record));
    scroll.onScrollDimensionsUpdated.add(() => this.updateScrollBar(record));
    return { root, hit, collider, track, knob, up, down };
  }

  /**
   * A paragraph: left-aligned, wrapped to a width, growing down from the
   * node's position. layoutRect is in the text object's local units, so the
   * width is divided by the scale the transform command already applied.
   */
  private applyTextWrap(text: Text, wrapWidthMeters: number): void {
    const scale = text.getSceneObject().getTransform().getLocalScale().x || 1;
    const width = (wrapWidthMeters * 100) / scale;
    text.horizontalOverflow = HorizontalOverflow.Wrap;
    text.verticalOverflow = VerticalOverflow.Overflow;
    text.horizontalAlignment = HorizontalAlignment.Left;
    text.verticalAlignment = VerticalAlignment.Top;
    text.layoutRect = Rect.create(0, width, -1, 0);
  }

  private applyContent(
    command: Extract<ViroSpecsRenderCommand, { op: "content" }>
  ): void {
    const record = this.requireNode(command.id);

    if (command.text !== undefined) {
      if (!record.text) {
        throw new Error(
          "Text content supplied to non-text Specs node " + command.id
        );
      }
      record.text.text = command.text;
      if (command.wrapWidthMeters !== undefined) {
        this.applyTextWrap(record.text, command.wrapWidthMeters);
      }
    }

    if (record.scroll && command.contentHeightMeters !== undefined) {
      record.scrollContentHeight = command.contentHeightMeters * 100;
      this.applyScrollContent(record);
      return;
    }

    if (record.surface) {
      this.applySurfaceAppearance(
        record.surface,
        command.tint,
        command.cornerRadiusMeters
      );
      return;
    }

    if (record.frame) {
      this.applyPanelAppearance(
        record.frame,
        command.tint,
        command.cornerRadiusMeters
      );
      return;
    }

    if (command.source === undefined) {
      return;
    }

    if (record.primitive === "image") {
      this.applyImageSource(record, command.source, command.id);
      this.applyFit(record.image, command.fit);
      return;
    }

    if (record.primitive === "render-mesh") {
      this.applyModelSource(record, command.source, command.id);
      return;
    }

    if (record.primitive === "video-surface") {
      this.applyVideoSource(record, command.source, command.id);
      this.applyFit(record.video, command.fit);
      record.wantsVideoControls = command.controls === true;
      if (record.wantsVideoControls) this.createVideoControls(record);
      // Adapt to the source's aspect now if it is known, and again once the
      // video reports ready (a video texture has no size before that).
      this.adaptVideo(record);
      const control = record.video?.mainPass.baseTex?.control as VideoTextureProvider | undefined;
      control?.onPlaybackReady.add(() => this.adaptVideo(record));
      return;
    }

    throw new Error(
      "Source content is unsupported for Specs primitive " +
        record.primitive +
        " (" +
        command.id +
        ")"
    );
  }

  private applyImageSource(
    record: NodeRecord,
    source: string,
    id: string
  ): void {
    if (!record.image) {
      throw new Error("Missing Image component for Specs node " + id);
    }

    const texture = this.assets.resolveImage(source);
    if (!texture) {
      throw new Error(
        "Specs image asset is not registered: " + source + " (" + id + ")"
      );
    }

    // UIKit/Image materials can differ by project. If the image already has a
    // material, assigning baseTex is the least invasive portable behavior.
    if (!record.image.mainMaterial) {
      throw new Error(
        "Specs Image node requires an Image material before setting source: " + id
      );
    }

    record.image.mainPass.baseTex = texture;
  }

  /**
   * Lens expresses fit as StretchMode on the Image component. Default to cover,
   * because Stretch (the component default) distorts any texture whose aspect
   * ratio differs from the surface.
   */
  private applyFit(
    image: Image | undefined,
    fit: "cover" | "contain" | "stretch" | undefined
  ): void {
    if (!image) return;
    if (fit === "contain") {
      image.stretchMode = StretchMode.Fit;
      return;
    }
    if (fit === "stretch") {
      image.stretchMode = StretchMode.Stretch;
      return;
    }
    // Cover crops. Fill scales the same way but draws the overflow past the
    // node's bounds, which pushed a portrait texture out of its panel slot.
    image.stretchMode = StretchMode.FillAndCut;
  }

  /**
   * UIKit's default frame chrome is a pale translucent plate, which disappears
   * against a light room.
   *
   * Setting Frame.roundedRectangle's colour does not take — it is only non-null
   * while the current visual is the default. Path Pioneer's
   * UIKitCustomVisualsFrame shows the supported route: parent a RoundedRectangle
   * of your own to the Frame and lift it one render-order step above the glass,
   * which leaves it below the Frame's child content.
   */
  /** Fill a flat surface. Shared with the layered panel backplate. */
  private applySurfaceAppearance(
    surface: RoundedRectangle,
    tint: [number, number, number, number] | undefined,
    cornerRadiusMeters: number | undefined
  ): void {
    if (cornerRadiusMeters !== undefined) {
      surface.cornerRadius = cornerRadiusMeters * 100;
    }
    if (!tint) return;

    // RoundedRectangle draws its background from the gradient, not from
    // backgroundColor, so a flat fill is a gradient whose stops share a colour,
    // lifted slightly at the top so it reads as a lit surface.
    const [r, g, b, a] = tint;
    const lift = 0.06;
    surface.setBackgroundGradient({
      enabled: true,
      type: "Linear",
      start: new vec2(0, 1),
      end: new vec2(0, -1),
      stop0: {
        enabled: true,
        percent: 0,
        color: new vec4(r + lift, g + lift, b + lift, a),
      },
      stop1: { enabled: true, percent: 1, color: new vec4(r, g, b, a) },
    });
  }

  private applyPanelAppearance(
    frame: Frame,
    tint: [number, number, number, number] | undefined,
    cornerRadiusMeters: number | undefined
  ): void {
    if (!tint && cornerRadiusMeters === undefined) return;

    frame.onInitialized.add(() => {
      if (isNull(frame)) return;

      const object = global.scene.createSceneObject("viro:panel-surface");
      object.setParent(frame.sceneObject);
      object.layer = frame.sceneObject.layer;
      object.getTransform().setLocalPosition(vec3.zero());

      const surface = object.createComponent(
        RoundedRectangle.getTypeName()
      ) as RoundedRectangle;
      const glass = frame.roundedRectangle;
      surface.cornerRadius =
        cornerRadiusMeters !== undefined
          ? cornerRadiusMeters * 100
          : glass
            ? glass.cornerRadius
            : 2;
      surface.initialize();
      surface.size = frame.innerSize;

      if (tint) {
        // backgroundColor alone does not reach the shader on a layered surface;
        // the visual draws its background from the gradient, which is the path
        // Path Pioneer's frame styling uses. A flat tint is a gradient whose
        // stops share a colour, lifted slightly at the top so the panel reads
        // as a lit surface rather than a sticker.
        const [r, g, b, a] = tint;
        const lift = 0.06;
        const gradient: GradientParameters = {
          enabled: true,
          type: "Linear",
          start: new vec2(0, 1),
          end: new vec2(0, -1),
          stop0: {
            enabled: true,
            percent: 0,
            color: new vec4(r + lift, g + lift, b + lift, a),
          },
          stop1: {
            enabled: true,
            percent: 1,
            color: new vec4(r, g, b, a),
          },
        };
        surface.setBackgroundGradient(gradient);
        surface.borderColor = new vec4(1, 1, 1, 0.12);
      }
      // One step above the Frame's own glass, or the pale default wins the tie
      // and the tint never shows. Scene content is pushed above both by
      // CONTENT_RENDER_ORDER, since a portable scene parents content to the
      // scene root rather than to the Frame.
      if (glass) {
        surface.renderMeshVisual.setRenderOrder(
          glass.renderMeshVisual.getRenderOrder() + 1
        );
      }
      // The Frame rescales on drag, so the surface has to follow it.
      frame.onScalingUpdate.add(() => {
        if (!isNull(surface)) surface.size = frame.innerSize;
      });
    });
  }

  private applyVideoSource(
    record: NodeRecord,
    source: string,
    id: string
  ): void {
    if (!record.video) {
      throw new Error("Missing Image component for Specs video node " + id);
    }

    const texture = this.assets.resolveVideo(source);
    if (!texture) {
      throw new Error(
        "Specs video asset is not registered: " + source + " (" + id + ")"
      );
    }

    if (!record.video.mainMaterial) {
      throw new Error(
        "Specs video node requires an Image material before setting source: " + id
      );
    }

    record.video.mainPass.baseTex = texture;

    // An imported video is a Texture whose control drives playback. Guard the
    // cast: a still assigned to a video node would otherwise fail silently.
    const control = texture.control as VideoTextureProvider | null;
    if (!control || typeof control.play !== "function") {
      throw new Error(
        "Specs video asset has no VideoTextureProvider: " + source + " (" + id + ")"
      );
    }
    // Negative playCount loops indefinitely.
    control.play(-1);
  }

  private applyModelSource(
    record: NodeRecord,
    source: string,
    id: string
  ): void {
    const prefab = this.assets.resolveModel(source);
    if (!prefab) {
      throw new Error(
        "Specs model asset is not registered: " + source + " (" + id + ")"
      );
    }

    if (record.instantiatedModel) {
      record.instantiatedModel.destroy();
    }

    record.instantiatedModel = prefab.instantiate(record.object);
    record.instantiatedModel.name = "viro-model:" + id;
  }

  private requireNode(id: string): NodeRecord {
    const record = this.nodes.get(id);
    if (!record) {
      throw new Error("Specs render node does not exist: " + id);
    }
    return record;
  }
}
