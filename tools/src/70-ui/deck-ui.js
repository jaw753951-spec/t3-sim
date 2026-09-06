/* ══════════════════════════════════════════════════════════════════
   §9.11 가방 편성 · 저울 칸
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 가방 편성 ══════════════════════════════════════════════
   단판·스토리·세션이 같은 화면을 쓴다. v19 는 세션에만 있었다. */
//@ 화면.가방 — §9.11 가방 편성 · 자동 진행 규칙 칸
function openDeck(o){
  DB = {sel:{}, ...o};
  for(const c of (o.init||[])) DB.sel[c]=1;
  showPane('deck'); renderDeck(); syncDeckBtn();
}

/* 가방을 펼친 동안에는 옆의 버튼이 확정 버튼으로 바뀐다.
   단판은 낱장 편성(DB), 스토리는 카드팩 편성(PK) 이라 여는 화면도 무르는 손도 다르다 */
function syncDeckBtn(){
  for(const [id, open, on, done] of [['btn_deck_one','openDeckOne()', !!DB, 'dbDone()'],
                                     ['btn_deck_story','openPackStory()', !!PK, 'pkDone()']]){
    const b = $(id); if(!b) continue;
    if(on){ b.textContent = '이 가방으로 간다'; b.classList.add('go'); b.setAttribute('onclick', done) }
    else  { b.textContent = '가방을 연다';     b.classList.remove('go'); b.setAttribute('onclick', open) }
  }
  /* 카드팩을 편 동안에는 새 판을 까는 버튼도 잠근다 — 지금 짜는 가방이
     들어갈 판을 그 사이에 갈아 치우면 무엇을 짜던 것인지 흐려진다 */
  const sg = $('btn_story_go'); if(sg) sg.disabled = !!PK;
  syncBackBtn();          // 가방을 펼친 동안에는 무대로 돌아가는 문을 잠근다
}

function dbToggle(c){
  if(DB.sel[c]) delete DB.sel[c];
  else{
    if(Object.keys(DB.sel).length >= DB.cap){ DB.msg = `${DB.cap}장이 상한이다. 한 장을 빼고 넣어야 한다.`; renderDeck(); return }
    DB.sel[c]=1;
  }
  DB.msg=''; renderDeck();
}

function dbPreset(name){
  const list = PRESETS[name].filter(c=>DB.pool.includes(c)).slice(0, DB.cap);
  DB.sel={}; for(const c of list) DB.sel[c]=1;
  DB.msg=`${name} 편성을 얹었다.`; renderDeck();
}

function dbFill(){
  for(const c of DB.pool){ if(Object.keys(DB.sel).length>=DB.cap) break; DB.sel[c]=1 }
  renderDeck();
}

function dbClear(){ DB.sel={}; renderDeck() }

function dbDone(){
  const list = Object.keys(DB.sel);
  if(list.length < DB.min){ DB.msg = `${DB.min}장은 있어야 한다.`; renderDeck(); return }
  const cb = DB.cb; DB=null;
  showPane(MODE); syncDeckBtn();
  cb(list);
}

function dbCancel(){ const back=DB.onCancel; DB=null; showPane(MODE); syncDeckBtn(); if(back) back(); else render() }

function renderDeck(){
  tipReset();
  const n = Object.keys(DB.sel).length;
  const by = {외과:0, 내과:0, 의공학:0, 공통:0};
  for(const c of Object.keys(DB.sel)) by[CARDS[c].dept]++;
  $('dk_body').innerHTML =
    `<div class="chart">${esc(DB.title)} — 가방 ${DB.pool.length}장 중 <b>${n}</b>/${DB.cap}장. 카드 1종은 1장.</div>`
    + (DB.note?`<div class="note">${DB.note}</div>`:'')
    + `<div class="bar"><span>외과 ${by.외과}</span><span>내과 ${by.내과}</span><span>의공학 ${by.의공학}</span><span>공통 ${by.공통}</span>
        <span class="right">${DB.msg?`<i>${esc(DB.msg)}</i>`:''}</span></div>`
    + `<div class="row3" style="max-width:640px;margin-bottom:12px">`
      + Object.keys(PRESETS).map(p=>`<button onclick="dbPreset('${p}')">${p}</button>`).join('')
      + `<button onclick="dbFill()">앞에서 채운다</button><button onclick="dbClear()">비운다</button></div>`
    + `<div class="hand">` + DB.pool.map(c=>{
        const on=!!DB.sel[c];
        return cardHTML(c, {dim:!on, onclick:`dbToggle('${c}')`,
          foot: on?'<span class="keep on">넣는다</span>':''});
      }).join('') + '</div>'
    + `<div class="row2" style="max-width:340px;margin-top:16px">
        <button class="go" onclick="dbDone()">${esc(DB.okLabel||'이 가방으로 간다')}</button>
        <button onclick="dbCancel()">그만둔다</button></div>`;
  $('log').innerHTML = LOG.map(t=>`<div>${t}</div>`).join('');
  renderAIW();
}

