export type MuxStoryboardTile = {
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MuxStoryboard = {
  spriteUrl: string;
  spriteWidth: number;
  spriteHeight: number;
  tiles: MuxStoryboardTile[];
};

const TIME =
  /(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?/;
const RECT =
  /#xywh=(\d+),(\d+),(\d+),(\d+)/i;

function parseTime(value: string): number | null {
  const match = value.trim().match(TIME);
  if (!match) return null;

  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = match[4]
    ? Number(match[4].padEnd(3, "0"))
    : 0;

  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

function resolveSpriteUrl(
  payload: string,
  vttUrl: string
): string {
  const clean = payload.split("#")[0]?.trim() ?? "";
  if (/^https?:\/\//i.test(clean)) {
    return clean;
  }

  const source = new URL(vttUrl);
  const basePath = source.pathname.slice(
    0,
    source.pathname.lastIndexOf("/") + 1
  );
  source.pathname = basePath + clean;

  return source.toString();
}

export function parseMuxStoryboardVtt(
  vtt: string,
  vttUrl: string
): MuxStoryboard | null {
  if (!vtt.includes("-->")) return null;

  const lines = vtt.split(/\r?\n/);
  const tiles: MuxStoryboardTile[] = [];
  let spriteUrl = "";
  let spriteWidth = 0;
  let spriteHeight = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const timing = lines[index] ?? "";
    if (!timing.includes("-->")) continue;

    const [rawStart, rawEnd] = timing.split("-->");
    const start = parseTime(rawStart ?? "");
    const end = parseTime(rawEnd ?? "");
    if (start == null || end == null) continue;

    const payload = lines[index + 1] ?? "";
    const rect = payload.match(RECT);
    if (!rect) continue;

    const x = Number(rect[1]);
    const y = Number(rect[2]);
    const width = Number(rect[3]);
    const height = Number(rect[4]);

    if (!spriteUrl) {
      spriteUrl = resolveSpriteUrl(payload, vttUrl);
    }

    spriteWidth = Math.max(spriteWidth, x + width);
    spriteHeight = Math.max(spriteHeight, y + height);
    tiles.push({ start, end, x, y, width, height });
  }

  if (!spriteUrl || tiles.length === 0) {
    return null;
  }

  return {
    spriteUrl,
    spriteWidth,
    spriteHeight,
    tiles,
  };
}

export function muxStoryboardTileAt(
  storyboard: MuxStoryboard,
  time: number
): MuxStoryboardTile | undefined {
  if (storyboard.tiles.length === 0) {
    return undefined;
  }

  const exact = storyboard.tiles.find(
    (tile) => time >= tile.start && time < tile.end
  );
  if (exact) return exact;

  if (time < storyboard.tiles[0]!.start) {
    return storyboard.tiles[0];
  }

  return storyboard.tiles[storyboard.tiles.length - 1];
}
