#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   lab/cure.js — 「우발 완치 차단」 인계 (2026-09-18) 의 R1~R5 를 재고 장부를 뽑는다.

     node lab/cure.js                     → 60시드로 전부 재고 보고까지
     node lab/cure.js --seeds 10          → 시드 수를 줄여서 (빠른 확인용)
     node lab/cure.js --file <html>       → 잴 파일을 정해서 (기본 = 루트 결과물)
     node lab/cure.js --report            → 이미 잰 lab/data/cure.json 만 다시 읽어 보고
     node lab/cure.js --ladder            → A안 단계당 값을 올려 가며 R2 를 다시 잰다 (§6-1)
     node lab/cure.js --win               → 방침별 승률 · 판정 분포 · 사망률 (C안 셋을 나란히)

   ── 이 자가 measure.js 와 따로 있는 까닭 ────────────────────────────
   measure.js 는 보스 × 방침 격자를 잰다. 이쪽은 **런** 격자다 — 같은 방침을
   다른 손으로, 같은 손을 다른 버프로 잰다. 둘을 한 자에 합치면 격자가 5차원이
   되고, 그때부터는 어느 축이 무엇을 재는지 아무도 못 읽는다.

   ── 런 ──────────────────────────────────────────────────────────────
     R1 완치   현행 버프 (병 노드 수치 −5%/단계)      표준
     R2 완치   A안     (병 노드 처치선 +10%p/단계)    표준
     R3 연명   연명 버프                              표준
     R3F 연명  연명 버프                              자리닫기 (몰아쳐 닫는다)
     R4 연명   연명 버프                              병노드타격 (자리 유지)
     R5 편하게 편하게 버프                            병노드타격 (배수 관리)
   세 보스 × 문진 단계 0~3 × 시드. R4·R5 가 이번 측정의 본체다.

   ★ R3F 가 표에 없는 런인 까닭. 인계 §4 는 R3 의 손을 「자리 닫기」라고 적었는데,
     지금 시뮬의 표준 연명 손은 **가장 굵은 자리**를 쳐서 3막 30턴에 자리를 아이
     0.02개 · 어부 0개밖에 못 닫는다. 그 손으로 잰 닫기 손익은 규칙이 아니라 표적
     고르기를 잰 값이라 B안 부등식에 못 쓴다. 표준(R3)은 measure.js 의 연명과
     맞물려 있어 기준선으로 남기고, §4 가 말한 손은 R3F 로 따로 세운다.

   ── 재면서 고른 것 (읽는 쪽이 알아야 한다) ──────────────────────────
   ① **전부 정진단으로 돌린다.** act1 이 내는 오진/정진단은 씨앗마다 반반인데
      (후보 둘 → 1/2), 오진이면 방침 디버프도 전장 버프도 통째로 안 붙는다.
      그대로 두면 절반이 '버프 없는 판' 이라 문진 단계 축이 반으로 묽어진다.
      1막은 그대로 돌리고(난수 줄기가 같아야 한다) 판정만 정진단으로 고정한다.
   ② **승률은 판정에 안 쓴다.** 인계 §3-5 — 같은 확정본에서 0.43~0.58 까지
      흔들린다. 여기서도 찍기는 하되 읽는 것은 체력 여유 쪽이다.
   ③ **사망률은 잴 수 없다.** 보스 셋이 전부 noDeath 라 체력이 1 에서 멈춘다.
      measure.js 와 같은 그림자 장부를 쓴다 — 바닥에 걸려 버려지는 몫까지
      평행 장부에 적는다. 판단은 한 글자도 안 달라진다 (같은 씨앗 · 같은 수).
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), vm = require('vm'), path = require('path');

const BOSSES = ['아이', '어부', '송이'];
const INQS   = [0, 1, 2, 3];
const seedList = n => { const a = []; for (let i = 0; i < n; i++) a.push(1000 + i * 37); return a };

/* 런 한 벌. field 는 그 런이 SR.FIELD 에 눌러 놓는 값이다 —
   src/ 는 현행(disHp)과 A안(disLine)을 둘 다 들고 있고, 런마다 진 쪽을 0 으로 누른다.
   그래야 같은 빌드에서 둘을 견준다 (인계 §3-3). */
const RUNS = [
  { id: 'R1', pol: '완치',   hand: '표준',       field: { 완치: { disHp: 0.05, disLine: 0    } }, desc: '현행 버프 · 표준' },
  { id: 'R2', pol: '완치',   hand: '표준',       field: { 완치: { disHp: 0,    disLine: 0.10 } }, desc: 'A안 처치선 +10%p · 표준' },
  { id: 'R3', pol: '연명',   hand: '표준',       field: null, desc: '표준 (기준선)' },
  { id: 'R3F',pol: '연명',   hand: '자리닫기',   field: null, desc: '몰아쳐 자리 닫기' },
  { id: 'R4', pol: '연명',   hand: '병노드타격', field: null, desc: '자리 유지 + 병 노드 타격' },
  { id: 'R5S',pol: '편하게', hand: '표준',       field: null, desc: '표준 (기준선)' },
  { id: 'R5', pol: '편하게', hand: '병노드타격', field: null, desc: '배수 관리 + 병 노드 타격' },
];