/* ── 자동 진행 규칙 판 — 로그 아래 ── */
function renderAIW(){
  const box = $('aiwbox'); if(!box) return;
  tipFixReset('aiw');
  const off = Object.keys(AIW_DEF).filter(k=>AIW[k]!==AIW_DEF[k]);
  const SEARCH = ['beam','depth','targets'];
  const row = k => {
    const [name, what, up, down] = AIW_DOC[k];
    const body = what
      + `<br><br><b>올리면</b> ${up}<br><b>내리면</b> ${down}`
      + `<br><br><span class="d">기본값 ${AIW_DEF[k]}${AIW[k]!==AIW_DEF[k]?` · 지금 ${AIW[k]}`:''}</span>`;
    return `<label class="mk"${tipFix('aiw', TT(name, body))}>${name}${AIW[k]!==AIW_DEF[k]?' <span class="badred" style="border:0;padding:0">•</span>':''}
      <input type="number" step="${AIW_DEF[k]%1?0.05:1}" value="${AIW[k]}" onchange="aiwSet('${k}',this.value)"></label>`;
  };
  box.innerHTML = `<summary>자동 진행 규칙${off.length?` <span class="badred">고친 값 ${off.length}개</span>`:''}</summary>`
    + `<div class="note">「자동 한 턴」과 「끝까지」가 쓰는 저울이다. 두 단계로 돈다.
        먼저 지금 둘 수 있는 수를 전부 늘어놓는다 — 카드를 어느 자리에 낼지, 어느 자리를 뽑을지가 각각 한 수다.
        그다음 그 수를 둔 결과 판을 아래 항목으로 점수 매겨 가장 높은 쪽을 고르고, 코스트가 남으면 그 위에 다음 수를 또 얹는다.
        항목 이름에 마우스를 올리면 그 값이 무엇을 재는지와 올렸을 때 · 내렸을 때 손이 어떻게 달라지는지 나온다.
        전투 규칙은 바뀌지 않는다 — 자동 플레이어의 취향만 바뀐다.</div>`
    + `<div class="bar" style="margin:10px 0 6px">탐색 범위 <span class="d" style="letter-spacing:0">얼마나 넓고 깊게 볼 것인가</span></div>`
    + `<div class="mkgrid">` + SEARCH.map(row).join('') + `</div>`
    + `<div class="bar" style="margin:14px 0 6px">판을 읽는 저울 <span class="d" style="letter-spacing:0">무엇을 이득으로 볼 것인가</span></div>`
    + `<div class="mkgrid">` + Object.keys(AIW_DEF).filter(k=>!SEARCH.includes(k)).map(row).join('') + `</div>`
    + `<div class="note">점수는 절대값이 아니라 서로의 비율로 읽힌다. 「남은 일」이 사실상 기준자라
        이 값을 흔들면 나머지 전부의 무게가 같이 바뀐다. 한 항목만 보려면 다른 값을 고정하고 이것부터 만지지 않는 편이 낫다.</div>`
    + `<div class="row2"><button onclick="aiwReset()">기본값으로</button>
        <button onclick="aiwCopy()">값을 베낀다</button></div>`;
}

function aiwSet(k,v){ const x=parseFloat(v); if(!isFinite(x)) return;
  AIW[k] = (k==='beam'||k==='depth'||k==='targets') ? Math.max(1, Math.round(x)) : x;
  renderAIW(); }

function aiwReset(){ AIW={...AIW_DEF}; log('<span class="d">자동 진행 규칙을 기본값으로 되돌렸다.</span>'); render() }

function aiwCopy(){ if(navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(AIW));
  log('<span class="d">자동 진행 규칙을 베꼈다.</span>') }

function deckLine(id, list, cap){
  const by={외과:0,내과:0,의공학:0,공통:0}; for(const c of list) by[CARDS[c].dept]++;
  $(id).innerHTML = `<b>${list.length}</b>/${cap}장 · 외 ${by.외과} 내 ${by.내과} 공학 ${by.의공학} 공통 ${by.공통}`;
}

function openDeckOne(){
  openDeck({pool:POOL.d3, cap:ONE_CAP, min:3, init:ONE_DECK, title:'단판 가방',
    note:`분과 보급 ${DEPT_ALL.length}장과 NPC ${NPC6.length}장이 모두 열려 있다.`,
    cb:list=>{ ONE_DECK=list; deckLine('one_deck',ONE_DECK,ONE_CAP);
               log(`<span class="d">가방 — ${list.join(' · ')}</span>`); render() }});
}

/* 스토리 가방은 여기 없다 — 낱장이 아니라 팩으로 짠다 (70-ui/pack-ui.js). */
