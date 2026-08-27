/* ══════════════════════════════════════════════════════════════════
   §9.24 무대의 막 — 명단 · 문진 · 결과 · 결산 · 스토리 갈림
   ──────────────────────────────────────────────────────────────────
   전투와 전투 사이에 끼는 판이다. 판단이 일어나는 자리는 전투 안이
   아니라 여기다 — 누구를 부를 것인가, 무엇을 물을 것인가, 어느 방침으로
   갈 것인가.

   문진은 한꺼번에 고르고 한 번에 확정한다. 확정하기 전에는 판을 건드리지
   않으므로 마음껏 물렀다 놓을 수 있다 — 「오기 전에 뭘 해보셨어요」처럼
   판 상태를 실제로 바꾸는 문진이 섞여 있어서 이 순서가 중요하다.
   ══════════════════════════════════════════════════════════════════ */

//@ 무대.막 — 오버레이 다섯
function stageOvHideAll(){
  for(const e of document.querySelectorAll('#sg .ov')) e.classList.remove('on');
}
/* 막을 올릴 때 머리띠도 같이 맞춘다 — 판은 이미 넘어갔는데 남은 예산과
   대기 인원이 한 박자 늦게 따라오던 자리다 */
function stageOvShow(id){
  stageOvHideAll();
  if(STAGE_ON && S) stageHud();
  const e=$(id); if(e) e.classList.add('on');
}

/* ── 호소 증상 ───────────────────────────────────────────────
   대본에 적힌 것이 있으면 그것을 쓰고, 없으면 핵심 증상에서 만든다.
   CHIEF 에 한 줄 적으면 그때부터 그 줄이 나온다. */
//@ 무대.호소 — 이 사람이 무엇 때문에 왔는가
function chiefOf(){
  if(!BOARD) return '—';
  const id = BOARD.script && BOARD.script.id;
  if(id && CHIEF[id]) return CHIEF[id];
  if(BOARD.script && BOARD.script.chief) return BOARD.script.chief;
  const core = BOARD.core || (alive(S)[0]||{}).sym;
  return CHIEF_BY_SYM[core] || '어디가 아픈지 잘 말하지 못한다';
}

/* ── 대기 명단 ─────────────────────────────────────────────── */
//@ 무대.명단 — 다음은 누구인가
function stageQueueShow(){
  if(MODE!=='sess' || !SESS){ stageRender(); return }
  const list = sessList(), def = SESS.def;
  const rounds = def.rounds.length;
  $('sg_qhead').textContent = def.name + (rounds>1 ? ` · ${SESS.round+1}라운드` : '');
  $('sg_qbud').textContent = `남은 예산 ${Math.max(0,SESS.budget)}턴`;

  const say = (SESS.idx===0 && def.roundSay && def.roundSay[SESS.round])
    ? def.roundSay[SESS.round]
    : (SESS.idx===0 ? String(def.nurse).replace('__B__', SESS.budget) : '다음 분 들어오세요.');
  $('sg_nurse').innerHTML = say;

  const doneHere = SESS.results.filter(r=>(r.round??0)===SESS.round);
  $('sg_qlist').innerHTML = list.map((id,i)=>{
    const p = SCRIPT[id], r = doneHere.find((_,k)=>k===i && i<SESS.idx);
    const done = i < SESS.idx, gi = r ? TIER.indexOf(r.out)+1 : 3;
    return `<div class="qrow ${done?'done':(i===SESS.idx?'now':'')}">
      <span class="qlv">Lv${p?p.lv:'—'}</span>
      <span class="qn">${esc(p?p.name:id)}</span>
      <span class="qr g${gi}">${r ? `${r.out} · ${r.turns}턴` : (i===SESS.idx?'지금':'대기')}</span></div>`;
  }).join('');

  const over = SESS.budget<=0;
  /* 이 라운드를 다 봤는가 — 왕진이면 다음 라운드 앞에 가방을 다시 짠다 */
  const roundDone = SESS.idx >= list.length;
  const more = SESS.round < def.rounds.length-1;
  const redeck = roundDone && more && def.visit;
  $('sg_qnote').innerHTML = over
    ? '예산이 다 됐다. 남은 사람은 <b>악화</b>로 남는다.'
    : redeck
    ? `${SESS.round+1}라운드를 다 봤다. 다음 라운드는 <b>가방을 다시 짜고</b> 나간다.`
      + '<br><span class="d">고르는 자리는 작업대다 — 무대가 잠깐 비켜선다.</span>'
    : '턴 예산을 다 쓰면 남은 사람은 못 본다. 못 본 사람은 <b>악화</b>로 남는다.'
      + '<br><span class="d">진료를 시작하면 예산에서 1턴이 나간다.</span>';
  $('sg_qgo').textContent = over ? (def.visit?'왕진을 마친다':'오전을 마친다')
    : redeck ? '가방을 다시 연다'
    : roundDone && more ? `${SESS.round+2}라운드로 간다`
    : '다음 환자를 부른다';
  stageOvShow('sg_ovQueue');
}