/* 방침마다 '제 판정' 이 무엇인가 — 승률을 셀 때 이 표 하나를 본다.
   두 곳에 따로 적으면 편하게의 승리 이름(호전)이 한쪽에서만 바뀐다. */
const OWN_WIN = { 완치:'완치', 연명:'연명', 편하게:'호전' };
/* 이기고 끝난 판정 한 벌. 이 밖은 전부 진 것이다 (악화 · 사망) */
const WIN_OUTS = ['완치','연명','호전'];

/* B안 후보값 — 자리 하나를 닫을 때 **늘어나는** 병 노드 공격 (인계 §2 B안 표).
   ★ 이 시뮬에는 병 노드가 환자를 직접 때리는 규칙이 없다. 그래서 이 값을 판에
     얹지 않는다 — 얹으면 규칙을 새로 정하는 일이고, 그것은 대화에서 할 몫이다.
     대신 **재는 쪽에서만** 쓴다: 실제로 잰 '사라지는 부수 턴 피해' 와 이 상수를
     나란히 놓으면 B안 부등식이 성립하는지는 규칙을 안 건드리고도 답이 나온다. */
const B_DROP = { 아이: 5, 어부: 4, 송이: 6 };

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

/* ── 한 판을 재는 자 ──────────────────────────────────────────────
   act1 · act3 를 그대로 부르고 둘레만 감싼다. runStory 를 베끼지 않는다 —
   베끼면 이 자가 규칙과 갈라지고, 갈라진 것을 아무도 안 본다 (measure.js 와 같은 잣대).

   ★ C.cardCost 를 감싸 '마지막으로 물어본 코스트' 를 붙잡는다. storyTurn 의 병 노드
     갈래가 `S.energy -= C.cardCost(...)` 바로 다음 줄에서 hitDisease 를 부르므로,
     그 사이에 끼는 것이 없어 그 값이 곧 그 타격의 코스트다. 이 붙임은 그 두 줄이
     붙어 있다는 데 기댄다 — storyTurn 의 그 갈래를 옮기면 여기가 조용히 빗나간다.
     (빗나가면 여유 화력이 병 노드 몫만큼 작게 나온다) */
