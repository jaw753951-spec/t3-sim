/* ══════════════════════════════════════════════════════════════════
   §9.16~17 자판 · 탭 갈아타기
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 단축키 ═════════════════════════════════════════════════
   손으로 판을 반복해 보는 작업이 본업이므로 마우스를 덜 쓰게 한다. */
//@ 화면.단축키 — §9.16 자판
const KEYHELP = '1~9 카드 · ←→ 자리 · X 처치 · Space 턴 종료 · Z 되돌리기 · A 자동 한 턴 · Esc 취소';

document.addEventListener('keydown', e=>{
  if(typeof STAGE_ON!=='undefined' && STAGE_ON) return;   // 무대에 제 자판이 있다
  if(typeof PN_OPEN!=='undefined' && PN_OPEN) return;     // 패치 노트가 덮고 있다 — 판에 손대지 않는다
  /* 더미 창이 덮고 있다 — Esc 로 그것만 닫고, 나머지 손은 판에 닿지 않는다 */
  if(typeof PILE_OPEN!=='undefined' && PILE_OPEN){
    if(e.key==='Escape'){ e.preventDefault(); pileClose() } return;
  }
  const t=e.target.tagName;
  if(t==='INPUT'||t==='TEXTAREA'||t==='SELECT'||e.metaKey||e.ctrlKey||e.altKey) return;
  /* 카드팩 편성 중 — Esc 는 펼친 대체 풀을 먼저 닫고, 없으면 편성을 무른다 */
  if(PK){ if(e.key==='Escape'){ e.preventDefault(); PK.open ? pkClose() : pkCancel() } return }
  if(DB || MODE==='batch' || MODE==='make' || MODE==='score' || !S) return;
  const inFight = MODE!=='sess' || (SESS && SESS.phase==='fight');
  const k=e.key;
  if(k==='Escape'){ e.preventDefault(); cancelPick(); return }
  if(k==='z'||k==='Z'){ e.preventDefault(); undoStep(); return }
  if(!inFight) return;
  if(k>='1'&&k<='9'){ const id=S.hand[+k-1];
    if(id){ e.preventDefault(); PICK ? pickCard(id) : playCard(id) } return }
  if(k==='ArrowRight'||k==='ArrowLeft'){
    e.preventDefault();
    const n=alive(S).length; if(!n) return;
    SEL = SEL===null ? 0 : (SEL + (k==='ArrowRight'?1:n-1)) % n;
    render(); return;
  }
  if(k==='x'||k==='X'){ e.preventDefault(); killSel(); return }
  if(k===' '||k==='Enter'){ e.preventDefault(); MODE==='sess'?sessEndTurn():endTurn(); return }
  if(k==='a'||k==='A'){ e.preventDefault(); if(MODE!=='sess') autoTurn(); return }
});

/* ═══ 모드 · 그리기 ══════════════════════════════════════════ */
//@ 화면.모드 — §9.17 탭 갈아타기
function showPane(m){
  for(const id of ['pane-one','pane-sess','pane-story','pane-batch','pane-make','pane-score','pane-deck']){
    const e=$(id); if(e) e.style.display='none';
  }
  $('pane-'+m).style.display='';
}

function setMode(m){
  PICK = null;
  if(DB || PK){ DB=null; PK=null; syncDeckBtn() }
  PANES[MODE] = {...PANES[MODE], S, BOARD, SEL, LOG, UNDO, SESS};
  MODE=m;
  const P = PANES[m]||{};
  S=P.S||null; BOARD=P.BOARD||null; SEL=P.SEL??null; LOG=P.LOG||[]; UNDO=P.UNDO||[]; SESS=P.SESS||null;
  for(const b of document.querySelectorAll('.tab')) b.classList.toggle('on', b.dataset.m===m);
  for(const id of ['side-one','side-sess','side-story','side-batch','side-make','side-score']){
    const e=$(id); if(e) e.style.display='none';
  }
  $('side-'+m).style.display='';
  showPane(m);
  const bu=$('btnundo'); if(bu) bu.disabled = !UNDO.length;
  if(!P.started){
    PANES[m].started=true;
    if(m==='one')   { newGame(); return }
    if(m==='story') { newStory(); return }
    if(m==='make')  { renderMake(); return }
  }
  render();
}
