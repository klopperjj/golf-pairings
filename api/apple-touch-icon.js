/**
 * Generates the SFGC Invitational app icon as a PNG on the fly.
 * Served at /apple-touch-icon.png via vercel.json rewrite.
 * No external dependencies — uses only Node.js built-in zlib.
 */
import zlib from 'zlib';

const W = 512, H = 512;
const BG   = [14,  45,  28];  // #0e2d1c  dark green outer
const MID  = [28,  72,  50];  // #1c4832  mid green inner
const GOLD = [201, 168, 76];  // #c9a84c  gold
const LITE = [232, 201, 106]; // #e8c96a  highlight gold

export default function handler(req, res) {
  const pixels = Buffer.alloc(W * H * 4, 0);

  function set(x, y, [r, g, b], a = 255) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 4;
    pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
  }

  // ── Background ─────────────────────────────────────────────
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      set(x, y, BG);

  // Inner lighter green panel (inset 20px)
  for (let y = 20; y < H-20; y++)
    for (let x = 20; x < W-20; x++)
      set(x, y, MID);

  // ── Gold border ring (inset 12px, 12px wide) ───────────────
  for (let t = 12; t < 24; t++) {
    for (let x = 12; x < W-12; x++) {
      set(x, t,     GOLD);
      set(x, H-1-t, GOLD);
    }
    for (let y = 12; y < H-12; y++) {
      set(t,     y, GOLD);
      set(W-1-t, y, GOLD);
    }
  }
  // Thin highlight line on inside edge of border
  for (let x = 24; x < W-24; x++) { set(x, 24, LITE); set(x, H-25, LITE); }
  for (let y = 24; y < H-24; y++) { set(24, y, LITE); set(W-25, y, LITE); }

  // ── Flag pole: x 248–258, y 100–400 ───────────────────────
  for (let y = 100; y < 402; y++)
    for (let x = 248; x < 258; x++)
      set(x, y, GOLD);

  // ── Flag pennant: right-pointing triangle ──────────────────
  // Top-left: (257, 100), tip: (257, 232), sweeps right to x~380 at y=100
  for (let y = 100; y < 233; y++) {
    const progress = (y - 100) / (232 - 100); // 0→1 top to bottom
    const maxX = Math.round(257 + (1 - progress) * 130);
    for (let x = 257; x <= maxX; x++) {
      // Highlight top edge slightly
      const col = y < 106 ? LITE : GOLD;
      set(x, y, col);
    }
  }

  // ── Ball / hole circle at base of pole ─────────────────────
  const bx = 253, by = 415, br = 18;
  for (let y = by - br; y <= by + br; y++)
    for (let x = bx - br; x <= bx + br; x++)
      if ((x-bx)*(x-bx) + (y-by)*(y-by) <= br*br)
        set(x, y, GOLD);

  // ── Thin inner shadow line beneath the pennant ─────────────
  for (let y = 232; y < 238; y++) {
    const alpha = Math.round(120 * (1 - (y-232)/6));
    for (let x = 257; x < 390; x++) {
      const i = (y * W + x) * 4;
      pixels[i] = 0; pixels[i+1] = 0; pixels[i+2] = 0; pixels[i+3] = alpha;
    }
  }

  const png = buildPNG(W, H, pixels);
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  res.end(png);
}

// ── Pure-Node PNG encoder (no external deps) ─────────────────────────────────
function buildPNG(w, h, pixels) {
  // CRC32
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const lBuf = Buffer.alloc(4); lBuf.writeUInt32BE(data.length);
    const tBuf = Buffer.from(type, 'ascii');
    const cBuf = Buffer.alloc(4); cBuf.writeUInt32BE(crc32(Buffer.concat([tBuf, data])));
    return Buffer.concat([lBuf, tBuf, data, cBuf]);
  }

  // IHDR: 8-bit RGBA
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;

  // Raw scanlines with filter byte 0 (None) per row
  const stride = 1 + w * 4;
  const raw = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    pixels.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }

  const idat = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
