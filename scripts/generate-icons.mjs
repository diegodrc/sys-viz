// Generates the PWA PNG icons (192/512) with no external dependencies.
// Run manually: node scripts/generate-icons.mjs  (output is committed in public/)
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [37, 99, 235];
const FG = [255, 255, 255];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function render(size) {
  // three nodes connected left -> top-right and left -> bottom-right (a tiny graph)
  const s = size / 100;
  const nodes = [
    [28, 50],
    [72, 30],
    [72, 70],
  ];
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0]; // filter type: none
    for (let x = 0; x < size; x++) {
      const ux = x / s;
      const uy = y / s;
      const onNode = nodes.some(([nx, ny]) => Math.hypot(ux - nx, uy - ny) <= 10);
      const onEdge =
        distToSegment(ux, uy, 28, 50, 72, 30) <= 3 || distToSegment(ux, uy, 28, 50, 72, 70) <= 3;
      row.push(...(onNode || onEdge ? FG : BG));
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), render(size));
}
