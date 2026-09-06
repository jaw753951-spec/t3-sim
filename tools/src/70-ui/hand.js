/* ══════════════════════════════════════════════════════════════════
   §9.14 판 위에서 손이 하는 일
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 판 위의 손 ═════════════════════════════════════════════ */
/* 이 판은 끝났는가 — 화면 판정과 손 동작이 같은 답을 쓴다 */
function verdictNow(){
  if(!S) return null;
  if(S.hp<=0 && !BOARD.noDeath) return '사망';
  if(MODE==='story' && S.act===3) return storyVerdict(S, S.nodes[0], S.policy);
  if(MODE==='story') return null;
  return alive(S).length ? null : (S.evoLog?'호전':'완치');
}

function locked(){
  const v = verdictNow();
  if(v){ log(`<i>판이 끝났다 — ${v}. 되돌리거나 새로 시작한다.</i>`); render(); return true }
  return false;
}

//@ 화면.손 — §9.14 판 위에서 손이 하는 일
function pickNode(i){ SEL=(SEL===i?null:i); render() }

/* 손패를 대상으로 잡는 카드 — 필요한 장수를 다 고르면 나간다 */
let PICK = null;                          // {id, chosen:[]}

function firePick(){
  const {id, chosen} = PICK; PICK = null;
  pushUndo(`「${id}」`);
  if(!play(S, id, null, chosen)){ UNDO.pop(); log(`<i>「${id}」를 지금은 낼 수 없다.</i>`); render(); return }
  const c = CARDS[id];
  log(c.kw==='재진'
    ? `「${id}」 → <b>${esc(chosen.join(' · '))}</b> — ${(S.diagPlus||{})[chosen[0]] ? `진단 +${S.diagPlus[chosen[0]]}` : '재진이 붙었다'}`
    : (chosen.length
        ? `「${id}」 → <b>${esc(chosen.join(' · '))}</b> 버림 · 다음 ${chosen.length}턴 동안 한 장씩 더 뽑는다`
        : `「${id}」 → 버릴 카드가 없다. 그냥 나간다`));
  render();
}

function pickCard(target){
  if(!PICK || !S) return;
  const pool = handPicks(S, PICK.id);
  for(const x of PICK.chosen){ const i=pool.indexOf(x); if(i>=0) pool.splice(i,1) }
  if(!pool.includes(target)) return;
  PICK.chosen.push(target);
  if(PICK.chosen.length >= pickNeed(S, PICK.id)) firePick();
  else render();
}

function cancelPick(){ if(PICK){ PICK=null; render() } }

function playCard(id){
  if(!S) return;
  if(locked()) return;
  const c=CARDS[id];
  if(PICK){ cancelPick(); return }
  if(c.target==='hand'){
    if(!canPlay(S,id)){ log(`<i>「${id}」 — 고를 카드가 없다.</i>`); render(); return }
    const pool = handPicks(S,id), want = pickNeed(S,id);
    /* 고를 것이 남은 장수와 같거나 적으면 물어보지 않고 바로 나간다 */
    if(pool.length <= (c.picks||1)){ PICK = {id, chosen: pool.slice(0,want)}; firePick(); return }
    PICK = {id, chosen: []};
    log(`<i>「${id}」 — ${want}장을 고른다.</i>`); render(); return;
  }
  const node=(c.target==='node')?alive(S)[SEL]:null;
  if(c.target==='node' && !node){ log('<i>자리를 먼저 고른다.</i>'); render(); return }
  /* 1막 — 진단은 병 노드가 아니라 검사 파라미터로 간다 (공용 spendParam).
     재진 태그만은 병 노드에 그대로 통한다 — 회차와 강등은 오르고 수치는 안 깎인다. */
  if(S.act===1 && c.verb==='진단'){
    if(cardCost(S,id)>S.energy){ log('<i>코스트가 모자란다.</i>'); render(); return }
    pushUndo(`「${id}」`);
    if(hasRevisit(S,id) && node){
      const r0=node.diagRound;
      diagnose(S, node, 1, {revisit:true});
      if(node.diagRound>r0) log(`<b>재진 ${node.diagRound}회차</b> — ${node.role==='disease'?'병 노드':node.sym}${node.demoted&&node.diagRound===R.DIAG_DEMOTE_ROUND?' · 반응 강등':''}`);
    }
    const g = spendParam(S, id);
    for(let k=0;k<g;k++) log(`<b>증거 ${S.evid-g+k+1}</b> — 차트에서 병명이 걸러진다.`);
    if(!g) log(`「${id}」 → 검사 파라미터 ${S.paramAcc}/${SR.PARAM_NEED}`);
    render(); return;
  }
  if(node && immune(S,node)){ log('<i>1막의 병 노드는 무적이다. 진단만 통한다.</i>'); render(); return }
  const before=node?node.val:0, hp0=S.hp, rem0=S.rem;
  pushUndo(`「${id}」`);
  if(!play(S,id,node)){ UNDO.pop(); log(`<i>「${id}」를 지금은 낼 수 없다.</i>`); render(); return }
  let extra='';
  if(c.bleed) extra += ` <span style="color:var(--blood)">사혈 ${c.bleed}단 −${hp0-S.hp}</span>`;
  if(!rem0 && S.rem) extra += ` <span class="rem">관해 개시 · 관해도 ${S.remGauge}</span>`;
  else if(S.rem && c.dept==='내과') extra += ` <span class="rem">관해도 ${S.remGauge}</span>`;
  log(`「${id}」${node?` → ${node.sym} <span class="n">${before}→${node.val}</span>`:''}${extra}`);
  render();
}

