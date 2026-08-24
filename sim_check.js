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

  /* ② 레벨표 중앙값 검산 — 값과, 그 값이 어느 레벨로 되돌아오는지 */
  out.median = L.medianBoards();
  out.medianLv = {};
  for (const lv of [1,2,3,4,5]) out.medianLv[lv] = L.lv_of(out.median[lv]);

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

/* ── 불변 조건 ──────────────────────────────────────────────────
   기준본과 견주는 것과 별개로, 그 파일 하나만 놓고도 맞아야 하는 것들.
   견주기는 '달라졌다' 만 잡는다. 처음부터 어긋나 있거나, 양쪽이 똑같이
   어긋나 있으면 못 잡는다. 그것을 여기서 잡는다. */
const INVARIANTS = `(() => {
  const bad = [];

  /* ① 레벨표가 스스로와 아귀가 맞는가.
     레벨 N 의 '평균적인 판' 을 지어 S 산식에 넣으면 다시 레벨 N 이어야 한다.
     LVTAB 이나 SW(산식 계수 · 레벨 경계)를 만지면 여기가 먼저 깨진다. */
  const med = L.medianBoards();
  for (const lv of [1, 2, 3, 4, 5]) {
    const back = L.lv_of(med[lv]);
    if (back !== lv) bad.push('레벨표 ' + lv + ' 의 중앙값 S=' + med[lv].toFixed(2) + ' 가 lv_of 로는 ' + back);
  }

  /* ② 카드 본문의 {열쇠} 가 그 카드의 v 에 실제로 있는가.
     서식을 오타 내면 화면에 {sup} 이 글자 그대로 남는다.
     ★ 이 덩어리는 통째로 템플릿 리터럴이다. 정규식의 백슬래시를 둘로 적지 않으면
       템플릿이 \w 를 w 로 삼켜 아무것도 안 걸린다. 줄이지 말 것.
     본문을 서식으로 쓰기 전의 파일에는 cardNums 가 없다 — 그때는 건너뛴다. */
  if (typeof C.cardNums === 'function') {
    for (const id of Object.keys(C.CARDS)) {
      const nums = C.cardNums(null, id);
      for (const m of String(C.CARDS[id].text || '').matchAll(/\\{(\\w+)\\}/g))
        if (!(m[1] in nums) && m[1] !== 'cost') bad.push('카드 「' + id + '」 본문의 {' + m[1] + '} 가 v 에 없다');
    }
  }

  /* ③ 덱과 가방 풀에 적힌 이름이 전부 실재하는 카드인가 */
  const pools = {DECK_D1: C.DECK_D1, DECK_D2: C.DECK_D2};
  for (const k in pools) for (const id of pools[k])
    if (!C.CARDS[id]) bad.push(k + ' 에 없는 카드 「' + id + '」');

  /* ④ 대본 환자가 부르는 증상이 증상표에 있는가 */
  for (const id in P.SCRIPT) for (const s of (P.SCRIPT[id].syms || []))
    if (!K.SYM[s]) bad.push('대본 「' + id + '」 이 모르는 증상 「' + s + '」 를 부른다');

  return bad;
})()`;

function run(file) {
  const ev = load(file);
  /* 불변 조건을 먼저 본다. 데이터가 어긋나 있으면 시나리오는 엉뚱한 곳에서
     스택 트레이스로 터진다 — 그 전에 무엇이 어긋났는지 이름으로 말해 준다. */
  let bad;
  try { bad = ev(INVARIANTS) }
  catch (e) { return { ok: false, err: '불변 조건을 재는 중 터졌다:\n' + (e.stack || String(e)) } }
  try { return { ok: true, v: ev(SCENARIOS), bad } }
  catch (e) { return { ok: false, bad, err: e.stack || String(e) } }
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
const report = (file, r) => {
  if (!r.bad.length) return 0;
  console.log(`${file} — 불변 조건이 깨진 곳 ${r.bad.length}\n` + r.bad.map(x => '  ' + x).join('\n'));
  return 1;
};

if (!f1 || !f2) {
  const file = f1 || 'intern_sim.html';
  const r = run(file);
  if (r.bad) report(file, r);
  if (!r.ok) { console.error(r.err); process.exit(1) }
  if (r.bad.length) process.exit(1);
  console.log(JSON.stringify(r.v, null, 1));
} else {
  const A = run(f1), B = run(f2);
  for (const [f, r] of [[f1, A], [f2, B]]) if (r.bad) report(f, r);
  if (!A.ok) { console.error(`${f1} 실패:\n` + A.err); process.exit(1) }
  if (!B.ok) { console.error(`${f2} 실패:\n` + B.err); process.exit(1) }
  const badly = A.bad.length + B.bad.length;
  const d = diff(A.v, B.v);
  /* 손잡이가 늘거나 준 것과, 판이 실제로 다르게 돈 것을 갈라 보인다.
     손잡이를 더하는 작업(변수화)에서는 앞의 것만 나와야 정상이다. */
  const knob = d.filter(x => x.startsWith('knobs.'));
  const sim  = d.filter(x => !x.startsWith('knobs.'));
  if (knob.length) console.log(`손잡이가 달라진 곳 ${knob.length}\n` + knob.map(x => '  ' + x).join('\n'));
  if (sim.length)  console.log(`\n판이 다르게 돈 곳 ${sim.length}\n` + sim.slice(0, 60).map(x => '  ' + x).join('\n'));
  if (!sim.length) console.log(`\n판은 같다 — 생성 ${B.v.boards.length} · 단판 ${B.v.one.length} · 세션 ${B.v.sess.length} · 스토리 ${B.v.story.length}`);
  process.exit(sim.length || badly ? 1 : 0)
}
