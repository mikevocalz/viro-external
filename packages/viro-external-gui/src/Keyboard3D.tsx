import React, { useMemo, useState } from "react";
import { ViroAnimations, ViroBox, ViroGeometry, ViroMaterials, ViroNode } from "@reactvision/react-viro";
import type { Vec3 } from "react-native-viro-mux";
import { roundedPlateBuffers, type PlateBuffers } from "./roundedPlate";
import { FluentMaterials, registerFluentMaterials } from "./materials";
import { Text3D } from "./Text3D";

/**
 * Compact XR QWERTY keyboard — Fluent-dark, one key = the proven interactive
 * primitive (node-level events + thin ViroBox hit surface + rounded plate).
 * Lowercase-only, space / backspace / send. Meant to float under a chat
 * slate; the parent owns the draft string.
 */
export interface Keyboard3DProps {
  onKey: (char: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  position?: Vec3;
}

const KM = { hit: "vxg_kb_hit" } as const;
let kbMaterialsRegistered = false;
function registerKbMaterials(): void {
  registerFluentMaterials();
  if (kbMaterialsRegistered) return;
  kbMaterialsRegistered = true;
  ViroMaterials.createMaterials({
    // Additive-black = hit-testable but invisible (no faint box around keys).
    [KM.hit]: { diffuseColor: "#000000", lightingModel: "Constant", blendMode: "Add" },
  });
  ViroAnimations.registerAnimations({
    vxgKeyHoverIn: { properties: { scaleX: 1.1, scaleY: 1.1, scaleZ: 1.1 }, duration: 90, easing: "EaseOut" },
    vxgKeyHoverOut: { properties: { scaleX: 1, scaleY: 1, scaleZ: 1 }, duration: 120, easing: "EaseOut" },
    vxgKeyPress: { properties: { scaleX: 0.88, scaleY: 0.88, scaleZ: 0.88 }, duration: 50, easing: "EaseOut" },
  });
}

const KEY = 0.052; // key pitch, meters
const KEY_W = 0.048;
const KEY_H = 0.044;

function Key(props: {
  label: string;
  x: number;
  y: number;
  w?: number;
  plate: PlateBuffers;
  widePlate?: PlateBuffers;
  onPress: () => void;
}): React.ReactElement {
  const { label, x, y, w = KEY_W, plate, widePlate, onPress } = props;
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const micro = pressed ? "vxgKeyPress" : hovered ? "vxgKeyHoverIn" : "vxgKeyHoverOut";
  const buffers = w > KEY_W ? widePlate! : plate;

  return (
    <ViroNode position={[x, y, 0]}>
      <ViroNode
        animation={{ name: micro, run: true, loop: false }}
        onHover={(h: boolean) => setHovered(h)}
        onClickState={(state: number) => {
          if (state === 1) setPressed(true);
          else if (state === 2) setPressed(false);
        }}
        onClick={onPress}
      >
        <ViroBox
          position={[0, 0, -0.003]}
          width={w * 1.12}
          height={KEY_H * 1.18}
          length={0.004}
          materials={[KM.hit]}
          opacity={0.15}
        />
        <ViroGeometry
          vertices={buffers.vertices}
          normals={buffers.normals}
          texcoords={buffers.texcoords}
          triangleIndices={buffers.triangleIndices}
          materials={[hovered ? FluentMaterials.buttonPlateHover : FluentMaterials.buttonPlate]}
          ignoreEventHandling
        />
        <Text3D
          text={label}
          width={w * 0.9}
          height={KEY_H * 0.62}
          fillRatio={0.6}
          color="#EDEDF2"
          position={[0, 0, 0.003]}
        />
      </ViroNode>
    </ViroNode>
  );
}

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export function Keyboard3D(props: Keyboard3DProps): React.ReactElement {
  const { onKey, onBackspace, onSubmit, position } = props;
  registerKbMaterials();

  const plate = useMemo(() => roundedPlateBuffers(KEY_W, KEY_H, 0.008, 8), []);
  const widePlate = useMemo(() => roundedPlateBuffers(KEY_W * 3.2, KEY_H, 0.008, 8), []);
  const backPlate = useMemo(
    () => roundedPlateBuffers(ROWS[0]!.length * KEY + 0.05, 4 * KEY + 0.05, 0.02, 10),
    []
  );

  const rowY = (r: number) => 1.5 * KEY - r * KEY;

  return (
    <ViroNode position={position}>
      {/* Backplate — one slab of slate chrome behind all keys. */}
      <ViroGeometry
        vertices={backPlate.vertices}
        normals={backPlate.normals}
        texcoords={backPlate.texcoords}
        triangleIndices={backPlate.triangleIndices}
        materials={[FluentMaterials.slateChrome]}
        position={[0, 0, -0.008]}
        ignoreEventHandling
      />
      {ROWS.map((row, r) =>
        row.split("").map((ch, i) => (
          <Key
            key={ch}
            label={ch}
            x={(i - (row.length - 1) / 2) * KEY + (r === 1 ? KEY * 0.25 : 0)}
            y={rowY(r)}
            plate={plate}
            widePlate={widePlate}
            onPress={() => onKey(ch)}
          />
        ))
      )}
      <Key label="⌫" x={(7 - 3) * KEY + KEY * 0.6} y={rowY(2)} plate={plate} widePlate={widePlate} onPress={onBackspace} />
      <Key label="space" x={-KEY} y={rowY(3)} w={KEY_W * 3.2} plate={plate} widePlate={widePlate} onPress={() => onKey(" ")} />
      <Key label="send" x={KEY * 2.4} y={rowY(3)} w={KEY_W * 3.2} plate={plate} widePlate={widePlate} onPress={onSubmit} />
    </ViroNode>
  );
}
