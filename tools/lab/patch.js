#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   lab/patch.js — src/ 를 건드리지 않고 판본을 뽑는다.

     node lab/patch.js               → 정의된 판본을 전부 뽑는다
     node lab/patch.js A AB          → 고른 판본만 뽑는다
     node lab/patch.js --list        → 판본 목록

   하는 일: src/ 와 build.js 를 lab/build/<판본>/ 에 통째로 복사하고,
   복사본에만 문자열 치환을 걸고, 그 자리에서 build.js 를 돌려
   lab/out/<판본>.html 을 뽑는다. 원본 src/ 는 한 글자도 바뀌지 않는다.

   치환은 전부 「이 문장이 딱 한 번 있어야 한다」를 확인하고 건다.
   원본이 움직이면 조용히 빗나가지 않고 그 자리에서 멈춘다.
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(__dirname, 'build');
const OUT   = path.join(__dirname, 'out');

/* ── 치환 도구 ── */
function edit(dir, file, find, replace, opt = {}) {
  const p = path.join(dir, file);
  const t = fs.readFileSync(p, 'utf8');
  const n = t.split(find).length - 1;
  const want = opt.count || 1;
  if (n !== want) throw new Error(`${file}: 「${find.slice(0, 60).replace(/\n/g, '⏎')}…」 가 ${n}번 (${want}번이어야 한다)`);
  fs.writeFileSync(p, t.split(find).join(replace));
}

/* ══════════════════════════════════════════════════════════════════
   손잡이 — 지금 src/ 가 기준선(A + B 반영본)이다.

   A 확정본과 B 는 2026-09-02 에 src/ 로 옮겼다. 그 치환문들은 원본이
   이미 바뀌어 더는 걸리지 않으므로 여기서 걷어냈다 — 어떤 치환이었는지는
   그 커밋의 diff 가 유일한 기록이다. 여기 남은 것은 아직 안 정한 손잡이,
   곧 §E 의 후퇴선 둘이다.
   ══════════════════════════════════════════════════════════════════ */

/* 노동자·군인 체격 — 200 이 기준선. 최종 병기 중에는 어부만 이 값을 본다 */
function workerHp(d, v){
  edit(d, 'src/10-config/levels.js',
    `const BODY_HP = { '소아':120, '성인':170, '노동자':200, '군인':200 };`,
    `const BODY_HP = { '소아':120, '성인':170, '노동자':${v}, '군인':${v} };`);
}

/* 비공격 넷의 진화 즉발 — 24 가 기준선. 어부·송이 피해의 전부가 이 값에서 나온다 */
function evoFlat(d, v){
  edit(d, 'src/10-config/rules.js',
    `EVO_HIT: {발열:20, 출혈:36, 감염:24, 탈수:24, 통증:24, 호흡곤란:24},`,
    `EVO_HIT: {발열:20, 출혈:36, 감염:${v}, 탈수:${v}, 통증:${v}, 호흡곤란:${v}},`);
}

/* ══════════════════════════════════════════════════════════════════
   판본 목록
   ══════════════════════════════════════════════════════════════════ */
const VARIANTS = {
  base: { desc: '지금 src/ — A + B 반영본. 후퇴선 비교의 기준선', apply: () => {} },
  /* §E 후퇴선 ㄱ — 어부만 건드린다. 송이·아이 부수 피해 0 */
  '노동자190': { desc: '노동자 체격 200 → 190', apply: d => workerHp(d, 190) },
  '노동자170': { desc: '노동자 체격 200 → 170', apply: d => workerHp(d, 170) },
  /* §E 후퇴선 ㄴ — 어부에 잘 듣지만 송이까지 함께 조인다 */
  '즉발27':    { desc: '비공격 즉발 24 → 27',   apply: d => evoFlat(d, 27) },
  '즉발30':    { desc: '비공격 즉발 24 → 30',   apply: d => evoFlat(d, 30) },
};


/* ── 뽑기 ── */
function make(name) {
  const v = VARIANTS[name];
  if (!v) throw new Error(`모르는 판본: ${name}`);
  const d = path.join(BUILD, name);
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
  fs.cpSync(path.join(ROOT, 'src'), path.join(d, 'src'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'build.js'), path.join(d, 'build.js'));
  v.apply(d);
  /* --out 을 안 주면 build.js 가 한 층 위(lab/build/)에 뽑아 판본끼리 서로를 덮는다 */
  const r = cp.spawnSync('node', ['build.js', '--out', 'intern_sim.html'], { cwd: d, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${name} 조립 실패:\n${r.stdout}${r.stderr}`);
  fs.mkdirSync(OUT, { recursive: true });
  const dst = path.join(OUT, `${name}.html`);
  fs.copyFileSync(path.join(d, 'intern_sim.html'), dst);
  console.log(`  ${name.padEnd(14)} ${v.desc}`);
  return dst;
}

if (require.main === module) {
  const arg = process.argv.slice(2);
  if (arg[0] === '--list') { for (const k in VARIANTS) console.log(`  ${k.padEnd(14)} ${VARIANTS[k].desc}`); process.exit(0) }
  const names = arg.length ? arg : Object.keys(VARIANTS);
  for (const n of names) make(n);
}
module.exports = { VARIANTS, make, OUT, edit };
