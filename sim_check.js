#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   sim_check.js — 화면 없이 도는 구간을 떼어 node 에서 돌린다.

     node sim_check.js                  → intern_sim.html 을 돌려 결과를 찍는다
     node sim_check.js a.html b.html    → 두 파일의 결과를 견주어 다른 곳만 찍는다

   떼어 오는 구간은 자름 앵커가 표시한다 (build.js 가 찍는다):
     자름.커널시작 ~ 자름.커널끝   = 수치 · 데이터 · 로직 · 자동 진행
     자름.배선시작 ~ 자름.배선끝   = K · L · C · P · D · H
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), vm = require('vm');

function carve(file) {
  const t = fs.readFileSync(file, 'utf8');
  const cut = (a, b) => {
    const i = t.indexOf(a), j = t.indexOf(b);
    if (i < 0) throw new Error(`${file}: 앵커 '${a}' 가 없다`);
    if (j < 0) throw new Error(`${file}: 앵커 '${b}' 가 없다`);
    if (j < i) throw new Error(`${file}: 앵커 '${b}' 가 '${a}' 보다 앞에 있다`);
    /* 앵커 줄 뒤에 설명이 붙어 있다 — 줄 단위로 자른다 */
    const from = t.indexOf('\n', i) + 1;
    return t.slice(from, j);
  };
  return cut('//@ 자름.커널시작', '//@ 자름.커널끝') + '\n' +
         cut('//@ 자름.배선시작', '//@ 자름.배선끝');
}

/* 떼어 온 구간을 돌리고, 그 안의 이름을 꺼내 쓴다 */
function load(file) {
  const ctx = vm.createContext({ console, Math, JSON, Object, Array, Set, Map, String, Number, isFinite });
  vm.runInContext(carve(file), ctx, { filename: file });
  return expr => vm.runInContext(expr, ctx, { filename: file + ' <expr>' });
}

/* ── 시나리오 ── 규칙을 고쳤을 때 무엇이 움직였는지 보이게 하는 것들 ── */
const SCENARIOS = `(() => {
  const out = {};
  const N = x => typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x;

  /* ① 판 생성 — 레벨별로 같은 씨앗이 같은 판을 뱉는가 */
  out.boards = [];
  for (let lv = 1; lv <= 5; lv++) for (const seed of [1, 7, 42]) {
    const b = L.makeBoard(lv, K.mulberry32(seed * 1000 + lv));
    out.boards.push({ lv, seed, S: N(L.S_of(b)), hp: b.hpMax,
      nodes: b.nodes.map(n => n.sym + ':' + n.init + '/' + n.evo + (n.shielded ? 'S' : '')),
      tags: b.tags, lines: (b.lines || []).map(l => l.join('>')) });
  }

  /* ② 레벨표 중앙값 검산 */
  out.median = L.medianBoards();

  /* ③ 단판 — 새 AI · 옛 AI 둘 다.
     배치 탭이 실제로 타는 경로와 같게 부른다: runDeck 이 opt.ai 로 갈래를 고른다. */
  out.one = [];
  for (const ai of ['D', 'H']) for (let lv = 1; lv <= 5; lv++) for (const seed of [3, 11]) {
    const b = L.makeBoard(lv, K.mulberry32(seed * 100 + lv));
    const r = runDeck(b, C.DECK_D2, seed * 7 + lv, { ai });
    out.one.push({ ai, lv, seed, turns: r.turns, hp: r.S.hp, out: r.out });
  }

  /* ④ 세션 — 1~3일차 */
  out.sess = [];
  for (const key of Object.keys(P.SESSIONS)) {
    const d = P.SESSIONS[key];
    const r = runSession(d.list, C.DECK_D2, 20, 5150);
    out.sess.push({ key, used: r.used, res: r.res, rep: N(r.rep) });
  }

  /* ⑤ 스토리 — 보스 × 방침 */
  out.story = [];
  for (const boss of Object.keys(BOSS)) for (const pol of ['완치', '연명', '편하게']) {
    const r = runStory(boss, C.DECK_D2, 777, pol);
    out.story.push({ boss, pol, turn: r.turn, hp: r.hp, win: r.win, out: r.out });
  }

  /* ⑥ 커널 손잡이 — 값이 그대로인가 */
  out.knobs = { R: R, SR: SR, SYMPARAM: SYMPARAM, LVTAB: LVTAB, BAND: BAND,
                HP_TAG: L.HP_TAG, ATK_W: L.ATK_W, ATK_TARGET: L.ATK_TARGET, AIW: AIW_DEF,
                cards: Object.keys(CARDS).length, script: Object.keys(P.SCRIPT).length };
  return out;
})()`;

function run(file) {
  const ev = load(file);
  try { return { ok: true, v: ev(SCENARIOS) } }
  catch (e) { return { ok: false, err: e.stack || String(e) } }
}

/* ── 두 결과를 견준다 ── */
function diff(a, b, p = '', acc = []) {
  if (a === b) return acc;
  /* 두 갈래는 서로 다른 vm 문맥이라 함수가 같은 객체일 수 없다 — 원문으로 견준다 */
  if (typeof a === 'function' && typeof b === 'function') {
    if (String(a) !== String(b)) acc.push(`${p}: 함수 본문이 다르다`);
    return acc;
  }
  const ta = a === null ? 'null' : Array.isArray(a) ? 'arr' : typeof a;
  const tb = b === null ? 'null' : Array.isArray(b) ? 'arr' : typeof b;
  if (ta !== tb || (ta !== 'object' && ta !== 'arr')) {
    acc.push(`${p}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`); return acc;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], p ? p + '.' + k : k, acc);
  return acc;
}

const [f1, f2] = process.argv.slice(2);
if (!f1) {
  const r = run('intern_sim.html');
  if (!r.ok) { console.error(r.err); process.exit(1) }
  console.log(JSON.stringify(r.v, null, 1));
} else if (!f2) {
  const r = run(f1);
  if (!r.ok) { console.error(r.err); process.exit(1) }
  console.log(JSON.stringify(r.v, null, 1));
} else {
  const A = run(f1), B = run(f2);
  if (!A.ok) { console.error(`${f1} 실패:\n` + A.err); process.exit(1) }
  if (!B.ok) { console.error(`${f2} 실패:\n` + B.err); process.exit(1) }
  const d = diff(A.v, B.v);
  if (!d.length) { console.log(`같다 — ${f1} ≡ ${f2}`); }
  else { console.log(`다른 곳 ${d.length}군데\n` + d.slice(0, 60).join('\n')); process.exit(1) }
}
