/* ══════════════════════════════════════════════════════════════════
   §9.23 무대 — 전투 화면
   ──────────────────────────────────────────────────────────────────
   작업대(3열)는 그대로 두고 그 위에 덮는 한 장이다. 규칙은 한 줄도
   여기 없다 — 커널이 낸 값을 그리고, 손이 닿으면 기존 손(playCard ·
   killSel · endTurn · sessEndTurn)을 그대로 부른다.

   그래서 무대와 작업대는 언제나 같은 판을 본다. 되돌리기 · 자동 진행 ·
   배치가 무대를 몰라도 되는 이유다 — render() 가 무대까지 맞춘다.

   연출은 커널이 S.ev 에 적어 둔 사건 줄을 읽어서 짠다 (fxPlanLog).
   커널에 심은 것은 훅이 아니라 기록이다 — 화면을 부르지 않고 배열에 밀어 넣기만
   하므로 30-core 는 여전히 화면을 모른다. S.ev 를 안 켜면 아무것도 쌓지 않는다.
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
  stageChart();
  stagePatient();
  stageDoc();
  stagePanel();
  stageHand();
  pileRender();                       // 더미 창이 떠 있으면 같이 맞춘다
}

/* ── 우측 차트 ── 이 사람에 대해 지금까지 알아낸 것만 적는다 ──
   전에는 머리띠(세션·막)와 카르테 두 칸으로 나뉘어 있었다. 한 칸으로 합쳤다.
   값은 그대로다 — 무엇을 감추는가도 그대로다 (문진 전에는 체력 태그가 「미상」). */
//@ 무대.차트 — 턴 · 사람 · 정신 · 남은 턴 · 문진
/* 이름 한 벌 — 차트 머리와 환자칸이 같은 것을 쓴다. 대본은 「병 · 사람」 순이고
   보스는 「사람 · 병」 순이라, 두 곳에서 따로 자르면 한쪽이 병명을 이름 자리에
   올린다. 자르는 손은 여기 하나만 둔다 */
//@ 무대.이름 — 이 사람을 뭐라 부르는가
function patientName(){
  const p = BOARD.script, boss = !!BOARD.boss;
  const full = p ? p.name : (boss ? (BOSS[BOARD.boss]||{}).name : `레벨 ${BOARD.level} 환자`);
  const bits = String(full).split(' · ');
  if(bits.length<2) return {who: bits[0], what: ''};
  return boss ? {who: bits[0], what: bits.slice(1).join(' · ')}
              : {who: bits.slice(1).join(' · '), what: bits[0]};
}

function stageChart(){
  const p = BOARD.script;
  const {who, what} = patientName();

  const hide = (MODE==='sess' && !S.tagsShown);
  const tags = hide
    ? '<span class="ktag hid">체력 태그 미상</span>'
    : ((BOARD.tags||[]).length
        ? (BOARD.tags||[]).map(t=>`<span class="ktag"${tip(TT(t, `체력 <b>×${HP_TAG[t]}</b>`))}>${esc(t)} ×${HP_TAG[t]}</span>`).join('')
        : '<span class="ktag">특이 없음</span>');

  /* 머리 — 턴과 사람. 막·증거는 여기 배지로 붙는다 (연출이 sg_act 를 잡는다) */
  const badge = MODE==='story'
    ? `<span id="sg_act">${S.act}막${S.policy?' · '+S.policy:''}${S.act===1?` · 증거 ${S.evid}/${SR.EVID_TOTAL}`:''}</span>`
    : `<span id="sg_act"></span>`;
  const rows = [];
  rows.push(`<div class="sec"><div class="lab">턴 ${S.turn} ${badge}</div>
    <div class="kname">${esc(who)}</div>
    <div class="kmeta">${esc((what?what+' · ':'') + (p?`Lv${p.lv}`:`Lv${BOARD.level||'—'}`))}</div>
    <div class="ktags">${tags}</div></div>`);

  rows.push(`<div class="sec"><div class="lab">정신 · ${S.mind}</div>
    <div class="body"${tip(TT('정신 · '+S.mind, mindTipBody(S)))}>${mindLine(S)}</div></div>`);

  /* 외래는 오늘 남은 턴, 스토리는 지금 방침이 판에 새긴 것 */
  if(MODE==='sess' && SESS){
    rows.push(`<div class="sec"><div class="lab">오늘 남은 턴</div>
      <div class="big">${Math.max(0,SESS.budget)}</div>
      <div class="body d">다음 환자 ${Math.max(0, sessList().length-SESS.idx-1)}명</div></div>`);
  } else if(MODE==='story' && S.act===3){
    rows.push(`<div class="sec"><div class="lab">병 노드</div>
      <div class="body"${tip(policyTip(S.policy))}>${winNote(S)}</div></div>`);
  }

  const asked = (S.asked && !Array.isArray(S.asked)) ? Object.keys(S.asked).filter(k=>S.asked[k]) : [];
  rows.push(`<div class="sec"><div class="lab">문진에서 얻은 것</div>`
    + (asked.length
        ? asked.map(id=>{ const q=QUIZ.find(x=>x.id===id); return q
            ? `<div class="ai"><em>${esc(q.opens)}</em><span>${esc(q.q)}</span><span>✓</span></div>` : '' }).join('')
        : `<div class="ai d"><span>${MODE==='sess'?'묻지 않았다':'—'}</span></div>`)
    + `</div>`);

  setHTML($('sg_chart'), rows.join(''));
}

