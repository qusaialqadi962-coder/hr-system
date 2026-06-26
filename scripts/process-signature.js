const path = require('path');
const sharp = require(path.join(__dirname, '../api/node_modules/sharp'));

const src = path.join(__dirname, '../assets/accountant-signature.png');
const out = path.join(__dirname, '../assets/accountant-signature-ink.png');

function isInk(r, g, b) {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const blueDelta = b - Math.max(r, g);
  return blueDelta > 18 && b > 55 && lum < 195;
}

function inkAlpha(r, g, b) {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const blueDelta = b - Math.max(r, g);
  if (blueDelta > 18 && b > 55 && lum < 195) {
    const strength = Math.min(255, Math.round(blueDelta * 6 + (195 - lum) * 0.8));
    return Math.min(255, Math.max(40, strength));
  }
  if (blueDelta > 8 && lum < 220) {
    return Math.min(120, Math.round((blueDelta - 8) * 5));
  }
  return 0;
}

sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
  .then(({ data, info }) => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = inkAlpha(r, g, b);
      data[i + 3] = a;
      if (a === 0) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      } else if (isInk(r, g, b)) {
        data[i] = Math.max(0, Math.min(35, r - 10));
        data[i + 1] = Math.max(0, Math.min(55, g - 5));
        data[i + 2] = Math.min(200, Math.max(120, b));
      }
    }
    return sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .trim({ threshold: 1 })
      .png()
      .toFile(out);
  })
  .then(() => console.log('saved', out))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
