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
   A — 확정본
   ══════════════════════════════════════════════════════════════════ */
function patchA(d, o = {}) {
  const 노동자 = o.workerHp || 200;
  const 비공격 = o.evoFlatNonAtk || 24;

  /* ── A-1 레벨표 — 체력 열을 걷고 진화 카운터를 일괄 +1 ── */
  edit(d, 'src/10-config/symptoms.js',
`  1:{n:[1,1], main:'I',  sub:null,  atkCap:1, basic:[0,0], enh:[0,0], evo:6, shield:'none', hp:100, dis:40},
  2:{n:[2,2], main:'II', sub:'I',   atkCap:1, basic:[1,1], enh:[0,0], evo:5, shield:'one',  hp:180, dis:75},
  3:{n:[2,3], main:'III',sub:'II',  atkCap:2, basic:[1,2], enh:[0,1], evo:4, shield:'all',  hp:280, dis:120},
  4:{n:[3,4], main:'IV', sub:'II',  atkCap:2, basic:[2,3], enh:[1,2], evo:3, shield:'all',  hp:400, dis:180},
  5:{n:[4,5], main:'V',  sub:'III', atkCap:3, basic:[3,4], enh:[2,3], evo:3, shield:'all',  hp:550, dis:250},`,
`  /* v26 — 체력 열을 걷었다. 환자 체력은 병의 난이도가 아니라 몸(체격)에서 나온다.
     BODY_HP(10-config/levels.js)를 본다. 진화 카운터는 전 레벨 일괄 +1 —
     SW.evoRef 도 6→7 로 함께 밀었다. 둘은 한 몸이다. */
  1:{n:[1,1], main:'I',  sub:null,  atkCap:1, basic:[0,0], enh:[0,0], evo:7, shield:'none', dis:40},
  2:{n:[2,2], main:'II', sub:'I',   atkCap:1, basic:[1,1], enh:[0,0], evo:6, shield:'one',  dis:75},
  3:{n:[2,3], main:'III',sub:'II',  atkCap:2, basic:[1,2], enh:[0,1], evo:5, shield:'all',  dis:120},
  4:{n:[3,4], main:'IV', sub:'II',  atkCap:2, basic:[2,3], enh:[1,2], evo:4, shield:'all',  dis:180},
  5:{n:[4,5], main:'V',  sub:'III', atkCap:3, basic:[3,4], enh:[2,3], evo:4, shield:'all',  dis:250},`);

  /* ── A-2 체격표 + 체력 태그 ── */
  edit(d, 'src/10-config/levels.js',
`const HP_TAG = {
  '노인':0.8, '소아':0.8, '영양실조':0.85, '굶주림':0.85, '만성기저질환':0.85,
  '재진악화':0.9, '공황시작':0.9, 'T3이식다수':0.9,
  '노동자':1.15, '군인':1.15, '상층':1.1,
};`,
`/* ── 체격 (v26) ─────────────────────────────────────────────
   환자 체력의 출발점. 레벨표가 아니라 몸이 정한다.
   체격 태그는 곱하는 값이 아니라 '어느 체격을 볼지 고르는' 값이다.
   태그에 체격 항목이 없으면 성인으로 본다 — 노인·상층이 그 경우다.
   ★ 노인은 두 곳에 다 든다: 체격은 성인(170)을 보고, 아래 체력 태그 ×0.85 를 받는다.
     소아 체격(120)으로 보내면 원래보다 지나치게 얇아진다. */
//@ 생성기.체격 — 환자 체력의 출발점. 태그가 어느 체격을 볼지 고른다
const BODY_HP = { '소아':120, '성인':170, '노동자':${노동자}, '군인':${노동자} };
const BODY_DEF = '성인';
const bodyHp = tags => {
  for(const t of (tags||[])) if(BODY_HP[t]!==undefined) return BODY_HP[t];
  return BODY_HP[BODY_DEF];
};

/* ── 체력 태그 — 체격을 고른 뒤에 곱한다. 전부 ×0.85 하나로 통일했다.
   한 환자에 둘까지 붙으므로 가장 얇아져도 0.7225 다.
   체격이 태그에서 빠졌으니 예전의 세 겹 누적(0.578)은 나올 수 없다. */
const HP_TAG = {
  '영양실조':0.85, '굶주림':0.85, '만성기저질환':0.85,
  '재진악화':0.85, '공황시작':0.85, 'T3이식다수':0.85, '노인':0.85,
};

/* 아는 태그 — 체격을 고르는 것과 체력을 곱하는 것을 합친 것.
   상층은 둘 다 아니다(성인 체격 · 곱 없음). 그래도 아는 태그다. */
const TAG_KNOWN = new Set([...Object.keys(BODY_HP), ...Object.keys(HP_TAG), '상층']);

/* 태그 목록에서 최종 체력을 낸다 — 생성기와 보스 표가 같은 자를 쓴다 */
const hpOfTags = tags => {
  let hp = bodyHp(tags);
  for(const t of (tags||[])){
    if(!TAG_KNOWN.has(t)) throw new Error('모르는 체력 태그: '+t);
    hp = Math.round(hp * (HP_TAG[t]||1));
  }
  return hp;
};`);

  /* ── A-3 S 산식 기준값 — 진화 +1 과 한 몸이다 ── */
  edit(d, 'src/10-config/levels.js',
`  evoRef: 6,      // 진화까지의 턴은 이 값에서 뺀 만큼 얹는다 (빠를수록 어렵다)`,
`  evoRef: 7,      // 진화까지의 턴은 이 값에서 뺀 만큼 얹는다 (빠를수록 어렵다)
                  // v26 — 레벨표 evo 를 일괄 +1 했으므로 여기도 +1. 안 밀면 전 레벨 S 가 어긋난다`);

  /* ── A-4 생성기 — 체력을 체격에서 낸다 ── */
  edit(d, 'src/30-core/generator.js',
`  let hp = T.hp;
  for(const t of (opt.tags||[])){
    if(HP_TAG[t]===undefined) throw new Error('모르는 체력 태그: '+t);
    hp = Math.round(hp*HP_TAG[t]);
  }`,
`  const hp = hpOfTags(opt.tags||[]);   // v26 — 레벨표가 아니라 체격표를 본다`);

  /* ── A-5 보스 표 — 같은 자를 쓴다 ── */
  edit(d, 'src/20-data/bosses.js',
`  if(b.hp && typeof b.hp === 'object'){
    let hp = LVTAB[b.hp.lv].hp;
    for(const t of (b.tags||[])) hp = Math.round(hp * (HP_TAG[t]||1));
    b.hp = hp;
  }`,
`  /* v26 — 체력은 레벨(hp.lv)이 아니라 체격 태그가 정한다.
     아이 120(소아) · 어부 ${노동자}(노동자) · 송이 ${Math.round(170*0.85)}(성인 + 영양실조) */
  if(b.hp && typeof b.hp === 'object') b.hp = hpOfTags(b.tags||[]);`);

  /* ── A-6 턴당 피해 · 진화 즉발 피해 ── */
  edit(d, 'src/10-config/rules.js',
`  ATK_K: 0.20,             // 발열·출혈 턴당 피해 = 수치의 20% (올림)
  /* 진화 즉발 피해 = 진화 '시점 수치'의 50%. 여섯 증상 모두 같다.
     순서 = 피해 먼저 → 그 뒤에 진화로 인한 수치 증가 */
  EVO_HIT: {발열:0.50, 출혈:0.50, 감염:0.50, 탈수:0.50, 통증:0.50, 호흡곤란:0.50},`,
`  ATK_K: 0.20,             // 점화(촉발선)만 쓰는 몫. 턴당 피해는 TURN_DMG 로 옮겼다
  /* ── v26 턴당 피해 ─────────────────────────────────────────
     증상마다 '최대 피해'를 정하고, 실제 피해는 지금 얼마나 남았는지로 깎는다.
       실제 피해 = 올림(최대 피해 × 현재 수치 ÷ 초기값)
     살아 있는 자리는 최소 1 은 때린다. 상한은 두지 않는다 —
     수치 상한이 초기값의 3배(VAL_CAP)이므로 출혈은 최대 27 까지 간다.
     넘치는 것은 버그가 아니다. 방치하면 아파진다는 출혈의 결이다.
     감염·탈수·통증·호흡곤란은 0 — 턴당으로는 안 때린다. */
  TURN_DMG: {출혈:9, 발열:5, 감염:0, 탈수:0, 통증:0, 호흡곤란:0},
  TURN_DMG_MIN: 1,         // 최대 피해가 있는 자리는 살아 있는 한 이만큼은 때린다
  /* ── v26 진화 즉발 피해 ────────────────────────────────────
     진화하는 순간 한 번 들어가는 고정값. 수치를 보지 않는다.
     비공격 넷에도 값이 있어야 한다 — 없으면 통증·탈수만 나오는 보스가
     환자를 때릴 길이 하나도 없어진다 (어부·송이가 실제로 그랬다).
     순서 = 피해 먼저 → 그 뒤에 진화로 인한 수치 증가 */
  EVO_HIT: {발열:20, 출혈:36, 감염:${비공격}, 탈수:${비공격}, 통증:${비공격}, 호흡곤란:${비공격}},`);

  /* ── A-7 커널 — 턴당 피해 ── */
  edit(d, 'src/30-core/kernel.js',
`  let dmg = 0;
  if(!S.rem) for(const n of active(S))
    if(n.role!=='disease' && !born(n) && SYM[n.sym].atk) dmg += Math.ceil(n.val*R.ATK_K);`,
`  let dmg = 0;
  if(!S.rem) for(const n of active(S))
    if(n.role!=='disease' && !born(n)) dmg += turnDmg(n);`);

  /* turnDmg 를 커널에 심는다 — hurtPatient 바로 앞이 자리다 */
  edit(d, 'src/30-core/kernel.js',
`function hurtPatient(S, amt){`,
`/* v26 — 자리 하나가 이번 턴에 때리는 몫.
   최대 피해를 '지금 얼마나 남았는지'로 깎는다. 초기값을 되찾으면 최대 피해 그대로,
   수치가 상한(초기값 ×VAL_CAP)까지 부풀면 그 배수만큼 넘어간다 — 상한을 두지 않는다.
   최대 피해가 0 인 증상(감염·탈수·통증·호흡곤란)은 턴당으로는 때리지 않는다. */
//@ 커널.턴피해 — 자리 하나가 이번 턴에 때리는 몫
function turnDmg(n){
  const cap = R.TURN_DMG[n.sym] || 0;
  if(cap<=0 || n.val<=0) return 0;
  return Math.max(R.TURN_DMG_MIN, Math.ceil(cap * n.val / Math.max(1, n.init)));
}

function hurtPatient(S, amt){`);

  /* ── A-8 커널 — 진화 즉발 피해 (비율 → 고정값) ── */
  edit(d, 'src/30-core/kernel.js',
`    hurtPatient(S, Math.ceil(n.val*(R.EVO_HIT[n.sym]||0)*policyDmg(S)));   // 진화 '시점' 수치의 50%`,
`    hurtPatient(S, Math.ceil((R.EVO_HIT[n.sym]||0)*policyDmg(S)));   // v26 — 수치를 보지 않는 고정값`);

  /* ── A-9 자동 진행 — 같은 저울을 보게 한다 ──
     안 고치면 AI 가 init×36 을 진화 피해로 읽어 판단이 통째로 뒤틀린다 */
  edit(d, 'src/40-ai/beam.js',
`    if(K.SYM[n.sym] && K.SYM[n.sym].atk) v -= n.val*R.ATK_K*W.atk;   // 이 자리는 계속 때린다`,
`    v -= K.turnDmg(n)*W.atk;                                        // 이 자리는 계속 때린다`);
  edit(d, 'src/40-ai/beam.js',
`    if(!n.evolved && n.evoLeft<=1) v -= n.init*(R.EVO_HIT[n.sym]||0)*W.evo;`,
`    if(!n.evolved && n.evoLeft<=1) v -= (R.EVO_HIT[n.sym]||0)*W.evo;`);
  edit(d, 'src/40-ai/heuristic.js',
`  if(K.SYM[n.sym].atk) t += n.val*R.ATK_K*3;`,
`  t += K.turnDmg(n)*3;`);
  edit(d, 'src/40-ai/heuristic.js',
`  if(!n.evolved) t += (n.init*(R.EVO_HIT[n.sym]||0))/Math.max(1,n.evoLeft);`,
`  if(!n.evolved) t += (R.EVO_HIT[n.sym]||0)/Math.max(1,n.evoLeft);`);

  /* turnDmg 를 K 에 실어 준다 — 40-ai 는 K 를 통해서만 커널을 본다 */
  edit(d, 'src/50-wire.js', `turnResolve,`, `turnResolve, turnDmg,`);

  /* ── A-10ㄴ 화면의 태그 목록 ──
     단판 태그 칸 · 「환자 만들기」 둘 다 Object.keys(HP_TAG) 를 '태그 전부' 로 읽고 있었다.
     체격을 HP_TAG 에서 빼면 소아·노동자·군인·상층이 화면에서 통째로 사라져
     체격을 고를 길이 없어진다. 목록은 TAG_LIST 가, 표기는 tagLabel 이 낸다. */
  edit(d, 'src/10-config/levels.js',
`const TAG_GROUP = [['노인','소아'], ['노동자','군인','상층']];`,
`const TAG_GROUP = [['노인','소아'], ['노동자','군인','상층']];

/* 화면에 늘어놓는 차례 — 체격을 고르는 것이 먼저, 곱하는 것이 뒤 */
const TAG_LIST = () => [...Object.keys(BODY_HP).filter(t=>t!=='성인'), '상층', ...Object.keys(HP_TAG)]
  .filter((t,i,a)=>a.indexOf(t)===i);
/* 그 태그가 무엇을 하는가 — 체격을 고르는 것과 곱하는 것을 한 줄로 적는다 */
const tagLabel = t => (BODY_HP[t]!==undefined ? '체격 '+BODY_HP[t] : '')
  + (BODY_HP[t]!==undefined && HP_TAG[t] ? ' · ' : '')
  + (HP_TAG[t] ? '×'+HP_TAG[t] : '')
  || '체격 '+BODY_HP[BODY_DEF];`);

  edit(d, 'src/70-ui/one.js',
`  box.innerHTML = Object.keys(HP_TAG).map(t =>
    \`<label><input type="checkbox" class="tag" value="\${t}" onchange="tagPick('\${t}')">\${t} <span class="d">×\${HP_TAG[t]}</span></label>\`).join('');`,
`  box.innerHTML = TAG_LIST().map(t =>
    \`<label><input type="checkbox" class="tag" value="\${t}" onchange="tagPick('\${t}')">\${t} <span class="d">\${tagLabel(t)}</span></label>\`).join('');`);

  edit(d, 'src/80-tools/make.js',
`\${Object.keys(HP_TAG).map(t=>\`<label><input type="checkbox" \${CUSTOM.tags.includes(t)?'checked':''} onchange="mkToggleTag('\${t}')">\${t} <span class="d">×\${HP_TAG[t]}</span></label>\`).join('')}`,
`\${TAG_LIST().map(t=>\`<label><input type="checkbox" \${CUSTOM.tags.includes(t)?'checked':''} onchange="mkToggleTag('\${t}')">\${t} <span class="d">\${tagLabel(t)}</span></label>\`).join('')}`);

  /* 판 위 툴팁 — LVTAB[lv].hp 를 읽던 줄. 그 열이 없어져 'undefined' 가 뜬다 */
  edit(d, 'src/70-ui/board-view.js',
`    ? tip(TT('체력 태그', (BOARD.tags||[]).map(t=>\`\${t} <b>×\${HP_TAG[t]}</b>\`).join('<br>')
        + \`<br><br>기본 체력 \${LVTAB[BOARD.level]?LVTAB[BOARD.level].hp:'—'} 에 곱연산으로 걸린다.\`)) : '';`,
`    ? tip(TT('체력 태그', (BOARD.tags||[]).map(t=>\`\${t} <b>\${tagLabel(t)}</b>\`).join('<br>')
        + \`<br><br>체격 \${bodyHp(BOARD.tags||[])} 에서 출발해 곱연산으로 걸린다.\`)) : '';`);

  /* ── A-10 화면 문안 — 걷어낸 비율을 그대로 말하지 않게 ── */
  edit(d, 'src/70-ui/board-view.js',
'진화하는 턴에 <b>진화 시점 수치의 ${pctOf(R.EVO_HIT[n.sym]||0)}</b>가 즉시 환자에게 들어간다. 피해가 먼저, 수치 증가는 그 뒤다.<br>지금 진화하면 −${Math.ceil(n.val*(R.EVO_HIT[n.sym]||0))}.',
'진화하는 턴에 <b>${R.EVO_HIT[n.sym]||0}</b>이 즉시 환자에게 들어간다. 수치를 보지 않는 고정값이다. 피해가 먼저, 수치 증가는 그 뒤다.');
}

