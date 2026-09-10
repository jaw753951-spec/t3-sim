#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   story_probe.js — 스토리 판을 들여다보는 자.

     node story_probe.js trace [보스] [방침] [씨앗] [파일]   한 판을 턴별로 훑는다
     node story_probe.js sweep [보스…] [파일]                 병이 노는 구간을 센다
     node story_probe.js diff  A.html B.html                   두 결과물의 판을 견준다
     node story_probe.js policy [파일]                         방침 셋이 실제로 갈리는가

   sim_check 는 판의 '끝' 만 본다 — 몇 턴에 어떤 판정이 났는가. 여기는 '과정' 을 본다.
   비트 이름만으로는 안 보이는 것들이 있다. 「파고든다」라고 적어 놓고 아무 자리도
   안 건드리는 턴이 그렇다 — 비트 앞뒤로 판을 찍어 실제로 바뀌었는지 본다.

   trace  한 판을 턴별로. 왜 이렇게 흘렀는지 눈으로 볼 때
   sweep  여러 판을 몰아. 병이 노는 턴이 얼마나 되는지 셀 때 (악보를 새로 짤 때)
   diff   규칙을 고친 몫을 잴 때. 판정 분포까지 갈라 보여 준다

   떼어 오는 구간은 sim_check 와 같다 — 자름 앵커가 표시한다 (build.js 가 찍는다).
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), vm = require('vm'), path = require('path');

const BOSSES = ['아이','어부','송이'], POLS = ['완치','연명','편하게'];
/* 결과물은 저장소 루트에 있다 — 이 파일 자리에서 잡는다 (cwd 를 안 탄다) */
const FILE = path.join(__dirname, '..', 'intern_sim.html'), SEEDS = 40, TURNS = 30;

/* 화면 없이 도는 구간만 떼어 돌린다 */
function load(file){
  const t = fs.readFileSync(file, 'utf8');
  const cut = (a, b) => {
    const i = t.indexOf(a), j = t.indexOf(b);
    if (i < 0 || j < 0) throw new Error(`${file}: 자름 앵커가 없다`);
    return t.slice(t.indexOf('\n', i) + 1, j);
  };
  const ctx = vm.createContext({ console, Math, JSON, Object, Array, Set, Map, String, Number, isFinite });
  vm.runInContext(cut('//@ 자름.커널시작','//@ 자름.커널끝') + '\n' +
                  cut('//@ 자름.배선시작','//@ 자름.배선끝'), ctx, { filename: file });
  return expr => vm.runInContext(expr, ctx, { filename: file + ' <expr>' });
}

/* 3막을 한 턴씩 돌며 그 턴에 병이 무엇을 했는지 적는다.
   턴 순서(병 행동 → 시계 → 손패 → 정산)는 storyPhase 를 그대로 부른다 —
   여기에 다시 적으면 언젠가 갈라지고, 갈라지면 이 자가 거짓말을 한다.
   비트 앞뒤로 판을 찍어야 하므로 diseaseAct 만 감싸 두고 storyPhase 가 그것을 부르게 한다. */
