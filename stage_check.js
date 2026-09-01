#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   stage_check.js — 무대(전투 화면)를 **재서** 본다.

     node stage_check.js [파일]        기본값 intern_sim.html

   sim_check 는 판정을, ui_check 는 글자를 견준다. 둘 다 「자리가 어디에
   앉았는가」는 못 본다 — 칸이 서로 겹치거나 카드가 줄 밖으로 나가도 글자는
   그대로라 통과한다. 눈으로 넘기다 실제로 놓친 것들이라 자를 댄다.

   보는 것
     ① 구역이 서로 안 겹치는가 (환자칸 · 의사 패널 · 판 · 차트 · 손패 줄)
     ② 손패 카드가 줄 안에 드는가
     ③ 배지가 자리 크기와 무관하게 같은 크기 · 같은 간격인가
        (병 노드는 부수 증상의 1.9배다. 눈금을 200 으로 못 박아 두면 배지도
         1.9배가 되어 테에서 127px 밖까지 밀려난다 — 실제로 그랬다)
     ④ 의도 칩의 합 = 「턴 끝 −N」 (커널이 낸 값을 화면이 다시 세지 않는다)
     ⑤ 칩 · 딱지 · 배선 메달이 전부 설명을 다는가
     ⑥ 오류 0

   헤드리스 크로미움이 필요하다 — playwright-core 와 미리 깔린 브라우저를 쓴다.
   번들의 S 는 스크립트 스코프 let 이라 window.S 로는 못 닿는다. eval 로 넣는다.
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright-core')) }
catch { console.error('playwright-core 가 없다 — npm install 을 먼저 돌린다'); process.exit(2) }

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

/* 판을 세우는 손. 자리 수 하나 · 다섯 · 스토리(병 노드 + 줄) · 외래를 다 밟는다 */
const BOARDS = {
  '단판 Lv1': () => { setMode('one'); document.getElementById('lv').value = '1';
    document.getElementById('seed').value = '7'; newGame(); eval('stageOpen()') },
  '단판 Lv5': () => { setMode('one'); document.getElementById('lv').value = '5';
    document.getElementById('seed').value = '42'; newGame(); eval('stageOpen()') },
  '스토리 3막': () => { setMode('story'); document.getElementById('boss').value = '어부';
    document.getElementById('sk_pol').value = '완치'; document.getElementById('sk_evid').value = '4';
    newStory(); eval('stageOpen()') },
  '외래': () => { setMode('sess'); sessInit();
    SESS.deck = POOL[SESS.def.pool].slice(0, SESS.def.cap); SESS.phase = 'intake';
    loadPatient(); eval('stageAskGo()') },
};

