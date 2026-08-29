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
function setHTML(el, html){
  if(!el || el.__h === html) return;
  el.__h = html; el.innerHTML = html;
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

/* 예고 하나에서 자리 번호 → 칩 목록을 만든다 */
function intentMap(f){
  const m = new Map();
  const put = (i, cls, txt, why) => {
    if(i==null || i<0) return;
    (m.get(i) || m.set(i, []).get(i)).push({cls, txt, why});
  };
  const evs = f.ev || [];
  /* 턴 공격 — 자리별 원값으로 총계를 나눠 갖는다 */
  const raws = evs.filter(e=>e.t==='atk' && e.i>=0).map(e=>({i:e.i, raw:e.raw}));
  const hit  = evs.filter(e=>e.t==='hp' && e.why==='turn').reduce((a,e)=>a+e.amt, 0);
  for(const [i,v] of shareOut(hit, raws)) if(v>0) put(i, 'dmg', `체력 −${v}`, '공격');
  /* 자리 하나가 낸 피해 — 진화 즉발과 점화. 커널이 출처를 붙여 준다.
     이쪽은 커널이 자리마다 따로 올림하므로 나눠 갖지 않고 그대로 적는다 */
  for(const e of evs){
    if(e.t!=='hp' || e.why==='turn' || e.i==null || e.i<0 || !(e.amt>0)) continue;
    put(e.i, 'hp', `체력 −${e.amt}`, e.why==='evo' ? '진화' : '점화');
  }
  /* 성장 · 감염이 판에 얹는 총량 · 진화 */
  for(const e of evs){
    if(e.t==='grow'  && e.amt>0) put(e.i, 'grw', `성장 +${e.amt}`, '성장');
    if(e.t==='inf'   && e.total>0) put(e.i, 'grw', `판 +${e.total}`, '감염');
    if(e.t==='evolve') put(e.i, 'evl', '진화한다', '진화');
    if(e.t==='revive') put(e.i, 'grw', '깨어난다', '휴면');
  }
  return m;
}

/* 자리가 판에 늘 걸어 두고 있는 것 — 턴 끝 사건이 아니라 상시 효과라 사건으로 안 온다.
   전부 그 자리의 손잡이(sp)를 그대로 읽는다. 목업은 −2 · −6 · −1 로 박아 뒀는데
   탈수는 빼기가 아니라 나누기고, 통증은 처치선에 곱연산이다. */
function standingChips(S, n){
  const out = [];
  if(n.muted || n.val<=0 || n.dead) return out;
  if(n.sym==='탈수')     out.push({cls:'std', txt:`안정화 ÷${numOf(sp(n,'탈수'))}`, why:'탈수'});
  if(n.sym==='통증')     out.push({cls:'std', txt:`처치선 ×${numOf(sp(n,'통증'))}`, why:'통증'});
  if(n.sym==='호흡곤란'){ const c = sp(n,'호흡곤란') * (n.evolved?R.EVO_X2:1);
                         out.push({cls:'std', txt:`드로우 −${numOf(c)}`, why:'호흡곤란'}) }
  return out;
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
    s += `<g${tip(KWTIP['재진'] + `<br><br>이 자리 — <b>${n.diagRound}회차</b> 완료 · `
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

  /* 좌상 — 보호막 방패. 남은 칸만큼 아래에서 찬다 */
  if(n.shielded){
    const [bx,by]=P(-141,RB), left=Math.max(0, R.SHIELD_MAX-Math.floor(n.stabAcc));
    const f=left/Math.max(1,R.SHIELD_MAX), id='sgcl'+S.nodes.indexOf(n);
    s += `<g transform="translate(${bx-16},${by-17})"${tip(TT('보호막',
          `받는 피해가 <b>${pctOf(n.shReduc)}</b> 줄어든다.<br>안정화를 ${R.SHIELD_MAX} 누적하면 벗겨진다. 지금 ${Math.floor(n.stabAcc)}.`
          + `<br><br>설치물의 자동 억제는 보호막을 무시한다.`))}>`
      + `<clipPath id="${id}"><rect x="0" y="${34-34*f}" width="32" height="${34*f}"/></clipPath>`
      + `<path d="M16 1 1 6.8V18.4C1 25.7 8 31 16 33.5 24 31 31 25.7 31 18.4V6.8Z" fill="#14181C" stroke="#7AA8B2" stroke-width="1.8"/>`
      + `<path d="M16 1 1 6.8V18.4C1 25.7 8 31 16 33.5 24 31 31 25.7 31 18.4V6.8Z" fill="#7AA8B2" clip-path="url(#${id})" opacity=".85"/>`
      + `<text x="16" y="22" text-anchor="middle" font-size="13" font-weight="800"`
      + ` font-family="ui-monospace,monospace" fill="${f>.55?'#14181C':'#7AA8B2'}">${left}</text></g>`;
  }

  /* 우상 — 진화 파이. 병 노드는 병기라 여기 안 쓴다 (.evc 가 맡는다) */
  if(n.role!=='disease'){
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
            + `<br><br>진화하는 턴에 <b>진화 시점 수치의 ${pctOf(R.EVO_HIT[n.sym]||0)}</b>가 즉시 환자에게 들어간다.`
            + `<br>지금 진화하면 −${Math.ceil(n.val*(R.EVO_HIT[n.sym]||0))}.`))}>`
        +  `<circle cx="${ex}" cy="${ey}" r="17" fill="#14181C" stroke="${col}" stroke-width="1.8"/>`
        +  (p>0?`<path d="M${ex} ${ey} L${ex} ${ey-17} A17 17 0 ${p>.5?1:0} 1 ${px} ${py} Z" fill="${col}" opacity=".25"/>`:'')
        +  `<text x="${ex}" y="${ey+5.5}" text-anchor="middle" font-size="15" font-weight="800"`
        +  ` font-family="ui-monospace,monospace" fill="${col}">${n.evoLeft}</text></g>`;
    } else {
      s += `<g${tip(TT('진화까지','아직 모른다. 문진 「언제부터 아프셨나요」나 진단 1회차로 열린다.'))}>`
        +  `<circle cx="${ex}" cy="${ey}" r="17" fill="#14181C" stroke="#8d8377" stroke-width="1.6" stroke-dasharray="4 4"/>`
        +  `<text x="${ex}" y="${ey+6}" text-anchor="middle" font-size="16" font-weight="800"`
        +  ` font-family="var(--sans)" fill="#8d8377">?</text></g>`;
    }
  }

  /* 우하 — 설치물 상자. 빌려온 물건은 빗금 칸으로 가른다 */
  const rig=(n.rig||0), lent=(n.rigLent||0);
  if(rig||lent){
    const [ix,iy]=P(39,RB), w=44, h=34, cap=n.rigCap||Math.max(R.RIG_CAP_MIN,rig);
    const slots=Math.max(1, Math.min(6, cap||1)), on=Math.round(rig/Math.max(1,cap)*slots);
    s += `<g transform="translate(${ix-w/2},${iy-h/2})"${tip(TT('설치물',
          `매 턴 종료 시 이 자리를 <b>${rig+lent}</b> 억제한다. 보호막을 무시한다.`
          + (rig?`<br>상한 ${cap}`:'') + (lent?`<br>빌려온 물건 ${lent} — 남의 손을 타지 않는다`:'')
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

  /* ── 이름 ── 아래 호를 따라 새긴다 ────────────────────────
     전에는 계기 밑에 검은 이름표 상자(.info)가 따로 달려 있었다. 상자가 62px 를
     먹어서 의도 칩이 그만큼 더 내려갔고, 자리가 여섯이면 상자끼리 붙었다.
     얼굴 안으로 들이면 줄이 그만큼 촘촘해진다 — 눈금이 비워 둔 아래 110°가
     원래 계기의 명찰 자리다.

     핵심 증상은 주묵으로 한 치수 커진다. 그런데 「무엇이 핵심인가」는 외래에서
     문진 「어떻게 아프십니까」가 파는 물건이다. 그래서 체력 태그와 같은 잣대로
     가린다 (MODE==='sess' && !S.coreShown) — 안 그러면 계기가 문진을 공짜로
     흘리고, 그 칸을 사는 이유가 없어진다. 스토리는 병 노드가 곧 핵심(core:'병')
     이라 감출 것이 없고, 단판은 문진 자체가 없다. */
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
    s += `<defs><path id="sgnm${ix}" d="M${ax0.toFixed(1)} ${ay0.toFixed(1)} `
       + `A${rn} ${rn} 0 0 0 ${ax1.toFixed(1)} ${ay1.toFixed(1)}"/></defs>`
       + `<text font-family="var(--sans)" font-size="${fs.toFixed(1)}" font-weight="800"`
       + ` letter-spacing="${ls}" fill="${isCore?'#98302A':'rgba(58,53,48,.62)'}">`
       + `<textPath href="#sgnm${ix}" startOffset="50%" text-anchor="middle">${esc(nm)}</textPath></text>`;
  }
  return s;
}

