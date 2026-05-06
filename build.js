import { build } from 'esbuild';
import { rmSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'icons'), { recursive: true });
mkdirSync(join(dist, 'popup'), { recursive: true });
mkdirSync(join(dist, 'options'), { recursive: true });

await build({
  entryPoints: {
    background: 'src/background/index.js',
    content: 'src/content/index.js',
    'popup/index': 'src/popup/index.js',
    'options/index': 'src/options/index.js',
  },
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  target: ['chrome109', 'firefox128'],
  minify: false,
  sourcemap: process.env.NODE_ENV !== 'production',
});

copyFileSync('src/popup/index.html', 'dist/popup/index.html');
copyFileSync('src/popup/styles.css', 'dist/popup/styles.css');
copyFileSync('src/options/index.html', 'dist/options/index.html');
copyFileSync('src/options/styles.css', 'dist/options/styles.css');
copyFileSync('manifest.json', 'dist/manifest.json');

await import('./scripts/generate-icons.js');

console.log('Build complete → dist/');
