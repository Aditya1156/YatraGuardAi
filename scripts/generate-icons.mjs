/**
 * Generates the PWA raster icons from the same shapes as icons/icon.svg.
 *
 * Written against Node's built-in zlib instead of pulling in a raster library:
 * the icon is a handful of primitives, and an image dependency would be the
 * heaviest thing in the project for the least reason.
 *
 *   node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const INDIGO = [0x1b, 0x2a, 0x4a];
const GREEN = [0x2e, 0x8b, 0x74];
const MARIGOLD = [0xf2, 0xa9, 0x3b];
const TRACK = [0x3a, 0x48, 0x64]; // indigo lightened, the ring's unfilled track

/** Anti-aliased coverage of a pixel against a circle edge. */
function edge(distance, radius, feather = 1) {
  return Math.min(1, Math.max(0, (radius - distance) / feather + 0.5));
}

function blend(base, colour, alpha) {
  if (alpha <= 0) return base;
  if (alpha >= 1) return [...colour];
  return base.map((channel, i) => Math.round(channel + (colour[i] - channel) * alpha));
}

/** The shield from the SVG, expressed in unit coordinates. */
function shieldAlpha(x, y, size) {
  const u = x / size;
  const v = y / size;
  if (v < 0.33 || v > 0.72 || u < 0.34 || u > 0.66) return 0;

  const centreU = 0.5;
  const halfWidth = 0.16;
  // Taper the lower half to a point, like the SVG path.
  const taper = v < 0.55 ? 1 : 1 - (v - 0.55) / 0.2;
  const width = halfWidth * Math.max(taper, 0);
  return Math.abs(u - centreU) <= width ? 1 : 0;
}

function renderIcon(size, { maskable }) {
  const pixels = Buffer.alloc(size * size * 4);
  const centre = size / 2;
  const radius = size * 0.293;
  const stroke = size * 0.066;
  const corner = maskable ? 0 : size * 0.219;

  // The Trust Ring arc: 78/100 of the circle, starting at 12 o'clock.
  const sweep = 0.78 * Math.PI * 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;

      // Rounded-square background, transparent outside the corner radius.
      let backgroundAlpha = 1;
      if (corner > 0) {
        const dx = Math.max(corner - px, px - (size - corner), 0);
        const dy = Math.max(corner - py, py - (size - corner), 0);
        if (dx > 0 && dy > 0) backgroundAlpha = edge(Math.hypot(dx, dy), corner);
      }

      let colour = [...INDIGO];

      const distance = Math.hypot(px - centre, py - centre);
      const onRing =
        edge(distance, radius + stroke / 2) * (1 - edge(distance, radius - stroke / 2));

      if (onRing > 0.01) {
        let angle = Math.atan2(py - centre, px - centre) + Math.PI / 2;
        if (angle < 0) angle += Math.PI * 2;
        const filled = angle <= sweep;
        colour = blend(colour, filled ? GREEN : TRACK, onRing);
      }

      const shield = shieldAlpha(px, py, size);
      if (shield > 0) colour = blend(colour, MARIGOLD, shield);

      const offset = (y * size + x) * 4;
      pixels[offset] = colour[0];
      pixels[offset + 1] = colour[1];
      pixels[offset + 2] = colour[2];
      pixels[offset + 3] = Math.round(backgroundAlpha * 255);
    }
  }

  return pixels;
}

/* ------------------------------ PNG encoding ------------------------------ */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(pixels, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  // 10–12 stay zero: deflate, adaptive filtering, no interlace.

  // Each scanline is prefixed with filter type 0 (none).
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------- Main ---------------------------------- */

const TARGETS = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const target of TARGETS) {
  const pixels = renderIcon(target.size, { maskable: target.maskable });
  writeFileSync(join(OUT_DIR, target.file), encodePng(pixels, target.size));
  console.log(`  wrote icons/${target.file} (${target.size}×${target.size})`);
}
