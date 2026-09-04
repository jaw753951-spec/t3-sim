/* ══════════════════════════════════════════════════════════════════
   §9.22 계기판 — 자리 하나의 겉모습
   ──────────────────────────────────────────────────────────────────
   자리 하나는 낡은 계기판 한 대다. 그림 파일은 쓰지 않는다 —
   테는 conic-gradient, 문자판은 radial-gradient, 눈금과 바늘은
   인라인 SVG 로 그린다. 판이 바뀌면 SVG 를 다시 뱉는다.

   계기판이 말하는 것 (전부 커널이 낸 값이다. 여기서 계산하지 않는다)
     바늘      지금 수치 / 초기값
     붉은 호   강반응 구간 (처치선의 절반 아래)
     푸른 호   약반응 구간 (처치선 아래)
     붉은 눈금 처치선 — 약화가 올리고 통증이 내린다. 실제로 움직인다
     빗금      반응 강등 (진단 2회차)
     쐐기      약화 스택
     바깥 호   설치물 — 쌓인 값 / 상한
     점선 링   진단 — 쌓은 값 / 이번 회차 요구치
     유리      보호막. 두께 두 가지 (경감 30% · 50%)
     서리      성장 정지 · 지연
     문자판 그림  증상마다 다른 얼룩 · 안개 · 균열
     아래 호   증상 이름. 핵심 증상은 주묵으로 한 치수 크다 (외래에서는 문진 뒤)
     수치판    지금 수치 │ 처치선. 문자판에 파낸 창이다

   자리를 무엇으로 세는가 — S.nodes 의 자리 번호다. 증상 이름이 아니다.
   판에 같은 이름이 둘 날 수 있고, 이름은 병 노드에서 병명으로 바뀐다.
   ══════════════════════════════════════════════════════════════════ */

//@ 무대.계기판 — 자리 하나를 계기판 한 대로 그린다
const STAGE_ELS = new Map();          // 자리 번호 → 계기판 DOM

const stageBoard = () => $('sg_board');

/* 판의 크기. 무대는 통째로 transform 으로 줄이므로 창을 줄여도 이 값은 그대로다
   (1920×1080 안의 % 다). 그런데 clientWidth 를 읽는 순간 브라우저가 밀어 둔
   쓰기를 전부 정산한다 — 매 수마다 그 값을 다시 읽던 것이 그리기 비용의 대부분이었다.
   한 번 재서 들고 있다가 무대를 열거나 창이 바뀔 때만 다시 잰다 */
let SG_BW = 0, SG_BH = 0;
function stageMeasure(){
  const B = stageBoard(); if(!B) return;
  SG_BW = B.clientWidth; SG_BH = B.clientHeight;
}

/* 같은 내용이면 innerHTML 을 건드리지 않는다 — 건드리면 SVG 를 다시 파싱하고
   그 안에 붙어 있던 연출 조각도 함께 날아간다 */
/* 손댔으면 true 를 돌려준다 — 손패는 그려 놓고 글자를 맞춰야 하는데(fitHandText)
   안 바뀐 줄에 그 일을 또 할 까닭이 없다 */
function setHTML(el, html){
  if(!el || el.__h === html) return false;
  el.__h = html; el.innerHTML = html;
  return true;
}
function stageEl(n){
  if(!n || !S) return null;
  return STAGE_ELS.get(S.nodes.indexOf(n)) || null;
}

/* ── 의도 칩 ── 이 자리가 이번 턴 끝에 무엇을 하는가 ─────────
   값을 여기서 계산하지 않는다. forecast() 가 클론 위에서 진짜 turnResolve 를 돌리고
   커널이 적어 둔 사건 줄을 그대로 읽는다. 손으로 다시 쓰면 방침 배수 · 완화 ·
   감염 배분 · 성장 정지 · 이번 턴에 태어난 자리를 하나씩 다 빠뜨리게 된다.

   방침 배수를 자리마다 곱하면 안 된다 — 커널은 '합에 한 번만' 올린다.
     dmg = ceil(Σ raw × (배수 − 완화))
   그래서 총계를 원값 비율로 나눠 갖는다. 배분은 내림이고 나머지는 원값이 큰 자리부터 —
   infPool 이 감염 총량을 나누는 것과 같은 손이다. 규약을 두 벌로 만들지 않는다.
   이렇게 해야 칩 합이 「턴 끝 −N」과 한 자리도 안 틀린다. */
//@ 무대.의도칩 — 자리마다 이번 턴에 무슨 일을 하는가
function shareOut(total, raws){
  const out = new Map();
  const sum = raws.reduce((a,r)=>a+r.raw, 0);
  if(!sum || !total) return out;
  let left = total;
  for(const r of raws){ const v = Math.floor(total*r.raw/sum); out.set(r.i, v); left -= v }
  const order = raws.slice().sort((a,b)=>b.raw-a.raw || a.i-b.i);
  for(let k=0; k<left && order.length; k++){
    const i = order[k%order.length].i;
    out.set(i, out.get(i)+1);
  }
  return out;
}

/* ── 아이콘 한 벌 ── 20×20, 선으로만 그린다 ────────────────────
   글자를 그림으로 바꾸는 자리에만 쓴다. 색은 안 박는다 — currentColor 라
   칩이 제 색(주묵 · 무쇠 · 먹)을 그대로 물려준다. 색을 박으면 「이 칩이
   나쁜 것인가 좋은 것인가」를 두 곳에서 정하게 된다.

   글자를 아주 없애지는 않는다. 숫자는 남는다 — 「몇」이 이 판의 값이고,
   없앤 것은 그 앞의 이름표(체력 · 성장 · 안정화)다. 이름은 툴팁이 말한다. */
//@ 무대.아이콘 — 칩과 딱지가 쓰는 그림 한 벌
const ICO = {
  hit:   'M10 17S3 12.6 3 8.2C3 5.6 5 4 7 4c1.6 0 2.6 1 3 1.8C10.4 5 11.4 4 13 4c2 0 4 1.6 4 4.2 0 4.4-7 8.8-7 8.8z',
  grow:  'M10 17V4M5 9l5-5 5 5',
  evo:   'M10 2.5l1.9 5.6 5.6 1.9-5.6 1.9L10 17.5l-1.9-5.6L2.5 10l5.6-1.9z',
  wake:  'M3.5 14.5a6.5 6.5 0 0 1 13 0M10 2.5V5M4.6 5.1l1.8 1.8M15.4 5.1l-1.8 1.8',
  stab:  'M10 3s4.8 5.4 4.8 8.3a4.8 4.8 0 0 1-9.6 0C5.2 8.4 10 3 10 3zM4 16.5 16 3.5',
  line:  'M3 7.5h14M10 9.5V17M6.8 13.8 10 17l3.2-3.2',
  draw:  'M5.5 3h9v14h-9zM7.8 10h4.4',
  weak:  'M10 16.5 3.8 5.5h12.4z',
  delay: 'M5 3h10M5 17h10M5.4 3.4 10 10l4.6-6.6M5.4 16.6 10 10l4.6 6.6',
  frost: 'M10 2.5v15M3.5 6.2l13 7.6M16.5 6.2l-13 7.6',
  demote:'M3 6h14M6.4 10.4l7.2 6.2M13.6 10.4l-7.2 6.2',
  mute:  'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM5 5l10 10',
  imm:   'M10 2.6 3.8 5.8v4.7c0 3.5 2.7 5.8 6.2 6.9 3.5-1.1 6.2-3.4 6.2-6.9V5.8z',
  chron: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM10 5.8v4.6l3.1 2.1',
  /* 병 노드의 다음 박자. 실루엣이 서로 다른 것이 뜻이 정확한 것보다 낫다 —
     정확한 뜻은 툴팁(BEATTIP)이 말하고, 여기는 「또 그거군」을 곁눈으로 잡는 자리다 */
  bSpawn: 'M10 17.5v-5.2M10 12.3 4.6 6M10 12.3 15.4 6',
  bUniq:  'M10 2.4 17.6 10 10 17.6 2.4 10z',
  bSpread:'M10 12.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8M4.8 15.2a7.4 7.4 0 0 1 0-10.4M15.2 4.8a7.4 7.4 0 0 1 0 10.4',
  bDown:  'M10 3v11M5.4 9.4 10 14l4.6-4.6M4 17h12',
  bWin:   'M3.6 3.6h12.8v12.8H3.6zM10 3.6v12.8M3.6 10h12.8',
  bSame:  'M5 8.6a5 5 0 0 1 9.4-1M15 11.4a5 5 0 0 1-9.4 1M4.4 5.6v3h3M15.6 14.4v-3h-3',
  bHard:  'M3.6 5h12.8v10H3.6zM3.6 10h12.8M8.4 5v5M12 10v5',
  bFast:  'M3.4 5.6 8 10l-4.6 4.4M11 5.6 15.6 10 11 14.4',
  flame:  'M10 2.6c3.2 4 5.2 6.2 5.2 9.2a5.2 5.2 0 0 1-10.4 0c0-3 2-5.2 5.2-9.2zM10 11.4c1.2 1.5 2 2.4 2 3.5a2 2 0 0 1-4 0c0-1.1.8-2 2-3.5z',
  /* 배선에 얹히는 키워드 넷. 실루엣만 서로 다르면 된다 — 뜻은 LINKTIP 이 든다 */
  kwLay:  'M3.4 16.6 16.6 3.4M13.6 3.4h3v3M3.4 13.6v3h3',
  kwBloom:'M10 3.6v12.8M3.6 10h12.8M5.5 5.5l9 9M14.5 5.5l-9 9',
  kwChain:'M8.2 11.8 6 14a3 3 0 0 1-4.2-4.2l2.2-2.2M11.8 8.2 14 6a3 3 0 0 1 4.2 4.2L16 12.4M7.4 12.6l5.2-5.2',
  kwBack: 'M16.6 10H8.2M8.2 10l3.2-3.2M8.2 10l3.2 3.2M4.4 4.2v11.6',
};
/* 배선 종류 → 그림. 메달에 글자를 안 쓰는 까닭은 아래 stageLinks 에 적었다 */
const LINKICO = {'가속':'bFast', '경화':'bHard', '점화':'flame', '발현':'bSpawn', '무장발현':'imm',
  '부설':'kwLay', '만개':'kwBloom', '연쇄':'kwChain', '불응':'kwBack', '확산':'bSpread'};
