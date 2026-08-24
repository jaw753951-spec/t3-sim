/* ══════════════════════════════════════════════════════════════════
   §7 v18 휴리스틱 (대조용)
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* 덱을 쥔 표준 플레이 — 단계 3 */

//@ AI옛.평가 — v18 휴리스틱. 대조용으로만 남는다
function need(S,n){ return n.val - K.killLine(S,n) }

function effSup(S,n,raw){
  let v=raw; if(S.mind==='불안'||S.mind==='공황') v-=R.MIND_ANX_SUP;
  if(v<=0) return 0; if(n.shielded) v=Math.ceil(v*(1-n.shReduc)); return v;
}

function threat(S,n){
  let t=0;
  if(K.SYM[n.sym].atk) t += n.val*R.ATK_K*3;
  t += n.init*n.grow*2;
  if(!n.evolved) t += (n.init*(R.EVO_HIT[n.sym]||0))/Math.max(1,n.evoLeft);
  return t;
}

function bestKill(S){
  let b=null,bv=-1;
  for(const n of K.alive(S)){ if(!K.canKill(S,n)) continue; const v=K.sweepAmt(n); if(v>bv){bv=v;b=n} }
  return b;
}

function focus(S){
  const c=K.alive(S).filter(n=>n.val>0&&need(S,n)>0);
  if(!c.length) return null;
  const reach=c.filter(n=>{
    let best=0; for(const id of S.hand){const cd=C.CARDS[id]; if(cd&&cd.sup&&C.cardCost(S,id)<=S.energy) best=Math.max(best,effSup(S,n,cd.sup))}
    return best>=need(S,n);
  }).sort((a,b)=>K.sweepAmt(b)-K.sweepAmt(a))[0];
  return reach || c.sort((a,b)=>threat(S,b)-threat(S,a))[0];
}

//@ AI옛.턴 — v18 한 턴.
/* 한 판을 끝까지 도는 러너(runDeckH)는 v25 에서 걷어냈다 — 부르는 곳이 없었고,
   이름은 H 인데 본문이 새 빔 탐색(aiTurn)을 부르고 있어 대조용 구실도 못 했다.
   옛 AI 로 한 판을 돌리려면 runDeck(board, deck, seed, {ai:'H'}) 를 쓴다 —
   배치 탭의 「휴리스틱 (v18 대조)」가 타는 길이 그것이다. */
function aiTurnH(S, opt={}){
  S.played=0;
  let guard=0;
  while(S.played < R.PLAY_CAP && guard++ < 60){
    /* 코스트 펌핑 먼저 */
    if(S.hand.includes('소매를 걷습니다') && C.canPlay(S,'소매를 걷습니다') && S.energy>=1){
      C.play(S,'소매를 걷습니다'); continue;
    }
    /* 뽑을 수 있으면 뽑는다 */
    const kn=bestKill(S);
    if(kn && S.energy>=R.KILL_COST && !S.rem){ K.doKill(S,kn); S.played++; continue }
    if(S.energy<=0) break;
    /* 손이 얇으면 보충 */
    if(S.hand.length<=2 && S.hand.includes('도와드릴까요?') && C.canPlay(S,'도와드릴까요?')){
      C.play(S,'도와드릴까요?'); continue;
    }
    const f = focus(S);
    if(!f) break;
    /* 설치는 일찍 깔수록 이득 */
    if(S.turn<=3){
      const rig=S.hand.find(id=>C.CARDS[id].kw==='설치'&&C.canPlay(S,id));
      if(rig && C.play(S,rig,f)) continue;
    }
    /* 막이 두꺼우면 걷는다 */
    if(f.shielded && need(S,f)>20){
      const st=S.hand.find(id=>C.CARDS[id].sub==='안정화'&&C.canPlay(S,id));
      if(st && C.play(S,st,f)) continue;
    }
    /* 진단 (스위치) */
    if(opt.diag){
      const dg=S.hand.filter(id=>C.CARDS[id].verb==='진단'&&C.canPlay(S,id))
                     .sort((a,b)=>C.CARDS[a].cost-C.CARDS[b].cost)[0];
      const tgt=K.alive(S).filter(n=>n.val>0&&n.diagRound<(opt.diagRounds||2)).sort((a,b)=>threat(S,b)-threat(S,a))[0];
      if(dg && tgt && C.play(S,dg,tgt)) continue;
    }
    /* 억제 — 값/코스트가 큰 것부터, 이번 턴에 처치선을 넘기면 우선 */
    const sup=S.hand.filter(id=>C.CARDS[id].verb==='억제'&&C.CARDS[id].sub!=='안정화'&&C.canPlay(S,id));
    if(!sup.length) break;
    let pick=null,ps=-1;
    for(const id of sup){
      const cd=C.CARDS[id];
      const e = cd.sup ? effSup(S,f,cd.sup) : 6;
      let sc = e/Math.max(1,cd.cost);
      if(e>=need(S,f)) sc += 50;
      if(cd.target==='all') sc += K.alive(S).length*1.5;
      if(sc>ps){ps=sc;pick=id}
    }
    if(!C.play(S,pick,f)) break;
  }
}
