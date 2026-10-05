import React from "react";
import { ViroNode, ViroQuad, ViroText } from "@reactvision/react-viro";
import type { Vec3 } from "@viro-external/core";
import { PanelButton, PanelText, SpatialPanel, SpatialScrollView } from "./index";

export type GlassesSurfaceProps = {
  width?: number;
  height?: number;
  position?: Vec3;
  children?: React.ReactNode;
};

export function GlassesBackplate({ width = 1.6, height = 1, position, children }: GlassesSurfaceProps) {
  return <SpatialPanel width={width} height={height} position={position} shape="rounded">{children}</SpatialPanel>;
}

export function GlassesFrame(props: GlassesSurfaceProps) { return <GlassesBackplate {...props} />; }
export function GlassesContainer(props: GlassesSurfaceProps) { return <GlassesBackplate {...props} />; }
export function GlassesCard(props: GlassesSurfaceProps) { return <GlassesBackplate {...props} />; }
export function GlassesCardStack(props: GlassesSurfaceProps) { return <GlassesBackplate {...props} />; }

export type GlassesButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  width?: number;
  height?: number;
  position?: Vec3;
  variant?: "rectangle" | "round" | "capsule";
};

export function GlassesButton({ variant: _variant, ...props }: GlassesButtonProps): React.ReactElement {
  return <PanelButton {...props} />;
}
export function GlassesRectangleButton(props: GlassesButtonProps) { return <GlassesButton {...props} variant="rectangle" />; }
export function GlassesRoundButton(props: GlassesButtonProps) { return <GlassesButton {...props} variant="round" />; }
export function GlassesCapsuleButton(props: GlassesButtonProps) { return <GlassesButton {...props} variant="capsule" />; }

export type GlassesCheckProps = GlassesButtonProps & {
  checked: boolean;
  onChange?: (checked: boolean) => void;
};

export function GlassesCheckbox({ checked, onChange, label, width = 0.42, height = 0.08, position, disabled }: GlassesCheckProps) {
  return (
    <ViroNode position={position}>
      <PanelButton label={label} width={width} height={height} disabled={disabled} onPress={() => onChange?.(!checked)} />
      <ViroText
        text={checked ? "✓" : "□"}
        color="#F7F8FC"
        width={width * 0.22}
        height={height * 0.72}
        position={[-width * 0.36, 0, 0.003]}
        style={{ textAlign: "center", textAlignVertical: "center", fontWeight: "700" }}
        ignoreEventHandling
      />
    </ViroNode>
  );
}

export function GlassesRadioButton({ checked, onChange, label, width = 0.42, height = 0.08, position, disabled }: GlassesCheckProps) {
  return (
    <ViroNode position={position}>
      <PanelButton label={label} width={width} height={height} disabled={disabled} onPress={() => onChange?.(true)} />
      <ViroText
        text={checked ? "●" : "○"}
        color="#F7F8FC"
        width={width * 0.22}
        height={height * 0.72}
        position={[-width * 0.36, 0, 0.003]}
        style={{ textAlign: "center", textAlignVertical: "center", fontWeight: "700" }}
        ignoreEventHandling
      />
    </ViroNode>
  );
}

export type GlassesSwitchProps = GlassesCheckProps;
export function GlassesSwitch(props: GlassesSwitchProps) { return <GlassesCheckbox {...props} />; }

export type GlassesSliderProps = {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  label?: string;
  width?: number;
  height?: number;
  position?: Vec3;
  disabled?: boolean;
};

export function GlassesSlider({
  value = 0, min = 0, max = 1, step = 0.1, onChange, label,
  width = 0.55, height = 0.08, position, disabled,
}: GlassesSliderProps) {
  const safeMax = max === min ? min + 1 : max;
  const clamped = Math.min(safeMax, Math.max(min, value));
  const ratio = (clamped - min) / (safeMax - min);
  const next = () => onChange?.(Math.min(safeMax, Math.max(min, clamped + step)));
  return (
    <ViroNode position={position}>
      <ViroQuad width={width} height={height * 0.25} materials={[]} />
      <ViroQuad
        width={Math.max(0.01, width * ratio)}
        height={height * 0.25}
        position={[-width * (1 - ratio) / 2, 0, 0.001]}
        materials={[]}
        onClick={disabled ? undefined : next}
      />
      {label ? <ViroText text={label} color="#F7F8FC" width={width} height={height * 0.8} position={[0, height * 0.55, 0.002]} ignoreEventHandling /> : null}
    </ViroNode>
  );
}

