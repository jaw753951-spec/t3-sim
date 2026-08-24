/* ══════════════════════════════════════════════════════════════════
   §9.12 카드팩 편성 — 스토리 가방
   ──────────────────────────────────────────────────────────────────
   스토리 가방은 낱장이 아니라 팩으로 짠다. 무엇을 몇 장 넣을까가 아니라
   어느 팩을 들일까가 판단이다. 팩과 대체 풀은 20-data/decks.js 의
   PACKS · SWAP 두 표가 정한다 — 이 화면은 그 표를 그릴 뿐이다.

   자리 하나 = 카드 한 장 + 그 밑의 레터박스.
   레터박스의 숫자는 이 자리에 놓을 수 있는 카드가 몇 장인가다 (지금은 0 아니면 2).
   카드를 누르면 그 자리 옆에 대체 카드 풀이 펼쳐지고 나머지 화면은 페이드 아웃된다.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 카드팩 편성 ════════════════════════════════════════════ */
//@ 화면.카드팩 — §9.12 팩으로 짜는 스토리 가방

/* 편성 중인 동안의 상태. 확정(pkDone)해야 STORY_* 로 넘어간다 —
   가방 화면에서 만지작거린 것이 곧바로 판에 얹히지 않는다.
     on    {팩id:참}          들인 팩. fixed 팩은 여기 없어도 든다
     swap  {기본카드:놓은 카드} 바꿔 둔 자리
     open  대체 풀을 펼쳐 둔 자리의 기본 카드 이름 (없으면 null) */
function openPackStory(){
  PK = {on:{...STORY_PACKS}, swap:{...STORY_SWAP}, open:null, msg:''};
  showPane('deck'); renderPack(); syncDeckBtn();
}

function pkToggle(id){
  const p = PACKS.find(x=>x.id===id), was = !!PK.on[id];
  PK.on = packPick(PK.on, id);
  PK.msg = !PK.on[id] ? `${p.name}${eul(p.name)} 뺐다 — ${p.cards.length}장.`
         : was        ? `${p.name}은(는) 이미 골라 둔 팩이다.`
         : p.group    ? (dept => `보급을 ${dept}${ro(dept)} 골랐다 — ${p.cards.join(' · ')}.`)(p.name.replace(' 보급 카드팩',''))
                      : `${p.name}${eul(p.name)} 들였다 — ${p.cards.length}장.`;
  PK.open = null; renderPack();
}

/* 받침이 있으면 '을', 없으면 '를'. 팩 이름이 늘 '팩' 으로 끝나리라는 법은 없다 */
function eul(w){
  const c = w.charCodeAt(w.length-1) - 0xAC00;
  return (c<0 || c>11171 || c%28) ? '을' : '를';
}

/* 받침이 없거나 ㄹ 이면 '로', 그 밖에는 '으로'. 외과·내과는 '로', 의공학은 '으로' */
function ro(w){
  const c = w.charCodeAt(w.length-1) - 0xAC00;
  if(c<0 || c>11171) return '으로';
  const j = c%28;
  return (j===0 || j===8) ? '로' : '으로';
}

/* 카드를 누르면 그 자리만 남고 나머지가 페이드 아웃된다.
   대체할 카드가 없는 자리(레터박스 0)도 눌린다 — 없다는 것을 그 자리에서 보인다 */
function pkOpen(base){
  PK.open = (PK.open===base ? null : base);
  renderPack();
  const slot = document.querySelector('.slot.on');
  if(slot){ slot.scrollIntoView({block:'nearest'}); pkPlace() }
}

function pkClose(){ PK.open = null; renderPack() }

function pkSwap(base, id){
  if(id===base) delete PK.swap[base]; else PK.swap[base]=id;
  PK.msg = id===base ? `「${base}」 자리를 기본으로 되돌렸다.`
                     : `「${base}」 자리에 「${id}」 를 놓았다.`;
  PK.open = null; renderPack();
}

function pkDone(){
  if(packDeck(PK.on, PK.swap).length > STORY_CAP){
    PK.msg = `${STORY_CAP}장이 상한이다. 팩 하나를 빼야 한다.`; renderPack(); return;
  }
  STORY_PACKS = {...PK.on}; STORY_SWAP = {...PK.swap};
  STORY_DECK  = packDeck(STORY_PACKS, STORY_SWAP);
  PK = null;
  showPane(MODE); syncDeckBtn();
  log(`<span class="d">스토리 가방 — ${STORY_DECK.join(' · ')}</span>`);
  render();
}

function pkCancel(){ PK=null; showPane(MODE); syncDeckBtn(); render() }

/* ── 그리기 ── */
function renderPack(){
  tipReset();
  const deck = packDeck(PK.on, PK.swap);
  const by = {외과:0, 내과:0, 의공학:0, 공통:0};
  for(const c of deck) by[CARDS[c].dept]++;
  const onN = PACKS.filter(p=>p.fixed||PK.on[p.id]).length;

  const over = deck.length > STORY_CAP;
  $('dk_body').innerHTML =
      `<div class="chart">스토리 가방 — 카드팩 <b>${onN}</b>개 · <b>${deck.length}</b>/${STORY_CAP}장</div>`
    + `<div class="bar"><span>외과 ${by.외과}</span><span>내과 ${by.내과}</span><span>의공학 ${by.의공학}</span><span>공통 ${by.공통}</span>
        <span class="right">${over?`<i class="up">상한 ${STORY_CAP}장을 넘었다</i>`:(PK.msg?`<i>${esc(PK.msg)}</i>`:'')}</span></div>`
    + packsHTML()
    + `<div class="row2" style="max-width:340px;margin-top:16px">
        <button class="go" onclick="pkDone()">이 가방으로 간다</button>
        <button onclick="pkCancel()">그만둔다</button></div>`
    + (PK.open ? `<div class="fade" onclick="pkClose()"></div>` : '');
  $('log').innerHTML = LOG.map(t=>`<div>${t}</div>`).join('');
  renderAIW();
  pkPlace();
}