/* 명단에서 「다음」 — 여기서 비로소 다음 사람을 들인다.
   왕진이고 라운드가 끝났으면 loadPatient 이 가방 화면을 연다 (무대는 비켜선다) */
function stageQueueGo(){
  if(SESS && SESS.phase==='after') sessNext();
  stageFlow();
}

/* ── 문진 ── 한꺼번에 고르고 한 번에 확정한다 ────────────────── */
let SG_ASK = [];

//@ 무대.문진 — 말수만큼 골라서 한 번에 묻는다
function stageAskShow(){
  SG_ASK = [];
  const p = BOARD.script;
  $('sg_askwho').textContent = p ? p.name : '';
  stageAskDraw();
  stageOvShow('sg_ovAsk');
}

function stageAskDraw(){
  const want = S.talk || 0;
  $('sg_asklist').innerHTML = QUIZ.map(q=>{
    const on = SG_ASK.includes(q.id);
    const full = !on && SG_ASK.length>=want;
    return `<div class="aq ${on?'on':''} ${full?'off':''}" onclick="stageAskPick('${q.id}')">
      <div class="q">${esc(q.q)}</div><div class="e">${esc(q.opens)}</div></div>`;
  }).join('');
  $('sg_askcnt').textContent = `${SG_ASK.length} / ${want}`;
  $('sg_asknote').innerHTML =
    `코스트를 쓰지 않는다. 이 진료 내내 남는다.<br>이 사람은 <b>${want}가지</b>만 말한다.`
    + '<br><span class="d">확정하기 전까지는 판이 바뀌지 않는다 — 얼마든지 물렀다 놓아도 된다.</span>';
  $('sg_askgo').className = 'ogo' + (SG_ASK.length===want ? '' : ' off');
}

function stageAskPick(id){
  const want = S.talk || 0;
  const i = SG_ASK.indexOf(id);
  if(i>=0) SG_ASK.splice(i,1);
  else if(SG_ASK.length < want) SG_ASK.push(id);
  stageAskDraw();
}

function stageAskGo(){
  const want = S.talk || 0;
  if(SG_ASK.length !== want) return;
  fxSilent(()=>{ for(const id of SG_ASK) ask(id) });
  for(const id of SG_ASK) sayEmit('intake', {key:id});
  startCombat();
  sayEmit('open', {});
  stageOvHideAll();
  stageRender();
}

