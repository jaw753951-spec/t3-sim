/* ══════════════════════════════════════════════════════════════════
   §9.23 무대 — 전투 화면
   ──────────────────────────────────────────────────────────────────
   작업대(3열)는 그대로 두고 그 위에 덮는 한 장이다. 규칙은 한 줄도
   여기 없다 — 커널이 낸 값을 그리고, 손이 닿으면 기존 손(playCard ·
   killSel · endTurn · sessEndTurn)을 그대로 부른다.

   그래서 무대와 작업대는 언제나 같은 판을 본다. 되돌리기 · 자동 진행 ·
   배치가 무대를 몰라도 되는 이유다 — render() 가 무대까지 맞춘다.

   연출은 「부르기 전 판」과 「부른 뒤 판」을 견줘서 짠다 (fxPlanDiff).
   커널에 훅을 심지 않은 것은 규칙 파일을 건드리지 않기 위해서다.
   ══════════════════════════════════════════════════════════════════ */

//@ 무대.전역 — 무대가 떠 있는가, 무엇을 겨누는 중인가
let STAGE_ON = false;
let STAGE_MODE = null;        // null | 'card' | 'treat'  — 자리를 겨누는 중인가
let STAGE_CARD = null;        // 겨누고 있는 카드 id

/* ── 열고 닫기 ──────────────────────────────────────────────── */
//@ 무대.열기 — 작업대에서 전투로 넘어간다
function stageOpen(){
  if(!S) return;
  STAGE_ON = true; STAGE_MODE = null; STAGE_CARD = null;
  STAGE_ELS.clear();
  const b = stageBoard(); if(b) for(const e of [...b.querySelectorAll('.gz')]) e.remove();
  $('sg').classList.add('on');
  document.body.classList.add('sgon');
  /* 무대를 여는 것은 사람이 보자고 한 일이다 — 조용한 구간 안에서 열렸더라도
     첫 판만은 반드시 그린다. 안 그러면 계기판이 하나도 안 선 빈 무대가 뜨고
     다음 그리기까지 그대로 남는다 */
  const wasQuiet = STAGE_QUIET; STAGE_QUIET = false;
  try{ stageFit(); stageFlow() } finally { STAGE_QUIET = wasQuiet }
}

function stageClose(){
  STAGE_ON = false; STAGE_MODE = null; STAGE_CARD = null;
  FXQ.length = 0;
  $('sg').classList.remove('on');
  document.body.classList.remove('sgon');
  stageOvHideAll();
  render();
}

/* 1920×1080 을 화면 폭에 맞춰 통째로 줄인다 */
function stageFit(){
  const w = $('sg_wrap'), g = $('sg_stage'), box = $('sg');
  if(!w || !g || !box) return;
  /* 자를 대는 곳은 바깥 상자다. 안쪽(sg_wrap)을 재면 지난번에 내가 넣어 준
     폭을 다시 읽어 무대가 조금씩 커진다 — 우측 계기가 잘리던 이유다 */
  const k = Math.min(1, box.clientWidth/1920, (box.clientHeight-4)/1080);
  g.style.transform = `scale(${k})`;
  w.style.width  = (1920*k)+'px';
  w.style.height = (1080*k)+'px';
  stageMeasure();
  if(STAGE_ON) stageRender();
}
window.addEventListener('resize', ()=>{ if(STAGE_ON) stageFit() });

/* ── 흐름 ────────────────────────────────────────────────────
   무대에 들어오면 지금 판이 어느 단계인지 보고 알맞은 것을 띄운다.
   외래·왕진은 명단 → 문진 → 전투, 스토리는 1막 → 선언 → 방침 → 3막이다. */