const ROWS = `((boss, policy, seed, cap) => {
  const rng = K.mulberry32(seed);
  const board = makeDisease(boss, rng);
  const S = K.newState(board, {}); S.board = board; S.rng = rng;
  /* 스토리 가방 그대로 돌린다 — 그 표가 서기 전의 옛 파일이면 2일차 8종으로 대신한다 */
  const deck = typeof STORY_DECK !== 'undefined' ? STORY_DECK : C.DECK_D2;
  C.setupDeck(S, deck, K.mulberry32(seed + 1)); S.rng = rng;
  const dis = S.nodes[0];
  const a1 = act1(S, deck, {});
  applyPolicy(S, dis, policy, a1.correct);

  /* 비트가 판을 바꿨는가 — 비트 번호는 빼고 본다 (그것만 늘 오른다).
     crave · closedN · cap 이 든 까닭: 「갈망」은 상시 규칙만 설치하고 처치는 정원을
     깎는다. 노드와 체력만 보던 동안 갈망이 360판에서 120회 「헛돈다」로 잘못
     세어졌다 — 실제로는 매번 규칙을 걸고 있었다. */
  const snap = () => JSON.stringify({ hp:S.hp, mind:S.mind, enh:(S.enh||[]).length, n:S.nodes.length,
    crave:!!S.crave, closed:S.closedN||0, cap:spotCap(S,dis),
    dis:[dis.val, dis.stage, dis.stageClock, dis.dead?1:0],
    nodes:S.nodes.filter(x=>x.role!=='disease').map(x=>[x.sym,x.val,x.dead?1:0,x.shielded?1:0,x.evoLeft]) });

  /* 병 행동만 따로 찍는다 — 비트 이름은 diseaseAct 가 세기 전에 읽어야 한다 */
  let mark = null;
  const orig = diseaseAct;
  globalThis.diseaseAct = (s, d, act) => {
    const beat = nextBeat(s, d), before = snap();
    const line = orig(s, d, act);
    mark = { beat, line, moved: snap() !== before };
    return line;
  };

  const rows = []; let t = 0;
  try {
    while (t < cap) {
      const v = storyVerdict(S, dis, policy);
      if (v) { rows.push({ t:t+1, end:v }); break }
      t++;
      S.played = 0; storyTurn(S, dis, policy);
      const hp0 = S.hp;
      const live = K.active(S).filter(x=>x.role!=='disease').length;
      const neuro = K.active(S).filter(x=>x.role!=='disease' && (x.sym==='통증'||x.sym==='호흡곤란')).length;
      mark = null;
      const ph = storyPhase(S, dis) || {};
      C.endTurnHand(S); K.turnResolve(S); storyTick(S);
      /* storyPhase 가 병을 안 움직인 턴 — 3막에서는 없지만, 없다고 터지지는 않게 한다 */
      const m = mark || { beat:'—', line:'병이 움직이지 않았다', moved:false };
      rows.push({ t, stage:dis.stage, clock:dis.stageClock, up:ph.up, live, neuro,
                  closed:S.closedN||0, cap:spotCap(S,dis),
                  beat:m.beat, line:m.line, moved:m.moved, floor:hp0<=1,
                  liveAfter:K.active(S).filter(x=>x.role!=='disease').length,
                  dmg:hp0-S.hp, hp:S.hp, disVal:dis.val });
    }
  } finally { globalThis.diseaseAct = orig }
  return rows;
})`;

const seedList = n => { const a = []; for (let i = 0; i < n; i++) a.push(1000 + i * 37); return a };

/* 한 판을 몇 턴까지 볼 것인가 — 그 파일의 손잡이를 그대로 쓴다.
   그 손잡이가 서기 전의 옛 파일이면 TURNS 로 대신한다. 0 이 되면 한 턴도 안 돌아
   「아무 일도 없다」로 조용히 잘못 읽힌다 — 그래서 여기서 한 번에 막는다. */
const capOf = ev => ev('typeof SR.ACT3_CAP === "number" ? SR.ACT3_CAP : 0') || TURNS;

/* ── trace ── 한 판을 턴별로 ── */
function trace(boss, pol, seed, file){
  const ev = load(file);
  const rows = ev(ROWS)(boss, pol, seed, capOf(ev));
  console.log(`=== ${boss} · ${pol} · 씨앗 ${seed} · ${file} ===`);
  console.log(' 턴 병기 시계 비트        판  자리   피해 병노드  줄');
  for (const r of rows) {
    if (r.end) { console.log(`  ${String(r.t).padStart(2)} ── 판정 ${r.end}`); continue }
    console.log(`  ${String(r.t).padStart(2)}   ${r.stage}   ${String(r.clock).padStart(2)}  ${r.beat.padEnd(9)}`
      + ` ${r.moved ? ' ○ ' : '✗무행동'} ${String(r.live).padStart(2)}→${r.liveAfter}`
      + ` ${String(r.dmg).padStart(5)} ${String(r.disVal).padStart(6)}  ${r.line || ''}${r.up ? `  ▲병기 ${r.up}` : ''}`);
  }
}

/* ── sweep ── 병이 노는 구간을 센다 ──
   ① 판을 안 바꿨는데 살아 있는 자리가 있었다 — 폴백이 놓친 비트
      (sim_check 불변 조건 ③ㄷ 가 원리상 잡지만, 여기는 실제 판에서 몇 번인지를 센다)
   ② 병도 부수도 아무 일 없는 턴이 연달아 몇 번인가 — 악보 배열이 만드는 빈 구간.
      비트 하나하나가 규약을 지켜도 배열 때문에 세 턴이 빌 수 있다. ③ㄷ 는 이것을 못 본다
   ③ 창 뒤로 몇 턴이 비는가 */
