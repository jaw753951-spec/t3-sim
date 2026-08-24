/* ══════════════════════════════════════════════════════════════════
   §9.4 카드 한 장의 겉모습
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
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

/* 카드 한 장 그리기 — 손패와 가방이 같은 것을 쓴다 */
function cardHTML(id, o={}){
  const c = CARDS[id], S = o.S;
  const keepLeft = S && c.keep ? c.keep-((S.keepUses||{})[id]||0) : c.keep;
  const cost = S ? cardCost(S,id) : c.cost;
  const cheap = S && c.costWhen && cost < c.cost;
  const rvOn = S && !!(S.revisitOn||{})[id];
  const dPlus = S ? ((S.diagPlus||{})[id]||0) : 0;
  return `<div class="card ${o.dim?'no':''} ${o.mark?'pick':''} ${c.dept}" ${o.onclick?`onclick="${o.onclick}"`:''}>
    <div class="chead"><span class="cost" ${cheap?'style="color:var(--calm)"':''}>${cost}</span>${bleedIcon(c,S)}<b>${esc(id)}</b>
      ${o.keyhint!==undefined?`<span class="key">${o.keyhint}</span>`:''}</div>
    <div class="cmeta">${c.dept} · ${c.verb}${c.sub?`(${c.sub})`:''}${c.kw?` · ${c.kw}`:''}${c.target==='all'?' · 전체':''}${c.target==='hand'?' · 손패':''}</div>
    <div class="ctext">${markKw(c.text||'')}</div>
    ${rvOn||dPlus?`<span class="keep on"${tip((rvOn?KWTIP['재진']+'<br><br>':'')+`이 카드에 붙은 것은 이번 전투 내내 남는다. 써도 빠지지 않는다.${dPlus?`<br><br>진단 <b>+${dPlus}</b> — 이 카드가 여는 진단 수치에 그대로 더해진다. 1막에서는 검사 파라미터에도 같이 붙는다.`:''}`)}>${[rvOn?'재진':'', dPlus?`진단 +${dPlus}`:''].filter(Boolean).join(' · ')}</span>`:''}
    ${c.keep?`<span class="keep">손에 남는다${c.keep<90?` ${keepLeft}회`:''}</span>`:''}
    ${o.foot||''}</div>`;
}