//@ 무대.흐름 — 지금 무엇을 보여 줄 차례인가
function stageFlow(){
  stageOvHideAll();
  if(MODE==='sess' && SESS){
    if(SESS.phase==='done'){ stageEndShow(); return }
    if(SESS.phase==='after'){ stageQueueShow(); return }
    if(S && S.phase==='intake'){ stageAskShow(); return }
  }
  if(MODE==='story' && S && (S.act===1 || S.act===2)){ stageActShow(); return }
  stageRender();
}

/* ── 그리기 ─────────────────────────────────────────────────── */
//@ 무대.그리기 — 계기판 · 카르테 · 손패
function stageRender(){
  if(!STAGE_ON || !S || STAGE_QUIET) return;
  /* 겨누던 카드가 손에서 사라졌으면 겨눔을 푼다.
     되돌리기가 판을 통째로 갈아 끼우면 그 카드는 덱으로 돌아가는데 겨눔만 남아,
     다음에 자리를 누르는 순간 손에 없는 카드가 나간다. 판을 바꾸는 길이 여럿이라
     (되돌리기 · 다음 환자 · 새 판) 길목마다 지우는 대신 그릴 때 스스로 맞춘다. */
  if(STAGE_CARD && !S.hand.includes(STAGE_CARD)){ STAGE_MODE = null; STAGE_CARD = null }
  tipReset();
  stageSync();
  stageHud();
  stageKarte();
  stagePatient();
  stageActbar();
  stagePanel();
  stageHand();
}

/* 머리띠 — 세션이면 명단과 예산, 스토리면 막과 증거 */
function stageHud(){
  const day = $('sg_day'), qs = $('sg_qs'), qt = $('sg_qtxt'),
        bud = $('sg_budget'), act = $('sg_act');
  if(MODE==='sess' && SESS){
    const list = sessList(), doneN = SESS.results.filter(r=>(r.round??0)===SESS.round).length;
    day.textContent = SESS.def.name;
    qs.innerHTML = list.map((id,i)=>
      `<i class="${i<doneN?'done':(i===SESS.idx?'now':'')}"></i>`).join('');
    qt.textContent = `대기 ${Math.max(0, list.length-SESS.idx)}`;
    bud.innerHTML = `${Math.max(0,SESS.budget)}<i>턴 남음</i>`;
    act.style.display = SESS.def.visit ? '' : 'none';
    if(SESS.def.visit) act.textContent = `평판 ${SESS.rep>0?'+':''}${SESS.rep}`;
  } else if(MODE==='story'){
    day.textContent = (BOSS[BOARD.boss]||{}).name || '스토리';
    qs.innerHTML = '';
    qt.textContent = S.act===1 ? `증거 ${S.evid}/${SR.EVID_TOTAL}`
                   : S.policy ? `${S.correct?'정진단':'오진'}` : '';
    bud.innerHTML = '';
    act.style.display = '';
    act.textContent = `${S.act}막${S.policy?' · '+S.policy:''}`;
  } else {
    day.textContent = BOARD.script ? BOARD.script.name.split(' · ')[0] : `레벨 ${BOARD.level}`;
    qs.innerHTML = ''; qt.textContent = '단판';
    bud.innerHTML = ''; act.style.display = 'none';
  }
}

