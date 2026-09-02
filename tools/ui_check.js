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

/* 탭 목록은 판이 쥔다 — 검사기가 제 목록을 들고 있으면 새 탭이 조용히 안 걸리고,
   요약 줄이 제 목록에서 센 수를 자신 있게 찍는다. 옛 파일은 그냥 탭이 적게 나온다 */
const PANES = page => page.evaluate(() =>
  [...document.querySelectorAll('.tab[data-m]')].map(e => e.dataset.m));

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

  /* ④ 탭마다 첫 화면 — 목록은 PANES 가 쥔다 */
  snap.panes = {};
  for(const m of await PANES(page)){
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
    const RULEFREE = new Set(['KWTIP.개방','KWTIP.진단','LINKTIP.불응',
      'LINKTIP.부설','LINKTIP.만개','LINKTIP.연쇄','LINKTIP.확산',
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

  /* ⑦ㄷ 깊은 경로 — 되돌리기 · 사혈 · 설치물 · 처치 · 규칙 덮어쓰기.
     여기는 두 파일을 견주는 것이 아니라, 그 파일 하나가 스스로 앞뒤가 맞는지 본다.
     화면 글자를 견주는 것만으로는 '눌렀더니 엉뚱한 일이 일어난다' 를 못 잡는다. */
  snap.deep = await page.evaluate(() => {
    const bad = [];
    if (typeof playCard !== 'function' || typeof undoStep !== 'function') return bad;
    const fresh = (hand, tweak) => {
      document.getElementById('seed').value = '2024';
      document.getElementById('src').value = 'level';
      document.getElementById('lv').value = '3';
      newGame();
      S.hand = hand.slice(); S.energy = 9; SEL = 0;
      if (tweak) tweak(S);
      render();
    };
    const shot = () => JSON.stringify({hp:S.hp, energy:S.energy, hand:[...S.hand].sort(),
      nodes:S.nodes.map(n=>[n.sym,n.val,n.rig|0,n.rigLent|0,n.weak|0,n.dead?1:0])});

    /* ① 되돌리기 — 카드를 내고 무르면 판이 원래대로 와야 한다 */
    fresh(['감초 탕약']);
    const a0 = shot();
    playCard('감초 탕약');
    if (shot() === a0) bad.push('되돌리기 — 카드를 냈는데 판이 그대로다 (검사가 헛돌았다)');
    undoStep();
    if (shot() !== a0) bad.push('되돌리기 — 무른 뒤 판이 원래대로 안 왔다');

    /* ② 사혈 — 낸 만큼 정확히 최대 체력에서 빠져야 한다.
       예상값을 bleedPay 로 구하면 그 함수가 틀려도 둘이 같이 틀려 검사가 헛돈다 —
       규칙값에서 따로 센다. */
    fresh(['매듭 짓다']);
    const tier = CARDS['매듭 짓다'].bleed;
    const hp0 = S.hp, want = Math.ceil(S.hpMax * R.BLEED_PAY[tier]);
    playCard('매듭 짓다');
    if (hp0 - S.hp !== want) bad.push(`사혈 — 지불액이 다르다. 규칙상 ${want} · 실제 ${hp0 - S.hp}`);

    /* ③ 설치물 — 놓고, 개방하면 사라지면서 수치가 준다 */
    fresh(['거치', '출력 개방'], s => { s.nodes[0].shielded = false; s.nodes[0].shReduc = 0 });
    playCard('거치');
    const rig = S.nodes[0].rig, want2 = C.cardNums(S, '거치').rig;
    if (rig !== want2) bad.push(`설치물 — 놓인 값이 다르다. 카드값 ${want2} · 실제 ${rig}`);
    const v0 = S.nodes[0].val;
    SEL = 0; playCard('출력 개방');
    if (S.nodes[0].rig !== 0) bad.push('설치물 — 개방했는데 설치물이 안 사라졌다');
    if (S.nodes[0].val >= v0) bad.push('설치물 — 개방했는데 수치가 안 줄었다');

    /* ④ 처치 — 처치선 아래면 끊기고 광역 억제가 돈다 */
    fresh([], s => { s.nodes[0].val = 1; s.nodes.forEach(n => { n.shielded = false; n.shReduc = 0 }) });
    if (S.nodes.length > 1) {
      const other = S.nodes[1].val;
      SEL = 0; killSel();
      if (!S.nodes[0].dead && S.nodes[0].val > 0) bad.push('처치 — 처치선 아래인데 안 끊겼다');
      if (S.nodes[1].val > other) bad.push('처치 — 끊었는데 다른 자리 수치가 되레 올랐다');
    }

    /* ⑤ 규칙 덮어쓰기 — 걸고 풀면 제자리로 와야 한다 */
    const k0 = R.KILL_LINE;
    ovrSet('R', 'KILL_LINE', 0.9);
    if (R.KILL_LINE !== 0.9) bad.push('덮어쓰기 — 값이 안 걸렸다');
    ovrReset();
    if (R.KILL_LINE !== k0) bad.push(`덮어쓰기 — 푼 뒤 제자리로 안 왔다. ${k0} → ${R.KILL_LINE}`);
    return bad;
  });
  await page.waitForTimeout(120);

  /* ⑧ 툴팁 — 등록된 설명 개수와 내용 */
  snap.tips = await page.evaluate(()=>({ n: Object.keys(TIPS).length, fix: Object.keys(FIXT).length }));

  /* ⑨ 카드팩 편성 — 팩을 빼면 그 카드가 빠지고, 대체하면 자리가 바뀐다.
     여기도 견주기가 아니라 그 파일 하나가 스스로 앞뒤가 맞는지 본다.
     ★ 툴팁까지 다 센 뒤에 돌린다 — 이 조작이 앞의 스냅숏을 흔들면 안 된다. */
  snap.packs = await page.evaluate(() => {
    const bad = [];
    if (typeof openPackStory !== 'function') return bad;   // 팩이 없던 파일
    const deck = () => packDeck(PK.on, PK.swap);
    setMode('story'); openPackStory();
    const p = PACKS.find(x => !x.fixed && !x.group), n0 = deck().length;

    /* ① 묶음이 아닌 팩 — 빼면 통째로 빠지고, 다시 들이면 통째로 돌아온다 */
    pkToggle(p.id);
    for (const id of p.cards)
      if (deck().includes(id)) bad.push(`카드팩 — 「${p.name}」 을 뺐는데 「${id}」 가 가방에 남았다`);
    if (deck().length !== n0 - p.cards.length)
      bad.push(`카드팩 — 뺀 장수가 팩 장수와 다르다. ${n0} → ${deck().length} · 팩 ${p.cards.length}장`);
    pkToggle(p.id);
    if (deck().length !== n0) bad.push('카드팩 — 다시 들였는데 장수가 안 돌아왔다');
    /* 늘 드는 팩은 뺄 손잡이가 아예 없어야 한다 */
    const fixed = PACKS.find(x => x.fixed);
    for (const id of fixed.cards)
      if (!deck().includes(id)) bad.push(`카드팩 — 늘 드는 팩의 「${id}」 가 가방에 없다`);

    /* ①ㄴ 묶음 팩 — 하나를 고르면 같은 묶음의 나머지가 빠진다. 장수는 그대로다 */
    const supply = PACKS.filter(x => x.group === 'supply');
    for (const q of supply) {
      pkToggle(q.id);
      const d = deck();
      for (const id of q.cards)
        if (!d.includes(id)) bad.push(`보급 — 「${q.name}」 을 골랐는데 「${id}」 가 가방에 없다`);
      for (const other of supply) if (other !== q) for (const id of other.cards)
        if (d.includes(id)) bad.push(`보급 — 「${q.name}」 을 골랐는데 「${other.name}」 의 「${id}」 가 남았다`);
      if (d.length !== n0) bad.push(`보급 — 분과를 바꿨는데 장수가 달라졌다. ${n0} → ${d.length}`);
      /* 고른 팩을 다시 눌러도 빠지지 않는다 — 묶음에서는 하나를 반드시 든다 */
      pkToggle(q.id);
      if (deck().length !== n0) bad.push(`보급 — 고른 「${q.name}」 을 다시 눌렀더니 편성이 달라졌다`);
      /* 어느 편성이든 상한을 넘지 않는다 */
      if (deck().length > STORY_CAP) bad.push(`상한 — 「${q.name}」 편성이 ${deck().length}/${STORY_CAP}장`);
    }

    /* ② 대체 — 자리가 바뀌되 자리 수는 늘지 않는다 */
    const [base, alt] = SWAP[0];
    pkSwap(base, alt);
    if (deck().includes(base)) bad.push(`대체 — 「${base}」 자리를 바꿨는데 그대로 있다`);
    if (!deck().includes(alt)) bad.push(`대체 — 「${alt}」 가 자리에 안 들어왔다`);
    if (deck().length !== n0) bad.push('대체 — 자리 수가 달라졌다. 바꾸는 것이지 더하는 것이 아니다');
    pkSwap(base, base);
    if (!deck().includes(base)) bad.push(`대체 — 기본으로 되돌렸는데 「${base}」 가 안 돌아왔다`);

    /* ③ 레터박스 — 카드 밑에 그린 숫자가 대체 풀 장수와 같은가 */
    const slots = [...document.querySelectorAll('#dk_body .slot')];
    const seats = PACKS.flatMap(x => x.cards);
    if (slots.length !== seats.length)
      bad.push(`레터박스 — 자리 ${slots.length}개 · 팩 카드 ${seats.length}장`);
    slots.forEach((el, i) => {
      const got = +el.querySelector('.lbox b').textContent, want = swapPool(seats[i]).length;
      if (got !== want) bad.push(`레터박스 — 「${seats[i]}」 자리에 ${got} 이라 적혔는데 대체 풀은 ${want}장`);
    });

    /* ④ 카드를 누르면 옆에 대체 풀이 펼쳐지고 나머지 화면이 페이드 아웃된다 */
    pkOpen(base);
    if (!document.querySelector('#dk_body .swaps')) bad.push('대체 풀 — 카드를 눌렀는데 옆에 안 떴다');
    if (!document.querySelector('#dk_body .fade')) bad.push('페이드 아웃 — 카드를 눌렀는데 화면이 안 덮였다');
    if (!document.querySelector('#dk_body .slot.on')) bad.push('페이드 아웃 — 누른 자리가 위로 안 올라왔다');
    const alone = seats.find(c => !swapPool(c).length);
    pkOpen(alone);
    if (!document.querySelector('#dk_body .swaps'))
      bad.push(`대체 풀 — 0장인 자리(「${alone}」)를 눌렀는데 아무것도 안 떴다`);
    pkClose();
    if (document.querySelector('#dk_body .fade')) bad.push('페이드 아웃 — 닫았는데 안 걷혔다');

    /* ④ㄴ 판은 어느 자리에서 열어도 화면 안에 통째로 들어와야 한다.
       아래쪽 팩(정착지 의사)에서 열면 밑이 잘려 안 보이던 자리다. */
    for (const seat of seats) {
      pkOpen(seat);
      const box = document.querySelector('#dk_body .swaps');
      if (!box) { pkClose(); continue }
      const r = box.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight + 1 || r.left < 0 || r.right > innerWidth + 1)
        bad.push(`대체 풀 — 「${seat}」 자리에서 연 판이 화면 밖으로 나갔다 ` +
                 `(top ${Math.round(r.top)} · bottom ${Math.round(r.bottom)} / ${innerHeight})`);
      if (r.height > innerHeight) bad.push(`대체 풀 — 「${seat}」 자리의 판이 화면보다 길다`);
      pkClose();
    }

    /* ⑤ 확정하기 전에는 판의 가방이 안 바뀐다 */
    const keep = STORY_DECK.slice();
    pkToggle(p.id);
    if (STORY_DECK.join() !== keep.join()) bad.push('편성 — 확정하기 전에 판의 가방이 바뀌었다');
    pkCancel();
    if (STORY_DECK.join() !== keep.join()) bad.push('편성 — 그만뒀는데 판의 가방이 바뀌었다');
    openPackStory(); pkToggle(p.id); pkDone();
    if (STORY_DECK.join() === keep.join()) bad.push('편성 — 확정했는데 판의 가방이 그대로다');
    openPackStory(); pkToggle(p.id); pkDone();
    if (STORY_DECK.join() !== keep.join()) bad.push('편성 — 도로 들였는데 가방이 안 돌아왔다');
    return bad;
  });

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
  for(const [f, r] of [[a, A], [b, B]]){
    const dp = [...(r.snap.deep || []), ...(r.snap.packs || [])];
    if(dp.length){ bad++; console.log(`\n=== ${f} — 깊은 경로가 어긋난 곳 ${dp.length} ===\n` + dp.map(x=>'  '+x).join('\n')) }
  }
  /* 목록 자체는 파일마다 다를 수 있으니 견주기에서는 뺀다 */
  delete A.snap.stuckTips; delete B.snap.stuckTips;
  delete A.snap.deep; delete B.snap.deep;
  delete A.snap.packs; delete B.snap.packs;

  const d = [];
  (function walk(x, y, p){
    if(typeof x === 'object' && x && typeof y === 'object' && y){
      for(const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], p ? p+'.'+k : k);
    } else if(x !== y){
      d.push(`${p}:\n  A: ${String(x).slice(0,300)}\n  B: ${String(y).slice(0,300)}`);
    }
  })(A.snap, B.snap, '');

  if(d.length){ console.log(`\n=== 화면이 다른 곳 ${d.length} ===\n` + d.slice(0,12).join('\n\n')); bad++ }
  /* 숫자를 글자로 박아 두면 탭이 늘 때마다 이 줄만 옛말을 한다 —
     실제로 「악보」를 더한 뒤 「탭 5개」로 남아 있었다. 목록에서 읽는다 */
  else console.log(`화면 같다 — 조작 8묶음 · 탭 ${Object.keys(B.snap.panes).length}개`
    + ' · 깊은 경로 5 + 카드팩 5 · 설명문 추적 · 오류 0');
  process.exit(bad ? 1 : 0);
})();