/* 박자 이름 → 그림. 없는 박자는 고유 표로 떨어진다 (새 보스가 새 박자를 들고
   와도 화면이 안 깨진다) */
const BEATICO = {
  '분화':'bSpawn', '성장':'grow', '몰린다':'grow', '치민다':'grow',
  '번진다':'bSpread', '엮는다':'bSpread', '아문다':'bDown', '가라앉는다':'bDown',
  '창':'bWin', '같은 박자':'bSame', '굳는다':'bHard', '진행':'bFast', '가속':'bFast',
  /* 고유 한 수 다섯 — 전에는 「고유」 한 이름이라 한 줄이면 됐다.
     이름으로 쪼갠 뒤로는 저마다 적어 준다. 여기 없는 박자는 아래 || 가 고유 그림으로 받는다 */
  '파고든다':'bUniq', '알아듣지 못한다':'bUniq', '터진다':'bUniq',
  '긁는다':'bUniq', '지금이면 괜찮아진다':'bUniq',
};
const ico = k => `<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="${ICO[k]}"/></svg>`;

/* 칩 하나 · 딱지 하나. 툴팁이 이름을 말하므로 칸에는 그림과 숫자만 남는다 */
/* 증상 설명은 진화 전후로 갈리므로(문안.증상진화) 칩이 자리를 들고 다닌다.
   c.n 이 없으면 진화 전 문안으로 떨어진다 — 자리가 없는 칩은 없지만,
   나중에 자리 없는 칩이 생겨도 화면이 안 깨진다 */
const chipHTML = c => `<span class="icp ${c.cls}"${tip(TT(c.lab,
    KWTIP[c.why] || (c.n ? symTip(c.n) : SYMTIP[c.why]) || ''))}>`
  + ico(c.ic) + (c.txt?`<b>${c.txt}</b>`:'') + '</span>';
const markHTML = m => `<span class="imk"${tip(m.tip)}>` + ico(m.ic) + (m.txt?`<b>${m.txt}</b>`:'') + '</span>';

/* 예고 하나에서 자리 번호 → 칩 목록을 만든다 */
function intentMap(f){
  const m = new Map();
  const put = (i, cls, ic, txt, lab, why) => {
    if(i==null || i<0) return;
    (m.get(i) || m.set(i, []).get(i)).push({cls, ic, txt, lab, why});
  };
  const evs = f.ev || [];
  /* 턴 공격 — 자리별 원값으로 총계를 나눠 갖는다 */
  const raws = evs.filter(e=>e.t==='atk' && e.i>=0).map(e=>({i:e.i, raw:e.raw}));
  const hit  = evs.filter(e=>e.t==='hp' && e.why==='turn').reduce((a,e)=>a+e.amt, 0);
  for(const [i,v] of shareOut(hit, raws)) if(v>0) put(i, 'dmg', 'hit', `−${v}`, `체력 −${v}`, '공격');
  /* 자리 하나가 낸 피해 — 진화 즉발과 점화. 커널이 출처를 붙여 준다.
     이쪽은 커널이 자리마다 따로 올림하므로 나눠 갖지 않고 그대로 적는다 */
  for(const e of evs){
    if(e.t!=='hp' || e.why==='turn' || e.i==null || e.i<0 || !(e.amt>0)) continue;
    put(e.i, 'dmg', 'hit', `−${e.amt}`, `체력 −${e.amt}`, e.why==='evo' ? '진화' : '점화');
  }
  /* 성장 · 진화 · 휴면에서 깨어남.
     감염의 「판 +N」은 걷었다. 감염이 얹는 총량은 받는 자리들의 「성장 +N」에
     이미 한 번 세어져 있어서, 그 칩을 같이 띄우면 같은 값을 두 번 읽게 된다.
     감염이 무엇을 하고 있는지는 숫자가 아니라 배선(stageLinks 의 퍼짐 선)이
     말한다 — 「누구에게」가 이 칩으로는 어차피 안 보였다 */
  for(const e of evs){
    if(e.t==='grow'  && e.amt>0) put(e.i, 'grw', 'grow', `+${e.amt}`, `성장 +${e.amt}`, '성장');
    if(e.t==='evolve') put(e.i, 'evl', 'evo', '', '이번 턴 진화한다', '진화');
    if(e.t==='revive') put(e.i, 'grw', 'wake', '', '휴면에서 깨어난다', '휴면');
  }
  return m;
}

/* 자리가 판에 늘 걸어 두고 있는 것 — 턴 끝 사건이 아니라 상시 효과라 사건으로 안 온다.
   전부 그 자리의 손잡이(sp)를 그대로 읽는다. 목업은 −2 · −6 · −1 로 박아 뒀는데
   탈수는 빼기가 아니라 나누기고, 통증은 처치선에 곱연산이다. */
function standingChips(S, n){
  const out = [];
  if(n.muted || n.val<=0 || n.dead) return out;
  if(n.sym==='탈수')     out.push({cls:'std', ic:'stab', txt:`÷${numOf(sp(n,'탈수'))}`,
                                  lab:`안정화 ÷${numOf(sp(n,'탈수'))}`, why:'탈수', n});
  if(n.sym==='통증')     out.push({cls:'std', ic:'line', txt:`×${numOf(sp(n,'통증'))}`,
                                  lab:`처치선 ×${numOf(sp(n,'통증'))}`, why:'통증', n});
  if(n.sym==='호흡곤란'){ const c = sp(n,'호흡곤란') * (n.evolved?R.EVO_X2:1);
                         out.push({cls:'std', ic:'draw', txt:`−${numOf(c)}`,
                                   lab:`드로우 −${numOf(c)}`, why:'호흡곤란', n}) }
  return out;
}

/* ── 딱지 ── 이 자리에 이미 걸려 있는 것 ────────────────────
   칩(이번 턴에 무엇을 하는가)과 줄을 갈라 아래에 붙인다. 전에는 「약화 2」
   「지연 1」만 글자로 있었고, 나머지(성장 정지 · 반응 강등 · 잠잠 · 만성 ·
   1막 무적)는 자리를 눌러야 뜨는 줄(sg_actbar)에만 있었다. 그 줄을 걷었으므로
   전부 여기로 내려온다 — 그림 하나에 툴팁, 셀 것이 있으면 숫자만.
   글은 전부 이미 있는 것을 쓴다 (KWTIP · TT) — 두 벌로 적지 않는다. */
function standingMarks(S, n){
  const out = [];
  if(immune(S,n)) out.push({ic:'imm', tip:TT('1막 · 무적',
    '병명 확정 전 까지 <br><b>진단</b>만 실시할 수 있다.')});
  if(n.weak)      out.push({ic:'weak',  txt:n.weak,     tip:KWTIP['약화']});
  if(n.delayed)   out.push({ic:'delay', txt:n.delayed,  tip:KWTIP['지연']});
  if(n.growHold>0)out.push({ic:'frost', txt:n.growHold, tip:TT('성장 정지',
    `이 증상은 <b>${n.growHold}턴</b> 성장이 멈춘다.<br>`)});
  if(n.demoted)   out.push({ic:'demote', tip:TT('반응 강등',
    '강반응이 영구히 약반응으로 내려간다.<br>')});
  if(n.chronic)   out.push({ic:'chron', tip:TT('만성','오래 끌어온 자리다. 억제가 잘 듣지 않는다.')});
  /* 불응이 걸어 둔 처치 저항. 걸린 줄 모르면 처치 한 번을 헛되이 쓴다 */
  if(n.resist>0)  out.push({ic:'kwBack', txt:n.resist, tip:TT('처치 저항 · 불응',
    `다음 처치를 <b>${n.resist}번</b> 튕겨 낸다. 코스트와 손은 나가고 처치는 되지 않는다.`
    + (n.resistBack?'<br><b>강반응으로 걸린 저항</b> — 튕겨 낼 때 이 증상이 <b>초기값으로 돌아간다</b>.':''))});
  /* TT 는 (제목, 본문) 두 벌이다. 한 인자로 부르면 본문이 undefined 로 찍힌다 */
  if(n.muted)     out.push({ic:'mute',  tip:TT('이번 턴 잠잠','이 증상은 이번 턴 아무것도 하지 않는다.')});
  return out;
}

/* ── 판 전체에 거는 자리 ── 제 자리를 넘어 남에게 손을 대는 증상 넷 ──
   전에는 감염만 배선(퍼짐 선)으로 그렸는데, 감염 하나가 자리 넷을 먹이면
   선이 넷 깔려서 계기 뒤로 지나가고 의도 칩을 가로질렀다. 「지저분하다」는
   말이 나온 자리다. 선을 걷고 자리 자체에 조용한 파문을 두른다.

   늘 보이는 것은 「이 자리가 판에 손을 대고 있다」 하나뿐이다. 마우스를
   올리면 그제야 **무엇에** 대는지가 켜진다 — 넷을 늘 켜 두면 자리 넷이
   동시에 빛나서 처음의 지저분함과 같은 꼴이 된다.

   대상은 커널에 물어본다. 손으로 고르면 감염이 둘일 때 · 성장 정지일 때 ·
   보호막이 없는 자리 · 병 노드를 하나씩 다 빠뜨린다.
     감염     infPool 의 열쇠 (성장을 나눠 받는 자리)
     통증     병 노드를 뺀 모든 자리 — killLine 이 painShare 를 타는데
              병 노드는 그 식을 안 탄다 (0에 무엇을 곱해도 0이라 뜻이 없다)
     탈수     보호막이 있는 자리 — stabAmt 가 막이 있어야 도는 값이다
     호흡곤란 자리가 아니라 덱이다 (drawCount) */
