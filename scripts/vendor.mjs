// Copies third-party browser files into www/vendor so the app works offline and inside Tauri/Capacitor.
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
await mkdir(new URL('www/vendor/', root), { recursive: true });
await copyFile(new URL('node_modules/hls.js/dist/hls.min.js', root), new URL('www/vendor/hls.min.js', root));
console.log('hls.js ->', fileURLToPath(new URL('www/vendor/hls.min.js', root)));