/* 카르테 — 이 사람에 대해 지금까지 알아낸 것만 적는다 */
function stageKarte(){
  const p = BOARD.script;
  const nameFull = p ? p.name : (BOARD.boss ? (BOSS[BOARD.boss]||{}).name : `레벨 ${BOARD.level} 환자`);
  const bits = String(nameFull).split(' · ');
  const boss = !!BOARD.boss;
  const who = bits.length>1 ? (boss ? bits[0] : bits.slice(1).join(' · ')) : bits[0];
  const what = bits.length>1 ? (boss ? bits.slice(1).join(' · ') : bits[0]) : '';
  $('sg_kname').textContent = who;
  $('sg_kmeta').textContent = (what?what+' · ':'') + (p?`Lv${p.lv}`:`Lv${BOARD.level||'—'}`);

  const hide = (MODE==='sess' && !S.tagsShown);
  $('sg_ktags').innerHTML = hide
    ? '<span class="ktag hid">체력 태그 미상</span>'
    : ((BOARD.tags||[]).length
        ? (BOARD.tags||[]).map(t=>`<span class="ktag"${tip(TT(t, `체력 <b>×${HP_TAG[t]}</b>`))}>${esc(t)} ×${HP_TAG[t]}</span>`).join('')
        : '<span class="ktag">특이 없음</span>');

  $('sg_kchief').textContent = chiefOf();

  const asked = (S.asked && !Array.isArray(S.asked)) ? Object.keys(S.asked).filter(k=>S.asked[k]) : [];
  $('sg_kask').innerHTML = asked.length
    ? asked.map(id=>{ const q=QUIZ.find(x=>x.id===id); return q
        ? `<span class="ai">${esc(q.q)}<em>${esc(q.opens)}</em></span>` : '' }).join('')
    : `<span style="color:var(--mut)">${MODE==='sess'?'묻지 않았다':'—'}</span>`;
}

/* 환자 — 체력 고리 · 흉상 · 정신 */
function stagePatient(){
  const f = forecast();
  const hp = Math.max(0, S.hp), pct = hp/Math.max(1,S.hpMax);
  const fore = Math.max(0, hp - f.dmg)/Math.max(1,S.hpMax);
  const C = 2*Math.PI*100;
  $('sg_ring').innerHTML =
    `<circle cx="108" cy="108" r="100" fill="none" stroke="#14181C" stroke-width="13"/>`
  + `<circle cx="108" cy="108" r="100" fill="none" stroke="#98302A" stroke-width="13"
       stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct)}" transform="rotate(-90 108 108)"/>`
  + `<circle cx="108" cy="108" r="100" fill="none" stroke="#E8E2D2" stroke-width="13"
       stroke-dasharray="${C}" stroke-dashoffset="${C*(1-fore)}" transform="rotate(-90 108 108)"/>`;

  const bust = $('sg_bust');
  if(!bust.dataset.drawn){ bust.innerHTML = bustSVG(); bust.dataset.drawn = '1' }

  /* 설명은 작업대와 같은 것을 쓴다. 여기는 속성에 직접 다는 자리라 열쇠만 받는다 */
  const hpEl = $('sg_hp');
  hpEl.innerHTML = `${(MODE==='sess'&&!S.tagsShown)?'?':hp}<i>${f.dmg?'−'+f.dmg:''}</i>`;
  hpEl.setAttribute('data-tip', tipKey(TT('환자 체력', hpTipBody(S, f))));

  const m = $('sg_mind');
  m.textContent = S.mind;
  m.className = S.mind==='평정' ? '' : (S.mind==='의식불명' ? 'ko' : 'bad');
  m.setAttribute('data-tip', tipKey(TT('정신 · '+S.mind, mindTipBody(S))));
}

/* 고른 자리 한 줄 — 지금 끊으면 무슨 일이 나는가 */
function stageActbar(){
  const bar = $('sg_actbar');
  const n = alive(S)[SEL];
  if(!n){ bar.classList.remove('on'); return }
  bar.classList.add('on');
  $('sg_an').textContent = n.role==='disease' ? '병 노드' : n.sym;
  const r = reaction(S,n), imm = immune(S,n);
  let v;
  if(imm) v = '1막의 병은 무적이다 — <u>진단</u>만 통한다';
  else if(r===null) v = `처치선까지 <u>${n.val - killLine(S,n)}</u> 남았다`;
  else if(r==='none') v = '휴면 — 보상 없음 · 연결선도 터지지 않는다';
  else {
    const fires = basicLines(alive(S).filter(x=>x.role!=='disease').map(x=>x.sym))
      .concat((BOARD.enh||[]).filter(()=>alive(S).some(x=>x.revealed)))
      .filter(l=>l.a===n.sym).map(l=>`${l.b} ${l.k}`);
    v = `${r==='strong'?'강반응':'약반응'} · 전체 −${sweepAmt(n)}`
      + (fires.length?` · <u>${fires.join(' / ')}</u>`:'')
      + (r==='strong'?' · <u>정신이 무너진다</u>':'');
  }
  $('sg_av').innerHTML = v + '<br>' + nodeMarks(S, n);
}