function sweep(bosses, file){
  const ev = load(file), run = ev(ROWS), cap = capOf(ev);
  /* v27 — 쉬는 비트 표(BEAT_REST)는 걷혔다. 이제 모든 박자가 판을 움직여야 하므로
     봐 줄 이름이 없다. 옛 파일을 재면 「같은 박자」가 헛돎으로 잡히는데 그것이 맞다 */
  const seeds = seedList(SEEDS);
  const miss = {}, idleRun = {}, win = [];
  for (const boss of bosses) for (const pol of POLS) for (const seed of seeds) {
    const rows = run(boss, pol, seed, cap);
    let streak = 0;
    rows.forEach((r, i) => {
      if (r.end) return;
      /* 체력이 이미 바닥(noDeath 는 1 에서 멈춘다)이면 「공격」이 제값을 때려도 판이
         안 움직인다. 비트가 헛돈 것이 아니라 더 깎을 데가 없는 것이다 — ② 가 hp>0 을
         보는 것과 같은 까닭이다. 이것을 안 빼면 아이 병기5 의 공격이 36회 잘못 잡힌다 */
      if (!r.moved && r.live > 0 && !r.floor) {
        const k = `${boss} · 병기${r.stage} · ${r.beat}`;
        miss[k] = miss[k] || { n:0, ex:null };
        miss[k].n++;
        if (!miss[k].ex) miss[k].ex = `씨앗 ${seed} ${pol} ${r.t}턴 — 자리 ${r.live}(신경계 ${r.neuro}) · 「${r.line}」`;
      }
      /* 빈 턴 = 비트가 판을 안 바꿨고 환자도 안 아팠다. 체력이 바닥이면 피해가 0으로 보이므로 뺀다 */
      if (!r.moved && r.dmg === 0 && r.hp > 0) streak++;
      else if (streak) { idleRun[streak] = (idleRun[streak] || 0) + 1; streak = 0 }
      if (r.beat === '창') {
        let k = 0;
        for (let j = i + 1; j < rows.length; j++) { const q = rows[j]; if (q.end || q.moved || q.dmg > 0) break; k++ }
        win.push({ boss, stage:r.stage, k });
      }
    });
    if (streak) idleRun[streak] = (idleRun[streak] || 0) + 1;
  }
  console.log(`=== ${file} · ${bosses.join('·')} × 방침 ${POLS.length} × 씨앗 ${seeds.length} ===`);
  console.log('\n① 판을 안 바꿨는데 살아 있는 자리가 있었다 (폴백이 놓친 비트)');
  const ks = Object.keys(miss).sort((a, b) => miss[b].n - miss[a].n);
  if (!ks.length) console.log('  없다');
  for (const k of ks) console.log(`  ${k.padEnd(24)} ${String(miss[k].n).padStart(4)}회   예: ${miss[k].ex}`);
  console.log('\n② 병도 부수도 아무 일 없는 턴이 연달아 몇 번인가');
  const rs = Object.keys(idleRun).sort((a, b) => a - b);
  if (!rs.length) console.log('  없다');
  for (const k of rs) console.log(`  ${k}턴 연속 × ${idleRun[k]}`);
  console.log('\n③ 창 뒤로 몇 턴이 비는가');
  const by = {};
  for (const w of win) (by[`${w.boss} 병기${w.stage}`] = by[`${w.boss} 병기${w.stage}`] || []).push(w.k);
  if (!Object.keys(by).length) console.log('  창이 없는 보스다');
  for (const k of Object.keys(by)) {
    const a = by[k];
    console.log(`  ${k.padEnd(12)} 창 ${String(a.length).padStart(3)}회 · 뒤이어 비는 턴 평균 ` +
                `${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2)} · 최대 ${Math.max(...a)}`);
  }
}

/* ── policy ── 방침 셋이 실제로 갈리는가 ──────────────────────
   인계 문서 §7.2 가 물은 여섯을 한 번에 잰다. 한 번 쓰고 마는 자를 lab/ 에 두지 않는다 —
   손잡이(연명 정원 증가 · 흡수율 셋 · 공격값)를 만질 때마다 다시 재야 하는 것들이다.

   ★ 사망률 · 승률은 못 쓰는 값이다 (§7.3). 셋 다 noDeath 판이고 자동 진행 AI 의
     실력이 곧 하한선이라 설계값이 아니다. 그래도 「한 번이라도 나오는가」는 쓸 수 있다 —
     0 이면 그 방침으로는 이길 길이 아예 없다는 뜻이고, 그때는 규칙을 조정할 자리다. */
