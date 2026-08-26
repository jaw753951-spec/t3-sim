/* ══════════════════════════════════════════════════════════════════
   §9.25 패치 노트 창
   ──────────────────────────────────────────────────────────────────
   판본 옆의 단추를 누르면 작업대가 흐려지고 가운데에 뜬다.
   판본 하나가 한 줄이고, 줄을 누르면 그 아래가 열린다 (한 번에 여럿 열린다).
   맨 위 — 지금 판본 — 은 처음부터 열려 있다.

   글은 60-text/patch-notes.js 에만 있다. 여기는 그리기만 한다.
   ══════════════════════════════════════════════════════════════════ */

//@ 화면.패치노트 — 판본별 변경 내역 창
let PN_OPEN = false;
let PN_ROWS = null;            // 어느 줄이 펼쳐져 있는가 (판본 → true)

function openPatch(){
  if(!PN_ROWS){
    /* 처음 열 때는 맨 윗줄만 펼쳐 둔다 — 대개 보고 싶은 것이 지금 판본이다 */
    PN_ROWS = {};
    if(PATCH_NOTES.length) PN_ROWS[PATCH_NOTES[0].v] = true;
  }
  PN_OPEN = true;
  $('pn').classList.add('on');
  document.body.classList.add('pnon');
  renderPatch();
}

function closePatch(){
  PN_OPEN = false;
  $('pn').classList.remove('on');
  document.body.classList.remove('pnon');
}

function togglePatch(v){
  PN_ROWS[v] = !PN_ROWS[v];
  renderPatch();
}

function renderPatch(){
  const box = $('pn_list'); if(!box) return;
  box.innerHTML = PATCH_NOTES.map(n=>{
    const open = !!PN_ROWS[n.v];
    const empty = !n.groups || !n.groups.length;
    const body = empty
      ? '<div class="pnempty">아직 적지 않았다.</div>'
      : n.groups.map(g=>
          `<div class="pngrp"><div class="pngn">${esc(g.name)}</div>`
          + `<ul>${(g.items||[]).map(t=>`<li>${t}</li>`).join('')}</ul></div>`).join('');
    return `<div class="pnrow ${open?'on':''}">
      <button class="pnhead" onclick="togglePatch('${n.v}')">
        <span class="pnarw">${open?'▾':'▸'}</span>
        <span class="pnv">${esc(n.v)}</span>
        ${n.tag?`<span class="pntag ${n.tag}">${({major:'큰 판',minor:'작은 판',fix:'고침'})[n.tag]||n.tag}</span>`:''}
        <span class="pnh">${n.head?esc(n.head):'<i>—</i>'}</span>
        <span class="pnd">${n.date?esc(n.date):''}</span>
      </button>
      <div class="pnbody">${body}</div>
    </div>`;
  }).join('') || '<div class="pnempty">적어 둔 판본이 없다.</div>';
}

/* 바깥을 눌러도 닫힌다. 창 안을 누른 것은 통과시킨다 */
document.addEventListener('click', e=>{
  if(!PN_OPEN) return;
  const box = $('pn'); if(!box) return;
  if(e.target === box) closePatch();
});

document.addEventListener('keydown', e=>{
  if(PN_OPEN && e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closePatch() }
}, true);
