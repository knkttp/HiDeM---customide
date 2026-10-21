import fs from 'fs';
import path from 'path';

// Generate a valid 64x64 32-bit BGRA .ico file with an Indigo-Purple gradient and "< >" code symbol
const width = 64;
const height = 64;
const pixelDataSize = width * height * 4;
const maskRowBytes = Math.ceil(width / 32) * 4;
const maskDataSize = maskRowBytes * height;
const bmpInfoHeaderSize = 40;
const imageSize = bmpInfoHeaderSize + pixelDataSize + maskDataSize;

const buf = Buffer.alloc(6 + 16 + imageSize);
let offset = 0;

// ICONDIR (6 bytes)
buf.writeUInt16LE(0, offset); offset += 2; // Reserved
buf.writeUInt16LE(1, offset); offset += 2; // Type: 1 = ICON
buf.writeUInt16LE(1, offset); offset += 2; // Count: 1 image

// ICONDIRENTRY (16 bytes)
buf.writeUInt8(width, offset); offset += 1;
buf.writeUInt8(height, offset); offset += 1;
buf.writeUInt8(0, offset); offset += 1; // Color count
buf.writeUInt8(0, offset); offset += 1; // Reserved
buf.writeUInt16LE(1, offset); offset += 2; // Color planes
buf.writeUInt16LE(32, offset); offset += 2; // Bits per pixel
buf.writeUInt32LE(imageSize, offset); offset += 4;
buf.writeUInt32LE(6 + 16, offset); offset += 4; // Offset to BMP data

// BITMAPINFOHEADER (40 bytes)
buf.writeUInt32LE(bmpInfoHeaderSize, offset); offset += 4;
buf.writeInt32LE(width, offset); offset += 4;
buf.writeInt32LE(height * 2, offset); offset += 4; // XOR + AND height
buf.writeUInt16LE(1, offset); offset += 2; // Planes
buf.writeUInt16LE(32, offset); offset += 2; // BitCount
buf.writeUInt32LE(0, offset); offset += 4; // Compression
buf.writeUInt32LE(pixelDataSize + maskDataSize, offset); offset += 4;
buf.writeInt32LE(0, offset); offset += 4;
buf.writeInt32LE(0, offset); offset += 4;
buf.writeUInt32LE(0, offset); offset += 4;
buf.writeUInt32LE(0, offset); offset += 4;

// Helper to check rounded rect
function insideRoundedRect(x, y, w, h, r) {
  const dx = Math.max(r - x, 0, x - (w - 1 - r));
  const dy = Math.max(r - y, 0, y - (h - 1 - r));
  return dx * dx + dy * dy <= r * r;
}

// Draw pixels (bottom-up for ICO DIB)
for (let row = 0; row < height; row++) {
  const y = height - 1 - row;
  for (let x = 0; x < width; x++) {
    const pxOffset = offset + (row * width + x) * 4;
    if (!insideRoundedRect(x, y, width, height, 14)) {
      buf.writeUInt32LE(0x00000000, pxOffset);
      continue;
    }

    // Gradient background: Indigo (#4f46e5) to Purple (#9333ea)
    const t = (x + y) / (width + height);
    let r = Math.round(79 * (1 - t) + 147 * t);
    let g = Math.round(70 * (1 - t) + 51 * t);
    let b = Math.round(229 * (1 - t) + 234 * t);

    // Draw white "< / >" code brackets in the center
    const cy = 31.5;
    const dy = Math.abs(y - cy);
    // Left chevron '<': centered around x = 16..24
    const leftDist = Math.abs((x - 15) - dy * 0.85);
    // Right chevron '>': centered around x = 40..48
    const rightDist = Math.abs((48 - x) - dy * 0.85);
    // Center slash '/': centered around x = 31.5
    const slashDist = Math.abs((x - 31.5) + (y - cy) * 0.38);

    const isBracket = (dy <= 11 && (leftDist < 2.3 || rightDist < 2.3)) || (dy <= 13 && slashDist < 1.9);

    if (isBracket) {
      r = 255;
      g = 255;
      b = 255;
    }

    buf[pxOffset + 0] = b;
    buf[pxOffset + 1] = g;
    buf[pxOffset + 2] = r;
    buf[pxOffset + 3] = 255;
  }
}

const outPath = path.resolve('launcher/app.ico');
fs.writeFileSync(outPath, buf);
console.log('Generated icon:', outPath);