const PROBE = `((boss, policy, hand, inq, seed, noDeath) => {
  const rng = K.mulberry32(seed);
  const board = makeDisease(boss, rng);
  /* 그림자 판 — 사망 면제를 실제로 걷는다. 보스 셋이 전부 noDeath 라 이것을 안 걷으면
     사망률이 정의상 0 이고 「편하게」 승률이 구조적으로 1.00 이다 (measure.js 와 같은 잣대). */
  if (noDeath === false) board.noDeath = false;
  const S = K.newState(board, {}); S.board = board; S.rng = rng;
  const deck = typeof STORY_DECK !== 'undefined' ? STORY_DECK : C.DECK_D2;
  C.setupDeck(S, deck, K.mulberry32(seed + 1)); S.rng = rng;

  const LED = { turnPend:null, evoSym:null, book:{}, total:0, maxHit:0,
                shadow:board.hpMax, shadowMin:board.hpMax,
                supRaw:0, supCost:0,          // 덱이 코스트 하나로 내는 억제량
                disCost:0, disLand:0,         // 병 노드에 쓴 코스트 · 실제로 들어간 값
                spareCost:0,                  // 승리 조건에 안 쓴 코스트 (누적)
                spareTurn:null, spareStage:null,
                closeN:0, closeDmg:0, closeEvo:0, reopen:0, closes:[],
                lastCost:0, turn:0 };
  const put = (k, amt) => { LED.book[k] = (LED.book[k]||0) + amt };

  /* ── 피해 장부 (measure.js 와 같은 자) ──
     ★ 감싼 것을 finally 에서 반드시 벗긴다. 처음에는 벗기지 않고 부르는 쪽이
       원본을 되돌리게 뒀는데, 그러면 판마다 껍질이 한 겹씩 쌓인다 —
       판정은 안 틀리지만(껍질마다 제 장부에 적고 값은 그대로 넘긴다) 호출이 깊어져
       느려지다가 결국 「Maximum call stack size exceeded」로 터진다.
       5040판 쓸기는 겨우 버티고 10800판 쓸기에서 터졌다. 감싼 자가 벗긴다. */
  const origTD = typeof turnDmg === 'function' ? turnDmg : null;
  if (origTD) {
    turnDmg = n => { const v = origTD(n);
      if (v > 0) { (LED.turnPend = LED.turnPend || {})[n.sym] = (LED.turnPend[n.sym] || 0) + v }
      return v };
  }
  const origEvolve = evolveNow;
  evolveNow = (s, n) => { LED.evoSym = n.sym; try { return origEvolve(s, n) } finally { LED.evoSym = null } };
  const origHurt = hurtPatient;
  hurtPatient = (s, amt, why, src) => {
    if (amt > 0) {
      LED.total += amt; LED.maxHit = Math.max(LED.maxHit, amt);
      LED.shadow -= amt; LED.shadowMin = Math.min(LED.shadowMin, LED.shadow);
      if (LED.turnPend) {
        const p = LED.turnPend, sum = Object.keys(p).reduce((a,k)=>a+p[k], 0);
        for (const k in p) put('턴당·' + k, amt * p[k] / sum);
        LED.turnPend = null;
      } else if (LED.evoSym) { put('진화·' + LED.evoSym, amt); LED.evoSym = null }
      else put('기타', amt);
    }
    return origHurt(s, amt, why, src);
  };
  const origTR = K.turnResolve;
  const wrapTR = s => { LED.evoSym = null; LED.turnPend = null; return origTR(s) };
  K.turnResolve = wrapTR; turnResolve = wrapTR;

  /* ── 코스트 장부 ── */
  const origCost = C.cardCost;
  C.cardCost = (s, id) => { const c = origCost(s, id); LED.lastCost = c; return c };
  const origPlay = C.play;
  C.play = (s, id, tgt) => {
    const cd = C.CARDS[id], cost = origCost(s, id), ok = origPlay(s, id, tgt);
    if (ok && cd && cd.verb === '억제' && cd.sub !== '안정화') { LED.supRaw += (cd.v.sup||0); LED.supCost += cost }
    return ok;
  };
  const origHit = hitDisease;
  hitDisease = (s, dis, amt) => {
    LED.disCost += LED.lastCost; LED.supRaw += amt; LED.supCost += LED.lastCost;
    const got = origHit(s, dis, amt); LED.disLand += got; return got;
  };

  /* ── 턴 장부 — 여유 화력 · 닫기 손익 ──
     자리가 닫히는 것은 처치만이 아니다. 억제로 0 에 닿아도(휴면) 그 자리는 이번 턴부터
     안 때린다. 그래서 '무엇으로 닫혔는가' 를 안 묻고 플레이어 국면 앞뒤를 견준다 —
     doKill 만 감싸면 휴면으로 닫은 자리를 통째로 놓친다. */
  const origST = storyTurn;
  storyTurn = (s, dis, pol, hd) => {
    LED.turn++;
    const live = K.active(s).filter(n => n.role !== 'disease');
    /* 자리 하나를 닫으면 두 가지가 사라진다 —
         d  그 자리가 **매 턴** 때리던 몫 (R.TURN_DMG). 발열·출혈만 0 이 아니다
         e  아직 안 왔으면 한 번 들어올 **진화 즉발** (R.EVO_HIT). 비공격 넷은 이쪽뿐이다
       d 만 세면 어부·송이의 닫기 손익이 통째로 0 으로 나온다 — 그 둘의 부수 자리는
       턴당으로는 한 대도 안 때리고 피해가 전부 진화 즉발에서 나오기 때문이다.
       두 값을 합치지 않고 따로 적는다: 하나는 턴당이고 하나는 일회라 단위가 다르다. */
    const snap = live.map(n => ({ n, d: K.turnDmg(n), e: n.evolved ? 0 : (K.R.EVO_HIT[n.sym]||0) }));
    const r = origST(s, dis, pol, hd);
    /* 닫힌 자리 — 앞에서 살아 있었고 뒤에서 죽었거나 0 이 된 것 */
    for (const x of snap) if (x.n.dead || x.n.val <= 0) {
      LED.closeN++; LED.closeDmg += x.d; LED.closeEvo += x.e; x.n.__closed = true;
      if (LED.closes.length < 40) LED.closes.push({ t: LED.turn, sym: x.n.sym, dmg: x.d, evo: x.e, stage: dis.stage });
    }
    /* 여유 코스트 — 안 쓰고 남은 에너지. 완치가 아니면 병 노드에 쓴 코스트도 여유다
       (그 방침의 승리 조건이 병 노드에 걸려 있지 않으므로) */
    let spare = Math.max(0, s.energy);
    if (pol !== '완치') spare += LED.disThisTurn || 0;
    LED.spareCost += spare;
    LED.disThisTurn = 0;
    /* 우발 완치가 성립하는 첫 턴 — 여유 화력이 '지금 병을 끊는 데 드는 값' 을 넘는 순간.
       감쌈을 셈에 넣는다: 부수 자리가 하나라도 서 있으면 병에 들어가는 값이 반이다 */
    if (LED.spareTurn === null && LED.supCost > 0) {
      const per = LED.supRaw / LED.supCost;
      const shield = K.active(s).some(n => n.role !== 'disease') ? (1 - K.R.DIS_SHIELD) : 1;
      const need = Math.max(0, dis.val - K.killLine(s, dis)) / Math.max(0.01, shield);
      if (!dis.dead && LED.spareCost * per >= need) { LED.spareTurn = LED.turn; LED.spareStage = dis.stage }
    }
    /* 닫았던 자리가 다시 선 적이 있는가 — B안의 전제(닫힌 자리는 안 돌아온다) 확인 */
    for (const n of s.nodes) if (n.__closed && !n.dead && n.val > 0) { LED.reopen++; n.__closed = false }
    return r;
  };

  let res;
  try {
    const dis = S.nodes[0];
    const a1 = act1(S, deck, {});
    /* 처치 수는 판 하나에 누적된다 — 1막에서 자동 진행이 뽑은 자리까지 들어 있다.
       3막 몫만 보려면 여기서 눈금을 찍어 둬야 한다. 안 찍으면 어느 런을 재도
       2.0 근처로 똑같이 나오고(전부 1막 몫이라), 그것을 3막 값으로 읽게 된다. */
    LED.kill0 = S.killed;
    if (a1.out === '사망') res = { out:'사망', act:1, turns:a1.turns, stage:dis.stage };
    else res = Object.assign({ act:3 }, act3(S, policy, true, { inq, hand }));   // 정진단 고정 (재는 쪽의 선택)
    res.hp = S.hp; res.hpMax = S.hpMax; res.mind = S.mind;
    res.disVal = dis.val; res.disInit = dis.init; res.disLine = K.killLine(S, dis); res.disDead = !!dis.dead;
    res.cand = a1.cand; res.trueCorrect = !!a1.correct; res.stage0 = BOSS[boss].stage0;
  } finally {
    hurtPatient = origHurt; K.turnResolve = origTR; turnResolve = origTR;
    evolveNow = origEvolve; storyTurn = origST;
    C.cardCost = origCost; C.play = origPlay; hitDisease = origHit;
    if (origTD) turnDmg = origTD;
  }
  const book = {}; for (const k in LED.book) book[k] = Math.round(LED.book[k]*100)/100;
  const per = LED.supCost > 0 ? LED.supRaw / LED.supCost : 0;
  return Object.assign(res, {
    total: LED.total, maxHit: LED.maxHit, shadowMin: LED.shadowMin, book,
    perCost: Math.round(per*1000)/1000,
    spareCost: LED.spareCost, spareFire: Math.round(LED.spareCost*per*10)/10,
    spareTurn: LED.spareTurn, spareStage: LED.spareStage,
    disCost: LED.disCost, disLand: LED.disLand,
    closeN: LED.closeN, closeDmg: LED.closeDmg, closeEvo: LED.closeEvo,
    reopen: LED.reopen, closes: LED.closes, killed3: S.killed - (LED.kill0||0),
  });
})`;

