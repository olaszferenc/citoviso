import { chromium } from 'playwright-core';
const exe = '/home/citoviso/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const inFile = process.argv[2] || '_preview.html';
const outFile = process.argv[3] || '_preview.png';
const base = '/home/citoviso/citoviso/assets/brand/';
const b = await chromium.launch({ executablePath: exe });
const p = await b.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 });
await p.goto('file://' + base + inFile);
await p.waitForTimeout(1500); // let webfont load
await p.screenshot({ path: base + outFile, fullPage: true });
await b.close();
console.log('ok:', outFile);
