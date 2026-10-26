// Surface ids for native Rive panels. They start high so they never meet the
// small ids nitro-canvas-in-Vision hands out for its own canvasSource
// materials in the same process. Stays inside int32.
const FIRST_ID = 0x4e500000;
const LAST_ID = 0x7ffffff0;
let next = FIRST_ID;

/** A process-unique `canvasSource` id for one native Rive panel. */
export function allocateRiveSurfaceId(): number {
  const id = next;
  next = next >= LAST_ID ? FIRST_ID : next + 1;
  return id;
}
