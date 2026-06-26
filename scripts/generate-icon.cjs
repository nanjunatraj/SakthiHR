// Dependency-free PNG icon generator for SakthiHR.
// Draws a rounded indigo tile with three ascending white bars (HR/payroll
// analytics motif) and writes build/icon.png. electron-builder converts this
// PNG into the platform .ico/.icns at build time.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 1024;
const buf = Buffer.alloc(SIZE * SIZE * 4); // RGBA

function setPx(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  // simple alpha-over compositing onto existing pixel
  const sa = a / 255;
  const da = buf[i + 3] / 255;
  const oa = sa + da * (1 - sa);
  for (let c = 0; c < 3; c++) {
    const sc = [r, g, b][c];
    const dc = buf[i + c];
    buf[i + c] = oa === 0 ? 0 : Math.round((sc * sa + dc * da * (1 - sa)) / oa);
  }
  buf[i + 3] = Math.round(oa * 255);
}

function fillRoundedRect(x0, y0, x1, y1, radius, color) {
  const [r, g, b] = color;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let inside = true;
      // round the four corners
      const corners = [
        [x0 + radius, y0 + radius],
        [x1 - radius, y0 + radius],
        [x0 + radius, y1 - radius],
        [x1 - radius, y1 - radius],
      ];
      if (x < x0 + radius && y < y0 + radius) inside = dist(x, y, corners[0]) <= radius;
      else if (x >= x1 - radius && y < y0 + radius) inside = dist(x, y, corners[1]) <= radius;
      else if (x < x0 + radius && y >= y1 - radius) inside = dist(x, y, corners[2]) <= radius;
      else if (x >= x1 - radius && y >= y1 - radius) inside = dist(x, y, corners[3]) <= radius;
      if (inside) setPx(x, y, r, g, b, 255);
    }
  }
}

function dist(x, y, [cx, cy]) {
  return Math.hypot(x - cx, y - cy);
}

// Background: indigo vertical gradient (#6366f1 -> #4338ca)
for (let y = 0; y < SIZE; y++) {
  const t = y / SIZE;
  const r = Math.round(0x63 + (0x43 - 0x63) * t);
  const g = Math.round(0x66 + (0x38 - 0x66) * t);
  const b = Math.round(0xf1 + (0xca - 0xf1) * t);
  for (let x = 0; x < SIZE; x++) setPx(x, y, r, g, b, 255);
}

// Mask to a rounded tile by clearing the corners (transparent outside radius).
const RADIUS = 200;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const corners = [
      [RADIUS, RADIUS],
      [SIZE - RADIUS, RADIUS],
      [RADIUS, SIZE - RADIUS],
      [SIZE - RADIUS, SIZE - RADIUS],
    ];
    let clear = false;
    if (x < RADIUS && y < RADIUS) clear = dist(x, y, corners[0]) > RADIUS;
    else if (x >= SIZE - RADIUS && y < RADIUS) clear = dist(x, y, corners[1]) > RADIUS;
    else if (x < RADIUS && y >= SIZE - RADIUS) clear = dist(x, y, corners[2]) > RADIUS;
    else if (x >= SIZE - RADIUS && y >= SIZE - RADIUS) clear = dist(x, y, corners[3]) > RADIUS;
    if (clear) {
      const i = (y * SIZE + x) * 4;
      buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0;
    }
  }
}

// Three ascending white bars.
const white = [255, 255, 255];
const baseY = 720;
const bars = [
  { x: 300, h: 200 },
  { x: 460, h: 340 },
  { x: 620, h: 480 },
];
const barW = 110;
for (const bar of bars) {
  fillRoundedRect(bar.x, baseY - bar.h, bar.x + barW, baseY, 36, white);
}
// Baseline underline.
fillRoundedRect(280, baseY + 30, 740, baseY + 70, 20, white);

// Encode PNG (8-bit RGBA, filter 0 per scanline).
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter type 0
  buf.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const compressed = zlib.deflateSync(raw, { level: 9 });

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.png'), png);
console.log('Wrote build/icon.png (%d bytes)', png.length);
