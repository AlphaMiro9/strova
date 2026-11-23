// Renders PNG icons from www/icons/icon.svg (web app, Tauri source icon).
import { Resvg } from '@resvg/resvg-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const svg = await readFile(new URL('www/icons/icon.svg', root), 'utf8');
await mkdir(new URL('build/', root), { recursive: true });

const render = (src, size) => new Resvg(src, { fitTo: { mode: 'width', value: size } }).render().asPng();

for (const size of [192, 512]) await writeFile(new URL(`www/icons/icon-${size}.png`, root), render(svg, size));
await writeFile(new URL('build/icon-1024.png', root), render(svg, 1024));

// Maskable variant: full-bleed gradient, logo scaled into the safe zone
const inner = svg.replace(/<svg[^>]*>/, '').replace('</svg>', '')
  .replace(/<rect width="512" height="512" rx="120" fill="#0c0b12"\/>/, '')
  .replace(/<rect x="40" y="40" width="432" height="432" rx="100" fill="url\(#g\)"\/>/, '');
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${inner.replace('</defs>', '</defs><rect width="512" height="512" fill="url(#g)"/><g transform="translate(76.8 76.8) scale(.7)">')}</g></svg>`;
await writeFile(new URL('www/icons/icon-maskable-512.png', root), render(maskable, 512));
console.log('Icons erstellt.');