//@ 무대.방사 — 판 전체에 거는 자리와 그 대상
const EMIT = {
  '감염':     {col:'#9BB2A6', tgt:(S,n)=>[...infPool(S).keys()].filter(x=>x!==n)},
  '통증':     {col:'#C2705F', tgt:(S)=>alive(S).filter(x=>x.role!=='disease')},
  '탈수':     {col:'#B99A5E', tgt:(S)=>alive(S).filter(x=>x.shielded)},
  '호흡곤란':  {col:'#8FA6AE', tgt:()=>[], pile:true},
};
function emitOn(S, n){
  return !!EMIT[n.sym] && n.role!=='disease' && !n.dead && !n.muted && n.val>0;
}
/* 마우스를 올린 동안만 대상을 켠다 */
function emitLight(n, on){
  const B = $('sg'); if(!B) return;
  for(const x of [...document.querySelectorAll('#sg .lit')]) x.classList.remove('lit');
  const e = n && EMIT[n.sym];
  if(!on || !e || !S || !emitOn(S, n)) return;
  B.style.setProperty('--lit', e.col);
  const self = stageEl(n);
  for(const t of e.tgt(S, n)){ const el = stageEl(t); if(el && el!==self) el.classList.add('lit') }
  if(e.pile){ const d = document.querySelector('#sg .res .stack.go'); if(d) d.classList.add('lit') }
}

/* ── 문자판 그림 ── 증상마다 다르게, 수치에 비례해서 ──────── */
function stgArt(n){
  const p = Math.min(1, n.val / Math.max(1, n.init));
  let art = '';
  if(n.role==='disease'){
    art = `<div class="dgrain" style="opacity:${(.30+.45*p).toFixed(2)}"></div>`;
  }
  else if(n.sym==='출혈' || n.sym==='통증'){
    const w = (28 + 34*p)|0;
    art = `<div class="blot" style="width:${w}%;height:${w}%"></div>`;
  }
  else if(n.sym==='발열') art = `<div class="fog" style="opacity:${(.15+.5*p).toFixed(2)}"></div>`;
  else if(n.sym==='탈수') art =
    `<svg class="cracks" viewBox="0 0 200 200" style="opacity:${(.3+.7*p).toFixed(2)}">
       <path d="M60 40 L74 78 L66 112 L82 150" fill="none" stroke="rgba(120,95,60,.5)" stroke-width="2.4"/>
       <path d="M140 36 L128 70 L142 104 L130 146" fill="none" stroke="rgba(120,95,60,.45)" stroke-width="2"/></svg>`;
  else if(n.sym==='감염') art = `<div class="slide"></div>`;
  else if(n.sym==='호흡곤란') art =
    `<svg class="cracks" viewBox="0 0 200 200" style="opacity:${(.25+.55*p).toFixed(2)}">
       <path d="M42 128 Q100 ${150-40*p} 158 128" fill="none" stroke="rgba(110,120,125,.55)" stroke-width="3"/>
       <path d="M52 148 Q100 ${166-34*p} 148 148" fill="none" stroke="rgba(110,120,125,.4)" stroke-width="2.4"/></svg>`;

  /* 성장이 멈춘 자리 · 진화가 미뤄진 자리 — 문자판에 서리가 낀다 */
  if(n.growHold>0 || n.delayed>0)
    art += `<div class="frost"><svg viewBox="0 0 200 200">
      <path d="M100 46 L100 154 M56 71 L144 129 M144 71 L56 129" stroke="rgba(220,232,236,.55)" stroke-width="3" fill="none"/>
      <path d="M100 60 L92 72 M100 60 L108 72 M100 140 L92 128 M100 140 L108 128"
            stroke="rgba(220,232,236,.4)" stroke-width="2.4" fill="none"/></svg></div>`;
  return art;
}

/* ── 배지 넷 ── 계기 밖 대각선에 앉는다 ─────────────────────
   모양이 서로 달라서 곁눈으로도 안 헷갈린다. 전에는 온도계 · 수액 · 설치통을
   증상마다 다른 자리에 매달았는데, 자리가 늘면 가로 폭을 먹어 줄이 넘쳤다.

     좌하  시약관   진단 — 요구가 3이든 40이든 관 크기는 그대로고 눈금만 촘촘해진다
     좌상  방패     보호막 — 남은 안정화만큼 아래에서 차오른다
     우상  파이     진화 시계 — 진단 1회차 전에는 파이 대신 물음표다
     우하  상자     설치물 — 칸이 부품, 아래 숫자가 턴 끝에 깎는 값

   ── 좌표계 ──
   배지는 자리가 커져도 화면에서 같은 크기여야 한다. 병 노드(330px)는 부수
   증상(176px)의 1.9배라, 눈금을 200 으로 못 박아 두면 배지도 1.9배로 커지고
   테에서 127px 밖까지 밀려나 계기와 따로 노는 물건이 된다 — 실제로 그랬다.
   3/5 에서 병 노드를 키운 순간 생긴 일이다.

   그래서 눈금을 자리 크기에 맞춰 늘인다. .atts 는 계기보다 30% 넓으므로
   (inset:-30%) 폭이 sz×1.6 px 다. 176px 자리에서의 눈금(1단위 = 1.408px)을
   기준으로 삼으면 viewBox = sz×1.6/1.408 = sz×1.136 이고, 그러면 배지 안의
   치수(관 15×36 · 방패 32×34 · 원 r17 · 글자 13)가 전부 화면에서 고정된다.
   테는 중심에서 sz/2 px = sz/2.816 단위, 배지는 그보다 41.2 단위(=58px) 밖.

   viewBox 는 stageSync 가 .atts 에 박는다 — 여기서 낸 V 와 갈리면 배지가
   엉뚱한 데 앉으므로 같은 식을 두 곳에 적지 않고 attsBox() 하나만 쓴다. */
//@ 무대.배지 — 진단 · 보호막 · 진화 · 설치물
const attsBox = sz => sz*1.136;
/* 크기는 부르는 쪽(stageSync)이 넘긴다. 여기서 n.sz 를 다시 읽으면 폴백이 갈려
   (저쪽은 n.sz||SZ, 이쪽은 n.sz||176) viewBox 와 배지 좌표가 다른 값에서 나온다 */