/* 정신 한 줄 — 지금 무엇이 걸려 있는가. 값은 손잡이에서 읽는다 */
function mindLine(S){
  if(S.mind==='평정')    return `안정화가 ${numOf(R.MIND_CALM_STAB)}배로 들어간다.`;
  if(S.mind==='공황')    return '처치를 눌러도 다음 턴 시작에 들어간다.';
  if(S.mind==='의식불명') return `진단이 ${R.MIND_ANX_DIAG + R.MIND_KO_DIAG} 줄어든다.`;
  return `억제 −${R.MIND_ANX_SUP} · 진단 −${R.MIND_ANX_DIAG}.`;
}

/* 환자 — 흉상 · 체력 막대 · 정신 */
function stagePatient(){
  const f = forecast();
  const hp = Math.max(0, S.hp), pct = hp/Math.max(1,S.hpMax)*100;
  const gone = Math.min(hp, f.dmg)/Math.max(1,S.hpMax)*100;

  const bust = $('sg_bust');
  if(!bust.dataset.drawn){ bust.innerHTML = bustSVG(); bust.dataset.drawn = '1' }

  /* 이름은 차트와 같은 것을 쓴다 (무대.이름) */
  $('sg_pwho').textContent = patientName().who;

  /* 설명은 작업대와 같은 것을 쓴다. 여기는 속성에 직접 다는 자리라 열쇠만 받는다 */
  const hpEl = $('sg_hp');
  const mask = (MODE==='sess' && !S.tagsShown);
  hpEl.innerHTML = `<b>${mask?'?':hp}</b><s>/ ${mask?'?':S.hpMax}</s>`
                 + `<u>${f.dmg?`턴 끝 −${f.dmg}`:''}</u>`;
  hpEl.setAttribute('data-tip', tipKey(TT('환자 체력', hpTipBody(S, f))));

  const bar = $('sg_hpbar');
  bar.querySelector('.hf').style.width = pct+'%';
  const hg = bar.querySelector('.hg');
  hg.style.left = (pct-gone)+'%'; hg.style.width = gone+'%';
  bar.setAttribute('data-tip', tipKey(TT('환자 체력', hpTipBody(S, f))));

  const m = $('sg_mind');
  m.textContent = '정신 · ' + S.mind;
  m.className = 'mn ' + (S.mind==='평정' ? '' : (S.mind==='의식불명' ? 'ko' : 'bad'));
  m.setAttribute('data-tip', tipKey(TT('정신 · '+S.mind, mindTipBody(S))));
}

/* 차트를 붙박이로 둔다 — 마우스를 올려야만 나오면 카드를 내는 동안 못 본다 */
//@ 무대.차트고정 — 등뼈를 누르면 열어 둔다
function chartPin(){ $('sg').classList.toggle('chartpin') }

/* ── 의사 자원 ── 기세 · 관해도 ────────────────────────────────
   둘 다 게이트가 있다. 목업은 늘 띄우지만 그러면 규칙이 거짓말을 한다.
     기세    S.rushArmed — 「참조 카드가 없어도 쌓인다. 계기판만 가린다」.
             쓸 카드가 가방에 없으면 숫자가 장식으로 올라갈 뿐이다.
     관해도  S.rem || S.remOpened — 열어 본 적이 없으면 있는 줄도 몰라야 한다.
   둘 다 꺼져 있으면 칸을 통째로 비운다 (CSS 가 :empty 면 테두리도 안 그린다). */
