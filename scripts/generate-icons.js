import { createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir  = join(__dirname, '../dist/icons');

const COLORS = {
  gray:   [136, 136, 136],
  green:  [34,  197, 94 ],
  yellow: [234, 179, 8  ],
  red:    [239, 68,  68 ],
};

const SIZE = 32;

function createCirclePNG(r, g, b) {
  const png    = new PNG({ width: SIZE, height: SIZE, filterType: -1 });
  const cx     = SIZE / 2;
  const cy     = SIZE / 2;
  const radius = SIZE / 2 - 2;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (SIZE * y + x) * 4;
      const dx  = x + 0.5 - cx;
      const dy  = y + 0.5 - cy;
      const d   = Math.sqrt(dx * dx + dy * dy);
      // soft anti-aliased edge over 1.5px
      const alpha = Math.max(0, Math.min(1, radius + 1.5 - d));
      png.data[idx]     = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = Math.round(alpha * 255);
    }
  }
  return png;
}

for (const [name, [r, g, b]] of Object.entries(COLORS)) {
  const png     = createCirclePNG(r, g, b);
  const outPath = join(iconsDir, `${name}.png`);
  await new Promise((resolve, reject) => {
    png.pack()
      .pipe(createWriteStream(outPath))
      .on('finish', resolve)
      .on('error', reject);
  });
  console.log(`  icon → ${name}.png`);
}