function badgeSVG(S, n, sz){
  const V = attsBox(sz);
  const C = V/2, RB = sz/2.816 + 41.2, rad=a=>a*Math.PI/180;
  const P=(a,r)=>[C+Math.cos(rad(a))*r, C+Math.sin(rad(a))*r];
  let s='';

  /* 좌하 — 진단 시약관. 자리를 안 가린다 — 1막의 병 노드는 억제도 처치도 안 받지만
     진단과 재진은 통하므로, 무적인 그 자리야말로 이 관이 유일하게 할 말이 있다.
     한때 병 노드를 빼려고 조건을 달았다가 늘 참인 채로 남아 있었다 */
  {
    const [gx,gy]=P(143,RB), tw=15, th=36, tx=gx-tw/2, ty=gy-13;
    const need=Math.max(1,n.diagNeed||R.DIAG_NEED), cur=Math.min(n.diagAcc||0,need);
    const f=cur/need, ih=th-3.4, left=Math.max(0,Math.ceil(need-cur));
    /* 아직 한 번도 안 연 자리에는 1회차 문안만, 한 번이라도 연 자리에는
       재진 문안을 단다 — 지금 할 수 없는 일을 먼저 읽게 하지 않는다 */
    s += `<g${tip((n.diagRound>=1 ? KWTIP['재진'] : KWTIP['진단'])
          + `<br><br>이 자리 — <b>${n.diagRound}회차</b> 완료 · `
          + `다음 회차 요구 <b>${need}</b> · 쌓은 값 ${n.diagAcc||0}`)}>`
      + `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="2" fill="#14181C" stroke="#4DD4C8" stroke-width="1.6"/>`
      + `<rect x="${tx+1.7}" y="${ty+th-1.7-ih*f}" width="${tw-3.4}" height="${ih*f}" fill="#4DD4C8" opacity=".85"/>`;
    const step = need<=10 ? 1 : Math.ceil(need/8);
    for(let k=step;k<need;k+=step){ const y=ty+th-1.7-ih*(k/need);
      s += `<line x1="${tx+tw}" y1="${y}" x2="${tx+tw+4}" y2="${y}" stroke="#4DD4C8" stroke-width="1.2" opacity=".8"/>` }
    s += `<text x="${gx}" y="${gy+34}" text-anchor="middle" font-size="13" font-weight="800"`
      +  ` font-family="ui-monospace,monospace" fill="#4DD4C8">${left}</text>`
      +  (n.diagRound>0?`<text x="${gx}" y="${ty-4}" text-anchor="middle" font-size="12" font-weight="800"`
      +  ` font-family="ui-monospace,monospace" fill="#4DD4C8">${'I'.repeat(Math.min(4,n.diagRound))}${n.diagRound>4?'+':''}</text>`:'')
      +  `</g>`;
  }

  /* 보호막은 배지가 아니라 계기 안에서 말한다 (dialSVG 의 서리 테).
     테 밖 왼쪽 위에 방패를 매달고 있었는데, 정작 그 값(남은 안정화)은
     계기를 보면서 재야 하는 값이라 눈이 안팎을 오갔다. 자리도 하나 먹었다 */

  /* 우상 — 진화 시계. 병 노드는 병기라 여기 안 쓴다 (아래 링이 맡는다).

     진단 전에는 **아무것도 안 그린다**. 전에는 점선 원에 물음표를 띄웠는데,
     그러면 「모른다」를 알리려고 자리를 하나 먹고 옆자리 방패와 붙어 버렸다.
     모르는 것은 비워 두는 편이 맞다 — 진단 1회차나 문진 「언제부터」가 열면
     그때 나타나는 것 자체가 알림이 된다. */
  if(n.role!=='disease' && (n.evolved || n.revealed)){
    const [ex,ey]=P(-39,RB);
    if(n.evolved){
      s += `<g${tip(TT('진화함', EVOTXT_F[n.sym]?EVOTXT_F[n.sym](n):''))}>`
        +  `<circle cx="${ex}" cy="${ey}" r="17" fill="#14181C" stroke="#C9A44A" stroke-width="1.8"/>`
        +  `<text x="${ex}" y="${ey+6}" text-anchor="middle" font-size="17" fill="#C9A44A">✦</text></g>`;
    } else if(n.revealed){
      const max=Math.max(1, n.evo||1), p=Math.max(0, Math.min(1, (max-n.evoLeft)/max));
      const col = n.evoLeft<=1 ? '#98302A' : '#E8E2D2';
      const a=-90+360*p, [px,py]=P2(ex,ey,a,17);
      s += `<g${tip(TT('진화까지', `남은 턴 <b>${n.evoLeft}</b>${n.delayed?` <span class="d">(지연 ${n.delayed})</span>`:''}`
            /* v26 — EVO_HIT 는 비율이 아니라 고정값이다. 비율로 읽으면 통증 자리에
               「수치의 2400% · 지금 진화하면 −1680」처럼 두 자리가 통째로 거짓말을 한다.
               board-view 는 고쳤는데 무대만 옛 식으로 남아 있었다 */
            + `<br><br>진화하는 턴에 <b>${R.EVO_HIT[n.sym]||0}</b>이 즉시 환자에게 들어간다. 수치를 보지 않는 고정값이다.`))}>`
        +  `<circle cx="${ex}" cy="${ey}" r="17" fill="#14181C" stroke="${col}" stroke-width="1.8"/>`
        +  (p>0?`<path d="M${ex} ${ey} L${ex} ${ey-17} A17 17 0 ${p>.5?1:0} 1 ${px} ${py} Z" fill="${col}" opacity=".25"/>`:'')
        +  `<text x="${ex}" y="${ey+5.5}" text-anchor="middle" font-size="15" font-weight="800"`
        +  ` font-family="ui-monospace,monospace" fill="${col}">${n.evoLeft}</text></g>`;
    }
  }

  /* ── 병 노드 — 병기 시계 링과 다음 박자 (9) ──────────────
     전에는 병기가 오른쪽 위 작은 원 하나였고 시계와 다음 박자는 자리를 눌러야
     뜨는 줄에만 있었다. 그 줄을 걷었으므로 계기 얼굴로 올라온다.

     링은 위쪽 140°(200°~340°)만 쓴다. 아래 대각선은 시약관과 설치통 자리다.
     칸 수는 SR.STAGE_TURNS 하나에서 나온다 — 목업은 단계마다 3·4·5 로 달랐는데
     규칙은 단계와 무관하게 한 값이다. 두 벌로 적으면 계기가 거짓말을 한다. */
  if(n.role==='disease'){
    const RR = sz/2.816 + 19, seg = Math.max(1, SR.STAGE_TURNS), left = Math.max(0, n.stageClock);
    const A0 = 200, SPAN = 140, gap = 2.6;
    const arc = (a0,a1,r,w,col,op) => {
      const [x0,y0]=P(a0,r), [x1,y1]=P(a1,r);
      return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 `
           + `${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${w}"`
           + ` opacity="${op}" stroke-linecap="butt"/>`;
    };
    /* class="ring" 은 표지다. stage_check 가 배지의 「크기 · 간격이 자리와
       무관한가」를 잴 때 이것을 뺀다 — 링은 테를 두르는 물건이라 지름이
       자리를 따라가는 것이 맞고, 140° 호의 외곽 상자 한가운데는 테 안쪽에
       찍혀서 같은 잣대로 재면 간격이 음수로 나온다 */
    s += `<g class="ring"${tip(TT('병기', `지금 병기 <b>${n.stage}</b> / 최대 ${n.stageMax}`
          + `<br>병기 시계 <b>${left}</b> — 0이 되면 병기가 한 칸 오른다.`
          + `<br>병기가 오르면 병 노드 수치가 그만큼 이월되어 커진다.`))}>`;
    for(let i=0;i<seg;i++){
      const a0 = A0 + SPAN*i/seg + gap/2, a1 = A0 + SPAN*(i+1)/seg - gap/2;
      s += arc(a0, a1, RR, 9, i<left ? '#C9A44A' : '#2b2b2c', i<left ? 0.95 : 0.85);
    }
    s += `</g>`;

    /* 병기 숫자 — 링 왼쪽에 판 하나. 링(시계)과 값이 다르므로 자리를 가른다.
       전에는 오른쪽 위 .evc 원이 맡았는데 링을 두르면서 그 위에 겹쳐 앉았다 */
    {
      const [sx2,sy2]=P(180, RR+25);
      s += `<g${tip(TT('병기', `지금 병기 <b>${n.stage}</b> / 최대 ${n.stageMax}`
            + `<br>병기 시계 <b>${left}</b> — 0이 되면 병기가 한 칸 오른다.`))}>`
        + `<circle cx="${sx2.toFixed(1)}" cy="${sy2.toFixed(1)}" r="17" fill="#C9A44A" stroke="#14181C" stroke-width="1.8"/>`
        + `<text x="${sx2.toFixed(1)}" y="${(sy2+6).toFixed(1)}" text-anchor="middle" font-size="17"`
        + ` font-weight="800" font-family="ui-monospace,monospace" fill="#241a08">${n.stage}</text></g>`;
    }

    /* 다음 박자 — 링 꼭대기에 그림 하나. 글은 beatTip 이 말한다 */
    const bt = (typeof nextBeat==='function' && S.board && S.board.boss) ? nextBeat(S, n) : null;
    if(bt){
      /* 병기 배지(r 17)보다 크게 둔다 — 병이 다음 턴에 무엇을 할지가 이 판에서
         가장 자주 보는 것인데 배지들 틈에 같은 크기로 묻혀 있었다.
         그림도 같은 배수로 키운다 (20×20 원본을 1.4배) */
      /* 오른쪽에 둔다 — 병기 배지가 왼쪽(180°)이라 좌우로 짝이 맞는다.
         정수리(270°)에 있던 것을 옮긴 까닭: 보호막 눈금이 위쪽 200°~340° 를
         쓰므로 그 한가운데였다. 그림을 키우자 눈금 위에 그대로 얹혀 둘 다 못 읽었다 */
      const [bx,by]=P(0, RR+25), r=24, sc=1.4;
      s += `<g${tip(beatTip(S,n) || TT('다음 박자', esc(bt)))}>`
        + `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${r}" fill="#14181C" stroke="#C9A44A" stroke-width="2.4"/>`
        + `<g transform="translate(${(bx-10*sc).toFixed(1)},${(by-10*sc).toFixed(1)}) scale(${sc})" fill="none" stroke="#C9A44A"`
        + ` stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">`
        + `<path d="${ICO[BEATICO[bt]||'bUniq']}"/></g></g>`;
    }
  }

  /* 우하 — 설치물 상자. 빌려온 물건은 빗금 칸으로 가른다 */
  const rig=(n.rig||0), lent=(n.rigLent||0);
  if(rig||lent){
    const [ix,iy]=P(39,RB), w=44, h=34, cap=n.rigCap||Math.max(R.RIG_CAP_MIN,rig);
    const slots=Math.max(1, Math.min(6, cap||1)), on=Math.round(rig/Math.max(1,cap)*slots);
    s += `<g transform="translate(${ix-w/2},${iy-h/2})"${tip(TT('설치물',
          `매 턴 종료 시 이 자리를 <b>${rig+lent}</b> 억제한다. 보호막을 무시한다.`
          + (rig?`<br>상한 ${cap} · 부품 ${n.rigPart||0}/${n.rigPartMax||0}`:'')
          + (lent?`<br>빌려온 물건 ${lent} — 남의 손을 타지 않는다`:'')
          + (rig?`<br><br>개방하면 <b>−${rig*CARDS['출력 개방'].v.mult}</b> 한 방으로 태울 수 있다.`:'')))}>`
      + `<rect x="0" y="0" width="${w}" height="${h}" fill="#14181C" stroke="#7AA8B2" stroke-width="1.8"/>`
      + `<rect x="7" y="-4" width="30" height="5" fill="#7AA8B2"/>`
      + Array.from({length:slots},(_,i)=>`<rect x="${5+i*(34/slots)}" y="7" width="${28/slots}" height="8"`
          + ` fill="${i<on?'#7AA8B2':'none'}" stroke="#7AA8B2" stroke-width="1"/>`).join('')
      + `<text x="${w/2}" y="29" text-anchor="middle" font-size="13" font-weight="800"`
      + ` font-family="ui-monospace,monospace" fill="#E4867A">−${rig+lent}</text></g>`;
  }
  return s;
}
/* 파이 조각의 끝점 — 배지 안에서만 쓴다 */
function P2(cx,cy,a,r){ const t=a*Math.PI/180; return [cx+Math.cos(t)*r, cy+Math.sin(t)*r] }

/* ── 다이얼 ── 눈금 · 구간 · 바늘 · 처치선 · 약화 · 설치 ──── */
function dialSVG(S, n){
  const V=200, c=V/2, piv=c+V*0.13, fr=V*0.37;
  const den = Math.max(1, n.init);
  const p  = Math.max(0, Math.min(1, n.val/den));
  const kl = Math.max(0, Math.min(1, killLine(S,n)/den));
  const ed = kl/2;
  const imm = immune(S, n);

  const P = (t, rr) => { const a = Math.PI*(1-t); return [c+rr*Math.cos(a), piv-rr*Math.sin(a)] };
  const seg = (t0, t1, col, w) => {
    if(t1 <= t0) return '';
    const [x0,y0]=P(t0,fr), [x1,y1]=P(t1,fr);
    return `<path d="M ${x0} ${y0} A ${fr} ${fr} 0 0 1 ${x1} ${y1}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  };

  let s = '';
  /* 구간 셋. 1막 병 노드는 아무 데도 못 끊으므로 전부 잿빛이다 */
  if(imm){
    s += seg(0, 1, '#6a6a68', 9);
  } else {
    s += seg(0, ed, '#9e2b2b', 11);
    s += seg(ed, kl, '#5a7d75', 11);
    s += seg(kl, 1, '#8a7a55', 7);
  }
  /* 눈금 다섯 */
  for(const t of [0,.25,.5,.75,1]){
    const [x0,y0]=P(t,fr-9), [x1,y1]=P(t,fr+3);
    s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#7a6b48" stroke-width="3"/>`;
  }
  /* 처치선 — 이 판에서 실제로 걸린 자리에 선다 */
  if(!imm && kl>0){
    const [kx0,ky0]=P(kl,fr-15), [kx1,ky1]=P(kl,fr+6);
    s += `<line x1="${kx0}" y1="${ky0}" x2="${kx1}" y2="${ky1}" stroke="#9e2b2b" stroke-width="7"/>`;
    /* 반응 강등 — 처치선에 빗금을 친다. 강반응이 여기서 죽었다는 표시 */
    if(n.demoted){
      const [hx,hy]=P(kl, fr+13);
      s += `<line x1="${hx-7}" y1="${hy-7}" x2="${hx+7}" y2="${hy+7}" stroke="#A8503F" stroke-width="3"/>`
         + `<line x1="${hx-7}" y1="${hy+7}" x2="${hx+7}" y2="${hy-7}" stroke="#A8503F" stroke-width="3"/>`;
    }
  }
  /* 약화 — 처치선을 밀어 올린 스택 수만큼 쐐기를 박는다 */
  if(n.weak>0){
    const per = (n.role==='disease' ? R.WEAK_STACK_DIS : R.WEAK_STACK);
    const show = Math.min(6, n.weak);
    for(let i=0;i<show;i++){
      const t = Math.max(0, kl - per*(i+0.5));
      const [wx,wy] = P(t, fr+9);
      s += `<polygon points="${wx},${wy-5} ${wx+4},${wy+4} ${wx-4},${wy+4}" fill="#A8503F"/>`;
    }
  }
  /* 설치물 — 바깥 테를 따라 도는 호. 쌓인 값 / 상한 */
  const rigAll = (n.rig||0) + (n.rigLent||0);
  if(rigAll>0){
    const cap = Math.max(1, n.rigCap || Math.max(R.RIG_CAP_MIN, n.rig||rigAll));
    const t = Math.min(1, rigAll/cap);
    const rr = fr+17;
    const [x0,y0]=P(0,rr), [x1,y1]=P(t,rr);
    s += `<path d="M ${x0} ${y0} A ${rr} ${rr} 0 0 1 ${x1} ${y1}" fill="none" stroke="rgba(122,168,178,.85)" stroke-width="5" stroke-linecap="round"/>`;
  }
  /* 바늘 */
  const a = Math.PI*(1-p);
  const tx = c+fr*0.94*Math.cos(a), ty = piv-fr*0.94*Math.sin(a);
  const lx = c-fr*0.22*Math.cos(a), ly = piv+fr*0.22*Math.sin(a);
  const px = -Math.sin(a), py = -Math.cos(a), w0 = 5;
  s += `<polygon points="${tx},${ty} ${c+px*w0},${piv+py*w0} ${lx+px*w0*0.8},${ly+py*w0*0.8} `
     + `${lx-px*w0*0.8},${ly-py*w0*0.8} ${c-px*w0},${piv-py*w0}" fill="#1f1815"/>`;
  s += `<circle cx="${c}" cy="${piv}" r="7" fill="#1f1815"/>`;

  /* ── 보호막 ── 문자판 가장자리에 낀 서리 ────────────────────
     유리(.glass)가 「막이 있다」를, 이 테가 「얼마나 남았다」를 말한다.
     전에는 계기 밖 방패 배지가 남은 수를 들고 있었는데, 그 수를 읽는 목적이
     「이 계기를 언제 열 수 있나」라서 눈이 계기와 배지를 오갔다.

     차오르는 쪽이 **쌓은 안정화**다 (남은 것이 아니다). 눈금이 다 차면 깨진다 —
     차가 오르는 것이 곧 진척이라 이쪽이 손에 맞는다.
     위쪽 140°만 쓴다. 아래는 이름이, 가운데는 수치판이 차지한다. */
  if(n.shielded){
    const RS = 93, A0 = 200, SPAN = 140, rad = d => Math.PI*d/180;
    const PS = (a,r) => [c+Math.cos(rad(a))*r, c+Math.sin(rad(a))*r];
    const f = Math.max(0, Math.min(1, (n.stabAcc||0) / Math.max(1, R.SHIELD_MAX)));
    const left = Math.max(0, R.SHIELD_MAX - Math.floor(n.stabAcc||0));
    const arcS = (a0,a1,w,col,op) => {
      if(a1<=a0) return '';
      const [x0,y0]=PS(a0,RS), [x1,y1]=PS(a1,RS);
      return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${RS} ${RS} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}"`
           + ` fill="none" stroke="${col}" stroke-width="${w}" opacity="${op}" stroke-linecap="round"/>`;
    };
    s += `<g class="shg"${tip(TT('보호막',
          `받는 피해가 <b>${pctOf(n.shReduc)}</b> 줄어든다.`
          + `<br>안정화를 ${R.SHIELD_MAX} 누적하면 벗겨진다. 지금 <b>${Math.floor(n.stabAcc||0)}</b> — ${left} 남았다.`
          + `<br><br>설치물의 자동 억제는 보호막을 무시한다.`))}>`
      /* 눈금과 숫자를 진하게. 옅은 물빛 숫자가 계기 얼굴 위에 얹혀 있어서
         밝은 자리에서는 배경에 잠겼다 — 어두운 테를 두르고(paint-order) 키운다.
         눈금 자체도 빈 쪽을 진하게 해서 얼마나 남았는지가 멀리서도 보이게 한다 */
      + arcS(A0, A0+SPAN, 10, 'rgba(14,20,24,.55)', 1)
      + arcS(A0, A0+SPAN, 10, 'rgba(122,168,178,.42)', 1)
      + arcS(A0, A0+SPAN*f, 10, '#B8E4EC', 1)
      + `<text x="${c}" y="45" text-anchor="middle" font-size="25" font-weight="800"`
      + ` font-family="ui-monospace,monospace" fill="#D6EFF4"`
      + ` stroke="#0E1418" stroke-width="4.5" paint-order="stroke" stroke-linejoin="round">${left}</text></g>`;
  }

  const ix = S.nodes.indexOf(n);
  const isCore = !(MODE==='sess' && !S.coreShown) && !!BOARD && n.sym===BOARD.core;

  /* ── 수치판 ── 문자판에 파낸 창. 지금 수치 │ 처치선 ────────
     바늘보다 뒤에 깔지 않는다. 바늘 꼬리는 수치가 절반쯤일 때 y≈142 까지
     내려오므로 뒤에 두면 숫자를 가로지른다. 창이 꼬리 끝을 조금 덮는 편이
     읽기도 낫고 계기답다. 창 위쪽(y=133)은 바늘 축(126+7)에 딱 붙인다.
     처치선이 주묵인 것은 다이얼의 붉은 눈금과 같은 값을 말하기 때문이다 —
     색이 갈리면 둘이 다른 것처럼 보인다. */
  const cur = String(n.val), kl2 = imm ? '—' : String(killLine(S,n));
  const pw = cur.length*14.4 + 20 + kl2.length*10.2 + 12, phw = pw/2;
  s += `<rect x="${(c-phw).toFixed(1)}" y="133" width="${pw.toFixed(1)}" height="24" rx="2"`
     + ` fill="#f0e6d2" opacity=".93" stroke="rgba(58,53,48,.3)" stroke-width="1"/>`
     + `<text x="${c}" y="153" text-anchor="middle" font-family="ui-monospace,monospace">`
     + `<tspan font-size="24" font-weight="800" fill="#2A2622">${cur}</tspan>`
     + `<tspan font-size="14" fill="rgba(58,53,48,.42)"> │ </tspan>`
     + `<tspan font-size="17" font-weight="800" fill="#98302A">${kl2}</tspan></text>`;

  /* ── 이름 ── 아래 호를 따라 새긴다 ────────────────────────
     전에는 계기 밑에 검은 이름표 상자(.info)가 따로 달려 있었다. 상자가 62px 를
     먹어서 의도 칩이 그만큼 더 내려갔고, 자리가 여섯이면 상자끼리 붙었다.
     얼굴 안으로 들이면 줄이 그만큼 촘촘해진다 — 눈금이 비워 둔 아래 110°가
     원래 계기의 명찰 자리다.

     핵심 증상은 주묵으로 한 치수 커진다. 그런데 「무엇이 핵심인가」는 외래에서
     문진 「어떻게 아프십니까」가 파는 물건이다. 그래서 체력 태그와 같은 잣대로
     가린다 (MODE==='sess' && !S.coreShown) — 안 그러면 계기가 문진을 공짜로
     흘리고, 그 칸을 사는 이유가 없어진다. 스토리는 병 노드가 곧 핵심(core:'병')
     이라 감출 것이 없고, 단판은 문진 자체가 없다.

     호를 88 에 두고 글이 쓸 수 있는 폭을 아래 ±32° 로 못 박은 뒤, 이름이 길면
     글자를 줄여서 그 안에 넣는다. 크기를 고정해 두면 「호흡곤란」 네 글자가
     양옆으로 기어올라 수치판을 뚫는다 — 실제로 그렇게 겹쳤다. 창 모서리는
     중심에서 74 · 50° 라 이 창 밖이고, 글의 안쪽 가장자리(88−0.75×글자)는
     58° 에서도 창 아래로 지나간다. 셋 중 하나만 건드려도 다시 겹친다. */
  {
    const rn = 88, HA = 32, rad = d => Math.PI*d/180;
    const nm = (n.role==='disease' ? '병 노드' : n.sym) + (n.evolved ? ' ✦' : '');
    const ls = isCore ? 4.5 : 3;
    const fs = Math.max(13, Math.min(isCore ? 24 : 20, 2*rad(HA)*rn/nm.length - ls));
    const [ax0,ay0] = [c+rn*Math.cos(rad(145)), c+rn*Math.sin(rad(145))];
    const [ax1,ay1] = [c+rn*Math.cos(rad(35)),  c+rn*Math.sin(rad(35))];
    /* 145° → 35° 를 sweep 0 으로 그으면 아래(90°)를 지난다. 글은 이 선 위에
       똑바로 선다 — 방향을 뒤집으면 글자가 거꾸로 매달린다 */
    /* 이름에 증상 설명을 단다. 무대에는 이것을 읽을 자리가 여태 없었다 —
       자리를 누르면 뜨던 줄(sg_actbar)을 걷으면서 같이 사라졌고, 의도 칩에는
       탈수 · 통증 · 호흡곤란만 붙어 있어 발열 · 출혈 · 감염은 읽을 길이
       아예 없었다. 이름이 곧 증상이니 이름에 다는 것이 제자리다.
       병 노드는 증상이 아니라 병이라 안 단다 (박자와 병기가 따로 말한다) */
    const st = n.role==='disease' ? '' : symTip(n);
    s += `<defs><path id="sgnm${ix}" d="M${ax0.toFixed(1)} ${ay0.toFixed(1)} `
       + `A${rn} ${rn} 0 0 0 ${ax1.toFixed(1)} ${ay1.toFixed(1)}"/></defs>`
       + `<g class="nmg"${st?tip(TT(n.sym + (n.evolved?' ✦':''), st)):''}>`
       + `<text font-family="var(--sans)" font-size="${fs.toFixed(1)}" font-weight="800"`
       + ` letter-spacing="${ls}" fill="${isCore?'#98302A':'rgba(58,53,48,.62)'}">`
       + `<textPath href="#sgnm${ix}" startOffset="50%" text-anchor="middle">${esc(nm)}</textPath></text></g>`;
  }
  return s;
}