/* 병 노드 타격에 쓴 코스트를 '그 턴 몫' 으로도 세야 여유 코스트에 얹을 수 있다.
   PROBE 안에서 hitDisease 가 LED.disThisTurn 을 올리게 한 자리 — 문자열을 한 벌 더
   적지 않으려고 여기서 끼워 넣는다 */
const PROBE_FIX = PROBE.replace(
  `LED.disCost += LED.lastCost; LED.supRaw += amt; LED.supCost += LED.lastCost;`,
  `LED.disCost += LED.lastCost; LED.disThisTurn = (LED.disThisTurn||0) + LED.lastCost;
    LED.supRaw += amt; LED.supCost += LED.lastCost;`);
if (PROBE_FIX === PROBE) throw new Error('PROBE 끼워 넣기가 빗나갔다 — hitDisease 감싸는 줄이 움직였다');

function run(file, seeds) {
  const ev = load(file);
  const probe = ev(PROBE_FIX);
  const base = ev(`JSON.stringify(SR.FIELD)`);
  const rows = [];
  for (const r of RUNS) {
    ev(`Object.assign(SR.FIELD, ${JSON.stringify(base ? JSON.parse(base) : {})})`);   // 런마다 원래 표로 되돌린다
    if (r.field) ev(`Object.assign(SR.FIELD, ${JSON.stringify(r.field)})`);
    for (const boss of BOSSES) for (const inq of INQS) for (const seed of seeds)
      rows.push({ run: r.id, pol: r.pol, hand: r.hand, boss, inq, seed, ...probe(boss, r.pol, r.hand, inq, seed) });
  }
  ev(`Object.assign(SR.FIELD, ${JSON.stringify(base ? JSON.parse(base) : {})})`);
  return rows;
}

/* ── 보고 ── */
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const med = a => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y), m = b.length >> 1;
                   return b.length % 2 ? b[m] : (b[m-1] + b[m]) / 2 };
const sd = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map(x => (x-m)*(x-m)))) };
const f2 = x => x.toFixed(2), f1 = x => x.toFixed(1);