/* ── 진단 링 ── 테를 두르는 점선. 이번 회차에 얼마나 쌓았는가 ── */
function diagRing(n){
  const need = Math.max(1, n.diagNeed||R.DIAG_NEED), acc = Math.min(need, n.diagAcc||0);
  const V=200, c=V/2, rr=V*0.455;
  let s='';
  for(let i=0;i<need;i++){
    /* 위쪽 반원에 고르게 — 계기판 아래는 이름표가 차지한다 */
    const a = Math.PI*(1 - (need===1 ? .5 : i/(need-1))) * 0.86 + Math.PI*0.07;
    const x = c+rr*Math.cos(a), y = c-rr*Math.sin(a);
    s += `<circle cx="${x}" cy="${y}" r="${i<acc?5:3.4}" fill="${i<acc?'#4DD4C8':'rgba(232,226,210,.30)'}"/>`;
  }
  if(n.diagRound>0){
    s += `<text x="${c}" y="${c-rr-4}" text-anchor="middle" font-size="17" font-weight="800"
            fill="#4DD4C8" font-family="ui-monospace,monospace">${'I'.repeat(Math.min(4,n.diagRound))}${n.diagRound>4?'+':''}</text>`;
  }
  return s;
}

/* ── 자리 놓기 ── 위쪽에 부채꼴로 편다 ─────────────────────── */
function stageLayout(){
  if(!S) return 0;
  if(!SG_BW) stageMeasure();
  const W = SG_BW, H = SG_BH;
  /* 가로 한 줄. 전에는 호(arc)에 앉혔는데 자리가 늘면 위아래로 벌어져
     배선이 계기판을 넘어 다녔다. 줄로 세우면 배선이 한 레인 위로만 지난다.
     병 노드는 줄에 끼지 않고 아래 가운데에 크게 앉는다 — 부수 증상과 격이 다르다. */
  const dis  = S.nodes.find(n=>n.role==='disease' && !n.dead);
  const row  = alive(S).filter(n=>n!==dis);
  const CN   = row.length || 1;
  const SZ   = Math.min(dis ? 176 : 244, (W*0.92)/CN - 26);
  const cy   = dis ? H*0.25 : H*0.40;
  row.forEach((n,i)=>{
    n.px = W*0.04 + (W*0.92)*(i+0.5)/CN;
    n.py = cy;
    n.sz = SZ;
  });
  /* 병 노드는 이름표와 칩이 아래로 더 나가므로 손패 줄에 안 닿게 더 올려 앉힌다 */
  /* 병 노드는 판의 주인공이라 부수 증상보다 확실히 크게 앉힌다 */
  if(dis){ dis.px = W/2; dis.py = H*0.655; dis.sz = Math.min(330, W*0.30) }
  return SZ;
}

