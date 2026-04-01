const puppeteer = require('puppeteer');
const path = require('path');

const FRAMES_DIR = path.join(__dirname, 'frames');
const BASE = 'https://yonkoo11.github.io/privacy-bridge';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  // 01 - Landing page hero + chain map
  console.log('01-landing...');
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3000);
  await page.screenshot({ path: path.join(FRAMES_DIR, '01-landing.png'), fullPage: false });

  // 02 - Deposit page with denomination selector
  console.log('02-deposit...');
  await page.goto(BASE + '/bridge/deposit', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3000);
  await page.screenshot({ path: path.join(FRAMES_DIR, '02-deposit.png'), fullPage: false });

  // 03 - Note display (same deposit page, scroll down a bit)
  console.log('03-note...');
  await page.evaluate(() => window.scrollBy(0, 300));
  await sleep(1000);
  await page.screenshot({ path: path.join(FRAMES_DIR, '03-note.png'), fullPage: false });

  // 04 - Withdraw page
  console.log('04-withdraw...');
  await page.goto(BASE + '/bridge/withdraw', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3000);
  await page.screenshot({ path: path.join(FRAMES_DIR, '04-withdraw.png'), fullPage: false });

  // 05 - Dashboard
  console.log('05-dashboard...');
  await page.goto(BASE + '/bridge', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3000);
  await page.screenshot({ path: path.join(FRAMES_DIR, '05-dashboard.png'), fullPage: false });

  // 06 - Landing hero again (clean close)
  console.log('06-close...');
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2000);
  await page.screenshot({ path: path.join(FRAMES_DIR, '06-close.png'), fullPage: false });

  await browser.close();
  console.log('Done. 6 frames captured.');
}

main().catch(e => { console.error(e); process.exit(1); });