(async () => {
  const file = path.resolve(process.argv[2] || 'intern_sim.html');
  if (!fs.existsSync(file)) { console.error(`${file} 가 없다`); process.exit(2) }
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const bad = [];
  let boards = 0, turns = 0, chips = 0, wires = 0, badges = 0;

  /* ── ①②③ 자리 재기 ── */
  for (const [name, setup] of Object.entries(BOARDS)) {
    const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    await pg.goto('file://' + file);
    await pg.waitForTimeout(300);
    await pg.evaluate(`(${setup.toString()})()`);
    await pg.waitForTimeout(700);
    const o = await pg.evaluate(() => {
      const st = document.getElementById('sg_stage').getBoundingClientRect(), k = st.width / 1920;
      const R2 = e => { const r = e.getBoundingClientRect();
        return { x: (r.x - st.x) / k, y: (r.y - st.y) / k, w: r.width / k, h: r.height / k } };
      const R = s => { const e = document.querySelector(s); return e ? R2(e) : null };
      return {
        zone: R('#sg_handzone'), pat: R('#sg_pat'), doc: R('#sg_doc'),
        board: R('#sg_board'), exit: R('#sg_exit'), chart: R('#sg_chartwrap'),
        /* 배선은 L 자라 외곽 상자가 제 노드를 반드시 품는다 — 상자로 재면 늘
           겹친 것으로 나온다. 레인 높이에 정확히 앉는 메달(rect)을 자로 쓴다.
           가로 구간이 계기나 배지를 지나면 메달도 지난다 */
        meds: [...document.querySelectorAll('#sg_links .wirem rect')].map(R2),
        cards: [...document.querySelectorAll('#sg_hand .card')].map(e => {
          const r = e.getBoundingClientRect();
          return { t: (r.y - st.y) / k, b: (r.bottom - st.y) / k } }),
        gz: [...document.querySelectorAll('#sg .gz')].map(el => {
          const g = el.getBoundingClientRect();
          const cx = (g.x + g.width / 2 - st.x) / k, cy = (g.y + g.height / 2 - st.y) / k;
          const rad = g.width / 2 / k;
          return { sz: Math.round(g.width / k), box: R2(el),
            b2: [...el.querySelectorAll('.atts > g:not(.ring)')].map(R2),
            /* 링(.ring)은 뺀다 — 테를 두르는 물건이라 지름이 자리를 따라가는
               것이 맞고, 호의 외곽 상자 한가운데는 테 안쪽에 찍힌다 */
            b: [...el.querySelectorAll('.atts > g:not(.ring)')].map(bb => {
              const r = bb.getBoundingClientRect();
              return { gap: Math.round(Math.hypot((r.x + r.width / 2 - st.x) / k - cx,
                                                  (r.y + r.height / 2 - st.y) / k - cy) - rad),
                       w: Math.round(r.width / k), h: Math.round(r.height / k) } }) } }),
      };
    });
    const say = t => bad.push(`${name} — ${t}`);
    const zt = o.zone.y, zb = o.zone.y + o.zone.h;
    for (const c of o.cards) if (c.t < zt - 0.5 || c.b > zb + 0.5)
      say(`손패 카드가 줄 밖 ${Math.round(c.t)}~${Math.round(c.b)} (줄 ${Math.round(zt)}~${Math.round(zb)})`);
    const ov = (a, c) => !(a.x + a.w <= c.x || c.x + c.w <= a.x || a.y + a.h <= c.y || c.y + c.h <= a.y);
    if (ov(o.exit, o.chart)) say('나가기가 차트와 겹친다');
    if (o.board.y + o.board.h > zt + 0.5) say('판이 손패 줄을 파고든다');
    if (o.doc.h > 0 && o.doc.y + o.doc.h > zt + 0.5) say('의사 패널이 손패 줄을 파고든다');
    if (o.pat.y + o.pat.h > (o.doc.h > 0 ? o.doc.y : zt) + 0.5) say('환자칸이 아래를 파고든다');
    for (const g of o.gz) if (g.x < o.pat.x + o.pat.w) say('계기가 환자칸을 침범한다');
    for (const m of o.meds) for (const g of o.gz) {
      if (ov(m, g.box)) say('배선 레인이 계기를 지난다');
      for (const a of g.b2) if (ov(m, a)) say('배선 레인이 배지를 지난다');
    }
    /* 배지 — 자리 크기가 달라도 크기와 간격이 같아야 한다 */
    const flat = o.gz.flatMap(g => g.b.map(x => ({ sz: g.sz, ...x })));
    badges += flat.length;
    const bySize = new Set(flat.map(x => `${x.w}×${x.h}`));
    if (flat.length && Math.max(...flat.map(x => x.gap)) - Math.min(...flat.map(x => x.gap)) > 14)
      say(`배지 간격이 자리마다 다르다 (${[...new Set(flat.map(x => x.gap))].join('/')})`);
    if (o.gz.length > 1 && bySize.size > o.gz[0].b.length + 2)
      say(`배지 크기가 자리마다 다르다 (${[...bySize].join(' ')})`);
    /* 차트를 붙박이로 열었을 때 계기를 덮지 않는가. 스쳐 보는 것(hover)은
       덮어도 되지만 열어 둔 채로 카드를 내려면 오른쪽 계기가 보여야 한다.
       차트는 0.26초에 걸쳐 미끄러진다 — 곧바로 재면 아직 화면 밖이라
       무엇과도 안 겹친 것으로 나온다. 전이가 끝나길 기다려서 잰다 */
    await pg.evaluate(() => chartPin());
    await pg.waitForTimeout(420);
    const pin = await pg.evaluate(() => {
      const st = document.getElementById('sg_stage').getBoundingClientRect(), k = st.width / 1920;
      const R2 = e => { const r = e.getBoundingClientRect();
        return { x: (r.x - st.x) / k, y: (r.y - st.y) / k, w: r.width / k, h: r.height / k } };
      const ch = R2(document.getElementById('sg_chartwrap'));
      return [...document.querySelectorAll('#sg .gz')].map(R2)
        .filter(g => !(g.x + g.w <= ch.x || ch.x + ch.w <= g.x || g.y + g.h <= ch.y || ch.y + ch.h <= g.y)).length;
    });
    await pg.evaluate(() => chartPin());
    if (pin) say(`차트를 열면 계기 ${pin}개가 덮인다`);
    for (const e of errs) say('오류 ' + e);
    boards++;
    console.log(`  ${name.padEnd(10)} 자리 ${o.gz.map(g => g.sz).join('/')} · 카드 ${o.cards.length}장 · 배지 ${flat.length}개`);
    await pg.close();
  }

  /* ── ④⑤ 값이 정직한가 ── 여러 판을 여러 턴 돌리면서 본다 */
  {
    const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    await pg.goto('file://' + file);
    await pg.waitForTimeout(300);
    const r = await pg.evaluate(() => {
      const res = { bad: [], turns: 0, chips: 0, chipNoTip: 0, wires: 0, wireNoTip: 0, evoMix: 0 };
      const run = setup => {
        setup();
        for (let t = 0; t < 9; t++) {
          if (!eval('S') || !eval('alive(S).length')) break;
          eval('stageSync()');
          /* 이름을 TIPMAP 으로 둔다 — 지역 상수를 TIPS 로 두면 그 초기화 식
             안에서 자기 자신을 부르게 된다 (TDZ). 이 저장소에서 세 번째로 밟은 함정이다 */
          const TIPMAP = eval('TIPS');
          const f = eval('forecast()');
          let sum = 0;
          for (const el of document.querySelectorAll('#sg .gz .icp.dmg b'))
            sum += Math.abs(parseInt(el.textContent.replace(/[^0-9]/g, ''), 10)) || 0;
          if (sum !== f.dmg) res.bad.push(`턴 ${eval('S.turn')} 칩 합 ${sum} ≠ 예고 ${f.dmg}`);
          for (const c of document.querySelectorAll('#sg .gz .icp,#sg .gz .imk')) {
            res.chips++; if (!c.getAttribute('data-tip')) res.chipNoTip++ }
          /* 떨림(warn)과 증상 문안의 상태가 갈리지 않는가. 둘 다 evoSoon 을 보므로
             갈릴 수 없어야 하지만, 한쪽만 조건을 손보는 것이 이 저장소가 여러 번
             겪은 일이라 자를 댄다 — 판이 떠는데 설명은 아직 「진화하면」이라 하는 꼴 */
          for (const el of document.querySelectorAll('#sg .gz')) {
            const g = el.querySelector('.dial .nmg'); if (!g) continue;
            const t = TIPMAP[g.getAttribute('data-tip')] || '';
            const soon = t.includes('다음 턴에 진화한다');
            if (soon !== el.classList.contains('warn')) res.evoMix++;
          }
          for (const g of document.querySelectorAll('#sg_links .wirem')) {
            res.wires++; if (!g.getAttribute('data-tip')) res.wireNoTip++ }
          res.turns++;
          eval('aiTurn(S); endTurnHand(S); turnResolve(S); S.turn++');
        }
      };
      for (const lv of ['3', '4', '5']) for (const sd of ['42', '7'])
        run(() => { setMode('one'); document.getElementById('lv').value = lv;
          document.getElementById('seed').value = sd; newGame(); eval('stageOpen()') });
      for (const pol of ['완치', '편하게'])
        run(() => { setMode('story'); document.getElementById('boss').value = '송이';
          document.getElementById('sk_pol').value = pol;
          document.getElementById('sk_evid').value = '4'; newStory(); eval('stageOpen()') });
      return res;
    });
    turns = r.turns; chips = r.chips; wires = r.wires;
    for (const t of r.bad) bad.push('정직성 — ' + t);
    if (r.chipNoTip) bad.push(`정직성 — 설명 없는 칩/딱지 ${r.chipNoTip}개`);
    if (r.wireNoTip) bad.push(`정직성 — 설명 없는 배선 메달 ${r.wireNoTip}개`);
    if (r.evoMix) bad.push(`정직성 — 떨림과 증상 문안의 진화 상태가 어긋난 자리 ${r.evoMix}개`);
    for (const e of errs) bad.push('정직성 — 오류 ' + e);
    await pg.close();
  }

  /* ── 증상 문안 세 상태 ── 실제 진행에만 기대면 못 본다.
     AI 는 진단을 잘 안 하고, 진화 임박(evoSoon)은 진단한 자리에만 뜬다 —
     71턴을 돌려도 warn 이 한 번도 안 서서 앞의 검사가 헛물을 켰다.
     그래서 자리를 손수 세 상태로 몰아 놓고 잰다. */
  {
    const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    await pg.goto('file://' + file);
    await pg.waitForTimeout(300);
    const r = await pg.evaluate(() => {
      setMode('one'); document.getElementById('lv').value = '5';
      document.getElementById('seed').value = '42'; newGame(); eval('stageOpen()');
      const TIPMAP = eval('TIPS'), out = [];
      const read = n => { eval('stageSync()'); const el = eval('stageEl')(n);
        const g = el.querySelector('.dial .nmg');
        return { t: g ? (TIPMAP[g.getAttribute('data-tip')] || '') : '',
                 warn: el.classList.contains('warn') } };
      const n = eval("alive(S)").find(x => x.sym === '발열');
      n.revealed = true;
      n.evolved = false; n.evoLeft = 4; out.push(['진화 전', read(n)]);
      n.evoLeft = 1;                     out.push(['임박',   read(n)]);
      n.evolved = true;                  out.push(['진화 후', read(n)]);
      n.evolved = false; n.evoLeft = 1; n.revealed = false;
      out.push(['미진단 · 임박', read(n)]);
      /* 문턱이 어긋나는지는 한 점만 찍어서는 안 보인다 — 떨림 조건만 <=2 로
         바꿔도 1과 4 에서는 둘이 같은 답을 낸다. 값을 훑어서 어디서든 같은지 본다 */
      n.revealed = true; const sweep = [];
      for (let k = 1; k <= 5; k++) { n.evoLeft = k; const s = read(n);
        sweep.push({ k, warn: s.warn, soon: s.t.includes('다음 턴에 진화한다') }) }
      return { out, sweep };
    });
    const has = (s, w) => s.includes(w);
    const [pre, soon, post, hidden] = r.out.map(x => x[1]);
    if (has(pre.t, '다음 턴에 진화한다') || has(pre.t, '진화함')) bad.push('증상 문안 — 진화 전인데 뒷이야기가 뜬다');
    if (!has(pre.t, '진화하면')) bad.push('증상 문안 — 진화 전에 예고가 없다');
    if (pre.warn) bad.push('증상 문안 — 진화 전인데 떤다');
    if (!has(soon.t, '다음 턴에 진화한다')) bad.push('증상 문안 — 임박인데 진화 뒤 이야기가 없다');
    if (!soon.warn) bad.push('증상 문안 — 임박인데 안 떤다');
    if (!has(post.t, '진화함')) bad.push('증상 문안 — 진화 후인데 진화함이 없다');
    if (has(post.t, '진화하면') || has(post.t, '다음 턴에')) bad.push('증상 문안 — 진화 후인데 앞이야기가 남았다');
    if (post.warn) bad.push('증상 문안 — 진화한 뒤에도 떤다');
    if (has(hidden.t, '다음 턴에 진화한다') || hidden.warn)
      bad.push('증상 문안 — 진단 안 한 자리가 진화 임박을 흘린다');
    for (const s of r.sweep) if (s.warn !== s.soon)
      bad.push(`증상 문안 — 남은 턴 ${s.k} 에서 떨림(${s.warn})과 문안(${s.soon})이 어긋난다`);
    for (const e of errs) bad.push('증상 문안 — 오류 ' + e);
    await pg.close();
  }

  await browser.close();
  if (bad.length) {
    console.log('\n걸린 것:');
    for (const t of bad) console.log('  ✗ ' + t);
    process.exit(1);
  }
  console.log(`\n무대는 제자리다 — 판 ${boards}개 · 배지 ${badges}개 · `
    + `${turns}턴에서 칩 합 = 「턴 끝 −N」 · 칩과 딱지 ${chips}개 · 배선 메달 ${wires}개가 전부 설명을 달고 `
    + `증상 문안이 진화 전 · 임박 · 후로 갈리며 떨림과 어긋나지 않는다 · 오류 0`);
})();