/* ── 계기판 맞추기 ── 있는 것은 고치고, 없어진 것은 걷고, 난 것은 세운다 ── */
//@ 무대.계기판맞춤 — DOM 을 판에 맞춘다
function stageSync(){
  if(!STAGE_ON) return;                 // 나간 뒤에 도는 연출이 빈 판을 세우지 않게
  const B = stageBoard(); if(!B || !S) return;
  const SZ = stageLayout();
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
      + '<div class="evc"></div><svg class="atts" viewBox="0 0 200 200"></svg>'
      + '<div class="chips"></div>';
      el.onclick = () => stageNodeClick(ix);
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
    el.classList.toggle('warn',  !n.evolved && n.revealed && n.evoLeft<=1 && n.role!=='disease');
    el.classList.toggle('sel',   SEL===alive(S).indexOf(n));
    el.classList.toggle('tgt',   STAGE_MODE!==null);
    el.classList.toggle('dis',   n.role==='disease');
    el.classList.toggle('imm',   imm);
    el.classList.toggle('evo',   !!n.evolved);
    el.classList.toggle('held',  n.growHold>0 || n.delayed>0);

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
    const cs = [...(IM.get(ix) || []), ...standingChips(S, n)]
      .map(c=>`<span class="icp ${c.cls}"${tip(KWTIP[c.why] || SYMTIP[c.why] || TT(c.why, ''))}>${c.txt}</span>`);
    const mk = [];
    if(n.weak)    mk.push(`<span class="imk"${tip(KWTIP['약화'])}>약화 ${n.weak}</span>`);
    if(n.delayed) mk.push(`<span class="imk"${tip(KWTIP['지연'])}>지연 ${n.delayed}</span>`);
    setHTML(el.querySelector('.chips'),
      (cs.length?`<div class="icr">${cs.join('')}</div>`:'') + (mk.length?`<div class="imr">${mk.join('')}</div>`:''));

    /* 오른쪽 위 뱃지 — 증상은 진화 시계, 병 노드는 병기 */
    /* 우상 뱃지는 병 노드의 병기 전용이다 — 증상의 진화 시계는 배지(파이)가 맡는다 */
    const ev = el.querySelector('.evc');
    if(n.role==='disease'){ ev.textContent = n.stage; ev.className = 'evc stg2' }
    else { ev.textContent = ''; ev.className = 'evc off' }

    if(fresh){ el.classList.add('pop'); setTimeout(()=>el.classList.remove('pop'), 620) }
  });

  stageLinks();
}

