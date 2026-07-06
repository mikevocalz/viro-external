// gen-test-spz.js — emits a valid v2 SPZ binary for end-to-end tests.
//
// Writes N splats arranged in a known pattern (5x5x5 grid + a few
// origin-anchored ones) so a successful render shows a recognizable
// shape. Matches the byte layout SpzReader.cpp decodes:
//   16-byte header:
//     uint32 magic       = 'NGSP' (0x5053474e LE)
//     uint32 version     = 2
//     uint32 numPoints
//     uint8  shDegree    = 0
//     uint8  fractionalBits
//     uint8  flags       = 0
//     uint8  reserved    = 0
//   body (per splat):
//     positions:  3 × i24  (xyz, sign-extended, / 2^fractionalBits)
//     alpha:      1 × u8
//     color:      3 × u8   (r,g,b 0..255)
//     scale:      3 × u8   ((value/16) - 10 = log-scale)
//     rotation:   3 × i8   (x,y,z; w reconstructed positive)
//
// Usage:
//   node tools/gen-test-spz.js > /tmp/test.spz
//   node tools/gen-test-spz.js --grid 4 --out /tmp/grid.spz

const FRACTIONAL_BITS = 12; // divisor 4096
const SCALE_BIAS = 10;      // value/16 - 10  =>  encode = (s+10) * 16
const ROT_SCALE = 127;

function parseArgs(argv) {
  const out = {
    mode: 'grid',
    grid: 5,
    sphereCount: 5000,
    sphereRadius: 4.0,
    scaleM: 0.04,
    alpha: 0.85,
    file: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') out.mode = argv[++i];
    else if (a === '--grid') out.grid = parseInt(argv[++i], 10);
    else if (a === '--count') out.sphereCount = parseInt(argv[++i], 10);
    else if (a === '--radius') out.sphereRadius = parseFloat(argv[++i]);
    else if (a === '--scale') out.scaleM = parseFloat(argv[++i]);
    else if (a === '--alpha') out.alpha = parseFloat(argv[++i]);
    else if (a === '--out') out.file = argv[++i];
  }
  return out;
}

function writeI24LE(buf, offset, v) {
  buf[offset]     =  v        & 0xff;
  buf[offset + 1] = (v >> 8)  & 0xff;
  buf[offset + 2] = (v >> 16) & 0xff;
}

function packPositionMeters(meters) {
  // meters * 2^fractionalBits, clamped to i24 range.
  let q = Math.round(meters * (1 << FRACTIONAL_BITS));
  if (q >  0x7fffff) q =  0x7fffff;
  if (q < -0x800000) q = -0x800000;
  if (q < 0) q += 0x1000000;  // two's-complement encode
  return q;
}

function packScaleMeters(scaleM) {
  // exp(s) ≈ scaleM → s ≈ log(scaleM); store as (s + 10) * 16, clamp u8.
  const s = Math.log(Math.max(1e-6, scaleM));
  let q = Math.round((s + SCALE_BIAS) * 16);
  if (q < 0)   q = 0;
  if (q > 255) q = 255;
  return q;
}

// Niantic SPZ v2 FirstThree pack:
//   normalize (w >= 0), then byte = (q + 1) * 127.5  for x, y, z.
//   (w is implicit on the reader; reconstructed from sqrt(1 - x²-y²-z²))
function packQuat(qx, qy, qz, qw = null) {
  let x = qx, y = qy, z = qz, w = qw;
  if (w === null) {
    const wsq = Math.max(0, 1 - x*x - y*y - z*z);
    w = Math.sqrt(wsq);
  }
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const toByte = (v) => Math.max(0, Math.min(255, Math.round((v + 1) * 127.5)));
  return [toByte(x), toByte(y), toByte(z)];
}

// Niantic SPZ color pack:
//   sh_dc = (L_linear - 0.5) / 0.2820947917
//   byte  = sh_dc * 0.15 * 255 + 0.5 * 255
function packColor(L) {
  const SH_DC = 0.2820947917;
  const COLOR_SCALE = 0.15;
  const sh = (L - 0.5) / SH_DC;
  const v = sh * COLOR_SCALE * 255 + 127.5;
  return Math.max(0, Math.min(255, Math.round(v)));
}

function genGridSplats(grid, scaleM, alpha) {
  const splats = [];
  const half = (grid - 1) / 2;
  const spacing = 0.1; // 10 cm
  for (let z = 0; z < grid; z++) {
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const px = (x - half) * spacing;
        const py = (y - half) * spacing;
        const pz = (z - half) * spacing - 1.0; // place 1m in front
        const r = (x / grid) * 255;
        const g = (y / grid) * 255;
        const b = (z / grid) * 255;
        splats.push({
          pos: [px, py, pz],
          alpha: Math.round(alpha * 255),
          color: [r | 0, g | 0, b | 0],
          scale: [scaleM, scaleM, scaleM],
          quat: [0, 0, 0],
        });
      }
    }
  }
  return splats;
}