function report(all) {
  const pick = (run, boss, inq) => all.filter(r => r.run === run && (!boss || r.boss === boss) && (inq === undefined || r.inq === inq));

  console.log('\n══ ① 체력 여유 (전투 종료 시 hp/hpMax) ══ 판정 기준 §6-1');
  console.log('  런별 · 문진 단계별. 괄호는 표준편차');
  for (const boss of BOSSES) {
    console.log(`\n  ── ${boss} ──`);
    console.log('    ' + '런'.padEnd(6) + INQS.map(i => `문진${i}`.padStart(15)).join(''));
    for (const r of RUNS) {
      const cells = INQS.map(i => {
        const R = pick(r.id, boss, i).map(x => x.hp / x.hpMax);
        return `${f2(mean(R))}(${f2(sd(R))})`.padStart(15);
      });
      console.log('    ' + r.id.padEnd(6) + cells.join(''));
    }
  }

  console.log('\n══ ② R2 대 R4·R5 — 폭이 겹치는가 ══ 판정 기준 §6-1');
  console.log('  R2 여유 − R4 여유 (같은 보스 · 같은 문진 단계 · 같은 씨앗의 짝 차이)');
  console.log('  짝 차이라 시드 흔들림이 빠진다. 0 보다 확실히 크면 R4 가 더 아프다 = A안 쪽');
  for (const boss of BOSSES) {
    for (const [a, b] of [['R2','R4'], ['R2','R5'], ['R1','R4'], ['R2','R3F']]) {
      const cells = INQS.map(i => {
        const A = pick(a, boss, i), B = pick(b, boss, i);
        const d = A.map((x, k) => (x.hp/x.hpMax) - (B[k].hp/B[k].hpMax));
        return `${f2(mean(d))}±${f2(sd(d)/Math.sqrt(Math.max(1,d.length)))}`.padStart(15);
      });
      console.log(`  ${boss} ${a}−${b}`.padEnd(14) + cells.join(''));
    }
  }

  console.log('\n══ ③ 우발 완치 ══ 판정 기준 §6-2');
  console.log('  완치율 = 그 런이 실제로 병 노드를 끊고 끝난 비율 (승률이 아니라 사건 빈도다)');
  console.log('  성립턴 = 여유 화력이 「지금 병을 끊는 데 드는 값」을 넘은 첫 턴 (중앙값 · 못 넘으면 −)');
  console.log('  앞병기 = 그 성립이 첫 병기 안에서 일어난 판의 비율 — 여기가 높으면 A안만으로 부족하다');
  for (const boss of BOSSES) {
    console.log(`\n  ── ${boss} ──`);
    console.log('    ' + '런'.padEnd(6) + INQS.map(i => `문진${i}`.padStart(20)).join(''));
    for (const r of RUNS) {
      const cells = INQS.map(i => {
        const R = pick(r.id, boss, i);
        const cure = R.filter(x => x.out === '완치').length / Math.max(1, R.length);
        const hit = R.filter(x => x.spareTurn !== null);
        const st = hit.length ? med(hit.map(x => x.spareTurn)) : null;
        const first = R.filter(x => x.spareStage !== null && x.spareStage === x.stage0).length / Math.max(1, R.length);
        return `${f2(cure)} ${st === null ? ' -' : f1(st)} ${f2(first)}`.padStart(20);
      });
      console.log('    ' + r.id.padEnd(6) + cells.join(''));
    }
    console.log('    (칸: 완치율 · 성립턴중앙 · 앞병기비율)');
  }

  console.log('\n══ ④ 닫기 손익 ══ 판정 기준 §6-3 · B안');
  console.log('  자리 하나를 닫을 때 사라지는 것 둘 — 턴당 몫과 아직 안 온 진화 즉발.');
  console.log('  둘을 안 합친다: 앞엣것은 남은 턴마다 되풀이되고 뒤엣것은 한 번뿐이다.');
  console.log('  B후보 = 인계 §2 B안 표의 자리당 감소값. 이 시뮬에는 병 노드가 환자를 직접');
  console.log('  때리는 규칙이 없어 판에 안 얹고 옆에 세워 견준다 — 턴당 몫이 B후보를 넘어야');
  console.log('  「사라지는 부수 턴 피해 > 늘어나는 병 노드 공격」이 성립한다.');
  console.log('  ' + '런'.padEnd(4) + '보스'.padEnd(6) + '닫은자리/판'.padStart(12) + '3막처치/판'.padStart(11)
              + '자리당턴당'.padStart(12) + 'B후보'.padStart(7) + '차'.padStart(8)
              + '자리당진화즉발'.padStart(16) + '다시선자리'.padStart(12));
  for (const r of RUNS) for (const boss of BOSSES) {
    const R = pick(r.id, boss);
    const n  = R.reduce((a, x) => a + x.closeN, 0);
    const d  = R.reduce((a, x) => a + x.closeDmg, 0);
    const e  = R.reduce((a, x) => a + x.closeEvo, 0);
    const kl = R.reduce((a, x) => a + (x.killed3||0), 0);
    const re = R.reduce((a, x) => a + x.reopen, 0);
    const per = n ? d / n : 0, perE = n ? e / n : 0;
    console.log('  ' + r.id.padEnd(4) + boss.padEnd(6) + (n/R.length).toFixed(2).padStart(12)
                + (kl/R.length).toFixed(2).padStart(11)
                + f2(per).padStart(12) + String(B_DROP[boss]).padStart(7) + f2(per - B_DROP[boss]).padStart(8)
                + f1(perE).padStart(16) + `${(re/Math.max(1,n)*100).toFixed(0)}%`.padStart(12));
  }

  console.log('\n══ ⑤ 기존 유효 지표 ══ 인계 §5');
  console.log('  ' + '런'.padEnd(5) + '보스'.padEnd(6) + '섀도최저'.padStart(10) + '섀도총피해'.padStart(12)
              + '최대단타'.padStart(10) + '턴수'.padStart(8) + '여유화력'.padStart(10) + '코스트당'.padStart(10));
  for (const r of RUNS) for (const boss of BOSSES) {
    const R = pick(r.id, boss);
    console.log('  ' + r.id.padEnd(5) + boss.padEnd(6)
      + f2(mean(R.map(x => x.shadowMin / x.hpMax))).padStart(10)
      + f1(mean(R.map(x => x.total))).padStart(12)
      + f1(mean(R.map(x => x.maxHit))).padStart(10)
      + f1(mean(R.map(x => x.turns))).padStart(8)
      + f1(mean(R.map(x => x.spareFire))).padStart(10)
      + f2(mean(R.map(x => x.perCost))).padStart(10));
  }

  console.log('\n══ ⑥ 증상별 피해 장부 (%) ══');
  for (const boss of BOSSES) {
    console.log(`\n  ── ${boss} ──`);
    const keys = new Set();
    const per = {};
    for (const r of RUNS) {
      const R = pick(r.id, boss), book = {};
      for (const x of R) for (const k in x.book) { book[k] = (book[k]||0) + x.book[k]; keys.add(k) }
      const sum = Object.keys(book).reduce((a, k) => a + book[k], 0) || 1;
      per[r.id] = Object.fromEntries(Object.entries(book).map(([k, v]) => [k, v/sum*100]));
    }
    console.log('    ' + '항목'.padEnd(14) + RUNS.map(r => r.id.padStart(9)).join(''));
    for (const k of [...keys].sort())
      console.log('    ' + k.padEnd(14) + RUNS.map(r => (per[r.id][k] ?? 0).toFixed(1).padStart(9)).join(''));
  }

  console.log('\n══ ⑦ 병 노드 끝수치 ══ A안이 실제로 선을 올렸는가');
  console.log('  ' + '런'.padEnd(5) + '문진'.padEnd(6) + BOSSES.map(b => b.padStart(22)).join(''));
  for (const r of RUNS) for (const i of INQS) {
    const cells = BOSSES.map(b => {
      const R = pick(r.id, b, i);
      return `선 ${f1(mean(R.map(x=>x.disLine)))} / 끝 ${f1(mean(R.map(x=>x.disVal)))}`.padStart(22);
    });
    console.log('  ' + r.id.padEnd(5) + String(i).padEnd(6) + cells.join(''));
  }
}

