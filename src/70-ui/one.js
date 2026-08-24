/* ══════════════════════════════════════════════════════════════════
   §9.12 단판 모드
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 단판 ═══════════════════════════════════════════════════ */
/* 사이드바 체력 태그 — 상한과 배타를 화면에서 바로 반영한다 */
//@ 화면.단판 — §9.12 단판 모드
function tagPick(t){
  const box = [...document.querySelectorAll('.tag')];
  const on = box.filter(x=>x.checked).map(x=>x.value);
  const next = box.find(x=>x.value===t).checked ? tagAdd(on.filter(x=>x!==t), t) : on.filter(x=>x!==t);
  for(const x of box) x.checked = next.includes(x.value);
}

function reseed(){ $('seed').value = (Math.random()*1e9)|0 }

function newGame(){
  PICK = null;
  const src=$('src').value, seed=+$('seed').value;
  if(src==='custom'){
    if(CUSTOM.dis){   // 병 노드는 1막·방침·병기가 있어야 돈다 — 단판에 두면 규칙이 반만 돈다
      $('boss').value='custom'; PANES.story.started=true; setMode('story'); newStory();
      log('<i>병 노드가 있는 환자라 스토리로 돌렸다.</i>'); return;
    }
    BOARD = buildCustom();
  }
  else if(src==='level'){
    const tags=[...document.querySelectorAll('.tag:checked')].map(x=>x.value);
    BOARD = makeBoard(+$('lv').value, mulberry32(seed), {tags});
  } else BOARD = makePatient(src, seed);
  S = newState(BOARD,{mind:$('mind').value}); S.board=BOARD;
  setupDeck(S, ONE_DECK, mulberry32(seed+1)); S.rng=mulberry32(seed);
  SEL=null; LOG=[]; UNDO=[]; SESS=null; PANES.one.started=true;
  log(`<b>${BOARD.script?BOARD.script.name:'레벨 '+BOARD.level}</b> · 노드 ${BOARD.nodes.length} · S ${(BOARD.S||0).toFixed(1)} · 체력 ${BOARD.hp}${ovrNote()}`);
  render();
}
