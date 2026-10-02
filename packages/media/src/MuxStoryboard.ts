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

const TIME_PATTERN =
  /(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?/;
const TILE_PATTERN =
  /#xywh=(\d+),(\d+),(\d+),(\d+)/i;

export function parseMuxStoryboardVtt(
  source: string,
  vttUrl: string
): MuxStoryboard | null {
  if (!source.includes("-->")) return null;

  const lines = source.split(/\r?\n/);
  const tiles: MuxStoryboardTile[] = [];
  let spriteUrl = "";
  let spriteWidth = 0;
  let spriteHeight = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const timeline = lines[index] ?? "";
    if (!timeline.includes("-->")) continue;

    const [rawStart, rawEnd] = timeline.split("-->");
    const start = parseTime(rawStart ?? "");
    const end = parseTime(rawEnd ?? "");
    if (start == null || end == null) continue;

    const payload = lines[index + 1] ?? "";
    const match = payload.match(TILE_PATTERN);
    if (!match) continue;

    const x = Number(match[1]);
    const y = Number(match[2]);
    const width = Number(match[3]);
    const height = Number(match[4]);

    if (!spriteUrl) {
      spriteUrl = resolveSpriteUrl(payload, vttUrl);
    }

    spriteWidth = Math.max(spriteWidth, x + width);
    spriteHeight = Math.max(spriteHeight, y + height);
    tiles.push({ start, end, x, y, width, height });
  }

  return tiles.length > 0 && spriteUrl
    ? { spriteUrl, spriteWidth, spriteHeight, tiles }
    : null;
}

export function muxStoryboardTileAt(
  storyboard: MuxStoryboard,
  seconds: number
): MuxStoryboardTile | undefined {
  if (storyboard.tiles.length === 0) return undefined;

  const time = Number.isFinite(seconds) ? seconds : 0;
  const exact = storyboard.tiles.find(
    (tile) => time >= tile.start && time < tile.end
  );
  if (exact) return exact;

  const first = storyboard.tiles[0]!;
  const last =
    storyboard.tiles[storyboard.tiles.length - 1]!;
  return time < first.start ? first : last;
}

function parseTime(value: string): number | null {
  const match = value.trim().match(TIME_PATTERN);
  if (!match) return null;

  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = match[4]
    ? Number(match[4].padEnd(3, "0"))
    : 0;

  return (
    hours * 3600 +
    minutes * 60 +
    seconds +
    milliseconds / 1000
  );
}

function resolveSpriteUrl(
  payload: string,
  vttUrl: string
): string {
  const reference =
    payload.split("#")[0]?.trim() ?? "";
  if (/^https?:\/\//i.test(reference)) {
    return reference;
  }

  try {
    const base = new URL(vttUrl);
    const resolved = new URL(reference, base);
    if (!resolved.search && base.search) {
      resolved.search = base.search;
    }
    return resolved.toString();
  } catch {
    const query = vttUrl.includes("?")
      ? "?" + vttUrl.split("?").slice(1).join("?")
      : "";
    const path = vttUrl.split("?")[0] ?? "";
    const directory =
      path.slice(0, path.lastIndexOf("/") + 1);
    return directory + reference + query;
  }
}