/* 우측 계기 — 턴 · 코스트 · 파일. 아래칸 카르테는 stageKarte() 가 채운다 */
function stagePanel(){
  $('sg_turn').textContent = S.turn;
  $('sg_spent').textContent = MODE==='sess' && SESS ? `${SESS.idx+1}/${sessList().length}명` : '';
  const en = Math.max(R.ENERGY, S.energy);
  $('sg_energy').innerHTML = Array.from({length:en},(_,i)=>`<i class="${i<S.energy?'on':''}"></i>`).join('');

  /* 1막에는 끊을 것이 없다 — 그 자리를 「병명을 선언한다」가 쓴다 */
  const tb = $('sg_treat');
  if(MODE==='story' && S.act===1){
    tb.className = 'btn' + (S.evid>=SR.EVID_AIM ? '' : ' off');
    tb.firstChild.nodeValue = '병명을 선언한다';
    $('sg_treatc').textContent = `증거 ${S.evid}/${SR.EVID_TOTAL}`;
  } else {
    const n = alive(S)[SEL];
    const canT = n && !immune(S,n) && reaction(S,n)!==null && !verdictNow();
    tb.className = 'btn' + (STAGE_MODE==='treat' ? ' on' : (canT||n ? '' : ' off'));
    tb.firstChild.nodeValue = '처치';
    $('sg_treatc').textContent = `${R.KILL_COST}코${S.mind==='공황'?' · 다음 턴':''}`;
  }

  const sb = $('sg_settle');
  const canS = MODE==='sess' && SESS && SESS.phase==='fight';
  sb.className = 'btn' + (canS ? '' : ' off');
  $('sg_settlec').textContent = canS ? outcome(S, BOARD.core) : '—';

  $('sg_pDeck').textContent = S.deck.length;
  $('sg_pDisc').textContent = S.discard.length;
  $('sg_pHand').textContent = S.hand.length;

  const eb = $('sg_end');
  eb.className = verdictNow() ? 'off' : '';
  eb.textContent = verdictNow() ? `${verdictNow()} — 정산한다` : '턴 종료';
}

/* 손패 — 카드 한 장의 겉모습은 작업대와 같은 것을 쓴다 (cardHTML).
   적힌 값과 실제 값, 그 이유까지 전부 딸려 온다 */
function stageHand(){
  const selNode = alive(S)[SEL];
  const pend = PICK ? CARDS[PICK.id] : null;
  let left = [];
  if(pend){
    left = handPicks(S, PICK.id);
    for(const x of PICK.chosen){ const i=left.indexOf(x); if(i>=0) left.splice(i,1) }
  }
  $('sg_hand').innerHTML = (pend
    ? `<div class="empty" style="width:100%">「${esc(PICK.id)}」 — ${pickNeed(S,PICK.id)-PICK.chosen.length}장 더 고른다. <span class="d">Esc 로 취소</span></div>`
    : '')
  + S.hand.map(id=>{
      if(pend){
        const okPick = left.includes(id);
        return cardHTML(id, {S, node:selNode, dim:!okPick, mark:okPick,
          onclick: okPick?`stagePickCard('${id}')`:''});
      }
      const {ok, why} = cardWhy(S, id, selNode);
      const aiming = STAGE_MODE==='card' && STAGE_CARD===id;
      return cardHTML(id, {S, node:selNode, dim:!ok, mark:aiming,
        onclick:`stageCardClick('${id}')`,
        foot: why?`<span class="keep why">${why}</span>`:''});
    }).join('') || '<div class="empty">손이 비었다.</div>';
}

