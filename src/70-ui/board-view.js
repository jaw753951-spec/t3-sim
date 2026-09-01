/* ══════════════════════════════════════════════════════════════════
   §9.18 판 · 계기판 그리기
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 예고 ═══════════════════════════════════════════════════
   판을 복제해 실제 turnResolve 를 한 번 돌려 본다.
   v19 는 같은 계산을 손으로 다시 써서 설치 억제 단계를 빠뜨렸고,
   그 결과 의공학 덱에서 예고가 49% 확률로 틀렸다. 계산은 한 곳에만 둔다.

   스토리에서는 storyPhase 까지 돌려야 한다 — 실제 턴 종료는 병이 먼저 움직이고
   그다음에 정산하기 때문이다 (resolveTurn 의 차례가 그렇다). 이 한 단계를
   빠뜨리는 동안 예고가 1,879턴 중 240번(12.8%) 틀렸다. 분화 · 굳는다 · 몰린다는
   자리를 키운 뒤에 때리므로 덜 봤고(최악 −25), 창 · 가라앉는다 · 아문다는 판을
   내려놓아 덜 때리므로 더 봤다(최악 −52). 설치 억제를 빠뜨렸던 것과 같은 종류다.

   난수를 빌리는 까닭 — 병의 박자는 난수로 자리를 고른다(분화 · 엮는다).
   clone 은 탐색이 흔들리지 않게 rng 를 ()=>0.5 로 고정하므로, 그대로 두면 예고와
   실제가 다른 갈래를 탄다. 실제 판의 난수를 빌려 쓰고 반드시 제자리로 돌려놓는다.
   돌려놓기가 finally 인 것은 이 함수가 그릴 때마다 불리기 때문이다 — 중간에 튀면
   난수가 앞으로 감긴 채 남아 판 전체가 어긋난다. */
//@ 화면.예고 — §9.10 다음 턴에 무슨 일이 나는가
function forecast(){
  if(!S) return {dmg:0, evo:[], mind:null, ev:[]};
  const T = clone(S);
  const hp0 = T.hp, mind0 = T.mind;
  const was = T.nodes.map(n=>n.evolved);
  const rng0 = (S.rng && S.rng.state) ? S.rng.state() : null;
  T.rng = S.rng || T.rng;
  /* 사건을 받아 둔다 — 무대의 의도 칩이 이것을 읽는다.
     칩을 지금 판에서 따로 계산하면 스토리에서 합이 안 맞는다: 실제 턴 종료는 병이
     먼저 움직이고 그 뒤에 때리므로, 자리 값이 이미 달라져 있다. 총계와 칩이
     같은 한 번의 정산에서 나와야 둘이 안 갈린다. */
  T.ev = [];
  try{
    if((T.act===1 || T.act===3) && T.nodes[0]) storyPhase(T, T.nodes[0]);
    turnResolve(T);
  }
  catch(e){ return {dmg:0, evo:[], mind:null, ev:[]} }
  finally{ if(rng0!==null && S.rng && S.rng.set) S.rng.set(rng0) }
  /* 자리를 번호로 바꿔 내보낸다 — 클론의 노드 객체는 이 밖에서 쓸 것이 못 된다.
     클론은 차례를 지키므로 T.nodes[i] 가 곧 S.nodes[i] 다 (박자가 새로 깐 자리는
     뒤에 붙으므로 번호가 밀리지 않는다) */
  const evOut = T.ev.map(e => e.n ? {...e, i:T.nodes.indexOf(e.n), n:null} : e);
  return {dmg: Math.max(0, hp0-T.hp),
          evo: T.nodes.map((n,i)=>(n.evolved&&!was[i])?n.sym:null).filter(Boolean),
          mind: T.mind!==mind0 ? T.mind : null,
          ev: evOut};
}

//@ 화면.그리기 — §9.18 판 · 손패 · 계기판을 그린다
function render(){
  /* 무대가 떠 있으면 그쪽도 같이 맞춘다 — 되돌리기 · 자동 진행 · 세션이
     무대를 몰라도 되는 이유가 이 한 줄이다 */
  if(typeof STAGE_ON!=='undefined' && STAGE_ON){
    /* 무대가 덮고 있는 동안 작업대는 보이지 않는다. 그리지 않는다 —
       나갈 때 stageClose() 가 render() 를 한 번 더 불러 맞춘다 */
    stageRender(); return;
  }
  deckLine('one_deck', ONE_DECK, ONE_CAP);
  packLine();
  renderOvr();
  const bu=$('btnundo'); if(bu) bu.disabled = !UNDO.length;
  syncBackBtn();
  if(DB){ renderDeck(); return }
  if(PK){ renderPack(); return }
  if(MODE==='batch'){ $('log').innerHTML=LOG.map(t=>`<div>${t}</div>`).join(''); return }
  if(MODE==='make'){ renderMake(); return }
  if(MODE==='sess'){ renderSess(); return }
  if(!S) return;
  renderInto(MODE==='story' ? 'st' : 'on');
  pileRender();                       // 더미 창이 떠 있으면 같이 맞춘다
}

