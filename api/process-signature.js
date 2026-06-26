import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(__dirname, '..', 'assets', 'accountant-signature.png');
const output = path.join(__dirname, '..', 'assets', 'accountant-signature-clean.png');

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const blueInk = b > r + 8 && b > g + 4;

  if (lum > 235 || (lum > 200 && !blueInk)) {
    data[i + 3] = 0;
  } else if (blueInk) {
    data[i] = Math.min(255, r * 0.55);
    data[i + 1] = Math.min(255, g * 0.65);
    data[i + 2] = Math.min(255, b * 1.05 + 10);
    data[i + 3] = Math.min(255, Math.round(255 - (lum - 80) * 1.8));
  } else {
    data[i + 3] = Math.max(0, Math.round(180 - lum));
  }
}

await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .trim()
  .png()
  .toFile(output);

console.log('Saved', output);