/* ── 사다리 ── 인계 §6-1 「폭이 겹치면 단계당 값을 올려 재측정한다」 ──────────
   A안 단계당 값만 갈아 끼우며 R2 를 다시 재고, R4 · R5 와의 짝 차이를 본다.
   R4 · R5 는 한 번만 잰다 — A안은 완치 줄의 손잡이라 그 둘을 한 자리도 안 움직인다.
   그 '안 움직인다' 자체가 이 표의 읽을거리다: 사다리를 아무리 올려도 R4 는 그대로고,
   벌어지는 것은 R2 쪽뿐이다. */
function ladder(file, seeds, vals) {
  const ev = load(file);
  const probe = ev(PROBE_FIX);
  const base = JSON.parse(ev(`JSON.stringify(SR.FIELD)`));
  const fix = {};
  for (const r of RUNS.filter(x => ['R4','R5'].includes(x.id))) {
    ev(`Object.assign(SR.FIELD, ${JSON.stringify(base)})`);
    fix[r.id] = [];
    for (const boss of BOSSES) for (const inq of INQS) for (const seed of seeds)
      fix[r.id].push({ boss, inq, seed, ...probe(boss, r.pol, r.hand, inq, seed) });
  }
  console.log('\n══ A안 단계당 값 사다리 ══ 인계 §6-1');
  console.log('  칸 = R2 여유 − 그 런의 여유 (같은 씨앗 짝 차이 ± 표준오차).');
  console.log('  양수 = 우발 완치 쪽이 더 아프다 = A안이 값을 하고 있다.');
  console.log('  ' + '단계당'.padEnd(8) + '보스'.padEnd(6) + '상대'.padEnd(6)
              + INQS.map(i => `문진${i}`.padStart(15)).join(''));
  for (const v of vals) {
    ev(`Object.assign(SR.FIELD, ${JSON.stringify(base)})`);
    ev(`Object.assign(SR.FIELD, ${JSON.stringify({ 완치: { disHp: 0, disLine: v } })})`);
    const r2 = [];
    for (const boss of BOSSES) for (const inq of INQS) for (const seed of seeds)
      r2.push({ boss, inq, seed, ...probe(boss, '완치', '표준', inq, seed) });
    for (const boss of BOSSES) for (const other of ['R4','R5']) {
      const cells = INQS.map(i => {
        const A = r2.filter(x => x.boss === boss && x.inq === i);
        const B = fix[other].filter(x => x.boss === boss && x.inq === i);
        const d = A.map((x, k) => (x.hp/x.hpMax) - (B[k].hp/B[k].hpMax));
        return `${f2(mean(d))}±${f2(sd(d)/Math.sqrt(Math.max(1,d.length)))}`.padStart(15);
      });
      console.log('  ' + `+${(v*100).toFixed(0)}%p`.padEnd(8) + boss.padEnd(6) + other.padEnd(6) + cells.join(''));
    }
  }
  ev(`Object.assign(SR.FIELD, ${JSON.stringify(base)})`);
}