/* 진단 링(diagRing)을 걷었다 — 테를 두르는 점선으로 이번 회차 진단 누적을
   말하던 물건이다. 좌하 **시약관 배지**가 같은 값을 더 정확히 말한다 (요구가
   3이든 40이든 관 크기는 고정이고 눈금만 촘촘해진다). 되살릴 거면 배지를 먼저
   걷어야 한다 — 둘이 같은 값을 두 벌로 그리면 한쪽이 곧 거짓말을 한다. */

/* ── 자리 놓기 ── 가로 한 줄 ────────────────────────────────
   전에는 호(arc)에 앉혔는데 자리가 늘면 위아래로 벌어져 배선이 계기판을 넘어
   다녔다. 줄로 세우면 배선이 한 레인 위로만 지난다.

   스토리는 병 노드가 **위**, 증상이 아래다. 병이 판을 내려다보고 증상에서
   병으로 올라가는 그림이다 — 반대로 두었더니 병이 손패 줄에 눌려 앉고
   증상이 병을 굽어보는 꼴이 됐다.

   자리 사이를 96px 벌린다. 배지가 테 밖 58px 에 앉으므로 26px 만 띄우면
   옆자리 배지와 겹친다 — 실제로 왼쪽 위 방패와 옆자리 오른쪽 위 진화 시계가
   붙어 있었다. 가로로 삐져나오는 양은 0.777×(sz/2+58) + 배지 반폭 ≈
   0.389sz + 69 이고 테 반폭이 0.5sz 이므로 자리 하나가 69 − 0.111sz,
   둘이 마주 보면 그 두 배다. 자리가 244 일 때 84 라 96 이면 넉넉하다. */
