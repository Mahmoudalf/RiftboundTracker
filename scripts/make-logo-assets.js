/**
 * Regenerates every launcher/splash/in-app asset from the master logo.
 *
 * Run: `node scripts/make-logo-assets.js`
 *
 * The master carries a real alpha channel, so the mark is cropped and scaled,
 * never keyed. The mark's extent is *measured* from that alpha rather than
 * hardcoded, so replacing the master with a differently-composed one needs no
 * edit here — which has already happened once.
 *
 * Two things this does that are easy to get wrong:
 *
 * - **Premultiplied resize.** Transparent pixels in the master are `0,0,0,0`.
 *   Scaling non-premultiplied RGBA averages that black into every edge pixel
 *   and leaves a dark fringe, which on a dark mark hides until someone puts it
 *   on a light background. Alpha is folded in before the resample and divided
 *   back out after.
 * - **`icon.png` is flattened.** iOS rejects an app icon with an alpha channel,
 *   so that one output — and only that one — gets an opaque field behind it.
 */
const path = require('path');
const Jimp = require('jimp-compact');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'app logo', 'Rifhthall Logo No BG.png');
const OUT = path.join(ROOT, 'assets', 'images');

/**
 * The field behind the launcher icon, and the artwork's own original ground.
 *
 * Deliberately *not* `color.bg` (#141416): an icon sits on the user's
 * wallpaper rather than on our surface, and the mark is charcoal — at the
 * app's near-black it would sink into a dark home screen.
 */
const ICON_BG = [0x1c, 0x1f, 0x24];

/** Measure the mark from the alpha channel. Anything above 0 counts as ink. */
function measure({ width: W, height: H, data }) {
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error('master is fully transparent');
  return {
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    cx: Math.round((minX + maxX) / 2),
    cy: Math.round((minY + maxY) / 2),
  };
}

/**
 * A square crop centred on the mark, sized so the mark's longer side occupies
 * `fraction` of it, resampled to `size`. Outside the master is transparent,
 * which is what a square larger than the artwork should be.
 */
function squareCrop(img, mark, fraction, size) {
  const { width: W, height: H, data } = img.bitmap;
  const S = Math.round(Math.max(mark.w, mark.h) / fraction);
  const out = new Jimp(S, S, 0x00000000);
  const od = out.bitmap.data;
  const x0 = mark.cx - (S >> 1);
  const y0 = mark.cy - (S >> 1);
  for (let y = 0; y < S; y++) {
    const sy = y0 + y;
    if (sy < 0 || sy >= H) continue;
    for (let x = 0; x < S; x++) {
      const sx = x0 + x;
      if (sx < 0 || sx >= W) continue;
      const si = (sy * W + sx) * 4;
      const oi = (y * S + x) * 4;
      // premultiply, so the resample below cannot pull black out of the void
      const a = data[si + 3];
      od[oi] = Math.round((data[si] * a) / 255);
      od[oi + 1] = Math.round((data[si + 1] * a) / 255);
      od[oi + 2] = Math.round((data[si + 2] * a) / 255);
      od[oi + 3] = a;
    }
  }
  out.resize(size, size, Jimp.RESIZE_BICUBIC);
  const rd = out.bitmap.data;
  for (let i = 0; i < rd.length; i += 4) {
    const a = rd[i + 3];
    if (a === 0) {
      rd[i] = rd[i + 1] = rd[i + 2] = 0;
      continue;
    }
    for (let c = 0; c < 3; c++) rd[i + c] = Math.min(255, Math.round((rd[i + c] * 255) / a));
  }
  return out;
}

/** Composite onto an opaque field. Only `icon.png` needs this; iOS demands it. */
function flatten(img, rgb) {
  const out = new Jimp(img.bitmap.width, img.bitmap.height, 0x000000ff);
  const od = out.bitmap.data;
  const d = img.bitmap.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    for (let c = 0; c < 3; c++) od[i + c] = Math.round(d[i + c] * a + rgb[c] * (1 - a));
    od[i + 3] = 255;
  }
  return out;
}

(async () => {
  const master = await Jimp.read(SRC);
  const mark = measure(master.bitmap);
  console.log(`master ${master.bitmap.width}x${master.bitmap.height}`);
  console.log(`  mark ${mark.w}x${mark.h} centred at ${mark.cx},${mark.cy}`);

  /*
   * The fractions are set by how each platform crops what it is handed.
   *
   * An adaptive icon is masked — to a circle, in the worst case — so the mark
   * stays inside the middle ~2/3 or the hexagon loses its corners. iOS masks to
   * a rounded square and can run closer to the edge. The onboarding hero is
   * masked by nothing at all.
   *
   * `splash-icon.png` is the exception and is deliberately *tight*. The splash
   * config already insets it — `imageWidth` scales the whole asset to that many
   * dp inside a larger canvas — so padding baked in here multiplies with the
   * padding applied there. At 60% it rendered about 42% of the splash canvas,
   * a mark visibly adrift in its own circle. Tight here means `imageWidth`
   * states the mark's size and nothing has to be back-computed.
   */
  const jobs = [
    ['icon.png', 0.73, 1024, ICON_BG],
    ['adaptive-icon.png', 0.6, 1024, null],
    ['favicon.png', 0.73, 256, null],
    ['splash-icon.png', 0.98, 1024, null],
    ['logo.png', 0.92, 512, null],
  ];

  for (const [name, fraction, size, field] of jobs) {
    let img = squareCrop(master, mark, fraction, size);
    if (field) img = flatten(img, field);
    await img.writeAsync(path.join(OUT, name));
    console.log(
      `  wrote ${name} ${size}x${size} — mark at ${Math.round(fraction * 100)}%` +
        (field ? ', flattened onto #1C1F24' : ', transparent')
    );
  }
})();
