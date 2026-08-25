/* ══════════════════════════════════════════════════════════════════
   §9.20 환자의 말
   ──────────────────────────────────────────────────────────────────
   대사는 아직 한 줄도 없다. 여기 있는 것은 「어디서 말이 나올 수 있는가」
   뿐이다. 자리를 미리 다 뚫어 두고 내용을 비워 둔 것은, 나중에 대사를
   넣을 때 이 파일 말고는 아무 데도 손대지 않기 위해서다.

   두 단이다.
     SAY.byPatient[환자ID][훅]   이 환자만의 말
     SAY.common[훅]              아무나 할 수 있는 말 (환자별이 비었을 때)

   한 훅에 넣을 수 있는 것 네 가지 — 필요한 만큼만 쓴다.
     '문자열'                     그냥 이 말을 한다
     ['첫 마디','둘째 마디']      부를 때마다 차례로 돈다
     {완치:'…', 사망:'…'}        ctx.key 로 갈라 고른다 (결과 · 증상 · 문진 …)
     (S, ctx) => '…'             판을 보고 그 자리에서 짓는다. 빈 값이면 안 한다

   훅은 아래 SAY_HOOKS 에 적힌 것이 전부다. 새 훅이 필요하면 여기 한 줄
   더하고, 부르는 쪽에서 sayEmit('이름', ctx) 를 부르면 된다.
   ══════════════════════════════════════════════════════════════════ */

/* 훅 하나하나가 언제 울리는가. 글은 사람이 읽으려고 적어 둔 것이고,
   pri 는 한 턴에 여러 개가 동시에 울렸을 때 누가 입을 잡는가다 (높은 쪽). */
//@ 대사.훅표 — 환자가 말할 수 있는 자리
const SAY_HOOKS = {
  open:    {pri:90, ctx:'—',            when:'진료를 시작한 직후'},
  intake:  {pri:80, ctx:'문진 id',      when:'문진 답이 나올 때마다'},
  turn:    {pri:10, ctx:'턴 수',        when:'SAY_TURN_EVERY 턴마다 한 번'},
  kill:    {pri:60, ctx:'증상 이름',    when:'한 자리를 끊었을 때'},
  dormant: {pri:40, ctx:'증상 이름',    when:'한 자리가 휴면에 들었을 때'},
  revive:  {pri:50, ctx:'증상 이름',    when:'휴면이 깨고 되살아났을 때'},
  shield:  {pri:35, ctx:'증상 이름',    when:'보호막이 벗겨졌을 때'},
  spawn:   {pri:65, ctx:'증상 이름',    when:'전이로 새 자리가 났을 때'},
  evolve:  {pri:75, ctx:'증상 이름',    when:'한 자리가 진화했을 때'},
  mind:    {pri:70, ctx:'정신 단계',    when:'정신이 한 단계 무너졌을 때'},
  mindUp:  {pri:45, ctx:'정신 단계',    when:'정신이 한 단계 돌아왔을 때'},
  hp:      {pri:85, ctx:'남은 비율',    when:'체력이 눈금을 지나 내려갔을 때'},
  diag:    {pri:55, ctx:'증상 이름',    when:'진단 한 회차를 열었을 때'},
  act:     {pri:95, ctx:'막 번호',      when:'스토리에서 막이 넘어갈 때'},
  policy:  {pri:95, ctx:'방침 이름',    when:'스토리에서 방침을 정했을 때'},
  stage:   {pri:80, ctx:'병기 번호',    when:'병기가 한 칸 올랐을 때'},
  verdict: {pri:99, ctx:'결과 등급',    when:'이 환자의 진료가 끝났을 때'},
};

/* 몇 턴마다 turn 훅이 울리는가. 0 이면 턴으로는 말하지 않는다 */
//@ 대사.턴간격 — turn 훅이 울리는 주기
const SAY_TURN_EVERY = 3;

/* 체력이 이 눈금들을 아래로 지날 때 hp 훅이 한 번씩 울린다 (한 눈금당 한 번) */
const SAY_HP_MARKS = [0.60, 0.35, 0.15];

/* 한 턴에 말풍선을 몇 개까지 띄우는가. 사건이 겹쳐도 도배되지 않게 한다 */
const SAY_PER_TURN = 1;

/* ── 대사 곳간 ──────────────────────────────────────────────
   전부 비어 있다. 넣고 싶은 자리에 글만 적으면 그 자리부터 말하기 시작한다.
   지우면 다시 조용해진다 — 지운 자리를 부르는 쪽은 아무 일도 하지 않는다. */
//@ 대사.곳간 — 지금은 전부 빈칸이다
const SAY = {
  /* 환자를 가리지 않는 말. byPatient 에 없을 때만 쓴다 */
  common: {
    open:    [],
    intake:  {},          // {when:'…', how:'…', hurt:'…', life:'…', past:'…', tried:'…'}
    turn:    [],
    kill:    {},          // {발열:'…', 출혈:'…', …}
    dormant: {},
    revive:  {},
    shield:  {},
    spawn:   {},
    evolve:  {},
    mind:    {},          // {불안:'…', 공황:'…', 의식불명:'…'}
    mindUp:  {},
    hp:      {},          // {'0.6':'…', '0.35':'…', '0.15':'…'}
    diag:    {},
    act:     {},          // {'2':'…', '3':'…'}
    policy:  {},          // {완치:'…', 연명:'…', 편하게:'…'}
    stage:   {},
    verdict: {},          // {완치:'…', 호전:'…', 연명:'…', 악화:'…', 사망:'…'}
  },

  /* 환자 하나에만 붙는 말. 키는 SCRIPT 의 id (d1_1 …) 또는 보스 이름 */
  byPatient: {
    // d1_1: { open:'…', kill:{발열:'…'}, verdict:{완치:'…'} },
  },
};