/* ── 환자 머리에 붙는 설명 둘 ────────────────────────────────
   작업대와 무대가 같은 것을 쓴다. 두 벌로 적혀 있던 동안 작업대 쪽이
   「한 턴에 두 번 억제」·「15%」를 글자로 박아 두고 커널과 갈라져 있었다.
   실제 규칙은 이렇다 (kernel.suppress · hurtPatient):
     · 한 자리를 한 턴에 HIT_ANX 번째로 억제할 때, 평정이면 불안으로.
       억제로는 공황까지 가지 않는다. 판이 스스로 일으킨 억제는 안 센다.
     · 한 턴 누적 손실이 최대 체력의 MIND_BIGHIT 을 넘으면 한 단계. 턴당 한 번. */
//@ 화면.정신설명 — 무엇이 정신을 흔드는가
function mindTipBody(S){
  return `평정 = 안정화 ×${R.MIND_CALM_STAB}<br>불안 · 공황 = 억제 −${R.MIND_ANX_SUP} · 진단 −${R.MIND_ANX_DIAG}`
    + `<br>의식불명 = 진단이 −${R.MIND_KO_DIAG} 더<br><br>`
    + `평정일 때 한 턴에 <b>${R.HIT_ANX}회</b> 억제하면 정신상태가 악화된다.`
    + `한 턴에 최대 체력의 <b>${pctOf(R.MIND_BIGHIT)}</b> 이상 잃으면 정신상태가 악화된다. 턴당 한 번.<br>`
    + '증상 처치, 진단 성공, 증상 휴면 도달은 정신 상태를 완화한다.'
    + (S.mind==='공황' ? '<br><br><b>공황</b> — 처치가 다음 턴 시작으로 밀린다.' : '');
}

//@ 화면.체력설명 — 이번 턴에 얼마를 잃는가
function hpTipBody(S, f){
  const cuts = comfortCuts(S);
  return `지금 <b>${S.hp}</b> / 최대 ${S.hpMax}<br>이번 턴 잃은 값 ${S.lostThisTurn||0}`
    + `<br>턴 끝 예고 피해 <b>−${f.dmg}</b>`
    + (policyDmg(S)>1?`<br><br><b>${S.policy} 방침</b> — 받는 피해 ×${policyDmg(S).toFixed(2)}`:'')
    + (cuts.length?`<br><b>완화 ${cuts.length}겹</b> — ${cuts.join(' · ')} · 배수에서 −${(R.COMFORT_CUT*cuts.length).toFixed(1)}`:'')
    + `<br><span class="d">이번 턴 최종 배수 ×${Math.max(0, policyDmg(S)-R.COMFORT_CUT*cuts.length).toFixed(2)}</span>`
    + (BOARD.noDeath?'<br><br><span class="d">이 판에서 체력은 <b>1 아래로 내려가지 않는다</b>.</span>':'');
}

/* ── 자리의 처치선 ── 규칙이 정한 바탕값과, 이 판에서 실제로 걸린 값 ──
   약화가 올리고(끊기 쉬워진다) 통증이 내린다(끊기 어려워진다).
   실제 값은 커널의 killLine 이 낸다 — 카드와 마찬가지로 화면이 따로 계산하지 않는다. */
//@ 화면.처치선 — 바탕 처치선과 지금 처치선
function lineEff(S, n){
  const pct = n.role==='disease' ? R.DIS_KILL_LINE : R.KILL_LINE;
  return { base: Math.floor(n.init * pct), eff: killLine(S, n) };
}
/* 뱃지에 박히는 처치선 한 조각 — 바탕값과 다르면 물든다.
   높아지는 쪽이 좋다: 처치선이 높을수록 일찍 끊을 수 있다 */
function lineSpan(S, n){
  const {base, eff} = lineEff(S, n);
  const why = lineWhy(S, n);
  return driftSpan(base, eff,
    `<span class="tt">처치선</span>규칙이 정한 값 <b>${base}</b><br>이 판에서는 <b>${eff}</b>`
    + (why.length ? '<br><br>' + why.join('<br>') : ''), true);
}

/* 무엇이 처치선을 움직였는가 */
function lineWhy(S, n){
  const w = [];
  const per = n.role==='disease' ? R.WEAK_STACK_DIS : R.WEAK_STACK;
  if(n.weak) w.push(`약화 ${n.weak} — 처치선 +${pctOf(per*n.weak)}p`);
  if(n.role!=='disease'){
    const ps = active(S).filter(x=>x.sym==='통증');
    if(ps.length) w.push(`통증 ${ps.length}자리 — 처치선 몫이 ${pctOf(R.KILL_LINE)} 에서 ${pctOf(painShare(S))} 로 눌렸다`);
  }
  return w;
}

/* ── 자리 하나에 붙는 표딱지들 ────────────────────────────────
   보호막 · 약화 · 설치물 · 성장 · 진화 시계 · 진단 회차 …
   3열 화면과 무대가 같은 것을 쓴다 — 두 벌로 적으면 한쪽이 곧 거짓말을 한다.
   글과 설명(툴팁)이 여기 다 들어 있으므로 부르는 쪽은 자리만 내주면 된다. */
