#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   lab/measure.js — 판본 하나를 60 시드로 재고 장부를 뽑는다.

     node lab/measure.js A AB                → 판본들을 재서 lab/data/<판본>.json
     node lab/measure.js --seeds 60 A        → 시드 수를 정해서

   ── 왜 이 값들인가 (판정 기준) ────────────────────────────────
   세 보스 전부 noDeath 다. 그래서 아래 셋은 정의상 아무것도 재지 못한다:
     · 사망률        — 체력이 1에서 멈추므로 늘 0
     · 「편하게」 승률 — 죽을 수가 없으므로 구조적으로 1.00
     · 일반 총피해    — 바닥에 닿은 뒤의 피해가 버려져 최대 체력 −1 에서 굳는다
   완치 승률은 60시드로는 표본 흔들림(±0.15)이 신호보다 커서 쓰지 않는다.

   그래서 '그림자 장부' 를 쓴다 — 같은 판을 그대로 돌리되, hurtPatient 이
   바닥에 걸려 버리는 몫까지 평행 장부에 그대로 적는다. 판단은 한 글자도
   달라지지 않으므로(같은 씨앗 · 같은 수) 발산이 없다.
   비교를 위해 사망 면제를 실제로 걷고 다시 돌린 판도 함께 잰다.
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), vm = require('vm'), path = require('path');

const BOSSES = ['아이', '어부', '송이'], POLS = ['완치', '연명', '편하게'];
const seedList = n => { const a = []; for (let i = 0; i < n; i++) a.push(1000 + i * 37); return a };

function load(file) {
  const t = fs.readFileSync(file, 'utf8');
  const cut = (a, b) => {
    const i = t.indexOf(a), j = t.indexOf(b);
    if (i < 0 || j < 0) throw new Error(`${file}: 자름 앵커가 없다`);
    return t.slice(t.indexOf('\n', i) + 1, j);
  };
  const ctx = vm.createContext({ console, Math, JSON, Object, Array, Set, Map, String, Number, isFinite });
  vm.runInContext(cut('//@ 자름.커널시작', '//@ 자름.커널끝') + '\n' +
                  cut('//@ 자름.배선시작', '//@ 자름.배선끝'), ctx, { filename: file });
  return e => vm.runInContext(e, ctx, { filename: file + ' <expr>' });
}

/* ── 한 판을 재는 자 ──────────────────────────────────────────
   runStory 를 베끼지 않는다 — act1 · act3 를 그대로 부르고 hurtPatient 만 감싼다.
   그래야 이 자가 규칙과 갈라지지 않는다. */