function policy(file){
  const ev = load(file), run = ev(ROWS), cap = capOf(ev);
  const RUN = ev(`((boss,pol,seed)=>{ const r=runStory(boss,C.DECK_D2,seed,pol,{});
    return {out:r.out, turns:r.turns, stage:r.stage, hp:r.hp, hpMax:r.S?r.S.hpMax:0} })`);
  const seeds = seedList(SEEDS);
  console.log(`=== ${file} · 방침 갈래 · 씨앗 ${seeds.length} ===`);

  for (const boss of BOSSES) {
    console.log(`
── ${boss} ──`);
    for (const pol of POLS) {
      const cnt = {}; let turns = 0, spare = 0, low = Infinity, big = 0, dmg = 0;
      let lingerTurn = 0, reopen = 0, closed = 0, capEnd = 0;
      for (const seed of seeds) {
        const r = RUN(boss, pol, seed);
        cnt[r.out] = (cnt[r.out] || 0) + 1; turns += r.turns;
        if (r.hpMax) spare += r.hp / r.hpMax;
        /* 그림자 런 — 판정과 무관하게 판이 얼마나 아팠는가 */
        const rows = run(boss, pol, seed, cap);
        /* 연명의 진척은 승률이 아니라 **닫은 자리**로 잰다. 이기지 못한 판도 몇 칸까지
           갔는지가 보여야 정원 손잡이를 어느 쪽으로 밀지 알 수 있다 —
           승률만 보면 0/40 과 「한 칸도 못 닫았다」와 「한 칸 남기고 졌다」가 구분이 안 된다 */
        /* 판정 줄(rows 의 마지막)에는 판 상태가 없다 — 그 앞의 마지막 턴을 본다.
           그냥 마지막 줄을 읽으면 **이긴 판만 0 으로 세어져** 닫은 자리가 거꾸로 나온다 */
        const last = [...rows].reverse().find(q => q.closed !== undefined) || {};
        closed += last.closed || 0; capEnd += last.cap || 0;
        for (const q of rows) {
          if (q.end) continue;
          dmg += q.dmg; big = Math.max(big, q.dmg); low = Math.min(low, q.hp);
          if (q.liveAfter === 0) lingerTurn++;          // 판이 빈 턴 (닫힌 것과는 다르다)
          if (q.live === 0 && q.liveAfter > 0) reopen++; // 빈 판에 자리가 다시 섰는가
        }
      }
      const n = seeds.length;
      console.log(`  ${pol.padEnd(4)} ${JSON.stringify(cnt).padEnd(30)}`
        + ` 평균 ${(turns/n).toFixed(1)}턴 · 끝 체력 여백 ${(spare/n*100).toFixed(0)}%`
        + ` · 최소 체력 ${low===Infinity?'—':low} · 최대 단타 ${big} · 총 피해 ${(dmg/n).toFixed(0)}`
        + (pol==='연명' ? ` · 닫은 자리 ${(closed/n).toFixed(1)} · 남은 정원 ${(capEnd/n).toFixed(1)}`
                          + ` · 빈 판 턴 ${lingerTurn}` : ''));
    }
  }

  /* 이음표 갈래 — 같은 보스 같은 최종 병기에서 **판 상태를 바꾸면** 궤적이 갈리는가.
     갈래가 하나면 이음표가 고정 악보와 다를 것이 없다.
     ★ 씨앗을 흔드는 것으로는 못 잰다. 씨앗은 자리의 초기 수치만 흔들 뿐 자리 수도
       종류도 안 바꾸는데, 이음표가 보는 것은 그 수치가 아니라 자리 수 · 증상 종류 ·
       휴면 · 배선이다. 처음에 씨앗으로 재서 「갈래 1가지」라는 답을 얻었다 —
       이음표가 안 도는 것이 아니라 자가 딴 것을 재고 있었다. */
  console.log('\n이음표 갈래 (최종 병기 · 판을 흔들었을 때의 박자 줄)');
  const TRACK = ev(`((boss,fill,dorm)=>{
    const rng=K.mulberry32(7); const board=makeDisease(boss,rng);
    const S=K.newState(board,{}); S.board=board; S.rng=rng; S.act=3; S.policy='완치';
    S.closedN=0; S.spawnBonus=0;
    const dis=S.nodes[0]; dis.stage=dis.stageMax; dis.beat=0;
    for(const n of S.nodes) if(n.role!=='disease'){ n.dead=true; n.val=0 }
    for(const sym of fill){ const n=mkSpot(boss,dis.stage,sym,60,0); n.val=40; S.nodes.push(n) }
    for(let i=0;i<dorm;i++){ const n=mkSpot(boss,dis.stage,'발열',60,0); n.val=0; n.dormT=2; S.nodes.push(n) }
    const out=[];
    for(let i=0;i<10;i++){ out.push(nextBeat(S,dis)); diseaseAct(S,dis,null); S.turn++ }
    return out.join(' → ');
  })`);
  /* 흔드는 판 여섯 — 빈 판 · 자리 하나 · 통증 둘 · 호흡곤란 낀 판 · 꽉 찬 판 · 휴면이 있는 판 */
  const SHAKE = [[[], 0], [['발열'], 0], [['통증','통증'], 0], [['통증','호흡곤란'], 0],
                 [['발열','출혈','통증'], 0], [['발열'], 2]];
  for (const boss of BOSSES) {
    const seen = new Map();
    for (const [fill, dorm] of SHAKE) {
      const t = TRACK(boss, fill, dorm);
      if (!seen.has(t)) seen.set(t, `${fill.length?fill.join('·'):'빈 판'}${dorm?` +휴면${dorm}`:''}`);
    }
    console.log(`  ${boss.padEnd(3)} 갈래 ${String(seen.size).padStart(2)}가지 / 흔든 판 ${SHAKE.length}`);
    for (const [t, why] of seen) console.log(`      ${why.padEnd(14)} ${t}`);
  }

  /* 앵커 상한 — 여섯 바퀴째부터 성장으로 바뀌는가 */
  console.log('\n앵커 상한');
  const ANCHOR = ev(`((boss)=>{
    const rng=K.mulberry32(7); const board=makeDisease(boss,rng);
    const S=K.newState(board,{}); S.board=board; S.rng=rng; S.act=3; S.policy='완치';
    const dis=S.nodes[0]; dis.stage=dis.stageMax;
    const out=[];
    for(let L=0;L<=SR.ANCHOR_LOOPS;L++){
      dis.beat=L*SR.ANCHOR_EVERY; dis.beatTurn=null; dis.beatPick=null;
      out.push((L+1)+'바퀴 '+nextBeat(S,dis));
    }
    return out.join(' · ');
  })`);
  for (const boss of BOSSES) console.log(`  ${boss.padEnd(3)} ${ANCHOR(boss)}`);
}

