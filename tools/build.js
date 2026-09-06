#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   build.js — src/ 의 층을 순서대로 이어 붙여 intern_sim.html 한 장을 뽑는다.

     node build.js            → intern_sim.html
     node build.js --check    → 뽑지 않고 순서·중복·문법만 본다

   층은 아래 ORDER 의 순서가 곧 적재 순서다. 번호가 곧 순서이므로
   파일을 새로 만들면 번호만 맞춰 ORDER 에 한 줄 넣으면 된다.

   §1~§8 (10~50) 은 화면을 한 번도 쓰지 않는다. sim_check.js 가 이 구간을
   그대로 떼어 node 에서 돌린다. 구간 경계는 자름 앵커가 표시한다 —
   그 앵커는 이 파일이 찍으므로 src/ 안에서 찾지 않는다.
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');

/* 적재 순서. 앞의 것이 뒤의 것보다 먼저 평가된다.
   const 는 끌어올려지지 않으므로 (TDZ) — 값이 값을 참조하면 순서가 곧 규칙이다. */
const ORDER = [
  /* ── 수치 ── 규칙을 의심하면 여기부터 본다. 숫자만 있고 함수가 없다 ── */
  'src/10-config/version.js',
  'src/10-config/rules.js',
  'src/10-config/symptoms.js',
  'src/10-config/levels.js',
  'src/10-config/story-rules.js',      // SR.DIS_BASE 가 LVTAB 을 읽는다 — 증상표 뒤여야 한다
  'src/10-config/session.js',
  'src/10-config/ai-weights.js',
  /* ── 데이터 ── 카드·환자·보스 표. 규칙이 아니라 내용물이다 ── */
  'src/20-data/cards.js',
  'src/20-data/decks.js',
  'src/20-data/patients.js',
  'src/20-data/bosses.js',
  /* ── 로직 ── 화면을 모른다 ── */
  'src/30-core/kernel.js',
  'src/30-core/generator.js',
  'src/30-core/card-rules.js',
  'src/30-core/patients.js',
  'src/30-core/session.js',
  'src/30-core/story.js',
  /* ── 자동 진행 ── */
  'src/40-ai/beam.js',
  'src/40-ai/heuristic.js',
  /* ── 배선 ── 층 사이 참조를 잇는다 ── */
  'src/50-wire.js',
  /* ── 문안 ── 사람이 읽는 글. 여기부터 화면이다 ── */
  'src/60-text/keywords.js',
  'src/60-text/rule-doc.js',
  'src/60-text/patch-notes.js',
  /* ── 화면 ── */
  'src/70-ui/globals.js',
  'src/70-ui/tooltip.js',
  'src/70-ui/say.js',
  'src/70-ui/card-view.js',
  'src/70-ui/board-view.js',
  'src/70-ui/hand.js',
  'src/70-ui/deck-ui.js',
  'src/70-ui/pile-ui.js',
  'src/70-ui/pack-ui.js',
  'src/70-ui/one.js',
  'src/70-ui/story-ui.js',
  'src/70-ui/session-ui.js',
  'src/70-ui/undo.js',
  'src/70-ui/mode.js',
  'src/70-ui/patch-ui.js',
  /* ── 무대 ── 전투 화면. 규칙을 모르고 커널이 낸 값을 그리기만 한다 ── */
  'src/70-ui/fx.js',
  'src/70-ui/stage-node.js',
  'src/70-ui/stage.js',
  'src/70-ui/stage-overlay.js',
  /* ── 도구 ── 밸런싱용. 게임 규칙이 아니다 ── */
  'src/80-tools/override.js',
  'src/80-tools/batch.js',
  'src/80-tools/make.js',
  'src/80-tools/score.js',      // CUSTOM 을 읽는다 — make.js 뒤여야 한다
  /* ── 부팅 ── 반드시 마지막 ── */
  'src/90-boot.js',
];

