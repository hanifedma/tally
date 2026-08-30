// ============================================================
//  Tally — icon generator.
//
//  Every PNG in this repo (and in the Android project's mipmaps) is drawn
//  here rather than exported from a design tool, so the mark can be edited
//  in one place and every size regenerated exactly:
//
//      node tools/make-icons.mjs . ../tally-android/app/src/main/res
//
//  The mark is a curve of compound growth. It is drawn with a signed-distance
//  rasteriser — a pixel's alpha is how far it sits from the stroke's centre
//  line — which gives clean antialiasing at 48px without supersampling, and
//  identical geometry at every size.
//
//  No dependencies: PNG encoding is zlib (built into Node) plus four chunks.
// ============================================================

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ---------- brand ----------
const BRAND_A = [0x8b, 0x93, 0xff]; // top-left of the tile gradient
const BRAND_B = [0x4f, 0x46, 0xe5]; // bottom-right
const INK = [0xff, 0xff, 0xff];

// ---------- canvas ----------
const canvas = (w, h) => ({ w, h, px: new Float64Array(w * h * 4) });

/** Straight-alpha compositing of one colour at coverage `a` (0..1). */
function blend(c, x, y, rgb, a) {
  if (a <= 0) return;
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  const px = c.px;
  const out = a + px[i + 3] * (1 - a);
  if (out <= 0) { px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0; return; }
  for (let k = 0; k < 3; k++) {
    px[i + k] = (rgb[k] * a + px[i + k] * px[i + 3] * (1 - a)) / out;
  }
  px[i + 3] = out;
}

/** Coverage from a signed distance: 1 inside, 0 outside, a soft pixel between. */
const cov = (d) => Math.min(1, Math.max(0, 0.5 - d));

/** Distance from p to the segment ab. */
function distSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, (wx * vx + wy * vy) / len2));
  const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return Math.hypot(dx, dy);
}

/** Distance to a rounded rectangle, negative inside. */
function distRoundRect(px, py, x, y, w, h, r) {
  const cx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const cy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  const ax = Math.max(cx, 0), ay = Math.max(cy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(cx, cy), 0) - r;
}

/** A diagonal linear gradient across the whole canvas. */
function gradientAt(c, x, y, a, b) {
  const t = Math.min(1, Math.max(0, (x / c.w + y / c.h) / 2));
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** Fill a rounded rect (or, with r = size/2, a circle) with the brand gradient. */
function fillTile(c, r) {
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const d = distRoundRect(x + 0.5, y + 0.5, 0, 0, c.w, c.h, r);
      blend(c, x, y, gradientAt(c, x, y, BRAND_A, BRAND_B), cov(d));
    }
  }
}

/** A stroke with round caps, in canvas units. */
function stroke(c, ax, ay, bx, by, width, rgb) {
  const r = width / 2;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1));
  const maxX = Math.min(c.w - 1, Math.ceil(Math.max(ax, bx) + r + 1));
  const minY = Math.max(0, Math.floor(Math.min(ay, by) - r - 1));
  const maxY = Math.min(c.h - 1, Math.ceil(Math.max(ay, by) + r + 1));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      blend(c, x, y, rgb, cov(distSeg(x + 0.5, y + 0.5, ax, ay, bx, by) - r));
    }
  }
}

// ------------------------------------------------------------
//  The mark: compound growth.
//
//  A line that only ever rises, and rises faster the further it goes —
//  thirty per cent a year, which is the shape of the curve rather than a
//  promise. Literally: y = (1.3^(8x) - 1) / (1.3^8 - 1) over eight years,
//  fitted to a single cubic Bezier so that the Android vector drawable can
//  carry the identical curve as one path command instead of a polyline.
//
//  Defined in the same 108x108 space Android adaptive icons use, and kept
//  inside the 72dp circle a launcher may crop to.
// ------------------------------------------------------------
const MARK = {
  box: 108,
  // p0 → p3, with the two control points between them.
  curve: [[32, 74], [47.4, 71.6], [61.9, 62.0], [76, 34]],
  width: 9.5,
  // The same curve as an SVG/vector path, for favicon.svg and the Android
  // drawables. Kept beside the numbers so the two cannot drift apart.
  path: "M32,74 C47.4,71.6 61.9,62 76,34",
};

/** A point on the cubic at t. */
function bezier(t, pts) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [
    a * pts[0][0] + b * pts[1][0] + c * pts[2][0] + d * pts[3][0],
    a * pts[0][1] + b * pts[1][1] + c * pts[2][1] + d * pts[3][1],
  ];
}

