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
                BEAT_LIST: typeof BEAT_LIST !== 'undefined' ? BEAT_LIST : null,
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

  /* ③ㄴ 카드팩과 대체 풀 — 스토리 가방이 이 둘에서 나온다.
     팩에 없는 카드 · 두 팩에 걸친 카드 · 어느 팩에도 없는 자리를 잡는다.
     팩이 없는 옛 파일에서는 건너뛴다. */
  if (C.PACKS) {
    const inPack = {};
    for (const p of C.PACKS) for (const id of p.cards) {
      if (!C.CARDS[id]) bad.push('카드팩 「' + p.name + '」 에 없는 카드 「' + id + '」');
      if (inPack[id]) bad.push('카드 「' + id + '」 가 카드팩 둘에 있다 — ' + inPack[id] + ' · ' + p.name);
      inPack[id] = p.name;
    }
    if (!C.PACKS.some(p => p.fixed)) bad.push('늘 드는 카드팩(fixed)이 없다 — 가방이 빌 수 있다');
    const inSwap = {};
    for (const pool of C.SWAP) {
      for (const id of pool) {
        if (!C.CARDS[id]) bad.push('대체 풀에 없는 카드 「' + id + '」');
        if (inSwap[id]) bad.push('카드 「' + id + '」 가 대체 풀 둘에 있다 — 어느 자리 것인지 갈린다');
        inSwap[id] = 1;
      }
      if (pool.length < 2) bad.push('대체 풀 「' + pool[0] + '」 에 대신할 카드가 없다');
      if (!inPack[pool[0]]) bad.push('대체 풀의 첫 장 「' + pool[0] + '」 이 어느 카드팩에도 없다 — 놓일 자리가 없다');
      /* 대체 카드는 자리를 '바꾸는' 것이다. 팩에도 들어 있으면 한 판에 두 장이 된다 */
      for (const id of pool.slice(1))
        if (inPack[id]) bad.push('대체 카드 「' + id + '」 가 카드팩 「' + inPack[id] + '」 에도 있다');
    }
    /* 어느 편성으로 짜도 1종 1장이고 상한을 넘지 않는가.
       묶음에서는 하나만 드므로 가장 큰 편성은 '묶음마다 하나 + 묶음 아닌 팩 전부' 다.
       자리를 전부 대체 카드로 바꾼 편성도 같이 본다. */
    const groups = {};
    for (const p of C.PACKS) if (p.group) (groups[p.group] = groups[p.group] || []).push(p.id);
    const swap = {}; for (const pool of C.SWAP) swap[pool[0]] = pool[pool.length - 1];
    let combos = [{}];
    for (const g in groups) combos = combos.flatMap(o => groups[g].map(id => Object.assign({}, o, {[id]: 1})));
    for (const p of C.PACKS) if (!p.fixed && !p.group) combos = combos.map(o => Object.assign({}, o, {[p.id]: 1}));
    for (const on of combos) for (const s of [{}, swap]) {
      const deck = C.packDeck(on, s), cnt = {};
      for (const id of deck) { if (cnt[id]) bad.push('스토리 가방에 「' + id + '」 가 두 장이다'); cnt[id] = 1 }
      if (deck.length > C.STORY_CAP)
        bad.push('스토리 가방이 상한을 넘는다 — ' + deck.length + '/' + C.STORY_CAP +
                 ' (' + Object.keys(on).join(' · ') + ')');
    }

    /* 묶음 팩을 차례로 골라도 둘이 되지 않는가 — packPick 이 규칙을 지키는지 본다 */
    for (const g in groups) {
      let on = {};
      for (const id of groups[g]) on = C.packPick(on, id);
      const got = groups[g].filter(id => on[id]);
      if (got.length !== 1) bad.push('묶음 「' + g + '」 에서 팩이 ' + got.length + '개 들렸다 — 하나여야 한다');
      /* 고른 팩을 다시 눌러도 빠지지 않는다 — 묶음에서는 하나를 반드시 든다 */
      if (!C.packPick(on, got[0])[got[0]]) bad.push('묶음 「' + g + '」 의 고른 팩이 다시 누르니 빠졌다');
    }
  }

  /* ③ㄷ 병 노드의 비트가 헛돌지 않는가.
     살아 있는 자리가 하나라도 있으면 「같은 박자」(설계상 쉼) 말고는 어떤 비트든
     판을 바꿔야 한다. 「고유가 헛돌면 성장으로 대신한다」는 규약이 여기서 걸린다 —
     고유가 실패하고도 문자열을 돌려주면 그 턴은 병이 통째로 노는 턴이 된다.
     세 가지 판에 세워 본다: 자리 하나 · 자리가 꽉 참 · 자리 하나에 정신이 바닥.
     쉬는 비트는 BEAT_REST 가 정한다 — 여기에 목록을 또 적지 않는다.
     그 표가 없는 옛 파일은 이 조건이 서기 전의 것이다 — 그때는 건너뛴다. */
  if (typeof BEAT_REST !== 'undefined') {
    const snap = S => JSON.stringify({mind: S.mind, enh: (S.enh || []).length,
      clock: S.nodes[0].stageClock, stage: S.nodes[0].stage,
      nodes: S.nodes.map(x => [x.sym, x.val, x.dead ? 1 : 0, x.shielded ? 1 : 0, x.evoLeft, x.dormT])});
    /* 병기 st 의 판을 세우고 자리를 fill 개만 살려 둔다 */
    const stand = (boss, stage, fill, mind) => {
      const rng = K.mulberry32(99);
      const board = makeDisease(boss, rng);
      const S = K.newState(board, {}); S.board = board; S.rng = rng; S.act = 3;
      S.nodes[0].stage = stage;
      for (const n of S.nodes) if (n.role !== 'disease') { n.dead = true; n.val = 0 }
      for (const sym of fill) { const n = mkSpot(sym, 50, 0); n.val = 20; S.nodes.push(n) }
      if (mind) S.mind = mind;
      return S;
    };
    for (const boss in BOSS) {
      const b = BOSS[boss];
      for (const st in b.beats) {
        const stage = +st;
        /* 자리가 꽉 찬 판 — 명부가 있으면 명부대로, 없으면 자리 상한만큼 */
        const full = b.roster ? b.roster[stage].map(r => r[0])
                              : new Array(SR.SPAWN_LV[SLV(boss, 'spots', stage)]).fill('발열');
        b.beats[st].forEach((beat, i) => {
          if (BEAT_REST[beat]) return;
          for (const [what, fill, mind] of [['자리 하나', ['발열'], null],
                                            ['자리가 꽉 참', full, null],
                                            ['자리 하나 · 공황', ['발열'], '공황']]) {
            const S = stand(boss, stage, fill, mind);
            S.nodes[0].beat = i;
            const before = snap(S);
            const line = diseaseAct(S, S.nodes[0], null);
            if (snap(S) === before)
              bad.push('비트가 헛돈다 — ' + boss + ' 병기' + stage + ' ' + (i + 1) + '번째 「' + beat +
                       '」 · ' + what + ' → 「' + line + '」');
          }
        });
      }
    }
    /* ③ㄹ 「악보」 탭이 고르게 해 주는 박자가 전부 실제로 판을 움직이는가.
       ③ㄷ 는 보스가 지금 쓰는 비트만 본다. 악보를 손으로 짜면 BEAT_LIST 전부를
       고를 수 있으므로, 목록에만 있고 아무 일도 안 하는 이름이 섞이면 그 턴이
       통째로 빈다 — 손으로 짠 판에서만 나는 빈 턴이라 ③ㄷ 가 못 잡는다.
       board.score 에 한 박자짜리 악보를 깔아 재므로 그 경로(scoreOf)도 함께 걸린다.
       BEAT_LIST 가 서기 전의 옛 파일에서는 건너뛴다. */
    if (typeof BEAT_LIST !== 'undefined') {
      for (const boss in BOSS) {
        const b = BOSS[boss], stage = b.stage0;
        const full = b.roster ? b.roster[stage].map(r => r[0])
                              : new Array(SR.SPAWN_LV[SLV(boss, 'spots', stage)]).fill('발열');
        for (const beat of BEAT_LIST) {
          if (BEAT_REST[beat]) continue;
          for (const [what, fill] of [['자리 하나', ['발열']], ['자리가 꽉 참', full]]) {
            const S = stand(boss, stage, fill, null);
            S.board.score = { [stage]: [beat] };
            S.nodes[0].beat = 0;
            if (nextBeat(S, S.nodes[0]) !== beat)
              bad.push('판에 실은 악보를 안 본다 — ' + boss + ' 병기' + stage + ' 「' + beat + '」');
            const before = snap(S);
            const line = diseaseAct(S, S.nodes[0], null);
            if (snap(S) === before)
              bad.push('악보의 박자가 헛돈다 — ' + boss + ' 병기' + stage + ' 「' + beat +
                       '」 · ' + what + ' → 「' + line + '」');
            /* 목록에는 있는데 diseaseAct 가 이름으로 안 받는 박자.
               판은 움직이므로(성장으로 받는다) 위의 헛돔 검사로는 안 걸린다 */
            if (typeof BEAT_UNKNOWN !== 'undefined' && String(line).startsWith(BEAT_UNKNOWN))
              bad.push('악보 목록에 있는데 병이 다룰 줄 모른다 — ' + boss + ' 「' + beat + '」');
          }
        }
      }

      /* ③ㅁ 보스가 지금 쓰는 비트가 전부 그 목록 안에 있는가.
         하나라도 빠지면 「악보」 탭이 그 병의 악보를 그대로 다시 짤 수 없다.
         「병기 가속」·「가속」은 「진행」의 다른 이름이라 목록에 따로 두지 않는다. */
      const ALIAS = ['병기 가속', '가속'];
      for (const boss in BOSS) for (const st in BOSS[boss].beats)
        for (const beat of BOSS[boss].beats[st])
          if (!BEAT_LIST.includes(beat) && !ALIAS.includes(beat))
            bad.push('악보 목록에 없는 박자를 보스가 쓴다 — ' + boss + ' 병기' + st + ' 「' + beat + '」');

      /* ③ㅂ 손으로 짠 악보가 커널에 들어올 때 모르는 이름이 걸러지는가 */
      const dirty = scoreClean({ 3: ['성장', '없는박자'], 4: [], 5: ['없는것만'] });
      if (!dirty || JSON.stringify(dirty) !== JSON.stringify({ 3: ['성장'] }))
        bad.push('scoreClean 이 모르는 이름·빈 병기를 못 떨군다 — ' + JSON.stringify(dirty));
      if (scoreClean({ 3: ['모르는것'] }) !== null)
        bad.push('scoreClean 이 남는 것 없는 악보를 null 로 돌려주지 않는다');
    }
  }

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
