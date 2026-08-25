#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   story_probe.js — 스토리 판을 들여다보는 자.

     node story_probe.js trace [보스] [방침] [씨앗] [파일]   한 판을 턴별로 훑는다
     node story_probe.js sweep [보스…] [파일]                 병이 노는 구간을 센다
     node story_probe.js diff  A.html B.html                   두 결과물의 판을 견준다

   sim_check 는 판의 '끝' 만 본다 — 몇 턴에 어떤 판정이 났는가. 여기는 '과정' 을 본다.
   비트 이름만으로는 안 보이는 것들이 있다. 「파고든다」라고 적어 놓고 아무 자리도
   안 건드리는 턴이 그렇다 — 비트 앞뒤로 판을 찍어 실제로 바뀌었는지 본다.

   trace  한 판을 턴별로. 왜 이렇게 흘렀는지 눈으로 볼 때
   sweep  여러 판을 몰아. 병이 노는 턴이 얼마나 되는지 셀 때 (악보를 새로 짤 때)
   diff   규칙을 고친 몫을 잴 때. 판정 분포까지 갈라 보여 준다

   떼어 오는 구간은 sim_check 와 같다 — 자름 앵커가 표시한다 (build.js 가 찍는다).
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), vm = require('vm');

const BOSSES = ['아이','어부','송이'], POLS = ['완치','연명','편하게'];
const CAP = 30;                                  // 한 판에서 볼 3막 턴 수

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
   ★ storyPhase 를 그대로 부르지 않고 그 안을 펼쳐 쓴다 — 비트 앞뒤로 판을 찍으려면
     diseaseAct 하나만 따로 감싸야 한다. 시계 처리는 storyPhase 와 같은 순서다. */
const ROWS = `((boss, policy, seed, cap) => {
  const rng = K.mulberry32(seed);
  const board = makeDisease(boss, rng);
  const S = K.newState(board, {}); S.board = board; S.rng = rng;
  C.setupDeck(S, STORY_DECK, K.mulberry32(seed + 1)); S.rng = rng;
  const dis = S.nodes[0];
  const a1 = act1(S, STORY_DECK, {});
  applyPolicy(S, dis, policy, a1.correct);

  /* 비트가 판을 바꿨는가 — 비트 번호는 빼고 본다 (그것만 늘 오른다) */
  const snap = () => JSON.stringify({ hp:S.hp, mind:S.mind, enh:(S.enh||[]).length, n:S.nodes.length,
    dis:[dis.val, dis.stage, dis.stageClock, dis.dead?1:0],
    nodes:S.nodes.filter(x=>x.role!=='disease').map(x=>[x.sym,x.val,x.dead?1:0,x.shielded?1:0,x.evoLeft]) });

  const rows = []; let t = 0;
  while (t < cap) {
    const v = storyVerdict(S, dis, policy);
    if (v) { rows.push({ t:t+1, end:v }); break }
    t++;
    S.played = 0; storyTurn(S, dis, policy);
    const hp0 = S.hp;
    const live = K.active(S).filter(x=>x.role!=='disease').length;
    const neuro = K.active(S).filter(x=>x.role!=='disease' && (x.sym==='통증'||x.sym==='호흡곤란')).length;
    const beat = nextBeat(S, dis), before = snap();
    const line = diseaseAct(S, dis, null);
    const moved = snap() !== before;
    dis.stageClock--;
    let up = null;
    if (dis.stageClock <= 0) { if (stageUp(S, dis)) up = dis.stage; else dis.stageClock = SR.STAGE_TURNS }
    C.endTurnHand(S); K.turnResolve(S); storyTick(S);
    rows.push({ t, stage:dis.stage, clock:dis.stageClock, beat, line, moved, live, neuro, up,
                liveAfter:K.active(S).filter(x=>x.role!=='disease').length,
                dmg:hp0-S.hp, hp:S.hp, disVal:dis.val });
  }
  return rows;
})`;

const seedList = n => { const a = []; for (let i = 0; i < n; i++) a.push(1000 + i * 37); return a };

/* ── trace ── 한 판을 턴별로 ── */
function trace(boss, pol, seed, file){
  const rows = load(file)(ROWS)(boss, pol, seed, CAP);
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
  const run = load(file)(ROWS);
  const seeds = seedList(40);
  const miss = {}, idleRun = {}, win = [];
  for (const boss of bosses) for (const pol of POLS) for (const seed of seeds) {
    const rows = run(boss, pol, seed, CAP);
    let streak = 0;
    rows.forEach((r, i) => {
      if (r.end) return;
      if (!r.moved && r.live > 0 && r.beat !== '같은 박자') {      // 「같은 박자」는 설계상 쉼이다
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

/* ── diff ── 규칙을 고친 몫을 잰다 ──
   sim_check 의 견주기는 스토리를 9판만 본다. 밸런스가 얼마나 움직였는지는 그것으로 안 나온다. */
function diff(a, b){
  const RUN = `((boss, pol, seed) => { const r = runStory(boss, C.DECK_D2, seed, pol, {});
                                       return r.out + '/' + r.turns + '/' + r.stage })`;
  const A = load(a)(RUN), B = load(b)(RUN);
  const seeds = seedList(40);
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
const [mode, ...rest] = process.argv.slice(2);
try {
  if (mode === 'trace') trace(rest[0] || '아이', rest[1] || '완치', +(rest[2] || 777), rest[3] || 'intern_sim.html');
  else if (mode === 'sweep') sweep((rest[0] || BOSSES.join(',')).split(','), rest[1] || 'intern_sim.html');
  else if (mode === 'diff') {
    if (!rest[1]) { console.error('두 파일을 넘긴다 — node story_probe.js diff A.html B.html'); process.exit(2) }
    diff(rest[0], rest[1]);
  }
  else {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('\n').slice(2, 9).join('\n'));
    process.exit(mode ? 2 : 0);
  }
} catch (e) { console.error(e.message); process.exit(2) }