/* ── 환자 흉상 ── 그림 파일 없이 실루엣 하나 ─────────────────
   증상마다 바꾸지 않는다. 나중에 그림이 들어올 자리이기도 하다. */
function bustSVG(){
  return `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="sgbust" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8d8377"/><stop offset="1" stop-color="#3a352f"/></linearGradient></defs>
    <path d="M100 44c-15 0-26 12-26 28 0 11 4 20 10 26-18 7-32 20-38 38-2 6 2 12 8 12h92c6 0 10-6 8-12
             -6-18-20-31-38-38 6-6 10-15 10-26 0-16-11-28-26-28z" fill="url(#sgbust)"/>
    <path d="M74 148h52" stroke="rgba(20,18,16,.5)" stroke-width="3" fill="none"/>
    <path d="M86 72q14 8 28 0" stroke="rgba(20,18,16,.45)" stroke-width="3" fill="none" stroke-linecap="round"/>
  </svg>`;
}

/* ── 손이 닿는 자리 ─────────────────────────────────────────── */
function stageNodeClick(ix){
  if(FX_BUSY || !S) return;
  const n = S.nodes[ix]; if(!n || n.dead) return;
  const a = alive(S).indexOf(n);
  if(STAGE_MODE==='card'){ const id=STAGE_CARD; SEL=a; STAGE_MODE=null; STAGE_CARD=null; stagePlay(id); return }
  if(STAGE_MODE==='treat'){ SEL=a; STAGE_MODE=null; stageKill(); return }
  SEL = (SEL===a ? null : a);
  stageRender();
}

function stageCardClick(id){
  if(FX_BUSY || !S) return;
  const c = CARDS[id];
  if(!canPlay(S,id)){ fxq(()=>FXE.deny(`#sg_hand .card`)); fxFlush(); stageToast('지금은 낼 수 없다'); return }
  if(c.target==='node'){
    if(alive(S)[SEL]){ stagePlay(id); return }
    STAGE_MODE = (STAGE_MODE==='card' && STAGE_CARD===id) ? null : 'card';
    STAGE_CARD = STAGE_MODE ? id : null;
    if(STAGE_MODE) stageToast('놓을 자리를 고른다');
    stageRender(); return;
  }
  stagePlay(id);
}

function stagePickCard(id){
  if(FX_BUSY) return;
  const b = fxSnap(S);
  pickCard(id);
  if(!PICK) fxPlanDiff(b, {verb:'card'});
  fxFlush();
}

function stageTreatBtn(){
  if(FX_BUSY || !S) return;
  if(MODE==='story' && S.act===1){
    if(S.evid < SR.EVID_AIM){ stageToast('증거가 아직 얕다 — 오진이 나기 쉽다'); }
    stageActShow(); return;
  }
  const n = alive(S)[SEL];
  if(n && !immune(S,n) && reaction(S,n)!==null){ stageKill(); return }
  STAGE_MODE = STAGE_MODE==='treat' ? null : 'treat'; STAGE_CARD = null;
  if(STAGE_MODE) stageToast('끊을 자리를 고른다');
  stageRender();
}

function stageSettleBtn(){
  if(FX_BUSY || MODE!=='sess' || !SESS || SESS.phase!=='fight') return;
  sessSettle(false);
  stageVerdShow();
}

function stageEndBtn(){
  if(FX_BUSY || !S) return;
  if(verdictNow()){
    if(MODE==='sess' && SESS && SESS.phase==='fight'){ sessSettle(true); stageVerdShow() }
    else stageVerdShow();
    return;
  }
  stageEndTurn();
}

/* ── 손 → 커널 → 연출 ────────────────────────────────────────
   기존 손을 그대로 부른다. 앞뒤로 판을 떠서 무슨 일이 났는지만 읽는다. */