/* 자름 앵커 — 이 파일 다음에 앵커를 찍는다 (sim_check.js 가 여기를 본다) */
const CUT_AFTER = { 'src/40-ai/heuristic.js': '//@ 자름.커널끝 — 여기까지가 화면 없이 도는 부분' };
const CUT_BEFORE = {
  'src/10-config/rules.js': '//@ 자름.커널시작 — 점검 스크립트가 여기서부터 잘라 간다',
  'src/50-wire.js':         '//@ 자름.배선시작 — 점검 스크립트가 이 블록을 붙여 쓴다',
  'src/60-text/keywords.js':'//@ 자름.배선끝 — 문서를 열면 여기서 시작한다',
};

const HEADER = `/* ${'═'.repeat(72)}
   INTERN 전투 시뮬레이터 — build.js 가 src/ 에서 이어 붙인 결과물이다.
   이 파일을 직접 고치지 않는다. 고칠 곳은 src/ 아래이고, 층 설명은 docs/구조.md 에 있다.
   ${'═'.repeat(72)} */`;

/* ── 지우개 ── 사람이 읽는 글은 src/ 에 있고 이 파일은 실행되기만 한다.
   판마다 src/ 의 주석을 고쳐도 결과물이 안 흔들리는 부수 효과도 있다.

   //@ 표지는 남긴다. 둘 다 부품이다:
     · 자름 앵커 넷 — sim_check.js 와 story_probe.js 가 여기를 잘라 화면 없이 돌린다.
       지우면 「앵커 '//@ 자름.커널시작' 가 없다」로 검사기가 통째로 죽는다.
     · 파일 표지 — 결과물의 줄 번호를 src 파일로 되짚는 유일한 끈이다
       (브라우저 오류는 이 파일의 줄 번호로 뜬다).

   줄이 통째로 주석인 것만 걷는다. 꼬리 주석(`const x = 1;  // 설명`)은 놔둔다 —
   그것까지 걷으려면 문자열·정규식 안인지 가려야 하는데, 얻는 몇 KB 에 비해
   조용히 깨질 위험이 크다. src/ 안에 '템플릿 문자열 안에서 줄이 // 나 /* 로 시작하는'
   자리가 하나도 없음을 확인했으므로 줄 단위는 안전하다. */
function stripJS(js){
  const out = []; let inB = false;
  for (const L of js.split('\n')) {
    const t = L.trim();
    if (inB) { if (t.includes('*/')) inB = false; continue }
    if (t.startsWith('//@')) { out.push(L); continue }
    if (t.startsWith('/*')) { if (!t.includes('*/')) inB = true; continue }
    if (t.startsWith('//')) continue;
    out.push(L);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}
const stripCSS  = c => c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n');
const stripHTML = h => h.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n');

const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/\n+$/, '');

/* 판본은 src/10-config/version.js 한 곳에만 적는다.
   껍데기(HTML)는 JS 를 못 부르므로 여기서 갈아 넣는다. */
const VERSION = (read('src/10-config/version.js').match(/const VERSION\s*=\s*'([^']+)'/) || [])[1];
if (!VERSION) { console.error('src/10-config/version.js 에서 판본을 못 읽었다'); process.exit(1) }
const stamp = t => t.replace(/\{\{VERSION\}\}/g, VERSION);

