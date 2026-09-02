/* ══════════════════════════════════════════════════════════════════
   §9.12 단판 모드
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 단판 ═══════════════════════════════════════════════════ */
/* 사이드바 체력 태그 — 상한과 배타를 화면에서 바로 반영한다 */
//@ 화면.단판 — §9.12 단판 모드
/* 체력 태그 칸 — 표에서 만든다.
   전에는 일곱 개를 마크업에 손으로 적어 뒀는데, HP_TAG 에는 열한 개가 있고
   「환자 만들기」는 열한 개를 다 보여 주고 있었다. 두 화면이 서로 다른 목록을
   내놓던 셈이다. 아래 설명도 TAG_CAP · TAG_GROUP 을 글로 베껴 놔서
   상한이나 묶음을 고치면 곧바로 거짓말이 됐다. */
//@ 화면.태그칸 — 체력 태그 칸을 표에서 만든다
function renderTagBox(){
  const box = $('tagbox'); if(!box) return;
  box.innerHTML = TAG_LIST().map(t =>
    `<label><input type="checkbox" class="tag" value="${t}" onchange="tagPick('${t}')">${t} <span class="d">${tagLabel(t)}</span></label>`).join('');
  const note = $('tagnote');
  if(note) note.textContent = `${TAG_CAP}개까지 · `
    + TAG_GROUP.map(g=>g.join('↔')).join(' · ') + ' 은 함께 붙지 않는다';
}

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
  render();          // 판만 깐다 — 전투 화면은 사람이 문을 열 때 뜬다
}