//@ 화면.자리표딱지 — 한 자리에 붙는 값과 그 설명
function nodeMarks(S, n){
  const gAdd = growAmt(S,n);
  return [
    /* 처치선은 늘 보인다. 뱃지는 이미 끊을 수 있을 때만 뜨는데,
      정작 이 수가 궁금한 것은 아직 못 끊을 때다 */
    `<span class="m ln">선 ${lineSpan(S,n)}<span class="d">/${n.val}</span></span>`,
    n.role==='disease'?`<span class="m ev"${tip(TT('병기',`지금 병기 <b>${n.stage}</b> / 최대 ${n.stageMax}<br>병기 시계 <b>${n.stageClock}</b> — 0이 되면 병기가 한 칸 오른다.<br>병기가 오르면 병 노드 수치가 그만큼 이월되어 커진다.`))}>병기 ${n.stage}/${n.stageMax} · 시계 ${n.stageClock}</span>`:'',
    n.role==='disease'?`<span class="m"${tip(beatTip(S,n))}>다음: ${nextBeat(S,n)}</span>`:'',
    n.shielded?`<span class="m sh"${tip(TT('보호막',`받는 피해가 <b>${pctOf(n.shReduc)}</b> 줄어든다.<br>안정화를 ${R.SHIELD_MAX} 누적하면 벗겨진다. 지금 ${Math.floor(n.stabAcc)}.<br>판에 탈수가 있으면 안정화가 ${R.DEHY_STAB} 로 나뉘어 ${pctOf(1/R.DEHY_STAB)} 만 쌓인다.<br><br>설치물의 자동 억제는 보호막을 무시한다.`))}>막 ${Math.floor(n.stabAcc)}/${R.SHIELD_MAX} · −${Math.round(n.shReduc*100)}%</span>`:'',
    n.weak?`<span class="m wk"${tip(KWTIP['약화'])}>약화 ${n.weak}</span>`:'',
    n.rig?`<span class="m rig"${tip(TT('설치물',`매 턴 종료 시 이 자리를 <b>${n.rig}</b> 억제한다. 보호막을 무시한다.<br>상한 ${n.rigCap||Math.max(R.RIG_CAP_MIN,n.rig)}<br><br>개방하면 <b>−${n.rig*CARDS['출력 개방'].v.mult}</b> 한 방으로 태울 수 있다.`))}>설치물 ${n.rig}${n.rigCap?`/${n.rigCap}`:''}</span>`:'',
    n.rigLent?`<span class="m rig"${tip(TT('빌려온 물건',`매 턴 종료 시 이 자리를 <b>${n.rigLent}</b> 따로 억제한다. 보호막을 무시한다.<br><br>남의 손을 타지 않는다 — 설치 카드로 쌓이지 않고 개방으로 태울 수도 없다.<br>보통 설치물과 같은 자리에 나란히 놓인다.`))}>빌려온 물건 ${n.rigLent}</span>`:'',
    gAdd>0?`<span class="m gr"${tip(TT('성장', growWhy(S,n)))}>성장 +${gAdd}</span>`:'',
    n.growHold>0?`<span class="m"${tip(TT('성장 정지',`이 자리는 <b>${n.growHold}턴</b> 자라지 않는다.<br>감염이 나눠 주는 몫도 그동안 받지 않고 그 몫은 다른 자리로 넘어가지 않는다.`))}>성장 정지 ${n.growHold}</span>`:'',
    n.role==='disease'?'':(n.evolved
      ?`<span class="m ev"${tip(TT('진화함', (EVOTXT_F[n.sym]?EVOTXT_F[n.sym](n):'')))}>진화함</span>`
      :`<span class="m"${tip(TT('진화까지',`남은 턴 <b>${n.revealed?n.evoLeft:'?'}</b>${n.delayed?` <span class="d">(지연 ${n.delayed})</span>`:''}<br><br>진화하는 턴에 <b>진화 시점 수치의 ${pctOf(R.EVO_HIT[n.sym]||0)}</b>가 즉시 환자에게 들어간다. 피해가 먼저, 수치 증가는 그 뒤다.<br>지금 진화하면 −${Math.ceil(n.val*(R.EVO_HIT[n.sym]||0))}.<br><br>문진 「언제부터 아프셨나요」나 진단 1회차로 열린다.`))}>진화까지 ${n.revealed?n.evoLeft:'?'}</span>`),
    n.delayed?`<span class="m dl"${tip(KWTIP['지연'])}>지연 ${n.delayed}</span>`:'',
    (SYMDOC[n.sym] && n.role!=='disease')
      ?`<span class="m"${tip(TT(n.sym+' · '+SYMDOC[n.sym].label, SYMDOC[n.sym].why()
      + `<br><br>이 자리의 값 <b>${sp(n)}</b>`
      + (sp(n)!==SYMPARAM[n.sym].def()?` <span class="d">(권위본 ${SYMPARAM[n.sym].def()} 에서 고침)</span>`:'')))
      }>${SYMDOC[n.sym].label} ${sp(n)}</span>`:'',
    `<span class="m"${tip((n.diagRound>=1 ? KWTIP['재진'] : KWTIP['진단']) + `<br><br>이 자리 — ${n.diagRound}회차 완료 · 다음 회차 요구 <b>${n.diagNeed}</b> · 쌓은 값 ${n.diagAcc}`
      + (n.diagRound>=1?'<br><span style="color:#98302A">재진 태그 없이는 더 못 연다.</span>':''))}>진단 ${n.diagRound}회 ${n.diagAcc}/${n.diagNeed}</span>`,
    n.demoted?`<span class="m dm"${tip(TT('반응 강등','진단 2회차의 값. 강반응이 영구히 약반응으로 내려간다.<br>강반응이 터뜨리는 전이 · 촉발 강화를 이 자리에서는 더 못 본다.'))}>반응 강등</span>`:'',
    n.chronic?`<span class="m"${tip(TT('만성','오래 끌어온 자리다. 억제가 잘 듣지 않는다.'))}>만성</span>`:'',
    n.muted?`<span class="m dm">이번 턴 잠잠</span>`:'',
    (S.pendKill||[]).includes(S.nodes.indexOf(n))
      ?`<span class="m"${tip(TT('처치 예약 · 공황','공황이라 손이 늦다. 다음 턴 시작에 터진다.<br>터질 때 다시 판정하므로 그 사이 이 자리가 처치선 위로 올라가면 헛손질로 끝난다. 코스트는 돌아오지 않는다.'))} style="color:var(--blood);border-color:var(--blood)">처치 예약</span>`:'',
    (n.evolved && (n.sym==='통증'||n.sym==='호흡곤란'))
      ?`<span class="m ev"${tip(TT('완화 면역',`진화한 ${n.sym}은 <b>자신에게 걸린 완화를 턴당 한 번</b> 튕겨 낸다.<br>판 전체가 아니라 이 자리만이고, 한 번 튕기면 그 턴은 다시 안 튕긴다.<br>「붕대 감기」의 정신 악화 방어는 완화가 아니라서 그대로 붙는다.`))}>완화 면역 ${n.calmUsed?'소진':'1회'}</span>`:'',
  ].filter(Boolean).join('');
}