/* ── 이 환자의 결과 ─────────────────────────────────────────── */
//@ 무대.결과 — 한 사람의 진료가 끝났다
function stageVerdShow(){
  const out = (MODE==='sess' && SESS && SESS.results.length)
    ? SESS.results[SESS.results.length-1].out
    : verdictNow();
  if(!out){ stageRender(); return }
  sayEmit('verdict', {key:out});
  $('sg_vg').textContent = out;
  const turns = (MODE==='sess' && SESS && SESS.results.length)
    ? SESS.results[SESS.results.length-1].turns : S.turn-1;
  $('sg_vs').innerHTML = ({
    사망:'환자가 죽었다.', 악화:'아직 살아 있는 증상이 남았다.',
    연명:'핵심이 잠들어 있을 뿐이다.', 호전:'핵심을 뽑아냈다.',
    완치:'전부 뽑아냈고 진화한 기록도 없다.'}[out] || '')
    + `<br>이 사람에게 <b>${turns}턴</b>을 썼다`
    + (MODE==='sess' && SESS ? ` · 남은 예산 ${Math.max(0,SESS.budget)}턴` : '');
  $('sg_vgo').textContent = (MODE==='sess' && SESS) ? '다음' : '작업대로';
  stageOvShow('sg_ovVerd');
}

/* 결과에서 「다음」 — 곧바로 다음 사람으로 넘어가지 않는다.
   누구를 부를지 보는 자리가 명단이므로 한 번 거쳐 간다 */
function stageVerdGo(){
  if(MODE==='sess' && SESS){ stageQueueShow(); return }
  stageClose();
}

/* ── 세션 결산 ─────────────────────────────────────────────── */
//@ 무대.결산 — 하루가 끝났다
function stageEndShow(){
  if(!SESS){ stageRender(); return }
  $('sg_ehead').textContent = SESS.def.visit ? '왕진이 끝났다' : '오전이 끝났다';
  $('sg_esub').textContent = `남은 예산 ${Math.max(0,SESS.budget)}턴`
    + (SESS.def.visit ? ` · 평판 ${SESS.rep>0?'+':''}${SESS.rep}` : '');
  $('sg_elist').innerHTML = SESS.results.map(r=>{
    const p = SCRIPT[r.id], gi = TIER.indexOf(r.out)+1;
    return `<div class="qrow"><span class="qlv">Lv${p?p.lv:'—'}</span>
      <span class="qn">${esc(p?p.name:r.id)}</span>
      <span class="qr g${gi}">${r.out}${r.auto?' · 못 봄':` · ${r.turns}턴`}</span></div>`;
  }).join('');
  const bad = SESS.results.filter(r=>r.out==='사망'||r.out==='악화').length;
  $('sg_enote').innerHTML = bad
    ? `<b>${bad}명</b>을 제대로 못 봤다.`
    : '온 사람을 다 봤다.';
  stageOvShow('sg_ovEnd');
}

/* ── 스토리 — 병명 선언 · 방침 ───────────────────────────────
   1막은 증거를 캐는 판이라 오버레이가 아니라 머리띠에만 뜬다.
   증거가 목표에 닿으면 여기서 선언을 물어본다. */
