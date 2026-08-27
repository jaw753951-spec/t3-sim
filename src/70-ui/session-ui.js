/* ══════════════════════════════════════════════════════════════════
   §9.19 세션 모드
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
function sessInit(){
  PICK = null;
  const key=$('ssel').value, def=SESSIONS[key];
  SESS={key, def, round:0, idx:0, budget:(+$('sbudget').value)||sessBudget(def),
        used:0, results:[], rep:0, phase:'deck', deck:null};
  LOG=[]; UNDO=[]; PANES.sess.started=true;
  log(`<b>${def.name}</b> — 환자 ${def.list.length}명 · 예산 ${SESS.budget}턴 (${BUDGET_SRC==='memo'?'메모 실측':'대본'})${ovrNote()}`);
  log(`<span class="say">간호사 — ${def.nurse.replace('__B__', SESS.budget)}</span>`);
  openSessDeck();
}

function openSessDeck(){
  const def=SESS.def, pool=POOL[def.pool];
  /* 가방을 고르는 곳은 작업대다. 무대가 덮고 있으면 잠깐 비켜 준다 —
     고르고 나면 loadPatient 끝에서 무대가 도로 올라온다 */
  if(typeof STAGE_ON!=='undefined' && STAGE_ON) stageClose();
  if(def.roundSay && def.roundSay[SESS.round]) log(`<span class="say">간호사 — ${def.roundSay[SESS.round]}</span>`);
  openDeck({pool, cap:def.cap, min:4, init:(SESS.deck||pool.slice(0,def.cap)),
    title:`${def.name}${def.rounds.length>1?` · ${SESS.round+1}라운드`:''} 가방`,
    note: pool.length<=def.cap ? '가방에 든 것이 상한과 같다 — 이 날은 고를 것이 없다.' : '',
    okLabel:'진료를 시작한다',
    onCancel:()=>{ SESS=null; render() },
    cb:list=>{ SESS.deck=list; SESS.phase='intake'; log(`<span class="d">가방 — ${list.join(' · ')}</span>`); loadPatient() }});
}

function sessList(){ return SESS.def.rounds[SESS.round] }

function loadPatient(){
  const list=sessList();
  if(SESS.idx>=list.length){
    if(SESS.round < SESS.def.rounds.length-1){
      SESS.round++; SESS.idx=0;
      log(`<span class="d">──── ${SESS.round+1}라운드 ────</span>`);
      /* 왕진은 라운드마다 가방을 다시 짠다 — 나가 있는 동안 무엇을 들고
         있는가가 왕진의 판단거리다. 외래는 하루 한 벌로 간다 */
      if(SESS.def.visit){ SESS.phase='deck'; openSessDeck(); return }
      SESS.phase='intake';
      if(SESS.def.roundSay && SESS.def.roundSay[SESS.round])
        log(`<span class="say">간호사 — ${SESS.def.roundSay[SESS.round]}</span>`);
      loadPatient(); return;
    }
    sessEnd(); return;
  }
  if(SESS.budget<=0){
    for(let r=SESS.round; r<SESS.def.rounds.length; r++)
      for(let i=(r===SESS.round?SESS.idx:0); i<SESS.def.rounds[r].length; i++)
        SESS.results.push({id:SESS.def.rounds[r][i], out:'악화', turns:0, auto:true});
    sessEnd(); return;
  }
  const id=list[SESS.idx], seed=+$('seed').value;
  BOARD=makePatient(id, seed+SESS.idx*97+SESS.round*911);
  S=newState(BOARD,{mind:'평정'}); S.board=BOARD;
  setupDeck(S, SESS.deck, mulberry32(seed+SESS.idx+SESS.round*7));
  S.rng=mulberry32(97+SESS.idx+SESS.round*31);
  S.talk=BOARD.script.talk??3; S.asked={}; S.phase='intake';
  S.tagsShown=false; S.coreShown=false; S.chronicShown=false;
  SESS.phase='intake'; SEL=null; UNDO=[];
  log(`<span class="d">──────── ${SESS.idx+1}번째 · 남은 예산 ${SESS.budget}턴 ────────</span>`);
  log(`<b>${BOARD.script.name}</b>`);
  renderSess();
  stageBattleStart();                 // 다음 사람이 들어왔다 — 무대로 넘어간다
}

