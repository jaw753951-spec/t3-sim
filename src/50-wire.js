/* ══════════════════════════════════════════════════════════════════
   층 사이 참조 배선
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ── 모듈 간 참조를 잇는다 (원본 파일이 require 로 나눠져 있던 자리) ── */
const K={R,SYM,ALLSYM,SYMPARAM,sp,killNow,calm,painShare,policyDmg,TRIG,TRANS,BAND,LVTAB,mulberry32,basicLines,EVO_ADJ,newState,alive,active,
  killLine,reaction,canKill,doKill,sweepAmt,suppress,stabilize,diagnose,canDiag,turnResolve,outcome,
  drawCount,painMul,mind,immune,growAmt,infPool,comfortCuts,hurtPatient,
  bleedPay,canBleed,doBleed,delay,remStart,remGain,remUpkeep};

const L={makeBoard,build,S_of,lv_of,medianBoards,HP_TAG,ATK_W,ATK_TARGET};

const C={CARDS,DECK_D1,DECK_D2,BAG_D3,setupDeck,drawTurn,play,canPlay,draw,endTurnHand,shuffle,
         cardCost,hasRevisit,rigTotal,handPicks,pickNeed};

const P={SCRIPT,SESSIONS,makePatient};

const D={aiTurn,runDeck};          // 새 AI 를 기본으로 쓴다

const H={aiTurn:aiTurnH,runDeck:runDeckH};   // 옛 휴리스틱 (대조용)