/* 무대에 그릴 배선 — 기본형에 강화형을 얹는다.

   강화형 배선은 **판(S)** 에서 읽는다. BOARD.enh 를 읽고 있었는데, 그것은
   처음 만들어진 판의 것이라 부설이 싸움 중에 놓은 줄(S.enh.push)이 화면에
   한 줄도 안 나왔다. 되돌리기가 판을 갈아 끼우면 둘이 아예 다른 배열이 된다.

   아직 안 드러난 강화형은 여기서 걸러 낸다 — **한 줄도 안 그린다.** 점선으로라도
   그리면 어느 자리끼리 걸렸는지가 새어 나간다 (작업대가 「? → ?」 로 양 끝을
   감추는 것과 같은 잣대다). 자리잡기도 이 목록을 보므로, 안 드러난 줄이
   빈 칸을 예약해 버리면 줄 간격만 보고 배선 수를 셀 수 있게 된다. */
/* ★ **한 수에 한 번만 뜬다.** 전에는 자리잡기와 그리기가 각각 불러서, 같은 손에
     목록을 두 벌 떴다 — alive(S) 걸러 내기 · enhShown 훑기 · 줄마다 객체 복사가
     통째로 두 번이고, stageSync 는 연출 묶음마다 도니 가장 뜨거운 길에서 그랬다.
     게다가 두 벌이 서로 다른 순간의 판을 볼 수 있어서, 자리잡기는 예약했는데
     그리기는 안 긋는 (또는 그 반대) 빈 칸이 날 수 있었다.
     stageSync 가 한 번 떠서 아래로 넘긴다. */
//@ 무대.배선목록 — 자리잡기와 그리기가 함께 보는 목록
function stageLines(live){
  if(!S) return [];
  const ns = live.filter(n=>n.role!=='disease');
  const shown = enhShown(S);
  return [...basicLines(ns.map(n=>n.sym)).map(l=>({...l, enh:false})),
          ...((S.enh)||[]).map(e=>({...e, enh:true}))]
    .filter(l => !(l.enh && !shown));
}

/* 전이 배선이 낳을 자리 — 아직 판에 없는 도착점.
   출발점 이름들을 함께 들고 나온다: 그리는 쪽이 설명을 달 때 lines 를 다시
   훑지 않아도 되고, 「누구를 처치하면 여기 나는가」의 답이 여기 한 번만 적힌다.
   빈 칸 하나가 계기 한 대의 GH_W 만큼을 먹는다. 1 로 두면 「날지도 모르는 자리」
   하나 때문에 실제 자리가 전부 한 치수 작아진다 — 절반쯤이 자리를 알아볼 만하면서
   줄을 덜 밀었다. */
const GH_W = 0.55;
let SG_GHOST = [];
function stageGhosts(live, lines){
  const on = new Set(live.filter(n=>n.role!=='disease').map(n=>n.sym));
  const out = [];
  for(const l of lines){
    /* 출발점이 판에 있어야 그릴 수 있다 — 강화형 배선은 판에 없는 자리에서
       나가는 것이 있다 (되돌리기로 자리가 사라져도 S.enh 는 남는다) */
    if(!on.has(l.a) || !spawnsSpot(l) || on.has(l.b)) continue;
    const had = out.find(g=>g.sym===l.b);
    if(had){ if(!had.from.includes(l.a)) had.from.push(l.a) }
    else out.push({sym:l.b, from:[l.a]});
  }
  return out;
}

function stageLayout(live, lines){
  if(!S) return 0;
  if(!SG_BW) stageMeasure();
  const W = SG_BW, H = SG_BH;
  const dis  = live.find(n=>n.role==='disease');
  const row  = live.filter(n=>n!==dis);
  const gh   = stageGhosts(live, lines);
  /* 칸은 「자리 하나」를 1 로 세는 단위다. 빈 칸이 GH_W 만 먹으므로 CN 은
     정수가 아니다 — 전에는 row.length 로만 나눴고, 그래서 전이로 자리가
     실제로 날 때 줄 전체가 한 칸씩 밀려 판이 통째로 흔들렸다.
     미리 비워 두면 태어나는 자리가 제 칸에 그대로 선다. */
  const CN   = (row.length + GH_W*gh.length) || 1;
  const SZ   = Math.max(118, Math.min(dis ? 200 : 280, (W*0.97)/CN - 96));
  const cy   = dis ? H*0.68 : H*0.46;
  const slot = (at,w) => W*0.015 + (W*0.97)*(at + w/2)/CN;
  row.forEach((n,i)=>{
    n.px = slot(i, 1);
    n.py = cy;
    n.sz = SZ;
  });
  SG_GHOST = gh.map((g,i)=>({...g, px:slot(row.length + i*GH_W, GH_W), py:cy, sz:SZ*GH_W}));
  /* 병 노드는 줄에 끼지 않고 위 가운데에 앉는다. 부수 증상보다 크되 전처럼
     판을 다 먹지는 않는다 — 330 은 배지까지 합쳐 판 높이의 절반을 넘었다 */
  /* 0.30 은 배지에서 거꾸로 잡은 값이다 — 병기 링 위 다음 박자 badge 가
     테에서 62px 더 나가므로 0.235 에 앉히면 그 badge 가 화면 위로 잘렸다 */
  if(dis){ dis.px = W/2; dis.py = H*0.30; dis.sz = Math.min(262, W*0.185) }
  return SZ;
}