function renderInto(h){
  if(!S) return;
  tipReset();
  const f=forecast(), hpPct=Math.max(0,S.hp/S.hpMax*100);
  const preD=Math.min(hpPct, f.dmg/S.hpMax*100);
  const cuts = comfortCuts(S);

  /* ── 환자 ── */
  const tagTip = (BOARD.tags||[]).length
    ? tip(TT('체력 태그', (BOARD.tags||[]).map(t=>`${t} <b>×${HP_TAG[t]}</b>`).join('<br>')
        + `<br><br>기본 체력 ${LVTAB[BOARD.level]?LVTAB[BOARD.level].hp:'—'} 에 곱연산으로 걸린다.`)) : '';
  const mindTip = tip(TT('정신 · '+S.mind, mindTipBody(S)));
  const hpTip   = tip(TT('환자 체력', hpTipBody(S, f)));

  $(h+'_patient').innerHTML=`
    <div class="prow"><span class="ptitle">환자</span>
      <span class="mind ${S.mind}"${mindTip}>${S.mind}</span>
      <span class="d"${tagTip}>${(MODE==='sess'&&!S.tagsShown)?'<i>문진 필요</i>':((BOARD.tags||[]).join(' · ')||'태그 없음')}</span>
      <span class="right hpnum"${hpTip}>${(MODE==='sess'&&!S.tagsShown)?'? / ?':S.hp+' <span class="d">/ '+S.hpMax+'</span>'}</span></div>
    <div class="hpbar"${hpTip}><div class="hp" style="width:${hpPct}%"></div>
      <div class="hpre" style="right:${100-hpPct}%;width:${preD}%"></div></div>
    <div class="prow small">
      <span>턴 <b>${S.turn}</b></span>
      <span>코스트 <b>${S.energy}</b>/${R.ENERGY}</span>
      <span>낸 카드 ${S.played}/${R.PLAY_CAP}</span>
      <span>손 ${S.hand.length}장</span>
      ${BOARD.script?`<span class="d">${esc(BOARD.script.name)}</span>`:`<span class="d">레벨 ${BOARD.level} · S ${(BOARD.S||0).toFixed(1)}</span>`}
      ${S.act?`<span class="evo">${S.act}막${S.policy?' · '+S.policy:''}</span>`:''}
      <span class="right d">턴 끝에 <b>−${f.dmg}</b>${f.evo.length?` <span class="evo">진화 ${f.evo.join('·')}</span>`:''}${f.mind?` <span class="badred">${f.mind}</span>`:''}</span></div>`;

  /* ── 자리 ── */
  const ns=alive(S);
  $(h+'_nodes').innerHTML=ns.map((n,i)=>{
    const line=killLine(S,n), edge=Math.floor(line/2), r=reaction(S,n), den=Math.max(n.init*1.2,1);
    const imm = immune(S,n);
    const badge = imm
      ? `<span class="badge none"${tip(TT('1막 · 무적','병명을 밝히기 전까지 병 노드는 억제 · 안정화 · 처치를 전부 받지 않는다.<br>이 자리에 통하는 것은 <b>진단</b>과 <b>재진</b>뿐이다. 진단 카드는 검사 파라미터로 들어가 증거를 쌓는다.'))}>무적 · 진단만 통한다</span>`
      : (r===null?'':`<span class="badge ${r}"${tip(TT(r==='strong'?'강반응':r==='weak'?'약반응':'휴면',
          `처치선 <b>${line}</b> (초기값의 ${pctOf(line/n.init)}) 아래로 내려온 자리는 끊을 수 있다.<br>`
          +`규칙이 정한 바탕값은 ${lineEff(S,n).base} (초기값의 ${pctOf(n.role==='disease'?R.DIS_KILL_LINE:R.KILL_LINE)}).<br>`
          +(n.role==='disease'
            ? `병 노드는 기본 ${pctOf(R.DIS_KILL_LINE)} 다. 약화 한 스택이 <b>${pctOf(R.WEAK_STACK_DIS)}p</b>씩 올린다 (증상의 절반). 지금 약화 ${n.weak}.<br>`
            : `= 초기값 × (통증 몫 ${pctOf(painShare(S))} + ${pctOf(R.WEAK_STACK)}p × 약화 ${n.weak})<br>`)
          +`강 · 약 경계는 처치선의 절반 = ${edge}.<br>처치 코스트 ${R.KILL_COST}.<br><br>`
          +`끊으면 판 전체가 <b>−${sweepAmt(n)}</b> 광역 억제된다 (잔량을 초기값 ${pctOf(R.SWEEP_CAP)} 에서 캡한 뒤 ${numOf(R.SWEEP_K)} 배, 올림).`
          +(r==='strong'?'<br><br>강반응은 전이 · 촉발을 강하게 터뜨리고 정신을 한 단계 무너뜨린다.':'')
          +(r==='none'?'<br><br>휴면에서 끊으면 광역 억제가 0이다.':'')))}>${r==='strong'?'강반응':r==='weak'?'약반응':'휴면'} · 처치 ${R.KILL_COST}코 · 전체 −${sweepAmt(n)}</span>`);

    const marks = nodeMarks(S, n);
    const nm = n.role==='disease' ? '병 노드' : n.sym;
    /* 이름을 nameTip 으로 바꿨다. 전에는 이 지역 상수가 symTip 이었는데,
       문안 고르는 함수도 symTip 이라 그 초기화 식 안에서 자기 자신을 부르게 됐다
       (「Cannot access 'symTip' before initialization」로 작업대가 통째로 안 떴다) */
    const nameTip = n.role==='disease'
      ? tip(TT('병 노드',`부수 증상이 하나라도 살아 있으면 받는 피해가 ${pctOf(R.DIS_SHIELD)} 줄어든다.<br>처치선 바탕값은 초기값의 ${pctOf(R.DIS_KILL_LINE)} — 약화로만 올라간다.<br>성장 · 공격 · 진화를 타지 않는다. 대신 병기가 오른다.`))
      : tip(TT(n.sym + (n.evolved?' ✦':''), symTip(n)));
    const evoTip = tip(TT('진화함', (EVOTXT_F[n.sym]?EVOTXT_F[n.sym](n):'') + '<br><br><span class="d">한 번 진화한 자리는 되돌아가지 않는다.</span>'));
    return `<div class="node ${SEL===i?'sel':''} ${SYM[n.sym]&&SYM[n.sym].atk?'atk':''} ${n.evolved?'evo':''} ${n.role==='disease'?'dis':''}" onclick="pickNode(${i})">
      <div class="nhead"><span><b${nameTip}>${nm}</b>${n.evolved?`<span class="evomark"${evoTip}>진화</span>`:''}</span><span class="val">${n.val}<span class="d">/${n.init}</span></span></div>
      <div class="track"><div class="fill" style="width:${Math.min(100,n.val/den*100)}%"></div>
        <div class="cut" style="left:${Math.min(100,line/den*100)}%"></div>
        <div class="cut half" style="left:${Math.min(100,edge/den*100)}%"></div></div>
      ${badge}<div class="marks">${marks}</div></div>`;
  }).join('') || '<div class="empty">판이 비었다.</div>';

  /* ── 연결선 ── */
  const bl=basicLines(ns.filter(n=>n.role!=='disease').map(n=>n.sym));
  const shown=ns.some(n=>n.revealed);
  $(h+'_wires').innerHTML=
    /* 배선은 **판(S)** 에서 읽는다 — BOARD.enh 는 처음 만들어진 판의 것이라
       부설이 싸움 중에 놓은 줄이 안 나온다 (무대가 같은 함정에 빠져 있었다) */
    (bl.length||(S.enh||[]).length ? '' : '<span class="wire hid">연결선 없음</span>')
    + bl.map(l=>`<span class="wire"${tip(kwTip(l))}>${l.a} 처치 시 → ${l.b} <em>${kwLabel(l)}</em></span>`).join('')
    +(S.enh||[]).map(e=>shown
        ?`<span class="wire enh"${tip(kwTip(e)+'<br><br><span class="d">강화형 — 이 환자에게만 걸린 배선이다.</span>')}>${e.a} 처치 시 → ${e.b} <em>${kwLabel(e)}</em></span>`
        :`<span class="wire hid"${tip(TT('감춰진 배선','이 환자에게만 걸린 강화형 연결선이다.<br>진단 1회차나 문진 「어쩌다 다치셨어요」로 드러난다.'))}>? → ? <em>진단 필요</em></span>`).join('');

  /* ── 우측 상태판 ── */
  const st = $(h+'_state'); if(st) st.innerHTML = stateHTML();

  /* ── 손패 ── */
  const selNode = alive(S)[SEL];
  const pend = PICK ? CARDS[PICK.id] : null;                 // 손패를 고르는 중인가
  let left = [];
  if(pend){
    left = handPicks(S, PICK.id);
    for(const x of PICK.chosen){ const i=left.indexOf(x); if(i>=0) left.splice(i,1) }
  }
  /* 덱과 버림은 손패 줄 맨 앞에 더미로 선다 — 눌러서 안을 본다 (pile-ui) */
  $(h+'_hand').innerHTML=(pend
    ? `<div class="empty" style="width:100%">「${esc(PICK.id)}」 — ${pickNeed(S,PICK.id)-PICK.chosen.length}장 더 고른다.
       ${PICK.chosen.length?`고른 것 <b>${esc(PICK.chosen.join(' · '))}</b> · `:''}<span class="d">esc 로 취소</span></div>` : '')
    + pileTiles()
    + (S.hand.map(id=>{
    if(pend){
      const taken = PICK.chosen.filter(x=>x===id).length;
      const okPick = left.includes(id);
      return cardHTML(id, {S, node:selNode, dim:!okPick, mark:okPick, onclick: okPick?`pickCard('${id}')`:'',
        foot: taken?'<span class="keep on">골랐다</span>':''});
    }
    const {ok, why} = cardWhy(S, id, selNode);
    return cardHTML(id, {S, node:selNode, dim:!ok, onclick:`playCard('${id}')`,
      foot: why?`<span class="keep why">${why}</span>`:''});
  }).join('') || '<div class="empty">손이 비었다.</div>');

  $(h+'_piles').innerHTML=`판 밖 ${S.exiled.length}`
    +` · 합 ${S.hand.length+S.deck.length+S.discard.length+S.exiled.length}`
    +(S.shuffles?` · 셔플 ${S.shuffles}`:'')
    +`<span class="right d" style="font-size:10px">${KEYHELP}</span>`;
  $('log').innerHTML=LOG.map(t=>`<div>${t}</div>`).join('');
  renderAIW();

  if(MODE==='story'){
    const cand = candLeft(S);
    const pol = (BOSS[BOARD.boss]||{policy:{완치:'병 노드를 끊는다',연명:'활성 부수 증상을 하나도 남기지 않는다',편하게:'시계가 다 돌 때까지 버틴다'}}).policy;
    $('st_ctrl').innerHTML = S.act===1
      ? `<div class="chart">증거 <b>${S.evid}</b>/${SR.EVID_TOTAL} · 파라미터 ${S.paramAcc}/${SR.PARAM_NEED} · 차트에 남은 병명 <b>${cand}</b> <span class="d">(정진단 ${(100/cand).toFixed(0)}%)</span></div>
         <div class="note">1막 — 병 노드는 무적이다. 진단 카드는 검사 파라미터로 들어간다.</div>
         <button onclick="declareDx()">병명을 선언한다</button>`
      : S.act===2
      ? `<div class="chart">치료 방침 — 각각 다른 승리 조건이다. 이름 위에 올리면 붙는 것이 보인다.</div>`
        +Object.entries(pol).map(([k,v])=>{
          const key = k;
          return v
            ?`<button class="polbtn"${tip(policyTip(key))} onclick="pickPolicy('${key}')">${k} — ${v}</button>`
            :`<button disabled>${k} — 선택할 수 없다</button>`}).join('')
      : `<div class="chart"><b${tip(policyTip(S.policy))}>${S.policy}</b> — ${pol[S.policy]||''}</div>`
        +`<div class="note">${winNote(S)}</div>`;
  }
  if(S.mind==='공황'){
    const kb = $(h+'_kill');
    if(kb) kb.textContent = `처치 (${R.KILL_COST}코) — 공황: 다음 턴에 터진다`;
  } else { const kb=$(h+'_kill'); if(kb) kb.textContent = `처치 (${R.KILL_COST}코)` }
  const done = verdictNow();
  const v=$(h+'_verdict');
  if(v) v.innerHTML = done
    ? `<span class="done ${done==='사망'||done==='악화'?'bad':''}">${done} — ${S.turn}턴</span>`
    : '';
  for(const b of [$(h+'_kill'), $(h+'_end')]) if(b) b.disabled = !!done;
}

