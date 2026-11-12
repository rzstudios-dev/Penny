import sharp from 'sharp';
import fs from 'node:fs/promises';

await fs.mkdir('release-assets', { recursive: true });
const bunny = await sharp('public/assets/penny-bunny.png')
  .resize(360, 360, { fit: 'contain', background: '#00000000' })
  .png()
  .toBuffer();
const artwork = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <rect width="1024" height="500" fill="#F9E4D9"/>
  <circle cx="843" cy="257" r="224" fill="#FCEDE4"/>
  <circle cx="1008" cy="56" r="131" fill="#F3C7B6" opacity=".62"/>
  <circle cx="725" cy="507" r="131" fill="#E8CAB9" opacity=".65"/>
  <path d="M50 77c0-15 12-27 27-27h98c15 0 27 12 27 27v52c0 15-12 27-27 27H77c-15 0-27-12-27-27V77Z" fill="#F5B9A6"/>
  <path d="m67 72 59 45 59-45" fill="none" stroke="#8A4C3D" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="50" y="264" fill="#603D35" font-family="Nunito, Arial, sans-serif" font-size="106" font-weight="800" letter-spacing="-5">Penny</text>
  <text x="54" y="330" fill="#7B5E56" font-family="Nunito, Arial, sans-serif" font-size="30" font-weight="600">A little more clarity for your money.</text>
  <path d="M55 396h247" stroke="#D98571" stroke-width="8" stroke-linecap="round"/>
</svg>`);
await sharp(artwork)
  .composite([{ input: bunny, left: 624, top: 106 }])
  .removeAlpha()
  .png()
  .toFile('release-assets/feature-graphic.png');
console.log('1024x500 Play feature graphic created.');