/* ── 점검 ── */
const problems = [];
const seen = new Set();
for (const f of ORDER) {
  if (seen.has(f)) problems.push(`ORDER 에 두 번 나온다: ${f}`);
  seen.add(f);
  if (!fs.existsSync(path.join(__dirname, f))) problems.push(`파일이 없다: ${f}`);
}
/* src/ 안에 있는데 ORDER 에 없는 .js 는 조용히 빠지므로 잡아 준다 */
const walk = d => fs.readdirSync(path.join(__dirname, d), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name))
                                : (e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
for (const f of walk('src')) if (!seen.has(f)) problems.push(`ORDER 에 없다: ${f}`);
if (problems.length) { console.error('=== 문제 ===\n' + problems.join('\n')); process.exit(1) }

/* ── 조립 ── */
const chunks = [HEADER];
for (const f of ORDER) {
  if (CUT_BEFORE[f]) chunks.push(CUT_BEFORE[f]);
  chunks.push(`//@ 파일.${f.replace(/^src\//, '').replace(/\.js$/, '')}`);
  chunks.push(read(f));
  if (CUT_AFTER[f]) chunks.push(CUT_AFTER[f]);
}
const js = stripJS(chunks.join('\n\n')) + '\n';

/* 껍데기 조각. 작업대와 무대를 따로 적고 여기서 이어 붙인다 */
const CSS  = ['src/00-shell/style.css', 'src/00-shell/stage.css'];
const BODY = ['src/00-shell/body.html', 'src/00-shell/stage.html'];

const html = [
  stripHTML(stamp(read('src/00-shell/head.html'))),
  stripCSS(CSS.map(read).join('\n')),
  '</style></head><body>',
  stripHTML(BODY.map(f=>stamp(read(f))).join('\n')),
  '<script>',
  js + '</script></body></html>',
].join('\n');

/* 문법 확인 — 뽑기 전에 판정한다 */
try { new (require('vm').Script)(js, { filename: 'bundle.js' }) }
catch (e) { console.error('문법 오류:', e.message); process.exit(1) }

/* ── 부르는 데 없는 이름 ──────────────────────────────────────
   층을 갈아 끼울 때 옛 함수가 조용히 남는다. 문법도 맞고 검사기도 다 통과하니
   아무도 안 걸린다. 실제로 둘이 남아 있었다 — 계기판을 다시 짜며 시약관 배지가
   대신한 `diagRing`, 차트를 네 구역으로 다시 짜며 **줄 자체가 빠진** `chiefOf`.
   뒤엣것은 죽은 코드가 아니라 잃어버린 화면이었다 (CHIEF · CHIEF_BY_SYM 두 표가
   같이 놀고 있었다). 그래서 이 검사는 청소가 아니라 회귀 잡이다.

   껍데기(HTML)까지 같이 훑는다 — onclick 으로만 불리는 이름이 많다.
   `$` 는 낱말 경계가 안 잡혀서 늘 걸린다. 셈에서 뺀다. */
{
  const whole = html, orphan = [];
  const names = new Set();
  for (const m of js.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of js.matchAll(/^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/gm)) names.add(m[1]);
  for (const n of names) {
    if (n === '$') continue;
    const re = new RegExp('\\b' + n.replace(/\$/g, '\\$') + '\\b', 'g');
    if ((whole.match(re) || []).length <= 1) orphan.push(n);
  }
  if (orphan.length) {
    console.error('=== 부르는 데 없는 이름 ' + orphan.length + ' ===\n  ' + orphan.sort().join('\n  ')
      + '\n걷을 것인지, 부르던 자리가 사라진 것인지 먼저 답할 수 있어야 한다.');
    process.exit(1);
  }
}

/* 결과물은 저장소 루트에 둔다 — tools/ 아래는 그것을 만드는 쪽이고,
   루트에 있는 파일이 곧 열어 보는 것이다.
   --out 은 lab/patch.js 가 쓴다. 판본을 제 딸린 칸에 뽑아야 하는데
   기본값(한 층 위)을 그대로 두면 판본들이 서로를 덮어쓴다. */
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx >= 0 && process.argv[outIdx + 1]
  ? path.resolve(process.argv[outIdx + 1])
  : path.join(__dirname, '..', 'intern_sim.html');

if (process.argv.includes('--check')) {
  console.log(`점검 통과 — 층 ${ORDER.length}개 · JS ${js.split('\n').length}줄`);
} else {
  fs.writeFileSync(OUT, html);
  console.log(`${path.relative(process.cwd(), OUT) || OUT} ${VERSION} — ${html.split('\n').length}줄 (JS ${js.split('\n').length}줄, 층 ${ORDER.length}개)`);
}