function ask(qid){
  const q=QUIZ.find(x=>x.id===qid);
  if(S.asked[qid]||S.talk<=0) return;
  pushUndo(`문진 「${q.q}」`);
  S.asked[qid]=true; S.talk--;
  const p=BOARD.script;
  if(qid==='when'){ const n=alive(S).find(x=>!x.revealed)||alive(S)[0]; if(n){n.revealed=true; log(`<span class="say">「${q.q}」 → ${n.sym}의 진화까지 <b>${n.evoLeft}턴</b>`)} }
  if(qid==='how'){ S.coreShown=true; log(`<span class="say">「${q.q}」 → 핵심은 <b>${BOARD.core}</b>`) }
  if(qid==='hurt'){ for(const n of alive(S)) n.revealed=true; log(`<span class="say">「${q.q}」 → 강화형 연결선이 드러난다`) }
  if(qid==='life'){ S.tagsShown=true; log(`<span class="say">「${q.q}」 → 체력 ${S.hpMax} · ${(BOARD.tags||[]).join(' · ')||'특이 없음'}`) }
  if(qid==='past'){ S.chronicShown=true; log(`<span class="say">「${q.q}」 → ${p.chronic?'<b>만성이다.</b> 억제가 잘 안 든다':'처음이다'}`) }
  if(qid==='tried'){
    log(`<span class="say">「${q.q}」 → ${p.tried||'없음'}`);
    if(p.tried && p.tried!=='없음'){ for(const n of alive(S)) if(n.shielded) n.stabAcc=Math.min(R.SHIELD_MAX-1,n.stabAcc+4);
      log('<span class="d">이미 손댄 자리라 막이 얇다.</span>') }
  }
  renderSess();
}

function chargeTurn(){ SESS.budget--; SESS.used++ }

function startCombat(){ PICK = null; pushUndo('진료 시작'); S.phase='fight'; SESS.phase='fight'; chargeTurn(); renderSess() }

function sessEndTurn(){
  pushUndo('턴 종료');
  const f=forecast();
  endTurnHand(S); turnResolve(S);
  log(`<span class="d">— ${S.turn-1}턴 · 체력 −${f.dmg}${f.evo.length?` · 진화 ${f.evo.join('·')}`:''} · 남은 예산 ${SESS.budget}턴 —</span>`);
  SEL=null;
  if((S.hp<=0&&!BOARD.noDeath) || !alive(S).length){ sessSettle(true); return }
  if(SESS.budget<=0){ log('<span class="d">예산이 다 됐다.</span>'); sessSettle(true); return }
  chargeTurn();
  renderSess();
}

function sessSettle(auto){
  const out=outcome(S, BOARD.core);
  SESS.results.push({id:sessList()[SESS.idx], out, turns:S.turn-1, round:SESS.round});
  SESS.rep += (REP[out]||0);
  log(`<b>${out}</b> — ${BOARD.script.name.split('·')[0]}${auto?' <span class="d">(자동 정산)</span>':''}`
      + (SESS.def.visit?` <span class="d">· 평판 ${SESS.rep>0?'+':''}${SESS.rep}</span>`:''));
  SESS.idx++; SESS.phase='after';
  renderSess();
}

function sessNext(){ UNDO=[]; loadPatient() }

function sessEnd(){
  SESS.phase='done';
  const c={}; for(const r of SESS.results) c[r.out]=(c[r.out]||0)+1;
  log(`<b>끝났다.</b> ${TIER.filter(t=>c[t]).map(t=>`${t} ${c[t]}`).join(' · ')} · 남은 예산 ${SESS.budget}턴`
      + (SESS.def.visit?` · 평판 ${SESS.rep>0?'+':''}${SESS.rep}`:''));
  renderSess();
}

function sessAuto(){
  pushUndo('자동으로 끝까지');
  let g=0;
  while(g++<60){
    if(!alive(S).length || (S.hp<=0&&!BOARD.noDeath)) break;
    const t=S.turn; S.rec=[];
    aiTurn(S,{});
    const used=S.rec; S.rec=null; logUsed(t, used);
    if(!alive(S).length) break;
    endTurnHand(S); turnResolve(S);
    if(SESS.budget<=0) break;
    chargeTurn();
  }
  sessSettle(true);
}

