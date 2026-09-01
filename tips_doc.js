#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   tips_doc.js — docs/툴팁.md 를 소스에서 뽑아 짓는다.

     node tips_doc.js

   문안을 문서에 손으로 옮겨 적으면 그 순간부터 문서만 옛 문안을 말한다.
   이 저장소가 「값을 두 벌로 적지 않는다」로 겪은 것과 같은 자리다 —
   그래서 문서 쪽을 소스에서 잘라 온다. 문안을 고쳤으면 이것을 다시 돌린다.
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');

const SRC = {};
for (const f of ['src/60-text/keywords.js', 'src/70-ui/stage-node.js',
                 'src/70-ui/stage.js', 'src/70-ui/tooltip.js', 'src/70-ui/board-view.js'])
  SRC[f] = fs.readFileSync(f, 'utf8');

/* 소스에서 한 덩이를 잘라 온다. 못 찾으면 조용히 넘어가지 않는다 —
   함수 이름이 바뀌면 문서에 빈 칸이 생기는 것보다 여기서 서는 편이 낫다 */
function block(f, from, to) {
  const t = SRC[f], i = t.indexOf(from);
  if (i < 0) throw new Error(`${f} 에서 「${from}」 를 못 찾았다`);
  const j = t.indexOf(to, i + from.length);
  if (j < 0) throw new Error(`${f} 에서 「${to}」 를 못 찾았다`);
  return t.slice(i, j).replace(/\s+$/, '');
}
/* const 이름 = { … } 를 짝 맞는 괄호까지 */
function table(f, name) {
  const t = SRC[f], i = t.indexOf(`const ${name} = {`);
  if (i < 0) throw new Error(`${f} 에 ${name} 이 없다`);
  let d = 0, k = i;
  for (;; k++) {
    if (t[k] === '{') d++;
    else if (t[k] === '}' && --d === 0) break;
  }
  return t.slice(i, k + 1);
}
const js = s => '```js\n' + s + '\n```\n';

const out = [];
const w = s => out.push(s);

w(`# 전투 화면 툴팁 문안

무대(전투 화면)에서 마우스를 올리면 뜨는 글을 한자리에 모았다.
**이 문서는 소스에서 뽑아 짓는다** (\`node tips_doc.js\`). 고칠 곳은 여기가 아니라
아래에 적힌 소스이고, 고친 뒤 이 명령을 다시 돌리면 문서가 따라온다.

## 고치기 전에 읽을 것

- **규칙값을 글자로 박지 않는다.** 덮어쓰기 칸(\`80-tools/override.js\`)이 \`R\` · \`SR\` 을
  바꾸므로 「50%」라고 적어 두면 그 순간부터 그 설명만 옛 값을 말한다.
  \`\${pctOf(R.KILL_LINE)}\` 처럼 손잡이에서 읽어 온다. 실제로 \`policyTip\` 의
  「50% · 20% · 1.5 − 0.6 = 0.9」와 처치선 설명의 「5%p」가 그렇게 거짓말을 했다.
- **\`TT(제목, 본문)\`** 이 한 벌이다. 제목은 굵은 머리줄로, 본문은 그 아래로 뜬다.
- 줄바꿈 \`<br>\` · 강조 \`<b>\` · 흐린 글 \`<span class="d">\` · 표 \`<table>\`.
- 값이 바뀌는 문안은 \`get '이름'(){ return TT(…) }\` 로 적는다. 그냥 \`'이름': TT(…)\` 로
  적으면 파일을 읽는 그 순간의 값이 굳는다.
- 고친 뒤 \`node build.js && node stage_check.js\` — 칩과 딱지와 배선 메달이
  **전부** 설명을 달고 있는지 검사기가 본다.

---

## 어디에 무엇이 뜨는가

| 뜨는 자리 | 문안 제목 | 소스 |
|---|---|---|
| 환자칸 · 체력 막대 | \`환자 체력\` | \`70-ui/board-view.js\` · \`hpTipBody\` |
| 환자칸 · 정신 | \`정신 · {상태}\` | \`70-ui/board-view.js\` · \`mindTipBody\` |
| 의사 패널 · 기세 | \`기세 · 외과\` | \`KWTIP['기세']\` |
| 의사 패널 · 관해도 | \`관해도 · 내과\` | \`KWTIP['관해도']\` |
| 계기 · 시약관 — **0회차** | \`진단 · 전 분과\` | \`KWTIP['진단']\` + \`badgeSVG\` 꼬리 |
| 계기 · 시약관 — **1회차 이상** | \`재진 · 내과\` | \`KWTIP['재진']\` + 같은 꼬리 |
| 계기 · 문자판 서리 테 | \`보호막\` | \`stage-node.js\` · \`dialSVG\` |
| 계기 · 진화 시계 | \`진화까지\` / \`진화함\` | \`stage-node.js\` · \`badgeSVG\` (+ \`EVOTXT_F\`) |
| 계기 · 설치통 | \`설치물\` | \`stage-node.js\` · \`badgeSVG\` |
| 병 노드 · 병기 링 · 병기 판 | \`병기\` | \`stage-node.js\` · \`badgeSVG\` |
| 병 노드 · 다음 박자 | 박자 이름 | \`BEATTIP\` · \`UNIQTIP\` |
| 계기 아래 · 의도 칩 | \`{한 일}\` + 증상 설명 | \`stage-node.js\` · \`chipHTML\` → \`SYMTIP\` · \`KWTIP\` |
| 계기 아래 · 딱지 | 무적 · 약화 · 지연 · 성장 정지 · 반응 강등 · 만성 · 잠잠 | \`stage-node.js\` · \`standingMarks\` |
| 배선 메달 | 배선 종류 + \`{A} 처치 시 → {B}\` | \`LINKTIP\` |
| 차트 · 체력 태그 | \`{태그}\` | \`stage.js\` · \`stageChart\` |
| 차트 · 방침 | \`{방침}\` | \`tooltip.js\` · \`policyTip\` |
| 손패 카드 안의 키워드 | 키워드 설명 | \`KWTIP\` |

**진단은 두 벌이다.** 아직 한 번도 안 연 자리의 시약관에는 \`KWTIP['진단']\`(1회차)만
뜬다. 한 번이라도 연 자리(\`diagRound >= 1\`)와 카드의 \`재진\` 키워드에는
\`KWTIP['재진']\`(2회차 이상)이 뜬다. 한 벌로 두면 아직 할 수 없는 일을 먼저 읽게 된다.

---
`);