/* ── 호소 증상 ──────────────────────────────────────────────
   카르테 맨 윗줄. 대사와 달리 빈칸으로 두면 화면이 허해서, 핵심 증상에서
   만든 기본 문장을 깔아 둔다. CHIEF 에 환자 id 로 한 줄 적으면 그 줄이
   기본을 밀어낸다 — 손볼 곳은 여기 한 곳이다. */
//@ 대사.호소 — 이 사람이 무엇 때문에 왔는가
const CHIEF = {
  // d1_1: '사흘째 열이 안 내린다',
};

/* 적어 둔 것이 없을 때 핵심 증상이 대신 말한다 */
const CHIEF_BY_SYM = {
  발열:'열이 안 내린다',
  출혈:'피가 자꾸 난다',
  감염:'붓고 붉어졌다',
  탈수:'물을 못 넘긴다',
  통증:'쑤셔서 견디기 어렵다',
  호흡곤란:'숨쉬기가 힘들다',
  병:'무엇 때문인지 모르겠다고 한다',
};

/* ── 고르기 ─────────────────────────────────────────────────
   환자별을 먼저 보고, 없으면 공용에서 찾는다. 둘 다 비면 조용하다. */

/* 이 판의 대사 주인이 누구인가 — 대본 환자면 그 id, 보스면 보스 이름 */
//@ 대사.주인 — 지금 말하는 사람의 열쇠
function sayWho(){
  if(!BOARD) return null;
  if(BOARD.script && BOARD.script.id) return BOARD.script.id;
  if(SESS && SESS.def) return sessList()[SESS.idx] || null;
  if(BOARD.boss) return BOARD.boss;
  return null;
}

/* 곳간에 든 것 한 덩이를 실제 문장 하나로 푼다.
   배열이면 차례로 돌고(그 순서는 판마다 따로 센다), 함수면 판을 넣어 부른다. */
function sayPick(entry, S, ctx, cursorKey){
  if(entry===null || entry===undefined) return null;
  if(typeof entry==='function'){ try{ return entry(S, ctx) || null }catch(e){ return null } }
  if(typeof entry==='string') return entry.trim() ? entry : null;
  if(Array.isArray(entry)){
    const live = entry.filter(x=>x!==null && x!==undefined && String(x).trim());
    if(!live.length) return null;
    S.sayN = S.sayN || {};
    const i = (S.sayN[cursorKey] = (S.sayN[cursorKey]||0) + 1) - 1;
    return sayPick(live[i % live.length], S, ctx, cursorKey+':'+(i%live.length));
  }
  if(typeof entry==='object'){
    const k = ctx && ctx.key!==undefined && ctx.key!==null ? String(ctx.key) : null;
    if(k===null) return null;
    if(!(k in entry)) return null;
    return sayPick(entry[k], S, ctx, cursorKey+':'+k);
  }
  return null;
}

/* 훅 하나를 울린다. 할 말이 있으면 말풍선을 띄우고 기록에 남긴다.
   할 말이 없으면 아무 일도 일어나지 않는다 — 지금이 그 상태다. */
//@ 대사.울리기 — 훅 하나를 울린다
function sayEmit(hook, ctx){
  if(!S || !SAY_HOOKS[hook]) return null;
  ctx = ctx || {};
  const who = sayWho();
  const mine = who && SAY.byPatient[who] ? SAY.byPatient[who][hook] : undefined;
  let txt = sayPick(mine, S, ctx, `${who}:${hook}`);
  if(txt===null) txt = sayPick(SAY.common[hook], S, ctx, `*:${hook}`);
  if(txt===null) return null;

  /* 한 턴에 여러 사건이 겹쳤다 — 급한 쪽이 입을 잡는다 */
  S.sayTurn = S.sayTurn || {t:-1, n:0, pri:-1};
  if(S.sayTurn.t !== S.turn) S.sayTurn = {t:S.turn, n:0, pri:-1};
  const pri = SAY_HOOKS[hook].pri;
  if(S.sayTurn.n >= SAY_PER_TURN && pri <= S.sayTurn.pri) return null;
  S.sayTurn.n++; S.sayTurn.pri = Math.max(S.sayTurn.pri, pri);

  sayShow(txt, ctx);
  return txt;
}

/* 체력 눈금을 지났는가 — 지난 눈금은 판에 적어 두고 두 번 울리지 않는다 */
//@ 대사.체력눈금 — 눈금을 아래로 지날 때 한 번
function sayHpCheck(){
  if(!S || !S.hpMax) return;
  const r = Math.max(0, S.hp) / S.hpMax;
  S.sayHp = S.sayHp || [];
  for(const m of SAY_HP_MARKS){
    if(r <= m && !S.sayHp.includes(m)){ S.sayHp.push(m); sayEmit('hp', {key:String(m), ratio:r}) }
  }
}

/* 턴 훅 — 주기가 맞을 때만 */
function sayTurnTick(){
  if(!S || !SAY_TURN_EVERY) return;
  if(S.turn % SAY_TURN_EVERY === 0) sayEmit('turn', {key:String(S.turn), turn:S.turn});
}

/* ── 내보내기 ───────────────────────────────────────────────
   말풍선은 무대에만 있다. 무대가 안 떠 있으면 기록에만 남는다. */
//@ 대사.표시 — 말풍선과 기록
function sayShow(txt, ctx){
  const name = (BOARD && BOARD.script) ? String(BOARD.script.name).split(' · ').pop() : '환자';
  log(`<span class="say"><b>${esc(name)}</b> — ${esc(txt)}</span>`);
  if(typeof stageBubble==='function') stageBubble(txt, ctx);
}