function renderSess(){
  if(!SESS){ $('se_body').innerHTML='<div class="empty">왼쪽에서 세션을 연다.</div>'; $('se_ctrl').innerHTML=''; return }
  const box=$('se_body'), ctrl=$('se_ctrl');
  const roundTag = SESS.def.rounds.length>1 ? ` · ${SESS.round+1}/${SESS.def.rounds.length}라운드` : '';
  if(SESS.phase==='done'){
    const c={}; for(const r of SESS.results) c[r.out]=(c[r.out]||0)+1;
    box.innerHTML=`<div class="chart">끝났다 — 남은 예산 ${SESS.budget}턴${SESS.def.visit?` · 평판 ${SESS.rep>0?'+':''}${SESS.rep}`:''}</div>
      <table><tr><th>라운드</th><th>환자</th><th>결과</th><th>턴</th></tr>`
      +SESS.results.map(r=>`<tr><td>${(r.round??0)+1}</td><td>${SCRIPT[r.id]?SCRIPT[r.id].name:r.id}</td><td>${r.out}</td><td>${r.turns}</td></tr>`).join('')
      +`</table><div class="bar">${TIER.filter(t=>c[t]).map(t=>`${t} ${c[t]}명`).join(' · ')}</div>`;
    ctrl.innerHTML=`<button class="go" onclick="sessInit()">다시 본다</button>`;
    $('log').innerHTML=LOG.map(t=>`<div>${t}</div>`).join('');
  renderAIW(); return;
  }
  if(SESS.phase==='after'){
    box.innerHTML=`<div class="chart">${SESS.idx}/${sessList().length}명을 봤다${roundTag} · 남은 예산 ${SESS.budget}턴${SESS.def.visit?` · 평판 ${SESS.rep>0?'+':''}${SESS.rep}`:''}</div>`;
    const last = SESS.idx>=sessList().length && SESS.round>=SESS.def.rounds.length-1;
    const nextRound = SESS.idx>=sessList().length && !last;
    ctrl.innerHTML=`<button class="go" onclick="sessNext()">${last?'하루를 마친다':nextRound?'가방을 다시 연다':'다음 분을 들인다'}</button>`;
    $('log').innerHTML=LOG.map(t=>`<div>${t}</div>`).join('');
  renderAIW(); return;
  }
  if(!S){ box.innerHTML='<div class="empty">가방을 먼저 고른다.</div>'; ctrl.innerHTML=''; return }

  const p=BOARD.script;
  const chips = alive(S).map(n=>`<span class="chip">${n.sym}</span>`).join('')
    + basicLines(alive(S).map(n=>n.sym)).map(l=>`<span class="chip">${l.a}→${l.b} ${l.k}</span>`).join('');
  let head=`<div class="pat" id="se_patient"></div>`;
  if(S.phase==='intake'){
    head=`<div class="chart">접수 — ${p.name}${roundTag}</div><div class="chips" style="margin-bottom:12px">${chips}</div>`
      + `<div class="chart">문진 · 남은 말수 <b>${S.talk}</b></div>`
      + `<div class="quiz">`+QUIZ.map(q=>`<button class="qbtn" ${S.asked[q.id]||S.talk<=0?'disabled':''} onclick="ask('${q.id}')">
           <span class="qq">${q.q}</span><span class="qo">${q.opens}</span></button>`).join('')+`</div>`
      + head;
    ctrl.innerHTML=`<button class="go" onclick="startCombat()">진료를 시작한다</button>`;
  } else {
    ctrl.innerHTML=`<div class="row2"><button onclick="killSel()">처치</button><button onclick="sessEndTurn()">턴 종료</button></div>
      <button onclick="sessSettle(false)">여기서 정산한다 — ${outcome(S,BOARD.core)}</button>
      <button onclick="sessAuto()">자동으로 끝까지</button>`;
  }
  box.innerHTML = head
    + `<div class="field"><div><div class="nodes" id="se_nodes"></div>`
    + `<div class="wires" id="se_wires"></div><div id="se_verdict"></div></div>`
    + `<aside class="state" id="se_state"></aside></div>`
    + `<div class="bar"><span>손패</span><span id="se_piles"></span>
       <span class="right">예산 ${SESS.budget}턴 · ${SESS.idx+1}/${sessList().length}명${roundTag}${SESS.def.visit?` · 평판 ${SESS.rep>0?'+':''}${SESS.rep}`:''}</span></div>`
    + `<div class="hand" id="se_hand"></div>`;
  renderInto('se');
  $('log').innerHTML=LOG.map(t=>`<div>${t}</div>`).join('');
  renderAIW();
}