w('## 1. 키워드 — `src/60-text/keywords.js` · `KWTIP`\n');
w('카드 본문의 밑줄 친 키워드, 의사 패널, 계기 딱지가 함께 쓴다.\n');
w(js(table('src/60-text/keywords.js', 'KWTIP')));

w('## 2. 증상 — `src/60-text/keywords.js` · `SYMTIP`\n');
w('의도 칩(성장 · 공격 · 안정화 ÷ · 처치선 × · 드로우 −)에 붙는다.\n');
w(js(table('src/60-text/keywords.js', 'SYMTIP')));

w('## 3. 배선 — `src/60-text/keywords.js` · `LINKTIP`\n');
w('배선 메달에 뜬다. 꼬리로 `{A} 처치 시 → {B}` 가 붙는다 (`stage-node.js` · `stageLinks`).\n');
w(js(table('src/60-text/keywords.js', 'LINKTIP')));

w('## 4. 병 노드의 박자 — `BEATTIP` · `UNIQTIP`\n');
w('병기 링 꼭대기의 「다음 박자」 그림에 뜬다. `고유` 는 보스 · 병기별로 `UNIQTIP` 이 대신한다.\n');
w(js(table('src/60-text/keywords.js', 'BEATTIP')));
w(js(table('src/60-text/keywords.js', 'UNIQTIP')));

w('## 5. 환자 체력 · 정신 — `src/70-ui/board-view.js`\n');
w('환자칸의 체력 막대와 정신 줄이 쓴다. **작업대도 같은 함수를 쓴다** — 여기를 고치면 둘 다 바뀐다.\n');
w(js(block('src/70-ui/board-view.js', 'function mindTipBody', '\n\n/*')));

w('## 6. 방침 — `src/70-ui/tooltip.js` · `policyTip`\n');
w('차트의 「방침」 줄과 3막 방침 고르기 칸이 쓴다.\n');
w(js(block('src/70-ui/tooltip.js', '/* ── 방침 ── */', '\nfunction markKw')));

w('## 7. 계기에 직접 붙은 것 — `src/70-ui/stage-node.js`\n');
w('키워드표에 없는, 무대에서만 쓰는 문안이다.\n');
w('### 7.1 딱지 일곱 — `standingMarks`\n');
w(js(block('src/70-ui/stage-node.js', 'function standingMarks', '\n\n/* ── 문자판')));
w('### 7.2 배지 — 진단 · 진화 · 설치물 · 병기 · 다음 박자 — `badgeSVG`\n');
w(js(block('src/70-ui/stage-node.js', '//@ 무대.배지', '\n/* 파이 조각의 끝점')));
w('### 7.3 보호막 서리 테 — `dialSVG`\n');
w(js(block('src/70-ui/stage-node.js', '  /* ── 보호막 ── 문자판 가장자리', '\n  /* ── 이름 ──')));

fs.mkdirSync('docs', { recursive: true });
const md = out.join('\n');
fs.writeFileSync(path.join('docs', '툴팁.md'), md);
console.log(`docs/툴팁.md — ${md.split('\n').length}줄 · ${Buffer.byteLength(md)}바이트`);
