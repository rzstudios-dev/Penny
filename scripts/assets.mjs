import sharp from 'sharp';
import fs from 'node:fs/promises';
const source = 'public/assets/penny-bunny.png';
await fs.mkdir('release-assets', { recursive: true });
const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [density, size] of Object.entries(sizes)) {
  const directory = `android/app/src/main/res/mipmap-${density}`;
  await fs.mkdir(directory, { recursive: true });
  const bunny = await sharp(source).resize(Math.round(size * .75), Math.round(size * .75), { fit: 'contain' }).png().toBuffer();
  const icon = sharp({ create: { width: size, height: size, channels: 4, background: '#F9E4D9' } }).composite([{ input: bunny, gravity: 'centre' }]);
  const bytes = await icon.png().toBuffer();
  await fs.writeFile(`${directory}/ic_launcher.png`, bytes); await fs.writeFile(`${directory}/ic_launcher_round.png`, bytes);
  const foreground = await sharp(source).resize(Math.round(size * 1.35), Math.round(size * 1.35), { fit: 'contain' }).png().toBuffer();
  await sharp({ create: { width: Math.round(size * 2.25), height: Math.round(size * 2.25), channels: 4, background: '#00000000' } }).composite([{ input: foreground, gravity: 'centre' }]).png().toFile(`${directory}/ic_launcher_foreground.png`);
}
const playBunny = await sharp(source).resize(390, 390, { fit: 'contain' }).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 3, background: '#F9E4D9' } }).composite([{ input: playBunny, gravity: 'centre' }]).png().toFile('release-assets/play-store-icon.png');
await sharp(source).resize({ width: 500 }).png().toFile('public/assets/penny-bunny-small.png');
console.log('Android density icons, adaptive foregrounds and 512px Play icon created.');
