// Genera los iconos PNG de la PWA / app Android, sin dependencias: node tools/make-icons.js
// Diseño: 4 recuadros (las "4 fotos") con una cruz dorada al centro.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const BG = [0x1f, 0x2a, 0x44], TILE = [0x3a, 0x4d, 0x78], GOLD = [0xf5, 0xc5, 0x42];

function inRoundRect(u, v, x0, y0, x1, y1, r) {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const cx = Math.min(Math.max(u, x0 + r), x1 - r);
  const cy = Math.min(Math.max(v, y0 + r), y1 - r);
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
}

// Color (RGBA 0-255) en el punto (x, y) de [0,1]². scale = tamaño del dibujo; corner = radio del fondo (0 = a sangre).
function sample(x, y, scale, corner) {
  if (corner > 0 && !inRoundRect(x, y, 0, 0, 1, 1, corner)) return [0, 0, 0, 0];
  const u = (x - 0.5) / scale + 0.5, v = (y - 0.5) / scale + 0.5;
  const cross = (pad) =>
    inRoundRect(u, v, 0.44 - pad, 0.18 - pad, 0.56 + pad, 0.82 + pad, 0.02) ||
    inRoundRect(u, v, 0.28 - pad, 0.34 - pad, 0.72 + pad, 0.46 + pad, 0.02);
  if (cross(0)) return [...GOLD, 255];
  if (cross(0.03)) return [...BG, 255]; // contorno para separar la cruz de los recuadros
  for (const [x0, y0] of [[0.075, 0.075], [0.535, 0.075], [0.075, 0.535], [0.535, 0.535]]) {
    if (inRoundRect(u, v, x0, y0, x0 + 0.39, y0 + 0.39, 0.07)) return [...TILE, 255];
  }
  return [...BG, 255];
}

function render(size, scale, corner) {
  const SS = 3, px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const c = sample((i + (sx + 0.5) / SS) / size, (j + (sy + 0.5) / SS) / size, scale, corner);
      r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
    }
    const o = (j * size + i) * 4, n = SS * SS;
    px[o] = a ? r / a : 0; px[o + 1] = a ? g / a : 0; px[o + 2] = a ? b / a : 0; px[o + 3] = a / n;
  }
  return px;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, "..", "site", "icons");
fs.mkdirSync(out, { recursive: true });
const files = [
  ["icon-192.png", 192, 0.9, 0.2],            // propósito "any", esquinas redondeadas
  ["icon-512.png", 512, 0.9, 0.2],
  ["icon-maskable-512.png", 512, 0.68, 0],    // "maskable": a sangre, dibujo dentro de la zona segura
  ["apple-touch-icon.png", 180, 0.8, 0],      // iOS aplica sus propias esquinas
];
for (const [name, size, scale, corner] of files) {
  fs.writeFileSync(path.join(out, name), png(size, render(size, scale, corner)));
  console.log("creado", name);
}