function killSel(){
  PICK = null;
  if(!S) return;
  if(locked()) return;
  const n=alive(S)[SEL];
  if(!n){ log('<i>자리를 먼저 고른다.</i>'); render(); return }
  if(S.act===1 && n.role==='disease'){ log('<i>1막에서는 병에 손댈 수 없다.</i>'); render(); return }
  const r=reaction(S,n);
  if(r===null){ log('<i>아직 끊을 수 있는 상태가 아니다.</i>'); render(); return }
  const amt=sweepAmt(n);
  pushUndo('처치');
  if(!doKill(S,n)){
    UNDO.pop();
    /* 왜 안 되는지 밝힌다 — 넷 중 하나다 */
    const why = S.rem ? '관해 중에는 처치할 수 없다. 관해를 끝내야 손을 댈 수 있다.'
      : !canKill(S,n) ? '진화한 통증이 판을 잡고 있다. 통증 말고는 아무것도 처치할 수 없다.'
      : S.energy < R.KILL_COST ? `코스트가 모자란다. 처치에 ${R.KILL_COST} 필요한데 ${S.energy} 남았다.`
      : (S.pendKill||[]).includes(S.nodes.indexOf(n)) ? '이미 예약해 둔 자리다. 다음 턴 시작에 터진다.'
      : '지금은 처치할 수 없다.';
    log(`<i>${why}</i>`); render(); return;
  }
  if(S.lastKillPended){
    log(`<b>처치 예약</b> ${n.sym} <span class="d">— 공황이라 손이 늦다. 다음 턴 시작에 터진다. 그 사이 처치선 위로 올라가면 헛돈다.</span>`);
    SEL=null; render(); return;
  }
  log(`<b>처치</b> ${n.sym} — ${r==='strong'?'강반응':r==='weak'?'약반응':'휴면'} · 판 전체 <span class="n">−${amt}</span>`);
  SEL=null; render();
}

/* 턴 종료 — 수동·자동·세션이 전부 이 한 곳을 지난다 */
function resolveTurn(quiet){
  PICK = null;                                   // 고르던 것은 턴을 넘기면 취소된다
  /* 순서는 act1/act3 과 같다 — 플레이어 → 병 → 턴 정산 → 유지 계수.
     v19 는 수동만 병을 정산 뒤에 움직여서 배치와 결과가 달랐다. */
  const story = (S.act===1||S.act===3);
  /* 예고를 병보다 먼저 뽑는다 — forecast 가 스스로 병을 움직여 보기 때문이다.
     병이 이미 움직인 뒤에 부르면 '다음' 박자를 당겨 예고하게 된다. */
  const f=forecast();
  const ph = story ? storyPhase(S, S.nodes[0]) : null;
  if(ph && !quiet){
    if(ph.line) log(`<span class="d">병 —</span> ${ph.line}`);
    if(ph.up)   log(`<b>병기 ${ph.up}</b> — 판이 무거워진다.`);
  }
  endTurnHand(S); turnResolve(S);
  if(story) storyTick(S);
  if(!quiet){
    log(`<span class="d">— ${S.turn-1}턴 종료 · 체력 −${f.dmg}${f.evo.length?` · 진화 ${f.evo.join('·')}`:''}${f.mind?` · 정신 ${f.mind}`:''} —</span>`);
  }
  for(const k of (S.killLate||[]))
    log(k.ok ? `<span class="d">미뤄 둔 처치가 터졌다 —</span> <b>${esc(k.sym)}</b>`
             : `<span class="d">미뤄 둔 처치가 <span style="color:#98302A">헛돌았다</span> — ${esc(k.sym)} 이 처치선 위로 올라갔다.</span>`);
  if(S.remLast==='end') log('<span class="d">관해도가 모자라 <b>관해가 끝났다</b>.</span>');
  else if(S.remLast==='keep' && !quiet) log(`<span class="rem">관해 ${S.remTurns}턴째 · 관해도 ${S.remGauge}</span>`);
  SEL=null;
}