/* ── 계기판 맞추기 ── 있는 것은 고치고, 없어진 것은 걷고, 난 것은 세운다 ── */
//@ 무대.계기판맞춤 — DOM 을 판에 맞춘다
function stageSync(){
  if(!STAGE_ON) return;                 // 나간 뒤에 도는 연출이 빈 판을 세우지 않게
  const B = stageBoard(); if(!B || !S) return;
  /* 산 자리와 배선 목록은 **여기서 한 번만** 뜬다 — 자리잡기 · 빈 칸 · 그리기가
     각자 뜨면 같은 손 안에서 서로 다른 순간의 판을 볼 수 있고, 그 자체가 비용이다
     (무대.배선목록) */
  const live  = alive(S);
  const lines = stageLines(live);
  const SZ = stageLayout(live, lines);
  /* 예고는 판마다 한 번만 뽑는다 — 자리마다 부르면 클론을 자리 수만큼 뜬다 */
  const IM = intentMap(forecast());

  /* 죽었거나 사라진 자리를 걷는다.
     단 「지금 사라지는 중」이라 표가 붙은 것은 연출이 끝낼 때까지 둔다 —
     안 그러면 끊는 연출이 시작도 하기 전에 계기판이 없어진다 */
  for(const [ix, el] of [...STAGE_ELS]){
    const n = S.nodes[ix];
    if((!n || n.dead) && !el.dataset.dying){ el.remove(); STAGE_ELS.delete(ix) }
  }

  alive(S).forEach(n=>{
    const ix = S.nodes.indexOf(n);
    let el = STAGE_ELS.get(ix), fresh = false;
    if(!el){
      el = document.createElement('div');
      el.className = 'gz';
      el.innerHTML =
        '<div class="bezel"></div>'
      + '<div class="body"></div><div class="face"><div class="stg"></div></div>'
      + '<svg class="dial" viewBox="0 0 200 200"></svg><div class="glass"></div>'
      + '<svg class="atts" viewBox="0 0 200 200"></svg>'
      + '<div class="halo"></div><div class="chips"></div>';
      el.onclick = () => stageNodeClick(ix);
      /* 판 전체에 거는 자리라면, 올려 놓은 동안만 대상을 켠다 (무대.방사) */
      el.onmouseenter = () => emitLight(S.nodes[ix], true);
      el.onmouseleave = () => emitLight(S.nodes[ix], false);
      B.appendChild(el); STAGE_ELS.set(ix, el); fresh = true;
    }
    /* 자리마다 제 크기를 쓴다 — 병 노드는 줄의 부수 증상보다 크게 앉는다.
       줄 크기(SZ)를 그대로 쓰면 stageLayout 이 병 노드에 따로 매긴 값이 버려진다 */
    const sz = n.sz || SZ;
    el.style.left = n.px+'px'; el.style.top = n.py+'px';
    el.style.width = sz+'px'; el.style.height = sz+'px';

    const r = reaction(S, n), imm = immune(S, n);
    el.classList.toggle('dorm',  n.dormT>0 || n.val===0);
    el.classList.toggle('ready', !imm && r!==null && r!=='none');
    el.classList.toggle('noshield', !n.shielded);
    el.classList.toggle('sh50',  !!n.shielded && n.shReduc > R.SHIELD_CUT);
    /* 떨림은 툴팁과 같은 조건을 본다 (문안.진화임박) — 두 벌로 적으면 판은
       떨고 있는데 설명은 아직 「진화하면」이라 하는 일이 난다 */
    el.classList.toggle('warn',  evoSoon(n));
    el.classList.toggle('sel',   SEL===live.indexOf(n));
    el.classList.toggle('tgt',   STAGE_MODE!==null);
    el.classList.toggle('dis',   n.role==='disease');
    el.classList.toggle('imm',   imm);
    el.classList.toggle('evo',   !!n.evolved);
    el.classList.toggle('held',  n.growHold>0 || n.delayed>0);
    /* 판 전체에 거는 자리는 제 색으로 파문을 두른다 (무대.방사) */
    const em = EMIT[n.sym];
    el.classList.toggle('emit', emitOn(S, n));
    if(em) el.style.setProperty('--emit', em.col);

    /* 그림은 안 바뀌었으면 다시 꽂지 않는다. SVG 를 매 수마다 새로 파싱하는
       것이 그리기 비용의 절반이었다 — 문자열이 같으면 손대지 않는다 */
    setHTML(el.querySelector('.stg'),   stgArt(n));
    setHTML(el.querySelector('.dial'),  dialSVG(S, n));
    /* 눈금은 자리 크기를 따른다 (무대.배지의 좌표계). 값이 같으면 손대지
       않는다 — 속성을 다시 박으면 브라우저가 SVG 배치를 다시 잰다 */
    const atts = el.querySelector('.atts'), vb = `0 0 ${attsBox(sz)} ${attsBox(sz)}`;
    if(atts.getAttribute('viewBox') !== vb) atts.setAttribute('viewBox', vb);
    setHTML(atts, badgeSVG(S, n, sz));

    /* 의도 칩 — 이번 턴 끝에 이 자리가 무엇을 하는가. 값은 커널이 냈다 (무대.의도칩).
       약화 · 지연은 이미 걸려 있는 것이라 아래 줄에 따로 붙인다 */
    const cs = [...(IM.get(ix) || []), ...standingChips(S, n)].map(chipHTML);
    const mk = standingMarks(S, n).map(markHTML);
    setHTML(el.querySelector('.chips'),
      (cs.length?`<div class="icr">${cs.join('')}</div>`:'') + (mk.length?`<div class="imr">${mk.join('')}</div>`:''));

    /* 오른쪽 위 뱃지 — 증상은 진화 시계, 병 노드는 병기 */
    /* 우상 뱃지는 병 노드의 병기 전용이다 — 증상의 진화 시계는 배지(파이)가 맡는다 */
    /* 병기가 오르면 무쇠가 한 겹씩 더 탄다 — 숫자만 바뀌면 오른 줄을 모른다.
       숫자 자체는 배지(무대.배지)의 왼쪽 판이 맡는다. 전에는 오른쪽 위 .evc
       원이 맡았는데, 병기 링을 두르면서 그 위에 겹쳐 앉아 걷었다 */
    if(n.role==='disease') el.dataset.stg = n.stage;
    else delete el.dataset.stg;

    if(fresh){ el.classList.add('pop'); setTimeout(()=>el.classList.remove('pop'), 620) }
  });

  stageLinks(live, lines);
}

/* ── 연결선 ── 촉발 · 전이 · 경화를 자리 사이에 긋는다 ───────
   목록은 받아 온다 (무대.배선목록). SG_GHOST 도 바로 앞의 stageLayout 이
   깔아 둔 것을 읽으므로, 이 둘은 stageSync 안에서만 이 차례로 돈다 */
