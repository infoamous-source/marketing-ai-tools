import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'ko-KR',
  extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko;q=0.9' },
});

const dir = '/Users/suni/marketing-ai-tools/screenshots';

// localStorage에 한국어 설정 주입
const seedPage = await context.newPage();
await seedPage.goto('http://localhost:5176/', { waitUntil: 'domcontentloaded', timeout: 10000 });
await seedPage.evaluate(() => { localStorage.setItem('i18nextLng', 'ko'); });
await seedPage.close();

// 8번: 회원가입 화면
const p1 = await context.newPage();
await p1.goto('http://localhost:5176/register', { waitUntil: 'networkidle', timeout: 15000 });
await p1.waitForTimeout(2500);
await p1.screenshot({ path: `${dir}/08-register.png`, fullPage: false });
console.log('✅ 08-register.png');

// 8번 대안: 로그인 화면
const p1b = await context.newPage();
await p1b.goto('http://localhost:5176/login', { waitUntil: 'networkidle', timeout: 15000 });
await p1b.waitForTimeout(2500);
await p1b.screenshot({ path: `${dir}/08-login.png`, fullPage: false });
console.log('✅ 08-login.png');

// 10번: 메인 화면
const p2 = await context.newPage();
await p2.goto('http://localhost:5176/', { waitUntil: 'networkidle', timeout: 15000 });
await p2.waitForTimeout(2500);
await p2.screenshot({ path: `${dir}/10-main.png`, fullPage: false });
console.log('✅ 10-main.png');

await browser.close();
console.log('🎉 Done!');
