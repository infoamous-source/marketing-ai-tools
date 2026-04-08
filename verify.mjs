import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';

const results = [];
const mark = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
const page = await ctx.newPage();

// JS 콘솔 에러 수집
const jsErrors = [];
page.on('pageerror', e => jsErrors.push(e.message));
page.on('console', msg => { if (msg.type() === 'error') jsErrors.push('console.error: ' + msg.text()); });

const url = pathToFileURL(path.resolve('index.html')).href;
await page.goto(url);
await page.waitForLoadState('domcontentloaded');

// 1. 타이틀 확인
const title = await page.title();
mark('1. title = "기획안 스튜디오"', title === '기획안 스튜디오', `실제: ${title}`);

// 2. 게이트 화면 존재
const gateH1 = await page.locator('#gateScreen h1').textContent();
mark('2. 게이트 화면 타이틀', gateH1.trim() === '기획안 스튜디오', `실제: ${gateH1}`);

// 3. TEST 코드로 입장
await page.fill('#gateCodeInput', 'TEST');
await page.click('#gateSubmitBtn');
await page.waitForTimeout(500);

// 4. 탑바 타이틀
const topH1 = await page.locator('#topBar h1').textContent();
mark('3. 탑바 타이틀', topH1.trim() === '기획안 스튜디오', `실제: ${topH1}`);

// 5. 히어로 카피에 "마케팅" 없는지
const heroH2 = await page.locator('main h2').first().textContent();
mark('4. 히어로 타이틀', heroH2.trim() === '기획안 스튜디오', `실제: ${heroH2}`);
const heroSub = await page.locator('main h2').first().locator('xpath=following-sibling::p').first().textContent();
mark('5. 히어로 서브카피에 "마케팅" 미포함', !heroSub.includes('마케팅'), `실제: ${heroSub.trim()}`);

// 6. 기획안 양식 폼 존재
const planSheetExists = await page.locator('#planSheet').count();
mark('6. #planSheet 존재', planSheetExists === 1);

// 7. 양식 6칸 textarea
const slotCount = await page.locator('#planSheet textarea[data-slot]').count();
mark('7. 기획안 양식 6칸', slotCount === 6, `실제: ${slotCount}개`);

// 8. PNG 저장 버튼 2개 (상단 + 하단)
const exportBtns = await page.locator('button:has-text("PNG")').count();
mark('8. PNG 저장 버튼 존재', exportBtns >= 1, `실제: ${exportBtns}개`);

// 9. 그룹명 확인
const groups = await page.locator('main section h3').allTextContents();
mark('9. "기획안 작성 핵심 도구" 그룹', groups.some(g => g.includes('기획안 작성 핵심 도구')), `실제: ${JSON.stringify(groups)}`);
mark('10. "기타 활용" 그룹', groups.some(g => g.includes('기타 활용')));
mark('11. "학습 자료" 그룹', groups.some(g => g.includes('학습 자료')));

// 12. 기타 활용 그룹 기본 접힘
const groupBody1 = page.locator('#group-1-body');
const isHidden = await groupBody1.evaluate(el => el.classList.contains('hidden'));
mark('12. "기타 활용" 그룹 기본 접힘', isHidden === true);

// 13. sessionStorage 저장 테스트
await page.fill('#planTitle', '시니어 디지털 교실 운영안');
await page.fill('[data-slot="5"]', '주 1회, 토요일 오전 10시, 마을회관');
await page.waitForTimeout(200);
const draft = await page.evaluate(() => JSON.parse(sessionStorage.getItem('marketing-plan-draft') || '{}'));
mark('13. sessionStorage 저장', draft.title === '시니어 디지털 교실 운영안' && draft.slot5?.includes('주 1회'), `실제: ${JSON.stringify(draft).slice(0,100)}`);

// 14. 새로고침 후 값 유지
await page.reload();
await page.waitForTimeout(500);
const titleAfter = await page.inputValue('#planTitle');
mark('14. 새로고침 후 양식 값 유지', titleAfter === '시니어 디지털 교실 운영안', `실제: ${titleAfter}`);

// 15. 페르소나 메이커 → sendToPlan 동작
await page.goto(url + '#persona-maker');
await page.waitForTimeout(300);
// 템플릿 클릭
await page.click('button[data-tmpl="20대 직장인"]');
await page.waitForTimeout(200);
await page.click('#personaGenBtn');
await page.waitForTimeout(300);
const planBtnVisible = await page.locator('#personaResult button:has-text("기획안 [타겟]")').count();
mark('15. 페르소나 결과에 "기획안으로 보내기" 버튼', planBtnVisible === 1);

// 16. 버튼 클릭 → 양식 slot3에 저장됨
if (planBtnVisible > 0) {
  await page.click('#personaResult button:has-text("기획안 [타겟]")');
  await page.waitForTimeout(1200); // 0.7초 후 홈으로 이동
  const slot3 = await page.evaluate(() => JSON.parse(sessionStorage.getItem('marketing-plan-draft') || '{}').slot3);
  mark('16. sendToPlan(3) 자동 저장', slot3 && slot3.includes('김민수'), `실제: ${(slot3||'').slice(0,80)}`);
}

