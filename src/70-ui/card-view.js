/* ══════════════════════════════════════════════════════════════════
   §9.4 카드 한 장의 겉모습
   ──────────────────────────────────────────────────────────────────
   카드에 적힌 숫자는 '적힌 값' 이 아니라 '지금 이 판 이 자리에서 실제로
   일어나는 값' 으로 그린다. 적힌 값보다 세지면 초록, 약해지면 빨강.
   코스트만 반대다 — 싸지는 것이 좋은 일이므로 낮아질 때 초록이다.

   실제 값은 커널의 supAmt · stabAmt · diagAmt 가 낸다. 카드가 쓰는 함수와
   판이 정산할 때 쓰는 함수가 같은 것이다 — 갈리면 카드가 거짓말을 한다.
   ══════════════════════════════════════════════════════════════════ */

/* 사혈 단수 아이콘 — 코스트 옆에 붙는다 */
//@ 화면.카드그리기 — §9.4 카드 한 장의 겉모습
function bleedIcon(c, S){
  if(!c.bleed) return '';
  const ok = !S || K.canBleed(S, c.bleed);
  const pay = S ? K.bleedPay(S, c.bleed) : Math.round((R.BLEED_PAY[c.bleed]||0)*100);
  const body = KWTIP['사혈'+c.bleed] + (S?`<br><br><b>지금 지불액 ${pay}</b>${ok?'':' <span style="color:#98302A">— 지금은 치를 수 없다</span>'}`:'');
  return `<span class="bl"${tip(body)} style="${ok?'':'opacity:.45'}">혈${c.bleed}</span>`;
}

//@ 화면.카드수치 — 적힌 값과 지금 실제로 일어나는 값
/* 이 카드의 이 열쇠가 지금 내는 값.
   base = 카드에 적힌 수 · eff = 이 판 이 자리에서 실제로 일어나는 수 */
function cardEff(S, id, key, node){
  const c = CARDS[id], v = C.cardNums(S, id);
  const kind = key==='cost' ? '코스트' : C.VAL_KIND[key];
  const base = key==='cost' ? c.cost : v[key];
  if(!S || !kind || typeof base!=='number') return {base, eff:base, kind:null};
  let eff = base;
  if(kind==='억제'){
    /* live 열쇠는 적힌 수가 아니라 지금 들어가는 원값에서 출발한다 (기세 따위) */
    const raw = (c.live===key || (c.branch && node && c.branch(S,node)===key))
              ? C.cardRaw(S, id, node) : base;
    eff = node ? K.supAmt(S, node, raw) : raw;
  }
  else if(kind==='안정화') eff = node ? K.stabAmt(S, node, base) : base;
  else if(kind==='진단')   eff = Math.max(0, K.diagAmt(S, base));
  else if(kind==='코스트') eff = v.cost;
  return {base, eff, kind};
}

/* 왜 이 값이 되었는가 — 지금 걸려 있는 수정자만 줄줄이 적는다 */
function effWhy(S, id, kind, node){
  if(!S) return [];
  const w = [], c = CARDS[id];
  if(kind==='억제'){
    if(c.live==='sup' && S.rush) w.push(`기세 ${S.rush} — 기세 1당 −${C.cardNums(S,id).per}`);
    if(S.mind==='불안'||S.mind==='공황') w.push(`${S.mind} — 억제 −${R.MIND_ANX_SUP}`);
    if(node && node.role==='disease' && K.alive(S).some(x=>x.role!=='disease'&&x.val>0))
      w.push(`부수 증상이 살아 있다 — 병 노드가 받는 피해 ${Math.round(R.DIS_SHIELD*100)}% 경감`);
    else if(node && node.shielded) w.push(`보호막 — 받는 피해 ${Math.round(node.shReduc*100)}% 경감`);
    if(node && K.immune(S,node)) w.push('1막 병 노드 — 어떤 효과도 안 통한다');
  }
  if(kind==='안정화'){
    if(S.mind==='평정') w.push(`평정 — 안정화 ×${R.MIND_CALM_STAB}`);
    const d = K.active(S).filter(x=>x.sym==='탈수');
    if(d.length) w.push(`탈수 — 안정화 ÷${Math.max(1,...d.map(x=>K.sp(x,'탈수')))}`);
    if(node && !node.shielded) w.push('이 자리엔 보호막이 없다 — 안정화가 할 일이 없다');
  }
  if(kind==='진단'){
    const dp = (S.diagPlus||{})[id]||0;
    if(dp) w.push(`이 카드에 얹힌 진단 +${dp}`);
    if(S.rem) w.push(`관해 중 — 진단 +${R.REM_DIAG_BONUS}`);
    if(S.mind==='불안'||S.mind==='공황') w.push(`${S.mind} — 진단 −${R.MIND_ANX_DIAG}`);
    if(S.mind==='의식불명') w.push(`의식불명 — 진단 −${R.MIND_ANX_DIAG + R.MIND_KO_DIAG}`);
  }
  if(kind==='코스트' && c.costWhen) w.push('이 카드는 판 상태에 따라 값이 달라진다');
  return w;
}