/* ── 승률 ── 방침마다 얼마나 이기는가. C안 셋을 나란히 놓는다 ─────────────
   ★ 여기서 재는 승률은 **판정에 안 쓴다** (인계 §3-5 — 같은 확정본에서 0.43~0.58
     까지 흔들린다). 그래도 재는 까닭은 C안이 '판정 이름' 을 바꾸는 안이기 때문이다:
     여유나 피해로는 C안 셋이 서로 구별되지 않는다. 같은 수를 두고 같은 피해를 받고
     끝에 적히는 이름만 달라지는 판이 있어서, 그 이름을 세는 자가 따로 있어야 한다.
   ★ 흔들림을 숨기지 않으려고 씨앗을 앞뒤 반으로 갈라 둘 다 찍는다. 두 반쪽이
     벌어진 폭이 곧 이 수를 믿을 수 있는 자리수다. */
function winrate(file, seeds, ids) {
  const ev = load(file);
  const probe = ev(PROBE_FIX);
  const base = JSON.parse(ev(`JSON.stringify(SR.FIELD)`));
  const scopes = JSON.parse(ev(`JSON.stringify(SR.CURE_SCOPE_LIST)`));
  const use = RUNS.filter(r => ids.includes(r.id));
  const rows = [];
  for (const sc of scopes) {
    ev(`SR.CURE_SCOPE = ${JSON.stringify(sc)}`);
    for (const r of use) {
      ev(`Object.assign(SR.FIELD, ${JSON.stringify(base)})`);
      if (r.field) ev(`Object.assign(SR.FIELD, ${JSON.stringify(r.field)})`);
      for (const boss of BOSSES) for (const inq of INQS) for (const seed of seeds) {
        const real = probe(boss, r.pol, r.hand, inq, seed, true);
        const bare = probe(boss, r.pol, r.hand, inq, seed, false);
        rows.push({ scope: sc, run: r.id, pol: r.pol, hand: r.hand, boss, inq, seed,
                    out: real.out, turns: real.turns, hp: real.hp, hpMax: real.hpMax,
                    bareOut: bare.out, bareTurns: bare.turns });
      }
    }
  }
  ev(`SR.CURE_SCOPE = ${JSON.stringify(scopes[0])}`);
  ev(`Object.assign(SR.FIELD, ${JSON.stringify(base)})`);
  return rows;
}