/* ── 연결선 ── 촉발 · 전이 · 경화를 자리 사이에 긋는다 ─────── */
function stageLinks(){
  if(!S) return;
  if(!SG_BW) stageMeasure();
  const W = SG_BW, H = SG_BH;
  const ns = alive(S).filter(n=>n.role!=='disease');
  const shown = alive(S).some(n=>n.revealed);
  const lines = [...basicLines(ns.map(n=>n.sym)).map(l=>({...l, enh:false})),
                 ...((BOARD.enh)||[]).map(e=>({...e, enh:true}))];

  let out = '';
  let lane = 0;
  for(const l of lines){
    /* 아직 안 드러난 강화형 배선은 **한 줄도 안 그린다**.
       점선으로라도 그리면 어느 자리끼리 걸렸는지가 새어 나간다 —
       작업대가 「? → ?」 로 양 끝을 감추는 것과 같은 잣대다.
       드러나는 길은 진단 1회차나 문진 「어쩌다 다치셨어요」다. */
    if(l.enh && !shown) continue;
    const A = ns.find(x=>x.sym===l.a), Bn = ns.find(x=>x.sym===l.b);
    if(!A || !Bn || A.px===undefined || Bn.px===undefined || A===Bn) continue;
    const sx=A.px/W*1210, ex=Bn.px/W*1210;
    const top=(A.py - A.sz*0.56)/H*744, ly=34 + lane*26; lane++;
    const mx=(sx+ex)/2;
    /* 전이는 새 자리를 낳고 촉발은 있는 자리를 건드린다 — 색으로 가른다 */
    const c = (l.k==='발현'||l.k==='무장발현') ? '#B8776F' : (l.k==='경화' ? '#4DD4C8' : '#C8B79A');
    const dash = l.enh ? ' stroke-dasharray="7 6"' : '';
    out += `<g>`
      + `<path d="M${sx} ${top} V${ly} H${ex} V${top-9}" fill="none" stroke="#14181C" stroke-width="7" stroke-linejoin="round"/>`
      + `<path d="M${sx} ${top} V${ly} H${ex} V${top-9}" fill="none" stroke="${c}" stroke-width="3"${dash} stroke-linejoin="round"/>`
      + `<path d="M${ex-7} ${top-11} L${ex} ${top-1} L${ex+7} ${top-11} Z" fill="${c}"/>`
      + `<circle cx="${mx}" cy="${ly}" r="13" fill="#14181C" stroke="${c}" stroke-width="2"/>`
      + `<text x="${mx}" y="${ly+4.5}" text-anchor="middle" font-family="var(--sans)" font-size="11"`
      + ` font-weight="700" fill="${c}">${l.k[0]}</text>`
      + `</g>`;
  }
  setHTML($('sg_links'), out);
}