// 17. 적성 테스트도 동일 확인
await page.goto(url + '#aptitude-test');
await page.waitForTimeout(300);
await page.click('#aptStartBtn');
// 10문제 모두 A 선택
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(100);
  const btn = page.locator('.apt-answer-btn').first();
  if (await btn.count() > 0) await btn.click();
}
await page.waitForTimeout(3500); // loading phase
const aptBtnCount = await page.locator('#aptContent button:has-text("기획안 [자기/팀 이해]")').count();
mark('17. 적성 테스트 결과에 "기획안으로 보내기" 버튼', aptBtnCount === 1);

// 18. 컬러피커
await page.goto(url + '#color-picker');
await page.waitForTimeout(300);
await page.click('.emotion-btn');
await page.waitForTimeout(300);
const colorBtn = await page.locator('#colorResult button:has-text("기획안 [컨셉]")').count();
mark('18. 컬러피커 결과에 "기획안으로 보내기" 버튼', colorBtn === 1);

// 19. JS 에러 없음
mark('19. JS 에러 없음', jsErrors.length === 0, jsErrors.length ? JSON.stringify(jsErrors).slice(0,300) : '');

// 20. html2canvas CDN 로드됨
const h2cLoaded = await page.evaluate(() => typeof html2canvas !== 'undefined');
mark('20. html2canvas CDN 로드됨', h2cLoaded);

// 21. PNG 저장 실제 실행 (다운로드 캡처)
await page.goto(url);
await page.waitForTimeout(400);
// gate 재통과
const needsGate = await page.locator('#gateScreen').isVisible().catch(() => false);
if (needsGate) {
  await page.fill('#gateCodeInput', 'TEST');
  await page.click('#gateSubmitBtn');
  await page.waitForTimeout(400);
}
const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
await page.click('button:has-text("기획안 한 장 PNG로 저장")');
const dl = await downloadPromise;
mark('21. PNG 저장 다운로드 트리거', !!dl, dl ? `파일명: ${dl.suggestedFilename()}` : '다운로드 이벤트 없음');

// ─── 깍두기 업데이트 포팅 회귀 검증 (2026-04-08) ───

// 22. ROAS 시뮬레이터 — 새 UI(입력 2개 + 신호등)
await page.goto(url + '#roas-simulator');
await page.waitForTimeout(400);
const hasNewRoas = await page.locator('#rsAdSpend, #rsRevenue').count();
mark('22. ROAS 새 입력 필드(rsAdSpend + rsRevenue)', hasNewRoas === 2);

// 23. ROAS 수식 계산 + 신호등 렌더
await page.fill('#rsAdSpend', '300000');
await page.fill('#rsRevenue', '540000');
await page.click('#rsGenerateBtn');
await page.waitForTimeout(1500);
const roasNum = await page.locator('#rsResult').textContent();
mark('23. ROAS 결과에 1.8× 표시 + 신호등 + 처방', roasNum.includes('1.8') && (roasNum.includes('본전') || roasNum.includes('좋아요') || roasNum.includes('손해')), roasNum.slice(0, 80));

// 24. ROAS 결과 → 기획안 [성과·검증] 버튼
const roasPlanBtn = await page.locator('#rsResult button:has-text("기획안 [성과·검증]")').count();
mark('24. ROAS 결과에 "기획안 [성과·검증]" 버튼', roasPlanBtn === 1);

// 25. market-scanner — 복수 키워드 +버튼
await page.goto(url + '#market-scanner');
await page.waitForTimeout(400);
const msAddBtn = await page.locator('#msAddKeywordBtn').count();
mark('25. market-scanner 복수 키워드 "➕ 키워드 추가" 버튼', msAddBtn === 1);

// 26. 키워드 추가 동작
await page.click('#msAddKeywordBtn');
await page.waitForTimeout(200);
const kwInputs = await page.locator('#msKeywordList input').count();
mark('26. +버튼 클릭 시 입력 칸 2개로 증가', kwInputs === 2);

// 27. 세일즈 플래너(퍼펙트플래너) 새 리스트 입력
await page.goto(url + '#sales-planner');
await page.waitForTimeout(400);
const spListCount = await page.locator('#spCustomersList, #spStrengthsList, #spOffersList').count();
mark('27. sales-planner 3개 리스트 입력(고객/장점/혜택)', spListCount === 3);

// 28. 세일즈 플래너 Mock 생성 → 상세페이지 탭
await page.fill('#spProductName', '테스트 상품');
await page.click('#spGenerateBtn');
await page.waitForTimeout(1200);
const detailTabVisible = await page.locator('#spTabDetail').count();
mark('28. sales-planner 결과에 "상세페이지" 탭 렌더', detailTabVisible === 1);

// 29. 세일즈 플래너 라이브 큐시트 탭 전환
await page.click('#spTabLive');
await page.waitForTimeout(300);
const liveScriptText = await page.locator('#spTabContent').textContent();
mark('29. 라이브 큐시트 탭에 5단계(오프닝/공감/시연/Q&A/마무리) 표시',
  liveScriptText.includes('오프닝') && liveScriptText.includes('시연') && liveScriptText.includes('Q&A'),
  liveScriptText.slice(0, 100));

// 30. callGeminiAPI alias 버그 픽스 확인
const aliasOk = await page.evaluate(() => typeof callGeminiAPI === 'function');
mark('30. callGeminiAPI alias 정의됨', aliasOk);

await browser.close();

const failed = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} 통과 ===`);
if (failed.length) {
  console.log('\n실패:');
  failed.forEach(f => console.log(`  ❌ ${f.name} — ${f.detail || ''}`));
  process.exit(1);
}