//@ 무대.행동 — 기존 손을 부르고 그 전후를 견준다
function stageAct(fn, plan){
  if(FX_BUSY || !S) return;
  const b = fxSnap(S);
  fn();
  if(S) fxPlanDiff(b, plan);
  fxFlush(()=>{ if(STAGE_ON) stageAfter() });
}

function stagePlay(id){
  STAGE_MODE = null; STAGE_CARD = null;
  const c = CARDS[id];
  stageAct(()=>playCard(id), {verb:'card', card:id, dept:c.dept});
}

function stageKill(){
  const n = alive(S)[SEL];
  if(!n) return;
  STAGE_MODE = null;
  const r = reaction(S,n), ix = S.nodes.indexOf(n);
  const el = STAGE_ELS.get(ix);
  if(el) el.dataset.dying = '1';          // 연출이 끝날 때까지 계기판을 남겨 둔다
  stageAct(()=>killSel(), {verb:'kill', killIx:ix, grade:r});
}

function stageEndTurn(){
  STAGE_MODE = null; STAGE_CARD = null;
  stageAct(()=> (MODE==='sess' ? sessEndTurn() : endTurn()), {verb:'turn'});
}

/* 연출이 끝난 뒤 — 판이 끝났으면 결과를 띄운다 */
function stageAfter(){
  if(!S) return;
  if(MODE==='sess' && SESS && SESS.phase!=='fight'){ stageVerdShow(); return }
  const v = verdictNow();
  if(v && MODE!=='sess') stageToast(`${v} — 판이 끝났다`);
  sayTurnTick();
}

/* ── 판을 뜬다 · 견준다 ──────────────────────────────────────── */
//@ 무대.스냅 — 연출이 볼 수 있는 만큼만 뜬다
function fxSnap(S){
  const dis = S.nodes.find(n=>n.role==='disease');
  return {
    hp:S.hp, mind:S.mind, turn:S.turn,
    rush:S.rush||0, remGauge:S.remGauge||0,
    evid:S.evid, stage: dis?dis.stage:0,
    len:S.nodes.length,
    nodes:S.nodes.map(n=>({
      dead:!!n.dead, val:n.val, shielded:!!n.shielded, dormT:n.dormT||0,
      evolved:!!n.evolved, weak:n.weak||0, rig:rigTotal(n), stabAcc:n.stabAcc||0,
      diagRound:n.diagRound||0, diagAcc:n.diagAcc||0, demoted:!!n.demoted,
      react: n.dead ? null : reaction(S,n),
    })),
  };
}

/* 무슨 일이 났는가 — 순서가 곧 연출 순서다.
   자리 하나에 여러 일이 겹치면 「값이 움직인 것 → 막이 깨진 것 → 잠든 것」 순이다. */