/* 성장이 어디서 왔는가 — 이미 박힌 값과 지금 켜져 있는 값을 갈라 적는다 */
function growWhy(S,n){
  let infN = 0, tgtN = -1;                 // 자기 자신은 대상 수에서 뺀다
  for(const f of active(S)){
    if(f!==n && f.sym==='감염') infN++;
    if(f.role!=='disease') tgtN++;
  }
  const share = infPool(S).get(n) || 0;
  const own  = Math.max(0, n.grow);
  if(n.growHold>0) return `턴 종료 시 <b>+0</b><br><br>· 성장이 <b>${n.growHold}턴</b> 멈춰 있다.<br>&nbsp;&nbsp;<span class="d">멈춘 동안 감염이 나눠 주는 몫도 받지 않는다. 그 몫은 다른 자리로 넘어가지 않고 사라진다.</span>`;
  const L=[`턴 종료 시 <b>+${growAmt(S,n)}</b>`, ''];
  if(n.sym==='출혈') L.push(`· 출혈 자체 — 매 턴 <b>현재 수치의 ${Math.round(sp(n,'출혈')*100)}%</b> (+${Math.ceil(n.val*sp(n,'출혈'))})${n.evolved?' <span class="d">진화로 두 배가 됐다</span>':''}`);
  if(share>0)     L.push(`· 감염이 나눠 준 몫 — <b>+${share}</b><br>&nbsp;&nbsp;<span class="d">감염 ${infN}자리가 만드는 총량을 자리 ${tgtN+1}개가 나눠 갖는다. 자리가 늘어도 판 전체 성장은 그대로고 한 자리 몫만 얇아진다.<br>감염을 끊으면 이 몫은 사라진다.</span>`);
  if(own>0)       L.push(`· 이 자리에 <b>이미 박힌</b> 성장률 +${own.toFixed(2)} (+${Math.ceil(n.init*own)})<br>&nbsp;&nbsp;<span class="d">가속 촉발이나 무장발현으로 한 번 붙은 값이다. 되돌릴 수 없다.</span>`);
  if(n.sym!=='출혈' && !share && !own) L.push('· 판 전체에 걸린 기본 성장률');
  L.push('', `<span class="d">수치 상한은 초기값의 ${R.VAL_CAP}배 = ${Math.floor(n.init*R.VAL_CAP)}.</span>`);
  return L.join('<br>');
}