function endTurn(){
  if(!S) return;
  if(locked()) return;
  pushUndo('턴 종료');
  resolveTurn(false);
  render();
}

/* 자동 플레이 한 턴 — 무엇을 냈는지 기록에 남긴다 */
function autoPlayOne(){
  S.rec = [];
  if(MODE==='story' && S.act===1) act1PlayerTurn(S, SR.EVID_AIM, D.aiTurn);
  else if(MODE==='story' && S.act===3) storyTurn(S, S.nodes[0], S.policy);
  else aiTurn(S,{});
  const used = S.rec; S.rec = null;
  return used;
}

function logUsed(turn, used){
  log(used && used.length
    ? `<span class="d">${turn}턴 자동 —</span> <span class="use">${used.map(esc).join(' · ')}</span>`
    : `<span class="d">${turn}턴 자동 — 낸 카드 없음</span>`);
  log(boardLine());
}

/* 지금 판을 한 줄로 — 체력과 증상 수치 */
function boardLine(){
  const ns = alive(S);
  const body = ns.length
    ? ns.map(n=>{
        const nm = n.role==='disease' ? `병(${n.stage})` : n.sym;
        const mk = [n.shielded?'막':'', n.evolved?'진':'', n.rig||n.rigLent?'설':'', n.weak?`약${n.weak}`:''].filter(Boolean).join('');
        return `${nm} <b>${n.val}</b><span class="d">/${n.init}${mk?' '+mk:''}</span>`;
      }).join(' · ')
    : '<span class="d">판이 비었다</span>';
  const rem = S.rem ? ` · <span class="rem">관해 ${S.remGauge}</span>` : '';
  const rush = S.rush ? ` · 기세 ${S.rush}` : '';
  return `<span class="d">└ 체력</span> <b>${S.hp}</b><span class="d">/${S.hpMax} · ${S.mind}${rem}${rush} ·</span> ${body}`;
}

function autoTurn(){
  if(!S) return;
  if(locked()) return;
  if(MODE==='story' && S.act===2){ log('<i>2막이다 — 방침을 고른다.</i>'); render(); return }
  pushUndo('자동 한 턴');
  const t = S.turn;
  const used = autoPlayOne();
  logUsed(t, used);
  resolveTurn(false);
  if(MODE==='story' && S.act===1 && S.evid>=SR.EVID_AIM)
    log(`<b>증거 ${S.evid}/${SR.EVID_TOTAL}</b> — 병명을 선언할 수 있다. 자동 진행은 여기서 더 캐지 않는다. 손으로 더 캐면 오진 확률이 준다.`);
  render();
}

function autoAll(){
  if(!S) return;
  if(locked()) return;
  pushUndo('자동 끝까지');
  for(let g=0; g<80; g++){
    if(S.hp<=0 && !BOARD.noDeath) break;
    if(MODE==='story'){
      if(S.act===2) break;
      if(S.act===3 && storyVerdict(S, S.nodes[0], S.policy)) break;
    } else if(!alive(S).length) break;
    const t = S.turn;
    const used = autoPlayOne();
    logUsed(t, used);
    if(MODE==='story' && S.act===1 && S.evid>=SR.EVID_AIM){ resolveTurn(true); break }
    if(MODE!=='story' && !alive(S).length) break;
    resolveTurn(true);
  }
  const done = verdictNow();
  log(done
    ? `<span class="d">자동 — 끝까지 ·</span> <b>${done}</b> <span class="d">· ${S.turn-1}턴</span>`
    : `<span class="d">자동 — 끝까지 · ${S.turn-1}턴을 돌았는데 판정이 나지 않았다.</span>`
      + (MODE==='story' && S.act===3
        ? `<br><span class="d">${winNote(S)}</span>` : ''));
  render();
}