//@ 무대.스토리 — 1막 선언 · 2막 방침
function stageActShow(){
  if(MODE!=='story' || !S){ stageRender(); return }
  const cand = candLeft(S);
  const body = $('sg_actbody');

  if(S.act===1){
    $('sg_acthead').textContent = '1막 — 무슨 병인가';
    $('sg_actsub').textContent = '병 노드는 무적이다. 진단 카드가 검사 파라미터로 들어간다';
    $('sg_actcnt').textContent = `증거 ${S.evid}/${SR.EVID_TOTAL}`;
    body.innerHTML =
      `<div class="evrow">${Array.from({length:SR.EVID_TOTAL},(_,i)=>
        `<i class="${i<S.evid?'on':''}"></i>`).join('')}</div>`
    + `<div class="nurse">검사 파라미터 <b>${S.paramAcc}/${SR.PARAM_NEED}</b> ·
        차트에 남은 병명 <b>${cand}</b><br>
        지금 선언하면 맞을 확률은 <b>${(100/cand).toFixed(0)}%</b> 다.</div>`;
    $('sg_actnote').innerHTML = S.evid>=SR.EVID_AIM
      ? '더 캘수록 후보가 준다. 그만큼 병은 자란다.'
      : '아직 증거가 얕다. 선언하면 오진이 나기 쉽다.';
    body.innerHTML += `<div class="polrow" style="grid-template-columns:1fr">
      <button class="polbtn2" onclick="stageDeclare()"><b>병명을 선언한다</b>
        <span>지금 가진 증거로 차트를 좁힌다. 맞을 확률 ${(100/cand).toFixed(0)}%</span></button></div>`;
    $('sg_actgo').textContent = '더 캔다';
    stageOvShow('sg_ovAct');
    return;
  }

  /* 2막 — 방침 셋. 각각 다른 승리 조건이다 */
  const pol = (BOSS[BOARD.boss] || {policy:{완치:'병 노드를 끊는다',
      연명:'활성 부수 증상을 하나도 남기지 않는다', 편하게:'시계가 다 돌 때까지 버틴다'}}).policy;
  $('sg_acthead').textContent = '2막 — 어떻게 할 것인가';
  $('sg_actsub').textContent = S.correct ? '정진단이었다' : '오진이었다';
  $('sg_actcnt').textContent = '';
  body.innerHTML = `<div class="polrow">`
    + Object.entries(pol).map(([k,v])=> v
        ? `<button class="polbtn2"${tip(policyTip(k))} onclick="stagePolicy('${k}')"><b>${k}</b><span>${esc(v)}</span></button>`
        : `<button class="polbtn2" disabled><b>${k}</b><span>고를 수 없다</span></button>`).join('')
    + `</div>`;
  $('sg_actnote').textContent = '한 번 정하면 이 전투 동안 바뀌지 않는다.';
  $('sg_actgo').textContent = '';
  $('sg_actgo').style.display = 'none';
  stageOvShow('sg_ovAct');
}

function stageActGo(){
  $('sg_actgo').style.display = '';
  stageOvHideAll();
  stageRender();
}

function stagePolicy(p){
  $('sg_actgo').style.display = '';
  fxSilent(()=>pickPolicy(p));
  sayEmit('policy', {key:p});
  sayEmit('act', {key:'3'});
  stageOvHideAll();
  stageRender();
}

/* 1막에서 병명을 선언한다 — 판 위 「처치」 자리를 이것이 대신한다 */
function stageDeclare(){
  if(MODE!=='story' || !S || S.act!==1) return;
  fxSilent(()=>declareDx());
  sayEmit('act', {key:'2'});
  stageFlow();
}

/* ── 작업대에서 무대로 ────────────────────────────────────────
   판이 깔린다고 무대가 열리지는 않는다 — 작업대가 기본 화면이다.
   저절로 넘어가는 길은 하나뿐이다: 세션에서 가방을 확정하는
   「진료를 시작한다」. 나머지 모드는 「전투 화면으로 간다」(stageResume)로
   사람이 연다. */
//@ 무대.진입 — 판이 깔린 뒤 무대를 연다
function stageBattleStart(){
  if(!S) return false;
  stageOpen();
  return true;
}

/* 「환자를 들인다」는 새 판을 깐다. 이것은 깔려 있는 판으로 되돌아간다.
   무대에서 작업대로 나오면 판이 없어진 것처럼 보이던 구멍을 메운다 —
   판은 그대로 있었고 돌아갈 문만 없었다.
   가방을 여는 중(DB · PK)에는 막는다. 그 화면 위에 무대를 덮으면
   닫고 나왔을 때 어디에 있었는지가 흐려진다 */
//@ 무대.복귀 — 보던 판을 그대로 다시 띄운다
function stageResumable(){
  return !!S && !STAGE_ON && !DB && !PK;
}

/* 돌아갈 판이 없으면 문도 잠가 둔다.
   그리기(render)와 가방 여닫기(syncDeckBtn) 두 곳이 부른다 —
   가방을 펼치는 동안에는 render 가 가방 화면에서 멈춰 서기 때문이다 */
function syncBackBtn(){
  for(const b of document.querySelectorAll('.sgback')) b.disabled = !stageResumable();
}

function stageResume(){
  if(!stageResumable()) return;
  stageOpen();
}
