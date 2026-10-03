/**
 * The Harlem Courts dashboard and its video panel, written once with
 * @viro-external/ui. In a Viro app it renders as native panels; on Specs,
 * `pnpm specs:scene` maps it to Lens UI Kit Frames, a scroll window, text,
 * images, bars and a video with controls.
 */
import React from "react";
import { Viro3DObject, ViroNode, ViroPolyline, ViroText } from "@reactvision/react-viro";
import {
  PanelBarChart,
  PanelImage,
  PanelLabel,
  PanelRow,
  PanelStack,
  PanelStat,
  PanelSurface,
  RivePanel,
  SpatialPanel,
  VideoPlayerPanel,
} from "@viro-external/ui";

const WEEK = [
  { label: "Mon", value: 12 },
  { label: "Tue", value: 18 },
  { label: "Wed", value: 9 },
  { label: "Thu", value: 22 },
  { label: "Fri", value: 30 },
  { label: "Sat", value: 41 },
  { label: "Sun", value: 27 },
];

const ABOUT =
  "Rucker Park has hosted pickup basketball on 155th Street since the 1950s, " +
  "and the courts still fill from the first warm weekend in spring until the " +
  "lights go off in October. Games run to 21 by ones and twos, winners stay on, " +
  "and the next five call it from the fence. Weekday evenings stay steady " +
  "around a dozen games; Friday and Saturday nights draw the crowd, with the " +
  "Saturday peak this week at 41 games across both courts. Bring water, call " +
  "your own fouls, and check the board by the gate for league nights, when the " +
  "main court closes to pickup from six o'clock.";

const RUNS = [
  { title: "Saturday Morning Run", detail: "8:00 AM  ·  Court 1  ·  open", image: "img/palace" },
  { title: "Over-35 League", detail: "6:30 PM  ·  Court 2  ·  12 signed up", image: "img/cactus" },
  { title: "Youth Clinic", detail: "Sun 10:00 AM  ·  both courts", image: "img/dog" },
];

/**
 * Registered with ViroAnimations in the app, and passed to the Specs mapper,
 * which reads elements without rendering them.
 */
export const animations = {
  platformLabPulse: {
    properties: { scaleX: 1.15, scaleY: 1.15, scaleZ: 1.15, opacity: 0.8 },
    duration: 500,
    easing: "EaseInEaseOut",
  },
};

/**
 * `lessonRiv` is the bytes of assets/moyo_learning_question.riv, which the app
 * loads (for example with expo-asset). The Specs build reads the file itself.
 */
export default function HarlemCourts({
  lessonRiv = new ArrayBuffer(0),
}: { lessonRiv?: ArrayBuffer } = {}): React.ReactElement {
  return (
    <ViroNode viroTag="platform-lab-root" position={[0, 0, -1.5]}>
      <ViroText
        viroTag="platform-lab-title"
        text="Viro Cross-Platform Lab"
        position={[0, 0.4, 0]}
        animation={{ name: "platformLabPulse", run: true, loop: true }}
      />
      <Viro3DObject
        viroTag="platform-lab-model"
        source={{ uri: "examples/visionos-sweep/assets/shiba.glb" }}
        type="GLB"
        position={[-0.2, -0.3, 0]}
        scale={[0.14, 0.14, 0.14]}
        onClick={() => undefined}
        onDrag={() => undefined}
      />
      <ViroPolyline
        viroTag="platform-lab-route"
        points={[[-0.7, -0.32, 0.12], [-0.45, -0.24, 0.12], [-0.2, -0.3, 0.12]]}
        thickness={0.008}
      />

      <SpatialPanel
        tag="platform-lab-panel"
        title="Harlem Courts"
        subtitle="Pickup games, last 7 days"
        width={0.9}
        height={0.6}
        position={[0.5, 0.02, 0]}
      >
        <PanelStack>
          <PanelRow>
            <PanelStack gap={0.012}>
              <PanelImage source={{ uri: "img/palace" }} width={0.34} height={0.22} />
              <PanelLabel text="Rucker Park, 155th St" variant="caption" />
            </PanelStack>
            <PanelBarChart data={WEEK} width={0.4} height={0.24} />
          </PanelRow>

          <PanelRow>
            <PanelStat value="159" caption="games this week" width={0.24} />
            <PanelStat value="41" caption="Saturday peak" width={0.24} />
            <PanelStat value="+18%" caption="vs last week" width={0.24} />
          </PanelRow>

          <PanelLabel text="About the courts" variant="heading" />
          <PanelLabel text={ABOUT} variant="body" wrap />

          <PanelLabel text="Upcoming runs" variant="heading" />
          {RUNS.map((run) => (
            <PanelSurface key={run.title} width={0.78} height={0.088}>
              <PanelRow gap={0.02}>
                <PanelImage source={{ uri: run.image }} width={0.07} height={0.07} />
                <PanelStack gap={0.006}>
                  <PanelLabel text={run.title} variant="label" width={0.6} />
                  <PanelLabel text={run.detail} variant="caption" width={0.6} />
                </PanelStack>
              </PanelRow>
            </PanelSurface>
          ))}
        </PanelStack>
      </SpatialPanel>

      <VideoPlayerPanel
        tag="platform-lab-video-panel"
        title="Courtside"
        source={{ uri: "media/demo" }}
        width={0.6}
        height={0.34}
        position={[-0.46, 0.02, 0]}
      />

      <RivePanel
        tag="platform-lab-lesson"
        width={0.56}
        height={0.35}
        position={[-0.46, 0.46, 0]}
        rive={{ source: { rivBytes: lessonRiv, stateMachine: "QuestionFlow" } }}
        specs={{
          file: "assets/moyo_learning_question.riv",
          // The Rive CLI's `rive inspect --json` for this file's RML project;
          // its listener hit shapes become the panel's buttons.
          inspect: "assets/moyo_learning_question.inspect.json",
          clips: {
            Loading: { animation: "EntranceLoading", loop: true },
            Entering: "Entering",
            Idle: "Idle",
            Submitting: { animation: "Submitting", loop: true },
            Correct: "FeedbackCorrect",
          },
          play: "Loading",
          next: { Entering: "Idle", Correct: "Idle" },
          // Pinch anywhere to start the lesson; then its own buttons drive it.
          onSelect: { Loading: "Entering", Submitting: "Correct" },
          actions: { board: "Loading", retry: "Entering", submit: "Submitting" },
        }}
      />
    </ViroNode>
  );
}