/* ══════════════════════════════════════════════════════════════════
   B — 자리 진화 카운터를 손잡이에 잇는다
   ══════════════════════════════════════════════════════════════════ */
function patchB(d) {
  /* ── B-1 공용 자 — 보스별 진화 레벨 → 레벨표 → 증상 보정 ── */
  edit(d, 'src/30-core/story.js',
`//@ 스토리.병노드 — 병 노드를 세운다
function mkSpot(sym, init, turn){`,
`/* v26 — 자리가 태어날 때 진화 카운터를 어디서 받는가.
   전에는 경로마다 달랐다: 명부가 있는 보스는 레벨표에서 읽고(laySpot),
   명부가 없는 보스(어부·송이)는 4 가 손으로 박혀 있었다. 그래서 어부·송이는
   진화 시계를 어떤 손잡이로도 못 만졌고, 송이에 지정된 진화 레벨(lv.evo)도
   읽히지 않는 죽은 값이었다. 이제 세 경로가 이 자 하나를 본다 —
   3막 진입 씨앗 · 명부대로 세우기 · 명부 없는 보스의 분화 폴백.
   병 노드 자신(evo 99)은 여기를 지나지 않는다. 병 노드는 진화하지 않는 것이 설계다. */
//@ 스토리.자리진화 — 자리가 갖고 태어나는 진화 카운터
function spotEvo(bossKey, stage, sym){
  const T = LVTAB[SLV(bossKey,'evo',stage)] || LVTAB[3];
  return Math.max(1, T.evo + (EVO_ADJ[sym]||0));
}

//@ 스토리.병노드 — 병 노드를 세운다
function mkSpot(sym, init, turn){`);

  /* ── B-2 laySpot — 새 자를 쓴다 (계산은 그대로) ── */
  edit(d, 'src/30-core/story.js',
`  /* v25 — 레벨표를 그대로 본다. build() 와 달리 EVO_ADJ 가 빠져 있어서
     같은 턴에 깔린 자리들이 같은 턴에 진화했다. 그게 체력 절벽의 원인이었다. */
  const T = LVTAB[SLV(S.board.boss,'evo',stage)] || LVTAB[3];
  const e = Math.max(1, T.evo + (EVO_ADJ[slot[0]]||0));
  nd.evo = e; nd.evoLeft = e;`,
`  /* v25 — 레벨표를 그대로 본다. build() 와 달리 EVO_ADJ 가 빠져 있어서
     같은 턴에 깔린 자리들이 같은 턴에 진화했다. 그게 체력 절벽의 원인이었다.
     v26 — 그 계산을 spotEvo 로 뽑았다. 씨앗·분화도 같은 자를 본다. */
  const e = spotEvo(S.board.boss, stage, slot[0]);
  nd.evo = e; nd.evoLeft = e;`);

  /* ── B-3 3막 진입 씨앗 — 손으로 박힌 4 를 걷는다 ── */
  edit(d, 'src/30-core/story.js',
`    nodes.push({sym:s, init, val:init, shielded:true, shReduc:R.SHIELD_CUT, stabAcc:0,
      grow:0, evo:4, evoLeft:4, evolved:false, dead:false, dormT:0,
      rig:0, rigUp:0, rigCap:0, rigLent:0, delayed:0, weak:0, diagRound:0, diagAcc:0, diagNeed:R.DIAG_NEED,
      demoted:false, revealed:false, spawned:false, role:'sym'});`,
`    /* v26 — 4 가 손으로 박혀 있던 자리. 명부 있는 보스가 쓰는 경로와 같은 자를 본다 */
    const e = spotEvo(key, stage, s);
    nodes.push({sym:s, init, val:init, shielded:true, shReduc:R.SHIELD_CUT, stabAcc:0,
      grow:0, evo:e, evoLeft:e, evolved:false, dead:false, dormT:0,
      rig:0, rigUp:0, rigCap:0, rigLent:0, delayed:0, weak:0, diagRound:0, diagAcc:0, diagNeed:R.DIAG_NEED,
      demoted:false, revealed:false, spawned:false, role:'sym'});`);

  /* ── B-4 분화 폴백 — 명부 없는 보스가 자리를 새로 뿜을 때 ── */
  edit(d, 'src/30-core/story.js',
`      const init = SR.DUP_BASE + Math.floor(S.rng()*SR.DUP_SPREAD);
      S.nodes.push({sym:s, init, val:init, shielded:true, shReduc:R.SHIELD_CUT, stabAcc:0,
        grow:0, evo:4, evoLeft:4, evolved:false, dead:false, dormT:0, rig:0, rigUp:0, rigCap:0, rigLent:0, delayed:0, weak:0,
        diagRound:0, diagAcc:0, diagNeed:R.DIAG_NEED, demoted:false, revealed:false,
        spawned:true, born:S.turn, role:'sym'});`,
`      const init = SR.DUP_BASE + Math.floor(S.rng()*SR.DUP_SPREAD);
      const e = spotEvo(S.board.boss, dis.stage, s);   // v26 — 여기도 4 가 박혀 있었다
      S.nodes.push({sym:s, init, val:init, shielded:true, shReduc:R.SHIELD_CUT, stabAcc:0,
        grow:0, evo:e, evoLeft:e, evolved:false, dead:false, dormT:0, rig:0, rigUp:0, rigCap:0, rigLent:0, delayed:0, weak:0,
        diagRound:0, diagAcc:0, diagNeed:R.DIAG_NEED, demoted:false, revealed:false,
        spawned:true, born:S.turn, role:'sym'});`);

  /* ── B-5 어부 「긁는다」 — 이차 감염도 같은 자를 지난다 ── */
  edit(d, 'src/20-data/bosses.js',
`      S.nodes.push(mkSpot('감염', SR.DUP_BASE+Math.floor(S.rng()*SR.DUP_SPREAD), S.turn));`,
`      const nd = mkSpot('감염', SR.DUP_BASE+Math.floor(S.rng()*SR.DUP_SPREAD), S.turn);
      const e = spotEvo(S.board.boss, S.nodes[0].stage, '감염');   // v26 — mkSpot 의 기본 4 를 덮는다
      nd.evo = e; nd.evoLeft = e;
      S.nodes.push(nd);`);

  /* ── B-6 송이 진화 레벨 1 → 5 ──
     1 을 지정한 의도는 「금단은 급성이니 빨리 진화한다」였는데, 레벨표에서 1 은
     가장 쉬운 판이라 진화가 가장 느리다. 손잡이 방향이 의도와 반대였다. */
  edit(d, 'src/20-data/bosses.js',
`    lv:{band:3, evo:1, spots:2, enh:1},`,
`    lv:{band:3, evo:5, spots:2, enh:1},   // v26 — 1 은 가장 느린 판이었다. 방향을 뒤집는다`);
}

