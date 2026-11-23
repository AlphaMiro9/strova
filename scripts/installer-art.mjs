// Renders the branded images for the Windows setup wizards (NSIS + WiX/MSI) as 24-bit BMP.
import { Resvg } from '@resvg/resvg-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const out = new URL('src-tauri/installer/', root);
await mkdir(out, { recursive: true });

const iconSvg = await readFile(new URL('www/icons/icon.svg', root), 'utf8');
const iconInner = iconSvg.replace(/<svg[^>]*>/, '').replace('</svg>', '');
const icon = (x, y, size) => `<g transform="translate(${x} ${y}) scale(${size / 512})">${iconInner}</g>`;
const FONT = 'Segoe UI, Segoe UI Variable Display, Arial, sans-serif';

/** RGBA pixels → 24-bit bottom-up BMP */
function toBmp(width, height, rgba) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const size = 54 + rowSize * height;
  const b = Buffer.alloc(size);
  b.write('BM', 0); b.writeUInt32LE(size, 2); b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14); b.writeInt32LE(width, 18); b.writeInt32LE(height, 22);
  b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28); b.writeUInt32LE(rowSize * height, 34);
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, a = rgba[i + 3] / 255;
      // flatten onto white
      b[row + x * 3] = Math.round(rgba[i + 2] * a + 255 * (1 - a));
      b[row + x * 3 + 1] = Math.round(rgba[i + 1] * a + 255 * (1 - a));
      b[row + x * 3 + 2] = Math.round(rgba[i] * a + 255 * (1 - a));
    }
  }
  return b;
}
async function render(name, w, h, body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#1d1530"/><stop offset="1" stop-color="#0c0b12"/></linearGradient>
      <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset=".55" stop-color="#f472b6"/><stop offset="1" stop-color="#fb923c"/></linearGradient>
      <radialGradient id="glow" cx=".3" cy=".25" r=".7"><stop offset="0" stop-color="#8b5cf6" stop-opacity=".55"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></radialGradient>
      <radialGradient id="glow2" cx=".8" cy=".9" r=".6"><stop offset="0" stop-color="#f472b6" stop-opacity=".35"/><stop offset="1" stop-color="#f472b6" stop-opacity="0"/></radialGradient>
    </defs>${body}</svg>`;
  const img = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' } }).render();
  await writeFile(new URL(name, out), toBmp(img.width, img.height, img.pixels));
  console.log(name, img.width + 'x' + img.height);
}

// NSIS welcome/finish sidebar – 164×314
await render('nsis-sidebar.bmp', 164, 314, `
  <rect width="164" height="314" fill="url(#bgGrad)"/>
  <rect width="164" height="314" fill="url(#glow)"/><rect width="164" height="314" fill="url(#glow2)"/>
  ${icon(42, 58, 80)}
  <text x="82" y="172" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="800" fill="#ffffff">Strova</text>
  <text x="82" y="194" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#c4bfd8">YouTube &amp; Musik</text>
  <text x="82" y="208" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#c4bfd8">ohne Tracking</text>
  <rect x="42" y="226" width="80" height="3" rx="1.5" fill="url(#brand)"/>
  <text x="82" y="292" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#8a85a0">Open Source · kostenlos</text>`);

// NSIS header (inner pages, top right on white) – 150×57
await render('nsis-header.bmp', 150, 57, `
  <rect width="150" height="57" fill="#ffffff"/>
  ${icon(96, 8, 42)}
  <text x="88" y="34" text-anchor="end" font-family="${FONT}" font-size="18" font-weight="800" fill="#17142a">Strova</text>`);

// WiX dialog background (welcome/finish) – 493×312: branded left panel, white right side for text
await render('wix-dialog.bmp', 493, 312, `
  <rect width="493" height="312" fill="#ffffff"/>
  <rect width="164" height="312" fill="url(#bgGrad)"/>
  <rect width="164" height="312" fill="url(#glow)"/><rect width="164" height="312" fill="url(#glow2)"/>
  ${icon(42, 70, 80)}
  <text x="82" y="184" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="800" fill="#ffffff">Strova</text>
  <text x="82" y="206" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#c4bfd8">YouTube &amp; Musik</text>
  <rect x="42" y="222" width="80" height="3" rx="1.5" fill="url(#brand)"/>`);

// WiX top banner (inner pages) – 493×58: white left for text, logo right
await render('wix-banner.bmp', 493, 58, `
  <rect width="493" height="58" fill="#ffffff"/>
  <rect x="380" width="113" height="58" fill="url(#bgGrad)"/>
  <rect x="380" width="113" height="58" fill="url(#glow)"/>
  ${icon(418, 10, 38)}`);