//@ 무대.의사자원 — 기세 · 관해도. 켜진 것만 뜬다
function stageDoc(){
  const out = [];
  /* 눈금 밑에 글을 깔지 않는다 — 늘 떠 있을 값이 아니라 물어볼 값이다.
     지금 상태(관해 몇 턴째 · 유지비가 모자란가)는 툴팁 끝에 붙여 준다 */
  if(S.rushArmed){
    out.push(`<div class="grp"${tip(KWTIP['기세'] + `<br><br>지금 <b>${S.rush}</b> / ${R.RUSH_MAX}`)}>
      <div class="mrow"><span>기세</span><span class="mv">${S.rush} / ${R.RUSH_MAX}</span></div>
      <div class="meter">${Array.from({length:R.RUSH_MAX},(_,i)=>`<i class="${i<S.rush?'on':''}"></i>`).join('')}</div></div>`);
  }
  if(S.rem || S.remOpened){
    const g = S.remGauge, up = R.REM_UPKEEP;
    const now = S.rem
      ? `관해 <b>${S.remTurns}턴째</b> · 다음 턴 유지비 ${up}${g<up?' — <b>모자란다. 끝난다</b>':''}`
      : '관해가 끝났다';
    out.push(`<div class="grp"${tip(KWTIP['관해도'] + '<br><br>' + now)}>
      <div class="mrow"><span>관해도</span><span class="mv">${g} / ${R.REM_MAX}</span></div>
      <div class="meter rm">${Array.from({length:R.REM_MAX},(_,i)=>
        `<i class="${i<g-up?'on':i<g?'drain':''}"></i>`).join('')}</div></div>`);
  }
  const el = $('sg_doc');
  setHTML(el, out.length ? `<div class="lab">의사</div>${out.join('')}` : '');
}

/* 자리를 누르면 뜨던 줄(sg_actbar)은 걷었다 (되짚기 5).
   「처치선까지 N 남았다」는 계기 얼굴의 수치판이 늘 말하고, 표식(약화 · 지연 ·
   성장 정지 · 반응 강등 · 잠잠 · 만성 · 1막 무적)은 계기 아래 딱지로 내려갔다
   (stage-node.js 의 standingMarks). 눌러야만 보이던 것을 늘 보이게 바꾼 것이라
   글자 수는 줄고 읽히는 것은 늘었다.
   되살릴 거면 nodeMarks 를 그대로 쓸 수 있다 — 작업대가 아직 쓴다. */

/* 아래 줄의 손잡이 — 처치 · 코스트 · 덱 · 버림 · 정산 · 턴 종료.
   전에는 우측 패널에 있던 것들이다. 하는 일은 그대로다 */