/* 값 하나를 글로. 적힌 값과 다르면 물들이고 왜 그런지 붙인다 */
function valSpan(S, id, key, node){
  const c = CARDS[id];
  const {base, eff, kind} = cardEff(S, id, key, node);
  if(base===undefined) return '?';
  /* 갈래가 있는 카드 — 지금 안 걸리는 쪽은 흐려 둔다.
     코스트는 갈래의 대상이 아니다. 카드가 어느 쪽으로 갈리든 값은 하나다 */
  if(S && node && c.branch && key!=='cost' && c.branch(S, node) !== key)
    return `<span class="voff"${tip(`<span class="tt">지금은 안 걸린다</span>고른 자리는 <b>${node.sym}</b> 이다.`)}>${numText(base)}</span>`;
  if(!kind || eff===base) return numText(base);
  const why = effWhy(S, id, kind, node);
  const body = `<span class="tt">${kind}</span>카드에 적힌 값 <b>${numText(base)}</b><br>`
    + `지금 실제로 <b>${numText(eff)}</b>`
    + (why.length ? '<br><br>' + why.join('<br>') : '');
  /* 코스트만 반대다 — 싸지는 쪽이 좋은 일이다 */
  return driftSpan(base, eff, body, kind!=='코스트');
}

/* 본문의 {열쇠} 를 값으로 갈아 넣는다. 없는 열쇠는 그대로 둔다 —
   서식을 잘못 적었을 때 조용히 사라지지 않고 눈에 띄게 남는다.

   키워드 밑줄(markKw)을 먼저 긋는다. markKw 는 글을 통째로 이스케이프하므로
   숫자 자리의 span 을 그보다 먼저 넣으면 태그가 글자로 보인다. */
function fillText(id, S, node){
  const v = C.cardNums(S, id);
  return markKw(String(CARDS[id].text||''))
    .replace(/\{(\w+)\}/g, (m, key) =>
      (key in v || key==='cost') ? valSpan(S, id, key, node) : m);
}

/* 카드 한 장 그리기 — 손패와 가방이 같은 것을 쓴다 */
function cardHTML(id, o={}){
  const c = CARDS[id], S = o.S, node = o.node || null;
  const keepLeft = S && c.keep ? c.keep-((S.keepUses||{})[id]||0) : c.keep;
  const rvOn = S && !!(S.revisitOn||{})[id];
  const dPlus = S ? ((S.diagPlus||{})[id]||0) : 0;
  return `<div class="card ${o.dim?'no':''} ${o.mark?'pick':''} ${c.dept}" ${o.onclick?`onclick="${o.onclick}"`:''}>
    <div class="chead"><span class="cost">${valSpan(S, id, 'cost', node)}</span>${bleedIcon(c,S)}<b>${esc(id)}</b>
      ${o.keyhint!==undefined?`<span class="key">${o.keyhint}</span>`:''}</div>
    <div class="cmeta">${c.dept} · ${c.verb}${c.sub?`(${c.sub})`:''}${c.kw?` · ${c.kw}`:''}${c.target==='all'?' · 전체':''}${c.target==='hand'?' · 손패':''}</div>
    <div class="ctext">${fillText(id, S, node)}</div>
    ${rvOn||dPlus?`<span class="keep on"${tip((rvOn?KWTIP['재진']+'<br><br>':'')+`이 카드에 붙은 것은 이번 전투 내내 남는다. 써도 빠지지 않는다.${dPlus?`<br><br>진단 <b>+${dPlus}</b> — 이 카드가 여는 진단 수치에 그대로 더해진다. 1막에서는 검사 파라미터에도 같이 붙는다.`:''}`)}>${[rvOn?'재진':'', dPlus?`진단 +${dPlus}`:''].filter(Boolean).join(' · ')}</span>`:''}
    ${c.keep?`<span class="keep">손에 남는다${c.keep<90?` ${keepLeft}회`:''}</span>`:''}
    ${o.foot||''}</div>`;
}
