/* ══════════════════════════════════════════════════════════════════
   §9.25 패치 노트 창
   ──────────────────────────────────────────────────────────────────
   판본 옆의 단추를 누르면 작업대가 흐려지고 가운데에 뜬다.
   판본 하나가 한 줄이고, 줄을 누르면 그 아래가 열린다 (한 번에 여럿 열린다).
   맨 위 — 지금 판본 — 은 처음부터 열려 있다.

   글은 60-text/patch-notes.js 에만 있다. 여기는 그리기만 한다.
   본문을 읽는 규칙도 거기 주석에 적혀 있다 — 두 벌로 적지 않는다.
   ══════════════════════════════════════════════════════════════════ */

//@ 화면.패치노트 — 판본별 변경 내역 창
let PN_OPEN = false;
let PN_ROWS = null;            // 어느 줄이 펼쳐져 있는가 (판본 → true)

/* 딱지 — 적는 쪽은 우리말 그대로 적는다. 여기서는 색만 붙인다.
   여기 없는 말을 적어도 찍히기는 한다. 색이 안 붙을 뿐이다 */
const PN_TAG_CLS = {'게임플레이 변경':'play', '버그 수정':'bug', '편의성 개선':'qol'};

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

/* 본문 한 덩이를 묶음들로 가른다.
   「-」「·」「*」로 시작하면 글머리, 그 밖에 글이 있는 줄이면 묶음 이름, 빈 줄은 버린다.
   이름 없이 글머리부터 나오면 제목 없는 묶음 하나로 담는다 */
function pnParse(text){
  const out = [];
  let cur = null;
  for(const raw of String(text).split('\n')){
    const line = raw.trim();
    if(!line) continue;
    if(/^[-·*]\s*/.test(line)){
      if(!cur){ cur = {name:'', items:[]}; out.push(cur) }
      cur.items.push(line.replace(/^[-·*]\s*/, ''));
    } else {
      cur = {name:line, items:[]}; out.push(cur);
    }
  }
  return out.filter(g=>g.name || g.items.length);
}

/* 묶음 한 벌을 화면으로. name 이 비면 제목 없이 목록만 낸다 */
function pnGroups(groups, raw){
  return groups.map(g=>{
    const nm = g.name ? `<div class="pngn">${raw ? g.name : esc(g.name)}</div>` : '';
    const li = (g.items||[]).map(t=>`<li>${t}</li>`).join('');
    return `<div class="pngrp">${nm}${li?`<ul>${li}</ul>`:''}</div>`;
  }).join('');
}

/* 새 방식(body 한 덩이)이 먼저, 옛 방식(groups)이 그 다음, 둘 다 없으면 빈 칸 */
function pnBody(n){
  if(typeof n.body === 'string' && n.body.trim()){
    const g = pnParse(n.body);
    if(g.length) return pnGroups(g, true);
  }
  if(n.groups && n.groups.length) return pnGroups(n.groups, false);
  return '<div class="pnempty">아직 적지 않았다.</div>';
}

function renderPatch(){
  const box = $('pn_list'); if(!box) return;
  box.innerHTML = PATCH_NOTES.map(n=>{
    const open = !!PN_ROWS[n.v];
    const cls  = PN_TAG_CLS[n.tag] || '';
    return `<div class="pnrow ${open?'on':''}">
      <button class="pnhead" onclick="togglePatch('${n.v}')">
        <span class="pnarw">${open?'▾':'▸'}</span>
        <span class="pnv">${esc(n.v)}</span>
        ${n.tag?`<span class="pntag ${cls}">${esc(n.tag)}</span>`:''}
        <span class="pnd">${n.date?esc(n.date):''}</span>
      </button>
      <div class="pnbody">${pnBody(n)}</div>
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