function stagePanel(){
  const en = Math.max(R.ENERGY, S.energy);
  setHTML($('sg_energy'), Array.from({length:en},(_,i)=>`<i class="${i<S.energy?'on':''}"></i>`).join(''));

  /* 1막에는 끊을 것이 없다 — 그 자리를 「병명을 선언한다」가 쓴다 */
  const tb = $('sg_treat');
  if(MODE==='story' && S.act===1){
    tb.className = 'btn treat' + (S.evid>=SR.EVID_AIM ? '' : ' off');
    tb.firstChild.nodeValue = '병명 선언';
    $('sg_treatc').textContent = `증거 ${S.evid}/${SR.EVID_TOTAL}`;
  } else {
    const n = alive(S)[SEL];
    const canT = n && !immune(S,n) && reaction(S,n)!==null && !verdictNow();
    tb.className = 'btn treat' + (STAGE_MODE==='treat' ? ' on' : (canT||n ? '' : ' off'));
    tb.firstChild.nodeValue = '처치';
    $('sg_treatc').textContent = `${R.KILL_COST}코${S.mind==='공황'?' · 다음 턴':''}`;
  }

  /* 조기 정산은 외래·왕진만 — 스토리에는 손을 뗄 자리가 없다 */
  const sb = $('sg_settle');
  const canS = MODE==='sess' && SESS && SESS.phase==='fight';
  sb.style.display = (MODE==='sess') ? '' : 'none';
  sb.className = 'btn early' + (canS ? '' : ' off');
  $('sg_settlec').textContent = canS ? outcome(S, BOARD.core) : '—';

  $('sg_pDeck').textContent = S.deck.length;
  $('sg_pDisc').textContent = S.discard.length;

  const done = verdictNow();
  const eb = $('sg_end');
  eb.className = 'btn endturn' + (done ? ' off' : '');
  eb.textContent = done ? `${done} — 정산한다` : '턴 종료';
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
  const b = fxMark(S);
  S.ev = [];
  pickCard(id);
  if(!PICK) fxPlanLog(S.ev, b, {verb:'card'});
  if(S) S.ev = null;
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
   기존 손을 그대로 부른다. 부르는 동안 커널이 S.ev 에 적어 둔 사건 줄을 읽는다.
   구간 넘김과 스토리 게이지만 전후를 견준다 (fxMark). */
//@ 무대.행동 — 기존 손을 부르고 커널이 적은 사건 줄을 읽는다
function stageAct(fn, plan){
  if(FX_BUSY || !S) return;
  const b = fxMark(S);
  const rec = S;                       // 손이 판을 갈아 끼울 수 있다 (되돌리기 · 세션) — 켠 자리를 기억해 둔다
  rec.ev = [];
  fn();
  if(S) fxPlanLog(S===rec ? rec.ev : [], b, plan);
  rec.ev = null; if(S) S.ev = null;
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

/* ── 사건으로 낼 수 없는 나머지 ────────────────────────────────
   커널이 S.ev 에 적어 주지 못하는 것만 여기 남는다. 둘뿐이다.

   · 구간 넘김(zone) — reaction() 은 painShare(S) 를 타서 **전역**이다.
     한 자리를 억제하면 손도 안 댄 자리의 등급이 같이 바뀐다. 어느 한 대입
     자리에서 낼 수 있는 사건이 아니라서 전후를 견주는 수밖에 없다.
   · 증거 · 병기 — 스토리 층(30-core/story.js)이 올리는 값이다. 이 층에는
     아직 사건을 안 붙였다.

   전에 fxSnap 이 뜨던 「자리마다 11필드 + 전역 7개」가 이만큼으로 줄었다. */
//@ 무대.나머지 — 사건으로 못 내는 것만 뜬다
function fxMark(S){
  const dis = S.nodes.find(n=>n.role==='disease');
  return {
    evid: S.evid, stage: dis?dis.stage:0, mind: S.mind,
    rush: S.rush||0, remGauge: S.remGauge||0,
    react: S.nodes.map(n=>n.dead ? null : reaction(S,n)),
  };
}

/* ── 사건 줄을 연출 줄로 ────────────────────────────────────────
   커널이 적어 준 차례가 곧 연출 차례다. 되짚기와 달리
     · 같은 자리를 두 번 억제하면 두 번 뜬다 (전에는 차이 하나로 뭉쳤다)
     · 아무것도 안 움직인 튕김도 뜬다 (무적 · 완화 면역)
     · 촉발 · 전이는 커널이 '실제로 건 것'만 넘겨 준다 — 무대가 흉내 내지 않는다
   구간 넘김과 손패 돌리기만 마지막에 따로 붙인다. */
//@ 무대.연출짜기 — 커널이 적어 준 사건 줄을 그대로 옮긴다
function fxPlanLog(log, before, plan){
  plan = plan || {};
  const cur = fxMark(S);
  let killed = false, turned = false;

  for(const e of (log||[])){
    const n = e.n;
    switch(e.t){
      case 'kill':
        killed = true;
        fxq(()=>FXE.treat(n, e.grade));
        sayEmit('kill', {key:n.role==='disease'?'병':n.sym, node:n});
        break;
      case 'trigger':    fxq(()=>FXE.trigger(e.from, e.to, e.grade)); break;
      case 'spawn':      fxq(()=>FXE.spawn(e.from, n)); sayEmit('spawn', {key:n.sym, node:n}); break;
      case 'sup':        fxq(()=>FXE.suppress(n, e.amt)); break;
      case 'stab':       fxq(()=>FXE.stabilize(n, e.amt)); break;
      case 'shBreak':    fxq(()=>FXE.shieldBreak(n)); sayEmit('shield', {key:n.sym, node:n}); break;
      case 'weak':       fxq(()=>FXE.weaken(n, e.add)); break;
      case 'rig':        fxq(()=>FXE.rig(n, e.amt)); break;
      case 'rigOpen':    fxq(()=>FXE.rigOpen(n, e.amt)); break;
      case 'diag':       fxq(()=>FXE.diagnose(n, e.round));
                         sayEmit('diag', {key:n.sym, node:n, round:e.round}); break;
      case 'demote':     fxq(()=>FXE.demote(n)); break;
      case 'evolve':     fxq(()=>FXE.evolve(n)); sayEmit('evolve', {key:n.sym, node:n}); break;
      case 'dorm':       fxq(()=>FXE.dormant(n)); sayEmit('dormant', {key:n.sym, node:n}); break;
      case 'revive':     fxq(()=>FXE.revive(n)); sayEmit('revive', {key:n.sym, node:n}); break;
      /* 손은 닿았는데 판이 안 움직인 자리 — 되짚기로는 볼 수 없던 것들 */
      case 'immune':
      case 'calmBounce': fxq(()=>FXE.immune(n)); break;
      case 'delay':      fxq(()=>FXE.stabilize(n, 0)); break;
      case 'hp':         e.why==='bleed' ? fxq(()=>FXE.patPay(e.amt)) : fxq(()=>FXE.patHit(e.amt)); break;
      /* 정신은 여기서 띄우지 않는다 — 한 손에 두세 번 흔들리는 일이 흔해서
         (억제로 악화 → 휴면 도달로 호전 …) 사건마다 띄우면 배너가 겹친다.
         결과만 아래에서 한 번 알린다. 게이지를 결과 한 번으로 내는 것과 같다. */
      case 'turn':       turned = true; break;
      /* 성장 · 뽑기 · 성장 정지는 계기판이 그리므로 연출을 따로 내지 않는다 */
    }
  }

  /* 처치를 걸었는데 사건이 안 왔다 — 못 끊었다. 표를 도로 뗀다 */
  if(plan.verb==='kill' && plan.killIx!=null && !killed){
    const el = STAGE_ELS.get(plan.killIx);
    if(el) delete el.dataset.dying;
  }

  /* 정신 — 오간 끝에 자리가 바뀌었을 때만 */
  if(cur.mind !== before.mind){
    const M = ['평정','불안','공황','의식불명'];
    const worse = M.indexOf(cur.mind) > M.indexOf(before.mind);
    fxq(()=>FXE.mind(cur.mind, worse));
    sayEmit(worse?'mind':'mindUp', {key:cur.mind});
  }

  /* 전역 게이지 — 사건이 여러 번 왔어도 결과 한 번만 알린다 */
  /* 숫자는 그 값이 실제로 적혀 있는 칸 위에 뜬다. 넷 다 sg_pat 을 가리키고
     있었는데, 그때는 sg_pat 이 위쪽 머리띠라 기세 · 관해 · 병기가 다 거기
     있었다. 네 구역으로 가르면서 기세 · 관해는 의사 패널로, 병기는 병 노드
     계기의 배지로 옮겨 갔다 — 가리키는 곳도 같이 옮긴다 */
  if(cur.rush !== before.rush)         fxq(()=>FXE.gauge('sg_doc', `기세 ${cur.rush}`, cur.rush>before.rush));
  if(cur.remGauge !== before.remGauge) fxq(()=>FXE.gauge('sg_doc', `관해 ${cur.remGauge}`, cur.remGauge>before.remGauge));
  if(cur.stage !== before.stage){
    const dz = S.nodes.find(n=>n.role==='disease' && !n.dead);
    fxq(()=>FXE.gauge((dz && stageEl(dz)) || 'sg_chart', `병기 ${cur.stage}`, false));
    sayEmit('stage', {key:String(cur.stage)});
  }
  if(cur.evid !== before.evid) fxq(()=>FXE.gauge('sg_act', `증거 ${cur.evid}`, true));

  /* 구간을 새로 넘어선 자리는 마지막에 한 번씩 김을 뿜는다 */
  for(let i=0;i<cur.react.length;i++){
    const a = before.react[i], c = cur.react[i];
    if(c !== a && c && c !== 'none' && S.nodes[i] && !S.nodes[i].dead) fxq(()=>FXE.zone(S.nodes[i], c));
  }

  if(turned) fxq(()=>FXE.dealHand());
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
  if(PILE_OPEN){ if(k==='Escape'){ e.preventDefault(); pileClose() } return }
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