function winReport(rows) {
  const scopes = [...new Set(rows.map(r => r.scope))];
  const ids = [...new Set(rows.map(r => r.run))];
  const half = r => r.seed < med(rows.map(x => x.seed));
  const rate = (R, f) => R.length ? R.filter(f).length / R.length : 0;

  console.log('\n══ ⓐ 방침별 승률 ══');
  console.log('  승률 = 악화·사망이 아닌 판의 비율. 제판정 = 그 방침의 제 이름으로 끝난 비율');
  console.log('  (완치→완치 · 연명→연명 · 편하게→호전). 둘이 갈리는 폭이 곧 우발 완치다');
  console.log('  ±는 씨앗을 앞뒤 반으로 가른 두 값의 차 — 이만큼은 표본이 흔드는 값이다');
  for (const boss of BOSSES) {
    console.log(`\n  ── ${boss} ──`);
    console.log('    ' + '런'.padEnd(5) + '정산'.padEnd(6) + INQS.map(i => `문진${i}`.padStart(21)).join(''));
    for (const id of ids) for (const sc of scopes) {
      const cells = INQS.map(i => {
        const R = rows.filter(x => x.run===id && x.scope===sc && x.boss===boss && x.inq===i);
        const own = OWN_WIN[R[0] ? R[0].pol : ''];
        const w = rate(R, x => WIN_OUTS.includes(x.out));
        const o = rate(R, x => x.out === own);
        const A = R.filter(half), B = R.filter(x => !half(x));
        const j = Math.abs(rate(A, x => WIN_OUTS.includes(x.out)) - rate(B, x => WIN_OUTS.includes(x.out)));
        return `${f2(w)} / ${f2(o)} ±${f2(j)}`.padStart(21);
      });
      console.log('    ' + id.padEnd(5) + sc.padEnd(6) + cells.join(''));
    }
    console.log('    (칸: 승률 / 제판정률 ± 반쪽 차)');
  }

  console.log('\n══ ⓑ 판정 분포 ══ 어느 이름으로 끝나는가 (문진 단계를 합친 값)');
  const OUTS = ['완치','연명','호전','악화','사망'];
  console.log('  ' + '런'.padEnd(5) + '정산'.padEnd(6) + '보스'.padEnd(6)
              + OUTS.map(o => o.padStart(8)).join('') + '사망(벗김)'.padStart(12) + '턴수'.padStart(8));
  for (const id of ids) for (const sc of scopes) for (const boss of BOSSES) {
    const R = rows.filter(x => x.run===id && x.scope===sc && x.boss===boss);
    console.log('  ' + id.padEnd(5) + sc.padEnd(6) + boss.padEnd(6)
      + OUTS.map(o => f2(rate(R, x => x.out === o)).padStart(8)).join('')
      + f2(rate(R, x => x.bareOut === '사망')).padStart(12)
      + f1(mean(R.map(x => x.turns))).padStart(8));
  }

  console.log('\n══ ⓓ 사망률 (사망 면제를 벗긴 짝) ══');
  console.log('  보스 셋이 전부 noDeath 라 위의 승률은 0 아니면 1 로 굳는다 — 질 방법이 없다.');
  console.log('  면제를 실제로 걷고 같은 씨앗으로 다시 돌린 판에서 재는 이 값이 이 판의 진짜 패배율이다.');
  for (const boss of BOSSES) {
    console.log(`\n  ── ${boss} ──`);
    console.log('    ' + '런'.padEnd(5) + '정산'.padEnd(6) + INQS.map(i => `문진${i}`.padStart(10)).join('') + '전체'.padStart(10));
    for (const id of ids) for (const sc of scopes) {
      const all = rows.filter(x => x.run===id && x.scope===sc && x.boss===boss);
      const cells = INQS.map(i => f2(rate(all.filter(x => x.inq===i), x => x.bareOut==='사망')).padStart(10));
      console.log('    ' + id.padEnd(5) + sc.padEnd(6) + cells.join('') + f2(rate(all, x => x.bareOut==='사망')).padStart(10));
    }
  }

  console.log('\n══ ⓒ C안이 무엇을 바꾸는가 ══ 전역 대비');
  console.log('  같은 씨앗 · 같은 손에서 정산만 갈아 끼운 값. 우발 완치가 얼마나 사라지는가');
  console.log('  ' + '런'.padEnd(5) + '보스'.padEnd(6) + '전역 완치율'.padStart(13)
              + '방침 완치율'.padStart(13) + '봉쇄 완치율'.padStart(13)
              + '방침 승률차'.padStart(13) + '봉쇄 승률차'.padStart(13));
  for (const id of ids) for (const boss of BOSSES) {
    const at = sc => rows.filter(x => x.run===id && x.scope===sc && x.boss===boss);
    const g = at('전역'), p = at('방침'), b = at('봉쇄');
    if (!g.length) continue;
    console.log('  ' + id.padEnd(5) + boss.padEnd(6)
      + f2(rate(g, x => x.out==='완치')).padStart(13)
      + f2(rate(p, x => x.out==='완치')).padStart(13)
      + f2(rate(b, x => x.out==='완치')).padStart(13)
      + f2(rate(p, x => WIN_OUTS.includes(x.out)) - rate(g, x => WIN_OUTS.includes(x.out))).padStart(13)
      + f2(rate(b, x => WIN_OUTS.includes(x.out)) - rate(g, x => WIN_OUTS.includes(x.out))).padStart(13));
  }
}

if (require.main === module) {
  const arg = process.argv.slice(2);
  const opt = (k, d) => { const i = arg.indexOf(k); return i >= 0 ? arg[i+1] : d };
  const DATA = path.join(__dirname, 'data', 'cure.json');
  if (arg.includes('--report')) { report(JSON.parse(fs.readFileSync(DATA, 'utf8')).rows); process.exit(0) }
  const n = +opt('--seeds', 60);
  const file = opt('--file', path.join(__dirname, '..', '..', 'intern_sim.html'));
  const seeds = seedList(n);
  if (arg.includes('--ladder')) { ladder(file, seeds, [0.10, 0.15, 0.20, 0.25, 0.30]); process.exit(0) }
  if (arg.includes('--win')) {
    const WDATA = path.join(__dirname, 'data', 'cure-win.json');
    const ids = ['R1','R3','R4','R5S','R5'];
    const t1 = Date.now();
    const w = winrate(file, seeds, ids);
    fs.mkdirSync(path.dirname(WDATA), { recursive: true });
    fs.writeFileSync(WDATA, JSON.stringify({ file: path.basename(file), seeds: n, rows: w }));
    console.log(`잰 판 ${w.length*2} · ${((Date.now()-t1)/1000).toFixed(1)}초 (사망 면제 벗긴 짝까지)`);
    winReport(w);
    process.exit(0);
  }
  const t0 = Date.now();
  const rows = run(file, seeds);
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  fs.writeFileSync(DATA, JSON.stringify({ file: path.basename(file), seeds: n, rows }));
  console.log(`잰 판 ${rows.length} · ${((Date.now()-t0)/1000).toFixed(1)}초 · 씨앗 ${n} × 보스 ${BOSSES.length} × 문진 ${INQS.length} × 런 ${RUNS.length}`);
  report(rows);
}
module.exports = { run, seedList, RUNS, BOSSES, INQS, B_DROP };