/* ── diff ── 규칙을 고친 몫을 잰다 ──
   sim_check 의 견주기는 스토리를 9판만 본다. 밸런스가 얼마나 움직였는지는 그것으로 안 나온다. */
function diff(a, b){
  const RUN = `((boss, pol, seed) => { const r = runStory(boss, C.DECK_D2, seed, pol, {});
                                       return r.out + '/' + r.turns + '/' + r.stage })`;
  const A = load(a)(RUN), B = load(b)(RUN);
  const seeds = seedList(SEEDS);
  let same = 0, moved = 0;
  const byCase = {}, outA = {}, outB = {};
  for (const boss of BOSSES) for (const pol of POLS) for (const s of seeds) {
    const x = A(boss, pol, s), y = B(boss, pol, s);
    outA[`${boss} ${pol} ${x.split('/')[0]}`] = (outA[`${boss} ${pol} ${x.split('/')[0]}`] || 0) + 1;
    outB[`${boss} ${pol} ${y.split('/')[0]}`] = (outB[`${boss} ${pol} ${y.split('/')[0]}`] || 0) + 1;
    if (x === y) same++;
    else { moved++; byCase[`${boss} · ${pol}`] = (byCase[`${boss} · ${pol}`] || 0) + 1 }
  }
  console.log(`=== ${a} → ${b} ===`);
  console.log(`같은 판 ${same} · 달라진 판 ${moved} / ${same + moved}`);
  for (const k of Object.keys(byCase)) console.log(`  ${k.padEnd(14)} ${byCase[k]}판`);
  console.log('\n판정 분포 (앞 → 뒤)');
  let any = false;
  for (const k of new Set([...Object.keys(outA), ...Object.keys(outB)]))
    if ((outA[k] || 0) !== (outB[k] || 0)) { any = true; console.log(`  ${k.padEnd(20)} ${outA[k] || 0} → ${outB[k] || 0}`) }
  if (!any) console.log('  그대로다');
}

/* ── 손잡이 ── */
const [mode, ...arg] = process.argv.slice(2);
try {
  if (mode === 'trace') trace(arg[0] || '아이', arg[1] || '완치', +(arg[2] || 777), arg[3] || FILE);
  else if (mode === 'sweep') sweep((arg[0] || BOSSES.join(',')).split(','), arg[1] || FILE);
  else if (mode === 'policy') policy(arg[0] || FILE);
  else if (mode === 'diff') {
    if (!arg[1]) throw new Error('두 파일을 넘긴다 — node story_probe.js diff A.html B.html');
    diff(arg[0], arg[1]);
  }
  else {
    /* 사용법은 머리말에 이미 적혀 있다 — 두 벌로 적지 않고 거기서 뽑는다 */
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]
      .split('\n').filter(l => l.includes('node story_probe.js')).join('\n'));
    process.exit(mode ? 2 : 0);
  }
} catch (e) { console.error(e.message); process.exit(2) }
