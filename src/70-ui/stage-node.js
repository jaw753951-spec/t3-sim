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

   자리를 무엇으로 세는가 — S.nodes 의 자리 번호다. 증상 이름이 아니다.
   판에 같은 이름이 둘 날 수 있고, 이름은 병 노드에서 병명으로 바뀐다.
   ══════════════════════════════════════════════════════════════════ */

//@ 무대.계기판 — 자리 하나를 계기판 한 대로 그린다
const STAGE_ELS = new Map();          // 자리 번호 → 계기판 DOM

const stageBoard = () => $('sg_board');

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

/* ── 바깥에 매다는 계측기 ── 노드 밖으로 나가므로 자리 수가 많으면 접는다 ── */
function attArt(n, small){
  if(small) return '';
  const p = Math.min(1, n.val / Math.max(1, n.init));
  let out = '';
  if(n.sym==='발열')
    out += `<div class="thermoX"><div class="tube"><div class="merc" style="height:${p*100|0}%"></div></div><div class="bulb"></div></div>`;
  if(n.sym==='탈수')
    out += `<div class="ivX"><div class="ivhook"></div><div class="ivbody"><div class="water" style="height:${(1-p)*100|0}%"></div></div><div class="ivhose"></div></div>`;
  /* 설치물 — 자리 옆에 세운 작은 통. 빌려온 물건은 색이 다르다 */
  const rig = (n.rig||0), lent = (n.rigLent||0);
  if(rig || lent){
    const cap = n.rigCap || Math.max(R.RIG_CAP_MIN, rig);
    out += `<div class="rigX"><div class="rigbody"><div class="rigfill" style="height:${Math.min(100, rig/Math.max(1,cap)*100)|0}%"></div>`
         + (lent?`<div class="riglent" style="height:${Math.min(100, lent/Math.max(1,cap)*100)|0}%"></div>`:'')
         + `</div><div class="rignum">${rig+lent}</div></div>`;
  }
  return out;
}

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
  const B = stageBoard(); if(!B || !S) return 0;
  const W = B.clientWidth, H = B.clientHeight;
  const live = alive(S), CN = live.length || 1;
  const CX=W*.5, CY=H*.19, RX=W*.35, RY=H*.40, A0=203, A1=337;
  const SZ = Math.min(252, W*.205) * (CN>5 ? 0.78 : CN>3 ? 0.9 : 1);
  live.forEach((n,i)=>{
    const a = CN===1 ? 270 : A0 + (A1-A0)*i/(CN-1);
    n.px = CX + RX*Math.cos(a*Math.PI/180);
    n.py = CY - RY*Math.sin(a*Math.PI/180);
    n.sz = SZ;
  });
  return SZ;
}

/* ── 계기판 맞추기 ── 있는 것은 고치고, 없어진 것은 걷고, 난 것은 세운다 ── */
//@ 무대.계기판맞춤 — DOM 을 판에 맞춘다
function stageSync(){
  if(!STAGE_ON) return;                 // 나간 뒤에 도는 연출이 빈 판을 세우지 않게
  const B = stageBoard(); if(!B || !S) return;
  const SZ = stageLayout();
  const small = SZ < 180;

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
        '<div class="bezel"></div><svg class="dring" viewBox="0 0 200 200"></svg>'
      + '<div class="body"></div><div class="face"><div class="stg"></div></div>'
      + '<svg class="dial" viewBox="0 0 200 200"></svg><div class="glass"></div>'
      + '<div class="evc"></div><div class="atts"></div>'
      + '<div class="info"><span class="nm2"></span><span class="hr2"></span><span class="num"></span></div>';
      el.onclick = () => stageNodeClick(ix);
      B.appendChild(el); STAGE_ELS.set(ix, el); fresh = true;
    }
    el.style.left = n.px+'px'; el.style.top = n.py+'px';
    el.style.width = SZ+'px'; el.style.height = SZ+'px';

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
    setHTML(el.querySelector('.dring'), diagRing(n));
    setHTML(el.querySelector('.atts'),  attArt(n, small));

    const nm = n.role==='disease' ? '병 노드' : n.sym;
    el.querySelector('.nm2').textContent = nm + (n.evolved ? ' ✦' : '');
    el.querySelector('.num').innerHTML =
      `${n.val}<s>│</s><u>${imm ? '—' : killLine(S,n)}</u>`;

    /* 오른쪽 위 뱃지 — 증상은 진화 시계, 병 노드는 병기 */
    const ev = el.querySelector('.evc');
    if(n.role==='disease'){ ev.textContent = n.stage; ev.className = 'evc stg2' }
    else { ev.textContent = n.evolved ? '✦' : (n.revealed ? n.evoLeft : '?'); ev.className = 'evc' }

    if(fresh){ el.classList.add('pop'); setTimeout(()=>el.classList.remove('pop'), 620) }
  });

  stageLinks();
}

/* ── 연결선 ── 촉발 · 전이 · 경화를 자리 사이에 긋는다 ─────── */
function stageLinks(){
  const B = stageBoard(); if(!B || !S) return;
  const W = B.clientWidth, H = B.clientHeight;
  const ns = alive(S).filter(n=>n.role!=='disease');
  const shown = alive(S).some(n=>n.revealed);
  const lines = [...basicLines(ns.map(n=>n.sym)).map(l=>({...l, enh:false})),
                 ...((BOARD.enh)||[]).map(e=>({...e, enh:true}))];

  let out = '<defs>' + ['#C8B79A','#B8776F','#4DD4C8'].map((c,i)=>
    `<marker id="sgah${i}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">`
    + `<path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('') + '</defs>';

  for(const l of lines){
    if(l.enh && !shown) continue;                       // 아직 안 드러난 강화형 배선
    const A = ns.find(x=>x.sym===l.a), Bn = ns.find(x=>x.sym===l.b);
    if(!A || !Bn || A.px===undefined || Bn.px===undefined) continue;
    const x1=A.px/W*1000, y1=A.py/H*700, x2=Bn.px/W*1000, y2=Bn.py/H*700;
    const dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy); if(!L) continue;
    const ux=dx/L, uy=dy/L, Rr=A.sz/W*1000*.52;
    const sx=x1+ux*Rr, sy=y1+uy*Rr, ex=x2-ux*(Rr+14), ey=y2-uy*(Rr+14);
    const ci = (l.k==='발현'||l.k==='무장발현') ? 0 : (l.k==='경화' ? 2 : 1);
    const c = ['#C8B79A','#B8776F','#4DD4C8'][ci], w = l.k==='경화' ? 9 : 5;
    const dash = ci===1 ? ' stroke-dasharray="9 7"' : (l.enh ? ' stroke-dasharray="3 6"' : '');
    /* 곧게 긋고 계기판 뒤로 보낸다 (CSS 가 자리를 위에 올린다) — 배선은
       기계 뒤로 지나가는 것이 맞고, 부풀리면 오히려 가운데 자리를 덮는다 */
    out += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#14181C" stroke-width="${w+6}" stroke-linecap="round"${dash}/>`
         + `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"${dash} marker-end="url(#sgah${ci})"/>`;
  }
  setHTML($('sg_links'), out);
}