/* 팩을 차례로 그리되, 묶음이 시작되는 자리에 묶음 머리를 한 줄 건다.
   묶음(보급)은 셋이 나란히 놓여 그중 하나를 고르는 것으로 보여야 한다 */
function packsHTML(){
  let out = '', group = null;
  for(const p of PACKS){
    if(p.group !== group){
      if(group) out += `</div>`;
      group = p.group;
      if(group) out += `<div class="bar">${esc(PACK_GROUP[group]||'')}</div><div class="group">`;
    }
    out += packHTML(p);
  }
  return out + (group ? '</div>' : '');
}

function packHTML(p){
  const on = p.fixed || !!PK.on[p.id];
  /* 묶음 팩은 넣고 빼는 것이 아니라 고르는 것이다 — 고른 팩에는 뺄 손잡이가 없다 */
  const knob = p.fixed ? `<span class="right d">늘 든다</span>`
             : p.group ? (on ? `<span class="right d">골랐다</span>`
                             : `<button class="mini right go" onclick="pkToggle('${p.id}')">이걸로 고른다</button>`)
                       : `<button class="mini right${on?'':' go'}" onclick="pkToggle('${p.id}')">${on?'뺀다':'들인다'}</button>`;
  return `<div class="pack ${on?'':'off'}${p.group?' ing':''}">
    <div class="packhead"><b>${esc(p.name)}</b><span class="d">${p.cards.length}장</span>${knob}</div>
    <div class="hand">${p.cards.map(base=>slotHTML(base, on)).join('')}</div></div>`;
}

/* 자리 하나 — 카드 · 레터박스 · (열려 있으면) 대체 카드 풀 */
function slotHTML(base, on){
  const id = PK.swap[base] || base;
  const pool = swapPool(base);
  const open = PK.open===base;
  const swapped = id!==base;
  return `<div class="slot${open?' on':''}">`
    + cardHTML(id, {dim: !on && !open, mark: open,
        onclick:`pkOpen('${base}')`,
        foot: swapped?`<span class="keep on">「${esc(base)}」 자리</span>`:''})
    + `<div class="lbox${pool.length?'':' zero'}"${tip(lboxTip(base, id, pool))}>
        <span>대체 카드</span><b>${pool.length}</b></div>`
    + (open ? swapsHTML(base, id, pool) : '')
    + `</div>`;
}

function lboxTip(base, id, pool){
  return TT('대체 카드 풀',
    pool.length
      ? `이 자리에 놓을 수 있는 카드 <b>${pool.length}</b>장 — ${pool.map(c=>`「${esc(c)}」`).join(' · ')}.<br>`
        + `지금 놓인 것은 <b>${esc(id)}</b>${id===base?' (기본)':''} 이다. 카드를 누르면 옆에 풀이 펼쳐진다.`
      : `이 자리를 대신할 카드가 없다. <b>${esc(base)}</b> 한 장뿐이다.`);
}

/* 페이드 아웃 위로 올라오는 판 — 자리 옆에 붙는다 */
function swapsHTML(base, cur, pool){
  return `<div class="swaps">
    <div class="swhead">대체 카드 풀 <b>${pool.length}</b></div>`
    + (pool.length
        ? pool.map(c=>cardHTML(c, {mark:c===cur, onclick:`pkSwap('${base}','${c}')`,
            foot:`<span class="keep ${c===cur?'on':'why'}">${c===cur?'지금 이 자리에 있다':'이 카드로 바꾼다'}</span>`})).join('')
        : `<div class="empty">이 자리를 대신할 카드가 없다.</div>`)
    + `<button class="mini" onclick="pkClose()">닫는다</button></div>`;
}

/* 판을 놓는다 — 툴팁과 같은 식이다. 자리 오른쪽에 붙이되 화면 밖으로 나갈 때만
   왼쪽으로 넘기고, 아래로 넘칠 때만 위로 물린다. 화면보다 긴 판은 판 안에서 구른다
   (아래 자리에서 열면 잘려 보이던 자리다).
   기준이 화면이므로 판은 fixed 다 — 자리가 화면 밖이면 먼저 자리를 끌어온다. */
function pkPlace(){
  const box = document.querySelector('.swaps'); if(!box) return;
  const card = document.querySelector('.slot.on .card'); if(!card) return;
  const r = card.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
  let x = r.right + 12, y = r.top;
  if(x + w > innerWidth  - 8) x = Math.max(8, r.left - w - 12);
  if(y + h > innerHeight - 8) y = Math.max(8, innerHeight - h - 8);
  box.style.left = x+'px'; box.style.top = y+'px';
}

/* 판을 연 채로 화면이 움직이면 자리도 같이 따라간다 */
addEventListener('scroll', ()=>{ if(PK && PK.open) pkPlace() }, true);
addEventListener('resize', ()=>{ if(PK && PK.open) pkPlace() });

/* ── 옆칸 한 줄 — 팩 몇 개 · 몇 장 · 분과 배분 ── */
function packLine(){
  const by={외과:0,내과:0,의공학:0,공통:0}; for(const c of STORY_DECK) by[CARDS[c].dept]++;
  const onN = PACKS.filter(p=>p.fixed||STORY_PACKS[p.id]).length;
  $('story_deck').innerHTML = `팩 <b>${onN}</b> · <b>${STORY_DECK.length}</b>/${STORY_CAP}장`
    + ` · 외 ${by.외과} 내 ${by.내과} 공학 ${by.의공학} 공통 ${by.공통}`;
}
