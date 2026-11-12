# Penny Google Play graphics

Upload these files in Play Console → Grow users → Store presence → Main store listing → Graphics.

| Placement | File | Format |
| --- | --- | --- |
| App icon | `play-store-icon.png` | 512 × 512 PNG with alpha |
| Feature graphic | `feature-graphic.png` | 1024 × 500 PNG without alpha |
| Phone screenshot 1 | `screenshot-home.jpg` | 1080 × 1920 JPEG |
| Phone screenshot 2 | `screenshot-transactions.jpg` | 1080 × 1920 JPEG |
| Phone screenshot 3 | `screenshot-reports.jpg` | 1080 × 1920 JPEG |
| Phone screenshot 4 | `screenshot-wallets.jpg` | 1080 × 1920 JPEG |
| Phone screenshot 5 | `screenshot-premium.jpg` | 1080 × 1920 JPEG |

The screenshots are captures of the actual app with illustrative ledger entries; they do not contain customer data. They can be reproduced with `node scripts/capture-store-screenshots.mjs` while the Vite server runs at `http://127.0.0.1:5174/`. Review Google Play's asset-specific AI labeling prompts for the mascot artwork. The earlier, taller screenshot files were replaced locally on 12 November 2026; the live Play listing still needs these refreshed files uploaded.

Specifications: [Google Play preview assets](https://support.google.com/googleplay/android-developer/answer/9866151), [AI asset declarations](https://support.google.com/googleplay/android-developer/answer/17262077).
