#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   ui_check.js — 화면 쪽 견주기.
   같은 조작을 두 파일에 그대로 넣고 화면에 뜬 글자를 통째로 비교한다.
   sim_check.js 가 못 보는 구간(그리기·이벤트·툴팁)이 여기 걸린다.

     node ui_check.js A.html B.html

   headless 크로미움이 필요하다 — playwright-core 와 미리 깔린 브라우저를 쓴다.
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright-core')) }
catch { console.error('playwright-core 가 없다 — npm install 을 먼저 돌린다'); process.exit(2) }

/* 미리 깔린 크로미움을 찾는다 */
const exe = (() => {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const hit = fs.existsSync(base) && fs.readdirSync(base)
    .filter(d => d.startsWith('chromium') && !d.includes('headless'))
    .map(d => path.join(base, d, 'chrome-linux', 'chrome'))
    .find(p => fs.existsSync(p));
  if (!hit) { console.error('크로미움을 못 찾았다 — CHROME_PATH 로 알려 준다'); process.exit(2) }
  return hit;
})();

const PANES = ['one','sess','story','batch','make'];

async function probe(browser, file){
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if(m.type()==='error') errs.push('console: ' + m.text()) });
  await page.goto('file://' + path.resolve(file));
  await page.waitForTimeout(300);

  const snap = {};
  const text = async sel => (await page.locator(sel).first().innerText().catch(()=>'(없음)')).replace(/\s+/g,' ').trim();

  /* ⓪ 머리 — 제목과 판 이름. 판본 표기가 여기 있다 */
  snap.head = { title: await page.title(), h1: await text('h1') };

  /* ① 부팅 직후 단판 화면 */
  snap.boot = { field: await text('#pane-one'), state: await text('#side-one'), log: await text('#log') };

  /* ② 고정 씨앗으로 새 판 → 자동 한 턴 ×3 */
  await page.evaluate(() => { document.getElementById('seed').value = '12345'; newGame() });
  await page.waitForTimeout(120);
  snap.seeded = await text('#pane-one');
  for(let i=0;i<3;i++){ await page.evaluate(()=>autoTurn()); await page.waitForTimeout(80) }
  snap.after3 = { field: await text('#pane-one'), log: await text('#log') };

  /* ③ 자동 완주 */
  await page.evaluate(()=>autoAll()); await page.waitForTimeout(400);
  snap.autoAll = { field: await text('#pane-one'), verdict: await text('#on_verdict') };

  /* ④ 탭 다섯 — 각 탭의 첫 화면 */
  snap.panes = {};
  for(const m of PANES){
    await page.evaluate(mm=>setMode(mm), m); await page.waitForTimeout(150);
    snap.panes[m] = { side: await text('#side-'+m), pane: await text('#pane-'+m) };
  }

  /* ⑤ 스토리 한 판 */
  await page.evaluate(()=>{ setMode('story'); newStory() }); await page.waitForTimeout(200);
  snap.story = await text('#pane-story');

  /* ⑥ 세션 시작 */
  await page.evaluate(()=>{ setMode('sess'); sessInit() }); await page.waitForTimeout(200);
  snap.sess = await text('#pane-sess');

  /* ⑦ 만들기 · 규칙 덮어쓰기 판 */
  await page.evaluate(()=>{ setMode('make'); renderMake() }); await page.waitForTimeout(150);
  snap.make = await text('#mk_body');
  snap.ovr  = await text('#ovrform');

  /* ⑦ㄴ 설명문이 손잡이를 따라오는가 —
     R · SR 의 숫자 손잡이를 전부 흔들어 놓고, 글이 그대로인 것을 찾는다.
     글에 숫자를 박아 두면 「규칙 덮어쓰기」로 값을 만지는 순간 설명이 거짓말을
     시작한다. 아래 목록은 애초에 규칙값을 인용하지 않는 순수 설명이라 안 움직이는
     것이 맞다. 여기 없는 이름이 새로 걸리면 그 설명문에 숫자를 박은 것이다. */
  snap.stuckTips = await page.evaluate(() => {
    /* 옛 파일에는 SYMDOC 도 ovrReset 도 없다 — 그때는 건너뛴다 */
    if (typeof SYMDOC === 'undefined' || typeof ovrSet !== 'function') return [];
    const RULEFREE = new Set(['KWTIP.관해','KWTIP.개방','LINKTIP.불응',
      'BEATTIP.분화','BEATTIP.같은 박자','BEATTIP.창','BEATTIP.굳는다','BEATTIP.엮는다',
      'BEATTIP.아문다','BEATTIP.고유','UNIQTIP.아이:4','UNIQTIP.아이:5','UNIQTIP.송이:3']);
    const all = () => {
      const o = {};
      for (const [nm, d] of [['KWTIP',KWTIP],['LINKTIP',LINKTIP],['BEATTIP',BEATTIP],
                             ['UNIQTIP',UNIQTIP],['SYMTIP',SYMTIP]])
        for (const k of Object.keys(d)) o[nm + '.' + k] = String(d[k]);
      for (const k of Object.keys(SYMDOC)) o['SYMDOC.' + k] = SYMDOC[k].why();
      return o;
    };
    const before = all();
    const shake = (root, obj, path = []) => {
      for (const k in obj) {
        const v = obj[k];
        if (typeof v === 'number') ovrSet(root, [...path, k].join('.'), v === 0 ? 7 : v * 3 + 1);
        else if (v && typeof v === 'object' && !Array.isArray(v)) shake(root, v, [...path, k]);
      }
    };
    shake('R', R0); shake('SR', SR0);
    const after = all();
    const stuck = Object.keys(before).filter(k => before[k] === after[k] && !RULEFREE.has(k));
    ovrReset();
    return stuck;
  });
  await page.waitForTimeout(120);

  /* ⑧ 툴팁 — 등록된 설명 개수와 내용 */
  snap.tips = await page.evaluate(()=>({ n: Object.keys(TIPS).length, fix: Object.keys(FIXT).length }));

  await page.close();
  return { snap, errs };
}

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const [a, b] = process.argv.slice(2);
  const A = await probe(browser, a), B = await probe(browser, b);
  await browser.close();

  let bad = 0;
  for(const [f, r] of [[a, A], [b, B]])
    if(r.errs.length){ bad++; console.log(`\n=== ${f} 오류 ${r.errs.length} ===\n` + r.errs.slice(0,10).join('\n')) }
  /* 손잡이를 따라오지 않는 설명문 — 견주기와 별개로 그 자체가 문제다 */
  for(const [f, r] of [[a, A], [b, B]]){
    const st = r.snap.stuckTips || [];
    if(st.length){ bad++; console.log(`\n=== ${f} — 손잡이를 안 따라오는 설명문 ${st.length} ===\n` + st.map(x=>'  '+x).join('\n')) }
  }
  /* 목록 자체는 파일마다 다를 수 있으니 견주기에서는 뺀다 */
  delete A.snap.stuckTips; delete B.snap.stuckTips;

  const d = [];
  (function walk(x, y, p){
    if(typeof x === 'object' && x && typeof y === 'object' && y){
      for(const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], p ? p+'.'+k : k);
    } else if(x !== y){
      d.push(`${p}:\n  A: ${String(x).slice(0,300)}\n  B: ${String(y).slice(0,300)}`);
    }
  })(A.snap, B.snap, '');

  if(d.length){ console.log(`\n=== 화면이 다른 곳 ${d.length} ===\n` + d.slice(0,12).join('\n\n')); bad++ }
  else console.log('화면 같다 — 조작 8묶음 · 탭 5개 · 오류 0');
  process.exit(bad ? 1 : 0);
})();