const PROBE = `((boss, policy, seed, noDeath) => {
  const rng = K.mulberry32(seed);
  const board = makeDisease(boss, rng);
  if(!noDeath) board.noDeath = false;              // 그림자 판 — 사망 면제를 실제로 걷는다
  const S = K.newState(board, {}); S.board = board; S.rng = rng;
  const deck = typeof STORY_DECK !== 'undefined' ? STORY_DECK : C.DECK_D2;
  C.setupDeck(S, deck, K.mulberry32(seed + 1)); S.rng = rng;

  /* ── 장부 ── */
  const LED = { turnPend: null, evoSym: null, book: {}, total: 0, maxHit: 0, shadow: board.hpMax,
                shadowMin: board.hpMax, spot: {} };
  const put = (k, amt) => { LED.book[k] = (LED.book[k] || 0) + amt };

  /* 턴당 피해는 자리마다 재고 한 번에 합쳐 때린다 — 자리별로 받아 두었다가 비율로 나눈다 */
  if (typeof turnDmg === 'function') {
    const origTD = turnDmg;
    turnDmg = n => { const v = origTD(n);
      if (v > 0) { (LED.turnPend = LED.turnPend || {})[n.sym] = (LED.turnPend[n.sym] || 0) + v }
      return v };
  }
  /* 진화 즉발은 그 피해를 내는 자(evolveNow)를 감싸서 붙잡는다.
     ★ 전에는 R.EVO_HIT 를 Proxy 로 갈아 끼워 '표를 읽는 순간'을 잡았는데,
       그 표는 빔 탐색(beam.js)과 휴리스틱도 상태를 평가할 때마다 읽는다 —
       한 판에 수천 번인 자리에 함정을 놓은 셈이라 쓸기 한 벌이 5~10% 느렸다.
       진화 피해가 나는 곳은 evolveNow 한 곳뿐이므로 그것만 감싼다. */
  const origEvolve = evolveNow;
  evolveNow = (s, n) => { LED.evoSym = n.sym; try { return origEvolve(s, n) } finally { LED.evoSym = null } };

  const origHurt = hurtPatient;
  hurtPatient = (s, amt) => {
    if (amt > 0) {
      LED.total += amt; LED.maxHit = Math.max(LED.maxHit, amt);
      LED.shadow -= amt; LED.shadowMin = Math.min(LED.shadowMin, LED.shadow);
      if (LED.turnPend) {                                    // 턴당 — 자리별 몫으로 쪼갠다
        const p = LED.turnPend, sum = Object.keys(p).reduce((a, k) => a + p[k], 0);
        for (const k in p) put('턴당·' + k, amt * p[k] / sum);
        LED.turnPend = null;
      } else if (LED.evoSym) { put('진화·' + LED.evoSym, amt); LED.evoSym = null }
      else put('기타', amt);
    }
    return origHurt(s, amt);
  };
  const origTR = K.turnResolve;
  const wrapTR = s => { LED.evoSym = null; LED.turnPend = null; return origTR(s) };
  K.turnResolve = wrapTR; turnResolve = wrapTR;

  let res;
  try {
    const dis = S.nodes[0];
    const a1 = act1(S, deck, {});
    if (a1.out === '사망') res = { out: '사망', act: 1, turns: a1.turns, stage: dis.stage };
    else res = Object.assign({ act: 3 }, act3(S, policy, a1.correct, {}));
    /* 자리가 갖고 태어난 진화 카운터 — 판이 끝난 뒤 증상별로 훑는다 */
    for (const n of S.nodes) if (n.role !== 'disease') {
      LED.spot[n.sym] = LED.spot[n.sym] || {};
      LED.spot[n.sym][n.evo] = (LED.spot[n.sym][n.evo] || 0) + 1;
    }
    res.hp = S.hp; res.hpMax = S.hpMax; res.evo = S.evoLog || 0; res.mind = S.mind;
  } finally {
    /* turnDmg 는 measure() 가 판마다 원본으로 되돌린다 (globalThis.__td) */
    hurtPatient = origHurt; K.turnResolve = origTR; turnResolve = origTR; evolveNow = origEvolve;
  }
  const book = {}; for (const k in LED.book) book[k] = Math.round(LED.book[k] * 100) / 100;
  return Object.assign(res, { total: LED.total, maxHit: LED.maxHit,
                              shadowMin: LED.shadowMin, book, spot: LED.spot });
})`;

function measure(file, seeds) {
  const ev = load(file);
  /* turnDmg 원본을 붙들어 둔다 — PROBE 가 판마다 감싸므로 겹치지 않게 한다 */
  ev(`if (typeof turnDmg === 'function' && !globalThis.__td) globalThis.__td = turnDmg`);
  const probe = ev(PROBE);
  const rows = [];
  for (const boss of BOSSES) for (const pol of POLS) for (const seed of seeds) {
    ev(`if (globalThis.__td) turnDmg = globalThis.__td`);         // 감싼 것을 벗기고 새 판을 잰다
    const real = probe(boss, pol, seed, true);
    ev(`if (globalThis.__td) turnDmg = globalThis.__td`);
    const sh = probe(boss, pol, seed, false);
    rows.push({ boss, pol, seed, real, shadow: sh });
  }
  return rows;
}

if (require.main === module) {
  const arg = process.argv.slice(2);
  let n = 60;
  const i = arg.indexOf('--seeds');
  if (i >= 0) { n = +arg[i + 1]; arg.splice(i, 2) }
  const seeds = seedList(n);
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  for (const v of arg) {
    const file = path.join(__dirname, 'out', `${v}.html`);
    const t0 = Date.now();
    const rows = measure(file, seeds);
    fs.writeFileSync(path.join(__dirname, 'data', `${v}.json`), JSON.stringify({ variant: v, seeds: n, rows }));
    console.log(`  ${v.padEnd(14)} ${rows.length}판 · ${((Date.now() - t0) / 1000).toFixed(1)}초`);
  }
}
module.exports = { measure, seedList, BOSSES, POLS };