function stageLinks(live, lines){
  if(!S) return;
  if(!SG_BW) stageMeasure();
  const W = SG_BW, H = SG_BH;
  const ns = live.filter(n=>n.role!=='disease');
  /* 판의 px 를 #sg_links 의 눈금으로 옮긴다. 1210×744 는 그 SVG 의 viewBox 이고
     (00-shell/stage.html), preserveAspectRatio="none" 이라 x 와 y 배율이 따로 논다.
     ★ 이 셈을 자리마다 손으로 적으면 한 함수 안에 눈금이 예닐곱 벌 생긴다 —
       viewBox 를 한 번 고칠 때 하나만 빠뜨려도 빈 칸과 레인과 화살촉이 서로 다른
       좌표계에 앉는데, 화면은 그냥 조금 어긋나 보일 뿐이라 못 알아본다. */
  const [VW, VH] = [1210, 744];
  const LX = x => x/W*VW, LY = y => y/H*VH;
  /* 레인은 줄 바로 위에 깐다. 판 꼭대기(34)에 못 박아 두었더니 스토리에서
     증상이 아래로 내려간 순간 배선이 병 노드를 가로질러 올라갔다.

     높이는 계기 테가 아니라 **배지 머리**에서 잡는다. 테(sz*0.56)로 잡았더니
     첫 레인이 배지 꼭대기와 같은 높이에 깔려 아홉 줄이 배지와 28곳, 계기와
     23곳에서 겹쳤다. 배지는 테 밖 58px 에 앉고 자체 반높이가 24 이므로
     꼭대기가 py − sz/2 − BADGE_PAD 다. 세 값(58 · 24 · 레인 간격)은 무대.배지와
     한 벌이라 거기가 바뀌면 여기도 바뀐다.
     ★ 이 값은 아래 병 노드 띠(DZ)도 쓴다. 두 벌로 적어 뒀더니 같은 수(82)가 한
       함수 안에 둘이 됐다 — 배지 모양이 바뀌면 한쪽만 따라가고, 그러면 레인이
       병 노드를 안 비키거나 rowTop 이 어긋난다. */
  const BADGE_PAD = 58 + 24;
  const BADGE_TOP = n => LY(n.py - n.sz/2 - BADGE_PAD);
  const rowTop = ns.length ? Math.min(...ns.map(BADGE_TOP)) : 120;

  /* 병 노드가 앉은 띠 — 레인이 여기를 지나면 안 된다.
     ★ 레인은 줄 위로 30 씩 쌓이는데, 스토리 판은 병 노드가 판 위쪽 한가운데에
       크게 앉아 있다. 레인이 서넛 되면 그 아래 테를 가로질렀다 (실측: 병 노드
       바닥 400 · 둘째 레인 머리 372). 병 노드는 배선이 닿는 자리가 아니므로
       가로지를 까닭이 없다.
     간격을 좁혀 아래에 다 욱여넣는 길도 있었지만, 그러면 줄이 둘만 돼도 레인이
       같은 높이에 겹쳐 메달이 포개졌다. 대신 **걸리는 줄만 병 노드 위로 넘긴다** —
       가로로 병 노드에 안 걸치는 줄은 제자리에 그대로 둔다. */
  const dz = live.find(n=>n.role==='disease' && n.px!==undefined);
  /* 여유는 테가 아니라 **배지 머리**에서 잡는다 — 병 노드는 테 밖으로 보호막 눈금과
     병기 · 다음 박자 배지를 두르고 있어서, 테만 피하면 그 위를 그대로 지나간다.
     BADGE_TOP 이 쓰는 것과 같은 값이다 */
  /* above 는 레인을 통째로 넘기던 때의 것이었다 — 메달만 비키는 지금은 필요 없다 */
  const DZ = dz ? {top:LY(dz.py - dz.sz/2 - BADGE_PAD), bot:LY(dz.py + dz.sz/2 + BADGE_PAD),
                   l:  LX(dz.px - dz.sz/2 - BADGE_PAD), r:  LX(dz.px + dz.sz/2 + BADGE_PAD)} : null;

  let out = '';

  /* 전이 색은 여기 하나로 둔다 — 빈 칸과 그 칸으로 가는 줄이 같은 색이라야
     둘이 한 벌로 읽힌다 */
  const C_TRANS = '#B8776F';

  /* ── 아직 안 난 자리 ── 전이 배선이 닿는 빈 칸을 먼저 깐다 (줄 아래에 놓는다).
     글자는 x 로 늘어난다: #sg_links 는 1210×744 viewBox 를 판(1512×788)에
     preserveAspectRatio="none" 로 늘여 쓰므로 x 와 y 배율이 다르다. 재서 되돌린다 —
     판 크기가 바뀌어도 따라온다. 이 SVG 에 글자를 넣는 것은 여기가 처음이다 */
  const kx = LX(1)/LY(1);
  for(const g of SG_GHOST){
    const gx=LX(g.px), gy=LY(g.py), rx=LX(g.sz/2), ry=LY(g.sz/2);
    const gt = TT(`${g.sym} — 아직 안 난 자리`,
      `<b>${esc(g.from.join(' · '))}</b> 처치 시 여기에 <b>${esc(g.sym)}</b> 자리가 난다.`
      + '<br><br><span class="d">칸만 비워 둔 것이다 — 지금은 아무것도 하지 않고,'
      + ' 아무것도 여기에 걸 수 없다.</span>');
    out += `<g class="ghz"${tip(gt)}>`
      + `<ellipse cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"`
      + ` fill="#14181C" fill-opacity=".55" stroke="${C_TRANS}" stroke-width="2.4"`
      + ` stroke-dasharray="9 8" opacity=".6"/>`
      + `<g transform="translate(${gx.toFixed(1)} ${gy.toFixed(1)}) scale(${kx.toFixed(3)} 1)">`
      + `<text text-anchor="middle" y="7" fill="${C_TRANS}" opacity=".9"`
      + ` font-size="20" font-weight="700">${esc(g.sym)}</text></g>`
      + `</g>`;
  }

  /* 감염의 퍼짐 선은 걷었다 — 자리 넷을 먹이면 선이 넷 깔려 계기 뒤로
     지나가고 의도 칩을 가로질렀다. 지금은 자리 자체의 파문이 말한다
     (무대.방사). 되살릴 거면 대상을 손으로 고르지 말고 infPool 의 열쇠를
     쓴다 — 감염 둘 · 성장 정지 · 병 노드를 그 함수가 이미 가린다. */

  /* 계기 테 꼭대기 — 줄이 여기에 붙는다. 빈 칸은 계기보다 작으므로 양 끝을
     따로 잰다. 전에는 출발점의 top 하나로 양 끝을 다 그렸는데, 그때는 줄에
     선 자리가 전부 같은 크기라 티가 안 났다 */
  const topOf = p => LY(p.py - p.sz*0.56);

  let lane = 0;
  for(const l of lines){
    const A = ns.find(x=>x.sym===l.a);
    /* 도착점이 아직 판에 없어도 전이는 그린다 — **처치하면 거기에 자리가 난다.**
       ★ 전에는 `if(!Bn) continue` 로 그 줄을 통째로 버렸다. basicLines 는 전이를
         도착점 없이도 내므로(「C는 아직 없어도 된다」) 작업대에는
         「발열 처치 시 → 탈수 무장발현」이 적히는데 무대에는 그 줄이 아예 없었다 —
         같은 판을 두 창이 다르게 말했다. 빈 칸은 stageLayout 이 미리 잡아 둔다 */
    const Bn = ns.find(x=>x.sym===l.b) || SG_GHOST.find(g=>g.sym===l.b);
    if(!A || !Bn || A.px===undefined || Bn.px===undefined || A===Bn) continue;
    const sx=LX(A.px), ex=LX(Bn.px);
    const top=topOf(A), topB=topOf(Bn);
    const ly = Math.max(14, rowTop - 20 - lane*30); lane++;
    /* 메달을 병 노드에서 비킨다.
       ★ 선 자체는 병 노드 뒤로 지나가도 된다 — 자리(z 15)가 배선(z 11) 위에
         그려지므로 가려질 뿐 겹쳐 보이지 않는다. 문제는 **메달**이었다.
         레인 가운데가 마침 병 노드 자리라, 종류 그림이 보호막 눈금 위에 얹혀
         둘 다 못 읽게 됐다. 레인을 통째로 병 노드 위로 넘겨도 봤지만 그 위
         공간이 좁아 레인 둘이 같은 높이에 겹쳤다 — 비키는 것은 메달만으로 족하다.
       띠 밖의 가까운 쪽으로 밀되, 제 줄(sx~ex) 밖으로는 안 나간다 */
    let mx = (sx+ex)/2;
    if(DZ && ly < DZ.bot && ly > DZ.top && mx > DZ.l && mx < DZ.r){
      const lo = Math.min(sx,ex) + 26, hi = Math.max(sx,ex) - 26;
      const left = DZ.l - 22, right = DZ.r + 22;
      const okL = left >= lo, okR = right <= hi;
      if(okL && okR) mx = (mx - DZ.l) < (DZ.r - mx) ? left : right;
      else if(okL)   mx = left;
      else if(okR)   mx = right;
      /* 양쪽 다 제 줄을 벗어나면 그냥 둔다 — 줄이 병 노드보다 짧다는 뜻이고,
         그때는 어디로 밀어도 제 줄 밖이라 더 나빠진다 */
    }
    /* 배선 하나가 키워드를 여럿 든다 — 색과 그림은 **기본형**이 정하고
       얹힌 강화형은 메달 옆에 작은 위성으로 붙는다. 갈래도 커널의 linkKind 로
       묻는다: 여기서 '발현'·'무장발현' 을 손으로 세던 때는 부설이 촉발 색으로
       나왔다 (전이인데). 종류 표를 두 벌로 적으면 곧 한쪽이 거짓말을 한다 */
    const hk = linkHead(l), mods = linkKws(l).filter(isEnhKw);
    const c = linkKind(l)==='trans' ? C_TRANS : (hk==='경화' ? '#4DD4C8' : '#C8B79A');
    /* 메달에 설명을 단다. 글은 작업대가 쓰는 LINKTIP 그대로다 —
       배선 규칙을 두 벌로 적으면 한쪽이 곧 거짓말을 한다 */
    const lt = kwTip(l) + `<br><br><b>${l.a}</b> 처치 시 → <b>${l.b}</b>`
      + (l.enh ? '<br><span class="d">강화형 — 이 환자에게만 걸린 배선이다.</span>' : '');
    /* 방향은 글자가 아니라 **흐르는 화살표**가 말한다.
       한때 메달에 「통증 → 발열」을 적었는데, 줄이 서넛이면 그 글이 레인마다
       하나씩 떠서 판 위쪽이 글자밭이 됐다. 선 자체가 A 에서 B 로 흐르면
       읽을 것이 없어도 방향이 보인다.

       흐름은 대시를 미는 것으로 낸다. 경로를 A→B 순으로 그으므로 dashoffset 을
       음수로 밀면 대시가 A 에서 B 로 간다 — 경로를 거꾸로 그으면 화살표도
       거꾸로 흐른다. 가로 구간 가운데에는 진행 방향을 가리키는 갈매기를 둘
       박아, 멈춰 있는 그림(갈무리 · 인쇄)에서도 방향이 남게 한다.
       메달에는 종류 그림 하나만 남긴다 — 설명은 툴팁이 든다. */
    const dir = ex > sx ? 1 : -1;
    const chev = k => `<path d="M${(mx + k - 5*dir).toFixed(1)} ${(ly-6).toFixed(1)} `
      + `L${(mx + k).toFixed(1)} ${ly} L${(mx + k - 5*dir).toFixed(1)} ${(ly+6).toFixed(1)}"`
      + ` fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
    out += `<g class="wirem"${tip(lt)}>`
      + `<path d="M${sx} ${top} V${ly} H${ex} V${topB-9}" fill="none" stroke="#14181C" stroke-width="8" stroke-linejoin="round"/>`
      + `<path class="wf${l.enh?' enh':''}" d="M${sx} ${top} V${ly} H${ex} V${topB-9}" fill="none"`
      + ` stroke="${c}" stroke-width="3.4" stroke-linejoin="round"/>`
      + `<path d="M${ex-7} ${topB-11} L${ex} ${topB-1} L${ex+7} ${topB-11} Z" fill="${c}"/>`
      + chev(34*dir) + chev(56*dir)
      + `<circle cx="${mx.toFixed(1)}" cy="${ly}" r="12.5" fill="#14181C" stroke="${c}" stroke-width="2"/>`
      + `<g transform="translate(${(mx-9).toFixed(1)},${(ly-9).toFixed(1)}) scale(.9)" fill="none"`
      + ` stroke="${c}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">`
      + `<path d="${ICO[LINKICO[hk]||'bFast']}"/></g>`
      /* 얹힌 강화형 — 메달 오른쪽에 작은 것으로 잇는다. 이름을 글로 적지 않는
         까닭은 위와 같다 (레인이 서넛이면 글자밭이 된다). 뜻은 툴팁이 든다 */
      + mods.map((k,j)=>{
          /* 23 과 18 은 눈으로 고른 값이 아니다 — 본 메달 반지름 12.5 에 위성
             8 을 더하면 20.5 이라 20 에서는 실제로 겹쳤고 (stage_check 가 잡았다),
             위성끼리도 16 이 바닥이라 17 은 아슬아슬했다 */
          const cx = mx + 23 + j*18;
          return `<circle cx="${cx.toFixed(1)}" cy="${ly}" r="8" fill="#14181C" stroke="${c}" stroke-width="1.6" opacity=".92"/>`
            + `<g transform="translate(${(cx-5.5).toFixed(1)},${(ly-5.5).toFixed(1)}) scale(.55)" fill="none"`
            + ` stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">`
            + `<path d="${ICO[LINKICO[k]||'bFast']}"/></g>`;
        }).join('')
      + `</g>`;
  }
  setHTML($('sg_links'), out);
}