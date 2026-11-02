 import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const PUBLIC_DIR = path.resolve('public');
const ICONS_DIR = path.join(PUBLIC_DIR, 'icons');

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// 1. Load Dadaji Photo (Shri Munshi Seth Ji)
const photoPath = path.join(PUBLIC_DIR, 'dadaji-photo.jpg');
let photoBase64 = '';
if (fs.existsSync(photoPath)) {
  const photoBuffer = fs.readFileSync(photoPath);
  photoBase64 = `data:image/jpeg;base64,${photoBuffer.toString('base64')}`;
}

// 2. Create Dadaji & Munsi Kirana SVG Monogram with real photo
const svgMonogram = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7B33CE"/>
      <stop offset="50%" stop-color="#5F259F"/>
      <stop offset="100%" stop-color="#3F1270"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFE8A3"/>
      <stop offset="50%" stop-color="#F5B83D"/>
      <stop offset="100%" stop-color="#DE9412"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#1B0633" flood-opacity="0.4"/>
    </filter>
    <clipPath id="dadajiCircle">
      <circle cx="256" cy="210" r="135"/>
    </clipPath>
  </defs>

  <!-- Background Base -->
  <rect width="512" height="512" rx="128" fill="url(#purpleGrad)"/>
  
  <!-- Outer Decorative Ring -->
  <circle cx="256" cy="256" r="215" fill="none" stroke="url(#goldGrad)" stroke-width="6" opacity="0.75"/>
  <circle cx="256" cy="256" r="202" fill="#FFFFFF" fill-opacity="0.05"/>

  <!-- Inner Badge Frame -->
  <circle cx="256" cy="210" r="144" fill="url(#goldGrad)" filter="url(#shadow)"/>
  <circle cx="256" cy="210" r="138" fill="#FFFFFF"/>

  ${
    photoBase64
      ? `<!-- Shri Munshi Seth Ji Photograph -->
  <image href="${photoBase64}" x="121" y="75" width="270" height="270" preserveAspectRatio="xMidYMid slice" clip-path="url(#dadajiCircle)"/>
  <circle cx="256" cy="210" r="136" fill="none" stroke="url(#goldGrad)" stroke-width="5"/>`
      : `<!-- Fallback Silhouette -->
  <circle cx="256" cy="210" r="135" fill="#FFF8EB"/>
  <g transform="translate(146, 100)">
    <circle cx="75" cy="115" r="22" fill="none" stroke="#5F259F" stroke-width="7"/>
    <circle cx="145" cy="115" r="22" fill="none" stroke="#5F259F" stroke-width="7"/>
    <line x1="97" y1="115" x2="123" y2="115" stroke="#5F259F" stroke-width="7"/>
    <path d="M 65 152 Q 110 148 110 165 Q 110 148 155 152 Q 130 178 110 166 Q 90 178 65 152 Z" fill="#5F259F"/>
    <path d="M 106 65 L 114 65 L 112 88 L 108 88 Z" fill="#E53935"/>
    <circle cx="110" cy="94" r="4" fill="#F5B83D"/>
  </g>`
  }

  <!-- Store Name & Grandfather Blessing Banner Below -->
  <rect x="36" y="375" width="440" height="102" rx="32" fill="url(#goldGrad)" filter="url(#shadow)"/>
  <text x="256" y="418" font-family="'Noto Sans Devanagari', 'Nirmala UI', sans-serif" font-size="28" font-weight="900" fill="#29163D" text-anchor="middle" letter-spacing="0.5">मुंशी किराना स्टोर</text>
  <text x="256" y="454" font-family="'Noto Sans Devanagari', 'Nirmala UI', sans-serif" font-size="16" font-weight="800" fill="#5F259F" text-anchor="middle">श्री मुंशी सेठ जी की पावन स्मृति में</text>
</svg>`;

// Write SVG files
fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), svgMonogram);
fs.writeFileSync(path.join(PUBLIC_DIR, 'dadaji-avatar.svg'), svgMonogram);
fs.writeFileSync(path.join(ICONS_DIR, 'icon.svg'), svgMonogram);

// Pure Node.js PNG encoder helper
function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generateRasterPNG(width, height, isMaskable = false) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  const rowLen = 1 + width * 4;
  const raw = Buffer.alloc(height * rowLen);
  const cx = width / 2;
  const cy = height / 2;
  const rOuter = (width / 2) * (isMaskable ? 0.95 : 0.88);
  const rInner = rOuter * 0.72;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    raw[rowOffset] = 0;

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (isMaskable) {
        if (dist <= rInner) {
          raw[pxOffset] = 255;
          raw[pxOffset + 1] = 248;
          raw[pxOffset + 2] = 235;
          raw[pxOffset + 3] = 255;
        } else if (dist <= rInner + 8) {
          raw[pxOffset] = 245;
          raw[pxOffset + 1] = 184;
          raw[pxOffset + 2] = 61;
          raw[pxOffset + 3] = 255;
        } else {
          raw[pxOffset] = 95;
          raw[pxOffset + 1] = 37;
          raw[pxOffset + 2] = 159;
          raw[pxOffset + 3] = 255;
        }
      } else {
        if (dist > rOuter) {
          raw[pxOffset] = 0;
          raw[pxOffset + 1] = 0;
          raw[pxOffset + 2] = 0;
          raw[pxOffset + 3] = 0;
        } else if (dist > rOuter - 6) {
          raw[pxOffset] = 245;
          raw[pxOffset + 1] = 184;
          raw[pxOffset + 2] = 61;
          raw[pxOffset + 3] = 255;
        } else if (dist <= rInner) {
          raw[pxOffset] = 255;
          raw[pxOffset + 1] = 248;
          raw[pxOffset + 2] = 235;
          raw[pxOffset + 3] = 255;
        } else {
          raw[pxOffset] = 95;
          raw[pxOffset + 1] = 37;
          raw[pxOffset + 2] = 159;
          raw[pxOffset + 3] = 255;
        }
      }
    }
  }

  const compressed = zlib.deflateSync(raw);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

fs.writeFileSync(path.join(ICONS_DIR, 'icon-192x192.png'), generateRasterPNG(192, 192));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-512x512.png'), generateRasterPNG(512, 512));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-maskable-512x512.png'), generateRasterPNG(512, 512, true));
fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.png'), generateRasterPNG(180, 180));

console.log('Successfully generated Munsi Kirana Store branding & PWA icons with Shri Munshi Seth Ji photo!');