function emitSpz(splats) {
  const POS_BYTES   = 9;
  const REST_BYTES  = 1 + 3 + 3 + 3;
  const bodyBytes   = splats.length * (POS_BYTES + REST_BYTES);
  const buf = Buffer.alloc(16 + bodyBytes);

  // Header
  buf[0] = 0x4e; buf[1] = 0x47; buf[2] = 0x53; buf[3] = 0x50; // 'NGSP'
  buf.writeUInt32LE(2, 4);                  // version
  buf.writeUInt32LE(splats.length, 8);      // numPoints
  buf[12] = 0;                              // shDegree
  buf[13] = FRACTIONAL_BITS;
  buf[14] = 0;                              // flags
  buf[15] = 0;                              // reserved

  // Body — block layout matches SpzReader's pointer math:
  //   positions [0 .. n*9),
  //   alphas    [n*9 .. n*9 + n),
  //   colors    [+ n*3),
  //   scales    [+ n*3),
  //   rotations [+ n*3)
  const n = splats.length;
  const pPos    = 16;
  const pAlpha  = pPos    + n * POS_BYTES;
  const pColor  = pAlpha  + n;
  const pScale  = pColor  + n * 3;
  const pRot    = pScale  + n * 3;

  for (let i = 0; i < n; i++) {
    const s = splats[i];
    writeI24LE(buf, pPos + i * POS_BYTES + 0, packPositionMeters(s.pos[0]));
    writeI24LE(buf, pPos + i * POS_BYTES + 3, packPositionMeters(s.pos[1]));
    writeI24LE(buf, pPos + i * POS_BYTES + 6, packPositionMeters(s.pos[2]));

    buf[pAlpha + i] = s.alpha & 0xff;

    // s.color is u8 [0..255] interpreted as 8-bit linear-light channel.
    // Re-encode through the Niantic SH-DC pack.
    buf[pColor + i * 3 + 0] = packColor(s.color[0] / 255);
    buf[pColor + i * 3 + 1] = packColor(s.color[1] / 255);
    buf[pColor + i * 3 + 2] = packColor(s.color[2] / 255);

    buf[pScale + i * 3 + 0] = packScaleMeters(s.scale[0]);
    buf[pScale + i * 3 + 1] = packScaleMeters(s.scale[1]);
    buf[pScale + i * 3 + 2] = packScaleMeters(s.scale[2]);

    const [rx, ry, rz] = packQuat(s.quat[0], s.quat[1], s.quat[2]);
    buf.writeInt8(rx, pRot + i * 3 + 0);
    buf.writeInt8(ry, pRot + i * 3 + 1);
    buf.writeInt8(rz, pRot + i * 3 + 2);
  }
  return buf;
}

// Fibonacci-sphere distribution: N points spread evenly on the unit
// sphere. Colors map spherical angles to hue so the user sees a
// continuous gradient when they look around — a synthetic "360 sky".
function genSphereSplats(count, radius, scaleM, alpha) {
  const splats = [];
  // Golden-angle increment for even spherical distribution.
  const phiInc = Math.PI * (3.0 - Math.sqrt(5.0));
  for (let i = 0; i < count; i++) {
    const y = 1.0 - (i / (count - 1)) * 2.0;       // y in [-1, 1]
    const r = Math.sqrt(Math.max(0, 1.0 - y * y));
    const phi = phiInc * i;
    const x = r * Math.cos(phi);
    const z = r * Math.sin(phi);

    // Position on sphere shell of radius `radius` centered at origin.
    const px = x * radius;
    const py = y * radius;
    const pz = z * radius;

    // Spherical-coord hue:
    //   latitude  → R (high = red top)
    //   longitude → G (azimuthal sweep)
    //   altitude  → B (deepens with -y)
    const lat = Math.asin(y);              // [-π/2, π/2]
    const lon = Math.atan2(z, x);          // [-π, π]
    const rCol = ((lat + Math.PI / 2) / Math.PI) * 255;     // 0 at south, 255 at north
    const gCol = ((lon + Math.PI) / (2 * Math.PI)) * 255;   // wraps around azimuth
    const bCol = ((1 - y) / 2) * 255;                       // 0 at top, 255 at bottom

    splats.push({
      pos: [px, py, pz],
      alpha: Math.round(alpha * 255),
      color: [rCol | 0, gCol | 0, bCol | 0],
      scale: [scaleM, scaleM, scaleM],
      quat: [0, 0, 0],
    });
  }
  return splats;
}

const opts = parseArgs(process.argv);
const splats = opts.mode === 'sphere'
  ? genSphereSplats(opts.sphereCount, opts.sphereRadius, opts.scaleM, opts.alpha)
  : genGridSplats(opts.grid, opts.scaleM, opts.alpha);
const buf = emitSpz(splats);
if (opts.file) {
  require('node:fs').writeFileSync(opts.file, buf);
  console.error(`wrote ${buf.length} bytes (${splats.length} splats) to ${opts.file}`);
} else {
  process.stdout.write(buf);
}
