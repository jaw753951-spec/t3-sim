/* ══════════════════════════════════════════════════════════════════
   §9.26 더미 들여다보기
   ──────────────────────────────────────────────────────────────────
   덱과 버림에 무엇이 남았는지 카드로 펼쳐 본다. 작업대와 무대가 같은
   창 하나를 쓴다 — 창(#pv)은 두 화면 위로 덮으므로 어느 쪽에서 눌러도
   같은 것이 뜬다.

   덱은 가나다 순으로 적는다. 섞인 순서 그대로 보이면 다음에 뽑을 것이
   그대로 드러난다 — 「무엇이 남았나」만 알려 주고 차례는 덮어 둔다.
   버림은 감출 것이 없으므로 최근 버린 것부터 그대로 적는다.
   ══════════════════════════════════════════════════════════════════ */
//@ 화면.더미 — §9.26 덱 · 버림에 남은 카드
let PILE_OPEN = null;                 // null | 'deck' | 'discard'

const PILE_DEF = {
  deck:    {ttl:'덱',   note:'가나다 순으로 적는다 — 뽑을 차례는 감춘다.',
            list:s=>[...s.deck].sort((a,b)=>a.localeCompare(b,'ko'))},
  discard: {ttl:'버림', note:'최근 버린 것이 앞이다.',
            list:s=>[...s.discard].reverse()},
};

function pileShow(which){
  if(!S || !PILE_DEF[which]) return;
  PILE_OPEN = which;
  $('pv').classList.add('on');
  pileRender();
}

function pileClose(){
  if(!PILE_OPEN) return;
  PILE_OPEN = null;
  $('pv').classList.remove('on');
}

/* 같은 더미를 다시 누르면 닫힌다 */
function pileToggle(which){ PILE_OPEN===which ? pileClose() : pileShow(which) }

/* 그릴 때마다 다시 그린다 — 툴팁 등록기(TIPS)가 판을 그릴 때 비워지므로
   창을 열어 둔 채 판이 바뀌면 열쇠가 끊긴다 (render · stageRender 가 부른다) */
function pileRender(){
  if(!PILE_OPEN || !S) return pileClose();
  const d = PILE_DEF[PILE_OPEN], ids = d.list(S);
  $('pv_ttl').textContent = d.ttl;
  $('pv_cnt').textContent = `${ids.length}장`;
  $('pv_note').textContent = d.note;
  $('pv_list').innerHTML = ids.length
    ? ids.map(id=>cardHTML(id, {S})).join('')
    : '<div class="empty">비었다.</div>';
}

/* 작업대 손패 줄 맨 앞에 세우는 더미 둘 */
function pileTiles(){
  return ['deck','discard'].map(k=>
    `<div class="pilebox" onclick="pileToggle('${k}')"${tip(
      `<span class="tt">${PILE_DEF[k].ttl}</span>눌러서 남은 카드를 본다.<br>${PILE_DEF[k].note}`)}>
      <div class="pn2">${k==='deck'?S.deck.length:S.discard.length}</div>
      <div class="pl2">${PILE_DEF[k].ttl}</div></div>`).join('');
}
