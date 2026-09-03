/* ══════════════════════════════════════════════════════════════════
   §9.13 스토리 모드
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 스토리 ═════════════════════════════════════════════════ */
//@ 화면.스토리 — §9.13 스토리 모드
/* 병기 고르개 — BOSS 표에서 짓는다. 저장해 둔 커스텀 병 노드도 여기 뜬다.
   전에는 셋을 마크업에 손으로 적어 둬서, 저장한 것을 고를 길이 없었다.
   편집 중인 것(DIS_KEY)은 「만든 환자」가 이미 가리키므로 목록에서 뺀다 */
//@ 화면.병기고르개 — BOSS 표에서 짓는다
function renderBossPick(){
  const sel = $('boss'); if(!sel) return;
  const was = sel.value;
  sel.innerHTML = Object.keys(BOSS).filter(k=>k!==DIS_KEY)
      .map(k=>`<option>${esc(k)}</option>`).join('')
    + '<option value="custom">만든 환자</option>';
  if(was && [...sel.options].some(o=>o.value===was)) sel.value = was;
}

function newStory(){
  PICK = null;
  const key=$('boss').value, seed=+$('seed').value, rng=mulberry32(seed);
  if(key==='custom'){
    if(!CUSTOM.dis){ log('<i>만든 환자에 병 노드가 없다. 「만들기」에서 병 노드를 켜라.</i>'); render(); return }
    BOARD = buildCustom();
  } else BOARD = makeDisease(key, rng);
  const stg = +$('sk_stage').value;
  if(stg && BOARD.nodes[0].role==='disease' && SR.DIS_BASE[stg]){
    const d=BOARD.nodes[0]; d.stage=stg; d.init=SR.DIS_BASE[stg]; d.val=SR.DIS_BASE[stg];
  }
  S = newState(BOARD,{}); S.board=BOARD; S.rng=rng;
  setupDeck(S, STORY_DECK, mulberry32(seed+1)); S.rng=rng;
  S.param=0; S.evid=1; S.paramAcc=0; S.act=1; S.policy=null; S.act1Beat=0; S.comfort=0;
  SEL=null; LOG=[]; UNDO=[]; SESS=null; PANES.story.started=true;
  /* 커스텀 판은 악보만 보스에게 빌려 쓴다 — 이름과 체력은 만든 것을 적는다.
     전에는 BOARD.boss 로 BOSS 를 찾아서, 만든 환자인데 「쓰러진 아이 · 체력 120」이라 적혔다.
     고르는 칸(select)이 아니라 판이 들고 있는 것을 본다 — buildCustom 이 board.script 에
     이름을 적어 두므로, 고른 칸을 안 거치는 길(불러온 판·배치·되감기)로 들어와도 맞는다 */
  const b = BOARD.script ? {name:BOARD.script.name, hp:BOARD.hp, noDeath:BOARD.noDeath} : BOSS[BOARD.boss];
  log(`<b>${b.name}</b> · 병기 ${BOARD.nodes[0].stage} · 체력 ${b.hp}`
    + `${BOARD.noDeath?' <span class="d">(체력 0이 되지 않는다)</span>':''}`
    + `${BOARD.score?' <span class="d">· 손으로 짠 악보</span>':''}${ovrNote()}`);

  /* 3막부터 시작 — v18 의 「3막만 돌린다」 자리 */
  const pol = $('sk_pol').value;
  if(pol){
    S.evid = +$('sk_evid').value;
    S.correct = $('sk_dx').value==='1';
    const note = applyPolicy(S, S.nodes[0], pol, S.correct);
    log(`<span class="d">1·2막을 건너뛴다 — 증거 ${S.evid} · ${S.correct?'정진단':'오진'}</span>`);
    log(`<b>${pol}</b> — ${note}`);
  } else {
    log('<span class="d">1막 — 진단 카드를 검사 파라미터에 써서 증거를 모은다.</span>');
  }
  render();          // 판만 깐다 — 전투 화면은 사람이 문을 열 때 뜬다
}

function declareDx(){
  pushUndo('병명 선언');
  const cand = candLeft(S);
  S.correct = S.rng() < 1/cand; S.act=2;
  log(`<b>병명 선언</b> — 남은 후보 ${cand} · ${S.correct?'<span class="n">정진단</span>':'<span style="color:var(--blood)">오진</span>'}`);
  render();
}

function pickPolicy(p){
  pushUndo('방침 선택');
  const note = applyPolicy(S, S.nodes[0], p, S.correct);
  log(`<b>${p}</b> — ${note}`);
  render();
}