//@ 무대.연출짜기 — 전후를 견줘 줄을 세운다
function fxPlanDiff(b, plan){
  plan = plan || {};
  const cur = fxSnap(S);
  const zoneAfter = [];

  /* 처치는 그 자리의 사라짐이 먼저다 */
  if(plan.verb==='kill' && plan.killIx!=null){
    const n = S.nodes[plan.killIx];
    const was = b.nodes[plan.killIx];
    const el = STAGE_ELS.get(plan.killIx);
    if(!(n && was && !was.dead && cur.nodes[plan.killIx].dead)){
      if(el) delete el.dataset.dying;     // 못 끊었다 — 표를 도로 뗀다
    } else {
      fxq(()=>FXE.treat(n, plan.grade));
      sayEmit('kill', {key:n.role==='disease'?'병':n.sym, node:n});
      /* 촉발 · 전이 — 이 자리에서 뻗은 선이 터진다 */
      if(plan.grade && plan.grade!=='none'){
        const lines = [...basicLines(b.nodes.map((_,i)=>S.nodes[i]).filter(x=>x&&!x.dead).map(x=>x.sym)),
                       ...((BOARD.enh)||[])];
        for(const l of lines){
          if(l.a!==n.sym) continue;
          const t = alive(S).find(x=>x.sym===l.b && x!==n);
          if(t) fxq(()=>FXE.trigger(n, t, plan.grade));
        }
      }
    }
  }

  /* 자리마다 — 값 · 막 · 약화 · 설치 · 진단 · 진화 · 휴면 */
  for(let i=0;i<cur.len;i++){
    const a = b.nodes[i], c = cur.nodes[i], n = S.nodes[i];
    if(!n) continue;
    if(!a){                                   // 새로 난 자리 (전이)
      const src = plan.killIx!=null ? S.nodes[plan.killIx] : null;
      if(src) fxq(()=>FXE.spawn(src, n));
      sayEmit('spawn', {key:n.sym, node:n});
      continue;
    }
    if(a.dead || c.dead) continue;            // 이미 위에서 다뤘거나 볼 것이 없다

    if(c.val < a.val)      fxq(()=>FXE.suppress(n, a.val-c.val));
    else if(c.val > a.val && plan.verb!=='turn') fxq(()=>FXE.stabilize(n, 0));
    if(c.stabAcc > a.stabAcc && c.shielded) fxq(()=>FXE.stabilize(n, c.stabAcc-a.stabAcc));
    if(c.weak > a.weak)    fxq(()=>FXE.weaken(n, c.weak-a.weak));
    if(c.rig  > a.rig)     fxq(()=>FXE.rig(n, c.rig));
    if(c.rig  < a.rig)     fxq(()=>FXE.rigOpen(n, a.rig-c.rig));
    if(a.shielded && !c.shielded){ fxq(()=>FXE.shieldBreak(n)); sayEmit('shield', {key:n.sym, node:n}) }
    if(c.diagRound > a.diagRound){
      fxq(()=>FXE.diagnose(n, c.diagRound));
      sayEmit('diag', {key:n.sym, node:n, round:c.diagRound});
    }
    if(!a.demoted && c.demoted) fxq(()=>FXE.demote(n));
    if(!a.evolved && c.evolved){ fxq(()=>FXE.evolve(n)); sayEmit('evolve', {key:n.sym, node:n}) }
    if(a.dormT===0 && c.dormT>0){ fxq(()=>FXE.dormant(n)); sayEmit('dormant', {key:n.sym, node:n}) }
    if(a.dormT>0 && c.dormT===0 && c.val>0){ fxq(()=>FXE.revive(n)); sayEmit('revive', {key:n.sym, node:n}) }
    if(c.react !== a.react && c.react && c.react!=='none') zoneAfter.push([n, c.react]);
  }

  /* 1막 병 노드를 건드렸는데 아무것도 안 움직였다 — 튕겨 낸다 */
  if(plan.verb==='card'){
    const n = alive(S)[SEL];
    if(n && immune(S,n) && CARDS[plan.card] && CARDS[plan.card].verb!=='진단'){
      const i = S.nodes.indexOf(n);
      if(b.nodes[i] && b.nodes[i].val === cur.nodes[i].val) fxq(()=>FXE.immune(n));
    }
  }

  /* 환자 쪽 */
  if(cur.hp < b.hp){
    const d = b.hp - cur.hp;
    if(plan.verb==='turn') fxq(()=>FXE.patHit(d));
    else if(CARDS[plan.card] && CARDS[plan.card].bleed) fxq(()=>FXE.patPay(d));
    else fxq(()=>FXE.patHit(d));
  }
  if(cur.mind !== b.mind){
    const worse = ['평정','불안','공황','의식불명'].indexOf(cur.mind)
                > ['평정','불안','공황','의식불명'].indexOf(b.mind);
    fxq(()=>FXE.mind(cur.mind, worse));
    sayEmit(worse?'mind':'mindUp', {key:cur.mind});
  }

  /* 전역 게이지 */
  /* 상태판을 걷었으므로 이 셋은 환자 위에 떠서 알린다 — 붙을 계기판이 없다 */
  if(cur.rush !== b.rush)         fxq(()=>FXE.gauge('sg_pat', `기세 ${cur.rush}`, cur.rush>b.rush));
  if(cur.remGauge !== b.remGauge) fxq(()=>FXE.gauge('sg_pat', `관해 ${cur.remGauge}`, cur.remGauge>b.remGauge));
  if(cur.stage !== b.stage){
    fxq(()=>FXE.gauge('sg_pat', `병기 ${cur.stage}`, false));
    sayEmit('stage', {key:String(cur.stage)});
  }
  if(cur.evid !== b.evid) fxq(()=>FXE.gauge('sg_act', `증거 ${cur.evid}`, true));

  /* 구간을 새로 넘어선 자리는 마지막에 한 번씩 김을 뿜는다 */
  for(const [n, r] of zoneAfter) fxq(()=>FXE.zone(n, r));

  /* 턴이 넘어갔으면 손패를 새로 돌린다 */
  if(cur.turn > b.turn) fxq(()=>FXE.dealHand());

  sayHpCheck();
}

