/* ══════════════════════════════════════════════════════════════════
   층 사이 참조 배선
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ── 모듈 간 참조를 잇는다 (원본 파일이 require 로 나눠져 있던 자리) ── */
const K={R,SYM,ALLSYM,SYMPARAM,sp,killNow,calm,painShare,policyDmg,TRIG,TRANS,BAND,LVTAB,mulberry32,basicLines,EVO_ADJ,newState,alive,active,
  killLine,reaction,canKill,doKill,sweepAmt,suppress,stabilize,diagnose,canDiag,turnResolve,outcome,
  supAmt,stabAmt,diagAmt,
  drawCount,painMul,mind,immune,growAmt,infPool,comfortCuts,hurtPatient,
  bleedPay,canBleed,doBleed,delay,remStart,remGain,remUpkeep};

/* medianBoards 는 화면에서 부르는 곳이 없다. 레벨표 중앙값으로 S 를 되짚는
   자체 검산이고, 지금 이것을 부르는 것은 sim_check.js 뿐이다. */
const L={makeBoard,build,S_of,lv_of,medianBoards,HP_TAG,ATK_W,ATK_TARGET};

const C={CARDS,DECK_D1,DECK_D2,PACKS,SWAP,STORY_CAP,swapPool,packDeck,packPick,setupDeck,drawTurn,play,canPlay,draw,endTurnHand,shuffle,
         cardCost,cardNums,cardRaw,hasRevisit,rigTotal,handPicks,pickNeed,VAL_KIND};

const P={SCRIPT,SESSIONS,makePatient};

const D={aiTurn};                  // 새 AI 를 기본으로 쓴다

const H={aiTurn:aiTurnH};          // 옛 휴리스틱 (대조용). 갈래는 runDeck 이 opt.ai 로 고른다