/**
 * Draw the mark scaled into a canvas of side `size`.
 *
 * The curve is walked as 96 straight segments with round caps, which at
 * these sizes is indistinguishable from a true curve and needs no curve
 * rasteriser of its own.
 */
function drawMark(c, size, scale = 1) {
  const k = (size / MARK.box) * scale;
  const off = (size - MARK.box * k) / 2;
  const at = (p) => [off + p[0] * k, off + p[1] * k];
  const width = MARK.width * k;
  const STEPS = 96;
  let prev = at(bezier(0, MARK.curve));
  for (let i = 1; i <= STEPS; i++) {
    const p = at(bezier(i / STEPS, MARK.curve));
    stroke(c, prev[0], prev[1], p[0], p[1], width, INK);
    prev = p;
  }
}

// ---------- PNG ----------
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(c) {
  // One filter byte (0 = none) per scanline, then straight RGBA.
  const raw = Buffer.alloc(c.h * (1 + c.w * 4));
  let o = 0;
  for (let y = 0; y < c.h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < c.w; x++) {
      const i = (y * c.w + x) * 4;
      raw[o++] = Math.round(Math.min(255, Math.max(0, c.px[i])));
      raw[o++] = Math.round(Math.min(255, Math.max(0, c.px[i + 1])));
      raw[o++] = Math.round(Math.min(255, Math.max(0, c.px[i + 2])));
      raw[o++] = Math.round(Math.min(255, Math.max(0, c.px[i + 3] * 255)));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0);
  ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function write(path, buf) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  console.log("  " + path.replace(/\\/g, "/") + "  (" + (buf.length / 1024).toFixed(1) + " kB)");
}

// ------------------------------------------------------------
//  Outputs
// ------------------------------------------------------------
const OUT_WEB = resolve(process.argv[2] || ".");
const OUT_ANDROID = process.argv[3] ? resolve(process.argv[3]) : null;

/** A square icon: rounded tile + mark. `radius` is a fraction of the side. */
function icon(size, { radius = 0.22, scale = 1, bleed = false } = {}) {
  const c = canvas(size, size);
  fillTile(c, bleed ? 0 : size * radius);
  drawMark(c, size, scale);
  return encodePng(c);
}

/** A circular icon, for Android's round launcher slot. */
function roundIcon(size) {
  const c = canvas(size, size);
  fillTile(c, size / 2);
  drawMark(c, size, 0.92);
  return encodePng(c);
}

console.log("Web icons");
write(OUT_WEB + "/icon-192.png", icon(192));
write(OUT_WEB + "/icon-512.png", icon(512));
// Maskable: the tile bleeds to every edge and the mark shrinks into the
// central safe zone, so a launcher may crop it to any shape.
write(OUT_WEB + "/icon-maskable-512.png", icon(512, { bleed: true, scale: 0.9 }));
// iOS applies its own mask, so this one is square to the edge.
write(OUT_WEB + "/apple-touch-icon.png", icon(180, { radius: 0 }));

// Open Graph card: the mark on a dark field. The words in a link preview are
// the page's job, not the image's.
{
  const c = canvas(1200, 630);
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      blend(c, x, y, gradientAt(c, x, y, [0x14, 0x14, 0x18], [0x25, 0x22, 0x4a]), 1);
    }
  }
  // The mark at 300 units, in brand indigo on the dark field.
  const k = 300 / MARK.box;
  const offX = (1200 - 108 * k) / 2, offY = (630 - 108 * k) / 2;
  let prev = null;
  for (let i = 0; i <= 96; i++) {
    const p = bezier(i / 96, MARK.curve);
    const q = [offX + p[0] * k, offY + p[1] * k];
    if (prev) stroke(c, prev[0], prev[1], q[0], q[1], MARK.width * k, [0x8b, 0x93, 0xff]);
    prev = q;
  }
  write(OUT_WEB + "/og-image.png", encodePng(c));
}

if (OUT_ANDROID) {
  console.log("Android mipmaps");
  // Legacy launcher icons, for API 24-25 (adaptive icons start at 26).
  const dpi = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [name, size] of Object.entries(dpi)) {
    write(OUT_ANDROID + "/mipmap-" + name + "/ic_launcher.png", icon(size, { radius: 0.2 }));
    write(OUT_ANDROID + "/mipmap-" + name + "/ic_launcher_round.png", roundIcon(size));
  }
}