/* ── 잔손 ───────────────────────────────────────────────────── */
let SG_TOAST = null;
function stageToast(t){
  const e = $('sg_toast'); if(!e) return;
  e.textContent = t; e.classList.add('on');
  clearTimeout(SG_TOAST); SG_TOAST = setTimeout(()=>e.classList.remove('on'), 1500);
}

let SG_BUBBLE = null;
function stageBubble(txt){
  if(!STAGE_ON) return;
  const b = $('sg_bubble'); if(!b) return;
  const p = BOARD && BOARD.script;
  $('sg_bwho').textContent = p ? String(p.name).split(' · ').pop() : '환자';
  $('sg_btxt').textContent = txt;
  b.classList.add('show');
  clearTimeout(SG_BUBBLE); SG_BUBBLE = setTimeout(()=>b.classList.remove('show'), 3200);
}

/* ── 자판 ────────────────────────────────────────────────────
   무대가 떠 있으면 작업대 자판은 물러난다 (mode.js 가 STAGE_ON 을 본다) */
document.addEventListener('keydown', e=>{
  if(!STAGE_ON) return;
  const t = e.target.tagName;
  if(t==='INPUT'||t==='TEXTAREA'||t==='SELECT'||e.metaKey||e.ctrlKey||e.altKey) return;
  const k = e.key;
  if(k==='Escape'){
    e.preventDefault();
    if(PICK){ cancelPick(); stageRender(); return }
    if(STAGE_MODE){ STAGE_MODE=null; STAGE_CARD=null; stageRender(); return }
    if(document.querySelector('#sg .ov.on')) return;
    stageClose(); return;
  }
  if(FX_BUSY || document.querySelector('#sg .ov.on')) return;
  if(k==='z'||k==='Z'){ e.preventDefault(); fxSilent(()=>undoStep()); return }
  if(!S) return;
  if(k>='1'&&k<='9'){ const id=S.hand[+k-1];
    if(id){ e.preventDefault(); PICK ? stagePickCard(id) : stageCardClick(id) } return }
  if(k==='ArrowRight'||k==='ArrowLeft'){
    e.preventDefault();
    const n = alive(S).length; if(!n) return;
    SEL = SEL===null ? 0 : (SEL + (k==='ArrowRight'?1:n-1)) % n;
    stageRender(); return;
  }
  if(k==='x'||k==='X'){ e.preventDefault(); stageTreatBtn(); return }
  if(k===' '||k==='Enter'){ e.preventDefault(); stageEndBtn(); return }
  if(k==='a'||k==='A'){ e.preventDefault(); fxSilent(()=>autoTurn()); return }
});