export type GlassesConfirmationSliderProps = GlassesSliderProps & { onConfirm?: () => void };
export function GlassesConfirmationSlider({ onConfirm, ...props }: GlassesConfirmationSliderProps) {
  return <GlassesSlider {...props} onChange={(value) => {
    props.onChange?.(value);
    if (value >= (props.max ?? 1)) onConfirm?.();
  }} />;
}
export const GlassesScrubber = GlassesSlider;

export type GlassesToggleGroupProps = {
  labels: readonly string[];
  selected: number;
  onChange?: (index: number) => void;
  position?: Vec3;
};
export function GlassesToggleGroup({ labels, selected, onChange, position }: GlassesToggleGroupProps) {
  return (
    <ViroNode position={position}>
      {labels.map((label, index) => (
        <PanelButton key={label + index} label={label} width={0.3} height={0.07} position={[index * 0.32, 0, 0]} onPress={() => onChange?.(index)} />
      ))}
      {labels[selected] ? <ViroText text={labels[selected]} visible={false} /> : null}
    </ViroNode>
  );
}

export type GlassesScrollWindowProps = {
  labels: readonly string[];
  initialIndex?: number;
  visibleCount?: number;
  itemHeight?: number;
  width?: number;
  position?: Vec3;
  onSelect?: (index: number) => void;
};
export function GlassesScrollWindow(props: GlassesScrollWindowProps) {
  return <SpatialScrollView {...props} />;
}
export const GlassesVerticalList = GlassesScrollWindow;
export const GlassesScrollView = GlassesScrollWindow;

export type GlassesScrollBarProps = { progress?: number; height?: number; position?: Vec3 };
export function GlassesScrollBar({ progress = 0, height = 0.7, position }: GlassesScrollBarProps) {
  const ratio = Math.min(1, Math.max(0, progress));
  return (
    <ViroNode position={position}>
      <ViroQuad width={0.025} height={height} materials={[]} />
      <ViroQuad width={0.032} height={Math.max(0.04, height * 0.18)} position={[0, height * 0.82 * (0.5 - ratio), 0.001]} materials={[]} />
    </ViroNode>
  );
}

export type GlassesGridLayoutProps = {
  columns?: number;
  children?: React.ReactNode;
  position?: Vec3;
  cellWidth?: number;
  cellHeight?: number;
  gap?: number;
};
export function GlassesGridLayout({ columns = 2, children, position, cellWidth = 0.3, cellHeight = 0.08, gap = 0.02 }: GlassesGridLayoutProps) {
  const items = React.Children.toArray(children);
  return (
    <ViroNode position={position}>
      {items.map((child, index) => (
        <ViroNode key={String(index)} position={[
          (index % columns) * (cellWidth + gap),
          -Math.floor(index / columns) * (cellHeight + gap),
          0,
        ]}>
          {child}
        </ViroNode>
      ))}
    </ViroNode>
  );
}

export type GlassesTooltipProps = { text: string; visible?: boolean; position?: Vec3 };
export function GlassesTooltip({ text, visible = true, position }: GlassesTooltipProps) {
  if (!visible) return null;
  return (
    <ViroNode position={position}>
      <ViroQuad width={0.55} height={0.12} materials={[]} />
      <ViroText text={text} color="#F7F8FC" width={0.52} height={0.1} position={[0, 0, 0.002]} style={{ textAlign: "center", textAlignVertical: "center" }} ignoreEventHandling />
    </ViroNode>
  );
}

export type GlassesTextInputProps = {
  value?: string;
  placeholder?: string;
  position?: Vec3;
  width?: number;
  height?: number;
  disabled?: boolean;
  onRequestInput?: () => void;
};
export function GlassesTextInput({
  value = "", placeholder = "Tap to enter text", position, width = 0.7, height = 0.1, disabled, onRequestInput,
}: GlassesTextInputProps) {
  return (
    <ViroNode position={position} onClick={disabled ? undefined : onRequestInput}>
      <ViroQuad width={width} height={height} materials={[]} />
      <ViroText text={value || placeholder} color="#F7F8FC" width={width * 0.92} height={height * 0.8} position={[0, 0, 0.002]} style={{ textAlign: "left", textAlignVertical: "center" }} ignoreEventHandling />
    </ViroNode>
  );
}

export function GlassesText({ children, position, width = 0.8, height = 0.08 }: GlassesSurfaceProps) {
  return <ViroNode position={position}>{typeof children === "string" ? <PanelText text={children} width={width} height={height} /> : children}</ViroNode>;
}

export function GlassesDivider({ position }: { position?: Vec3 }) {
  return <ViroQuad width={0.65} height={0.005} materials={[]} position={position} />;
}