/* ── 우측 상태판 ── 키워드가 다 켜져도 겹치지 않게 세로로 쌓는다 ── */
function pips(cur, max, cls){
  let o='<div class="pips">';
  for(let i=0;i<max;i++) o+=`<div class="pip ${cls||''} ${i<cur?'on':''}"></div>`;
  return o+'</div>';
}

function stateHTML(){
  const rows=[];
  const ns = alive(S);

  /* 기세 — 외과 */
  if(S.rushArmed){   // 기세는 늘 쌓이지만 참조 카드가 덱에 없으면 계기판을 켜지 않는다
    rows.push(`<div class="st"${tip(KWTIP['기세'])}>
      <div class="stt"><span>기세</span><b>${S.rush}<span class="d">/${R.RUSH_MAX}</span></b></div>
      ${pips(S.rush, R.RUSH_MAX)}
      <div class="stnote">처치 1회당 +${R.RUSH_PER} · 단독 효과 없음<br>쓰는 값은 카드가 정한다</div></div>`);
  }
  /* 관해도 — 내과 */
  if(S.rem || S.remOpened){
    rows.push(`<div class="st"${tip(KWTIP['관해도'])}>
      <div class="stt"><span>관해도</span><b>${S.remGauge}<span class="d">/${R.REM_MAX}</span></b></div>
      ${pips(S.remGauge, R.REM_MAX, 'rm')}
      <div class="stnote">${S.rem
        ? `관해 ${S.remTurns}턴째 · 다음 턴 유지비 ${R.REM_UPKEEP}${S.remGauge<R.REM_UPKEEP?' <span style="color:#98302A">— 모자란다. 끝난다</span>':''}<br>처치 불가 · 성장 · 피해 · 휴면 부활 정지`
        : '관해가 끝났다'}</div></div>`);
  }
  /* 사혈 — 이번 턴 지불 */
  const bledPct = Math.round((S.bledRate||0)*100);
  if(S.hand.some(id=>CARDS[id]&&CARDS[id].bleed) || bledPct>0){
    const left = Math.max(0, Math.round(R.BLEED_TURN_CAP*100) - bledPct);
    rows.push(`<div class="st"${tip(KWTIP['사혈'])}>
      <div class="stt"><span>사혈</span><b>${bledPct}<span class="d">/${Math.round(R.BLEED_TURN_CAP*100)}%</span></b></div>
      ${pips(bledPct, 15, 'bl')}
      <div class="stnote">이번 턴 남은 여유 ${left}%p<br>1단 ${bleedPay(S,1)} · 2단 ${bleedPay(S,2)} · 3단 ${bleedPay(S,3)}</div></div>`);
  }
  /* 설치물 — 의공학 */
  const rigs = ns.filter(n=>rigTotal(n)>0);
  if(rigs.length){
    rows.push(`<div class="st"${tip(KWTIP['설치'])}>
      <div class="stt"><span>설치물</span><b>${rigs.reduce((a,n)=>a+rigTotal(n),0)}</b></div>
      <div class="stnote">${rigs.map(n=>`${n.sym} ${[n.rig?`설치 ${n.rig}/${n.rigCap||n.rig}`:'', n.rigLent?`빌려온 ${n.rigLent}`:''].filter(Boolean).join(' · ')}`).join('<br>')}
      <br>턴 종료 시 자동 억제 · 보호막 무시</div></div>`);
  }
  /* 약화 */
  const wks = ns.filter(n=>n.weak>0);
  if(wks.length){
    rows.push(`<div class="st"${tip(KWTIP['약화'])}>
      <div class="stt"><span>약화</span><b>${wks.reduce((a,n)=>a+n.weak,0)}</b></div>
      <div class="stnote">${wks.map(n=>`${n.sym} ${n.weak} → 선 ${Math.round(killLine(S,n)/n.init*100)}%`).join('<br>')}</div></div>`);
  }
  /* 지연 */
  const dls = ns.filter(n=>n.delayed>0);
  if(dls.length){
    rows.push(`<div class="st"${tip(KWTIP['지연'])}>
      <div class="stt"><span>지연</span><b>${dls.reduce((a,n)=>a+n.delayed,0)}</b></div>
      <div class="stnote">${dls.map(n=>`${n.sym} +${n.delayed}턴 · 수치 +${Math.ceil(n.init*R.DELAY_GROW)*n.delayed}`).join('<br>')}</div></div>`);
  }
  /* 재진 */
  const rv = ns.filter(n=>n.diagRound>=1);
  const held = [...new Set([...Object.keys(S.revisitOn||{}).filter(k=>S.revisitOn[k]),
                            ...Object.keys(S.diagPlus||{}).filter(k=>S.diagPlus[k])])];
  if(rv.length || held.length){
    rows.push(`<div class="st"${tip(KWTIP['재진'])}>
      <div class="stt"><span>재진</span><b>${held.length?held.length+'장':rv.length+'자리'}</b></div>
      <div class="stnote">${held.map(k=>`<b>${k}</b> — ${[(S.revisitOn||{})[k]?'재진':'', (S.diagPlus||{})[k]?`진단 +${S.diagPlus[k]}`:''].filter(Boolean).join(' · ')}`).join('<br>')}
        ${held.length&&rv.length?'<br>':''}
        ${rv.map(n=>`${n.role==='disease'?'병':n.sym} ${n.diagRound}회 · 다음 ${n.diagNeed}`).join('<br>')}</div></div>`);
  }
  /* 공황 처치 예약 */
  if((S.pendKill||[]).length){
    rows.push(`<div class="st"${tip(TT('처치 예약 · 공황','공황 중에는 처치가 다음 턴 시작에 터진다. 코스트는 낼 때 이미 나갔다.<br>터질 때 다시 판정한다 — 자리가 처치선 위로 올라가 있으면 헛손질이다.'))}>
      <div class="stt"><span>처치 예약</span><b>${S.pendKill.length}</b></div>
      <div class="stnote">${S.pendKill.map(i=>{
        const n=S.nodes[i]; if(!n) return '—';
        const ok = !n.dead && reaction(S,n)!==null;
        return `${n.sym} ${n.val}/${killLine(S,n)} ${ok?'<span style="color:#3C6E52">터진다</span>':'<span style="color:#98302A">헛손질</span>'}`;
      }).join('<br>')}</div></div>`);
  }
  /* 통증 배율 */
  const pm = painMul(S), ps = painShare(S);
  if(pm<1){
    rows.push(`<div class="st"${tip(TT('통증 · 처치선',
      `살아 있는 통증 자리마다 처치선 몫이 곱연산으로 낮아진다. 배율 <b>×${pm.toFixed(3)}</b>.<br>`
      +`하한은 <b>${Math.round(R.PAIN_FLOOR*100)}%</b>이고 통증 몫에만 걸린다 — 약화는 그 위에 더해지므로 언제나 유효하다.<br><br>`
      +`지금 처치선 = 초기값 × (${Math.round(ps*100)}% + ${pctOf(R.WEAK_STACK)}p × 약화)`))}>
      <div class="stt"><span>처치선 몫</span><b>${Math.round(ps*100)}%</b></div>
      <div class="stnote">기본 ${Math.round(R.KILL_LINE*100)}% → ${Math.round(ps*100)}%${ps<=R.PAIN_FLOOR?' <span class="d">(하한)</span>':''}<br>통증이 판을 조이고 있다</div></div>`);
  }
  /* 「편하게」 완화 */
  if(S.policy==='편하게'){
    const cuts = comfortCuts(S);
    rows.push(`<div class="st"${tip(policyTip('편하게'))}>
      <div class="stt"><span>완화</span><b>×${Math.max(0, policyDmg(S)-R.COMFORT_CUT*cuts.length).toFixed(2)}</b></div>
      <div class="stnote">${['통증 비활성','호흡곤란 비활성','공황 아님']
        .map(x=>`${cuts.includes(x)?'●':'○'} ${x}`).join('<br>')}</div></div>`);
  }
  /* 병기 */
  const dis = S.nodes.find(n=>n.role==='disease');
  if(dis && !dis.dead){
    rows.push(`<div class="st"${tip(TT('병기',`병기 시계가 0이 되면 병기가 한 칸 오르고 병 노드 수치가 커진다.<br>최대 병기 ${dis.stageMax} 의 시계까지 다 돌면 병이 갈 데까지 간 것이다.`))}>
      <div class="stt"><span>병기</span><b>${dis.stage}<span class="d">/${dis.stageMax}</span></b></div>
      <div class="stnote">시계 ${dis.stageClock}턴${dis.finished?'<br><b>최종 병기 소진</b>':''}</div></div>`);
  }
  return `<h4>판 위의 값</h4>` + (rows.join('') || '<div class="stempty">아직 켜진 키워드가 없다.</div>');
}

/* 지금 방침으로 이기려면 무엇이 남았는가 */
function winNote(S){
  const dis=S.nodes[0], others=active(S).filter(n=>n.role!=='disease');
  if(S.policy==='완치') return `병 노드를 ${killLine(S,dis)}까지 내려서 끊는다. 지금 ${dis.val}.`;
  if(S.policy==='연명') return `활성 부수 증상을 하나도 남기지 않는다. 지금 ${others.filter(n=>n.val>0).length}자리 남았다.`;
  if(S.policy==='편하게') return `병기 ${dis.stage}/${dis.stageMax} · 시계 ${dis.stageClock}턴. 최종 병기의 시계까지 다 돌 때 환자가 살아 있으면 이긴다. 완화 ${comfortCuts(S).length}겹.`;
  return '';
}