/* ══════════════════════════════════════════════════════════════════
   판본 목록
   ══════════════════════════════════════════════════════════════════ */
const VARIANTS = {
  base: { desc: '손대지 않은 현재 src/', apply: () => {} },
  A:    { desc: 'A 확정본만 — 기준선', apply: d => patchA(d) },
  AB:   { desc: 'A + B — 자리 진화 카운터를 손잡이에 잇는다', apply: d => { patchA(d); patchB(d) } },
  /* E — 후퇴선 둘 */
  'AB-노동자190': { desc: 'A + B + 노동자 체격 200→190', apply: d => { patchA(d, {workerHp:190}); patchB(d) } },
  'AB-즉발30':    { desc: 'A + B + 비공격 즉발 24→30',   apply: d => { patchA(d, {evoFlatNonAtk:30}); patchB(d) } },
  /* 후퇴선의 기울기를 보려고 두 점을 더 찍는다 — 200→190 이 거의 안 움직여서다 */
  'AB-노동자170': { desc: 'A + B + 노동자 체격 200→170', apply: d => { patchA(d, {workerHp:170}); patchB(d) } },
  'AB-즉발27':    { desc: 'A + B + 비공격 즉발 24→27',   apply: d => { patchA(d, {evoFlatNonAtk:27}); patchB(d) } },
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
  const r = cp.spawnSync('node', ['build.js'], { cwd: d, encoding: 'utf8' });
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
module.exports = { VARIANTS, make, OUT };
