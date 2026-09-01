/* ══════════════════════════════════════════════════════════════════
   §1 규칙 커널
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ── 이 절의 값이 왜 이 값인가 ───────────────────────────────
   출처: 시스템기획_정리 「전투」 탭 (2026-08-15 정연 수정본).
   화면 없음 · 덱 없음 · 서사 없음. 규칙만 있다.

   광역 억제 계수 1/3 은 밸런스 손잡이가 아니다. 0~2/3 사이에서 중앙 턴이
   0~4턴 움직이고 사망률은 거의 안 움직인다. 도미노 폭주는 안 일어났다.
   휴면에서 끊으면 광역 억제가 0이라 표준 플레이가 노드를 재우지 않는다.
   에너지 3 은 본게임의 코스트 펌핑 카드로 메우기로 하고 유지한다.
   출혈 성장은 현재 수치의 0.10. 늦게 손대면 복리로 커진다.

   판단이 안 선 넷은 미결.md 로 옮겼다 — C-116~C-119.
   진화 즉발 피해 배율 · 진단 후반 감소량 · 내과의 맛 · 표준턴 표와 실측 차이.
   ═══════════════════════════════════════════════════════ */

/* ── 시드 난수 (v18 mulberry32 이식) ── */
//@ 커널.난수 — 시드 난수
function mulberry32(a){a|=0;
  const f=function(){a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  f.state=()=>a; f.set=v=>{a=v|0}; return f}

/* ── 항목별 레벨 ────────────────────────────────────────────
   병기 번호가 기본 레벨이고, 보스는 어긋나는 항목만 BOSS[].lv 에 적는다.
   band(수치) · evo(진화 시계) · spots(자리 상한) · dis(병 노드) · enh(연결선) */
//@ 스토리.레벨 — 병기 → 항목별 레벨
function SLV(bossKey, item, stage){
  const b = BOSS[bossKey];
  const m = (b && b.lv) || {};
  return m[item] || stage;
}

function stageBand(bossKey, stage, i){
  const T = LVTAB[SLV(bossKey,'band',stage)] || LVTAB[3];
  const mi = BAND_ORDER.indexOf(T.main);
  const si = BAND_ORDER.indexOf(T.sub || T.main);
  return BAND[BAND_ORDER[Math.max(si, mi - i)]];
}

/* ── 판 생성 ────────────────────────────────────────────────── */
function basicLines(syms){
  const out=[];
  for(const [a,b,k] of TRIG)  if(syms.includes(a)&&syms.includes(b)) out.push({a,b,k,kind:'trig'});
  for(const [a,b,k] of TRANS) if(syms.includes(a)) out.push({a,b,k,kind:'trans'}); // C는 아직 없어도 된다
  return out;
}

/* ── 배선 키워드 ──────────────────────────────────────────────
   배선 하나가 키워드를 **여럿** 든다. 기본형(촉발 · 전이) 하나에 강화형이
   얹히는 모양이다 — 강화형은 혼자 설 수도 있고 다른 키워드에 붙을 수도 있다.

     촉발  가속 · 경화 · 점화        A 처치 시 B 를 건드린다
     전이  발현 · 무장발현 · 부설    A 처치 시 새것이 생긴다
     강화형 만개 · 연쇄 · 불응 · 확산  같은 배선의 **다른 키워드**를 바꾼다

   옛 판은 k 가 문자열 하나였다. 배열도 문자열도 그대로 읽힌다 —
   명부(patients.js)와 저장된 만들기 판이 아직 문자열을 쓴다.

   kind 를 종류 이름에서 되찾는 까닭: 명부가 손으로 적는 배선은 {a,b,k} 세 칸뿐이라
   kind 가 없었고, fireReactions 가 그것으로 갈래를 갈라서 **명부의 강화 배선이
   하나도 안 터졌다** (감염→탈수 가속 · 감염→통증 불응 둘 다). 표를 두 벌로 안
   적으려고 TRIG · TRANS 에서 뽑고, 표에 없는 것만 아래에 적는다. */
//@ 커널.배선키워드 — 여럿 드는 배선 · 촉발과 전이 가르기
const ENH_KW = ['만개','연쇄','불응','확산'];
const isEnhKw = k => ENH_KW.includes(k);
/* 기본형 목록은 표에서 뽑는다 — 표에 없는 것만 손으로 더한다. 작업대 고르개와
   부설의 뽑기 통이 이 하나를 본다 */
const BASE_KW = [...new Set([...TRIG.map(t=>t[2]), ...TRANS.map(t=>t[2]), '점화', '부설'])];
const linkKws = L => Array.isArray(L.k) ? L.k : [L.k];

let KIND_OF = null;
function kindOf(k){
  if(!KIND_OF){
    KIND_OF = {'부설':'trans'};                        // 표에 없는 전이
    for(const x of ENH_KW) KIND_OF[x] = 'trig';        // 강화형은 대상 자리가 필요하다
    for(const [,,x] of TRIG)  KIND_OF[x] = 'trig';
    for(const [,,x] of TRANS) KIND_OF[x] = 'trans';
  }
  return KIND_OF[k] || 'trig';
}
/* 배선 하나의 갈래는 **기본형 키워드**가 정한다. 강화형만 있으면 촉발로 본다 */
function linkKind(L){
  if(L.kind) return L.kind;
  const base = linkKws(L).find(k => !isEnhKw(k));
  return base ? kindOf(base) : 'trig';
}
/* 배선에 적힌 종류 하나 — 화면이 색과 그림을 고를 때 쓴다 (기본형이 있으면 그것) */
const linkHead = L => linkKws(L).find(k => !isEnhKw(k)) || linkKws(L)[0];

/* 이 자리의 값 — 적어 둔 것이 있으면 그것, 없으면 권위본 기본값 */
function sp(n, sym){
  const d = SYMPARAM[sym||n.sym]; if(!d) return 0;
  const v = n[d.key];
  return (v===undefined || v===null || v==='' || !Number.isFinite(+v)) ? d.def() : +v;
}

/* ── 상태 조회 ──────────────────────────────────────────────── */
//@ 커널.조회 — 살아 있는 자리 · 통증 배율
const alive = S => S.nodes.filter(n=>!n.dead);

const active = S => S.nodes.filter(n=>!n.dead && n.val>0);

/* 통증 배율 — 살아 있는 통증 자리마다 곱한다. 하한은 여기가 아니라 처치선에서 건다 */
function painMul(S){
  /* killLine → reaction → canKill 이 이것을 판마다 수십 번 부른다.
     중간 배열을 만들지 않고 S.nodes 를 한 번만 훑는다 — 곱할 것이 없으면 1 그대로다. */
  let m = 1;
  for(const n of S.nodes){
    if(n.dead || n.val<=0 || n.sym!=='통증' || n.muted) continue;
    if(!R.PAIN_STACK) return sp(n,'통증');                   // 겹치지 않으면 가장 앞의 하나
    m *= sp(n,'통증');                                       // 곱연산으로 겹친다
  }
  return m;
}

/* 통증이 깎고 남은 처치선 몫. 하한을 여기에 건다 —
   통증은 곱, 약화는 그 위에 합.
   하한을 통증 몫에만 걸어 두면 약화가 죽는 구간이 생기지 않는다.
   하한을 최종 비율에 걸면 통증 둘일 때 약화 2스택이 하한에 먹혀 아무 일도 안 한다. */
function painShare(S){ return Math.max(R.PAIN_FLOOR, R.KILL_LINE * painMul(S)) }

/* 처치선 ────────────────────────────────────────────
   증상  = 초기값 × min(100%, max(25%, 50% × 통증배율) + 5%p × 약화스택)
   병    = 초기값 × min(100%, 0% + 2.5%p × 약화스택)   — 약화가 반만 먹는다
   통증은 병 노드의 처치선을 건드리지 않는다. 0에 무엇을 곱해도 0이라 뜻이 없다. */
//@ 커널.처치선 — 처치선 공식 · 반응 등급 · 드로우 수
function killLine(S,n){
  if(n.role==='disease'){
    const pct = Math.min(R.WEAK_LINE_MAX, R.DIS_KILL_LINE + R.WEAK_STACK_DIS * n.weak);
    return Math.floor(n.init * pct);
  }
  const pct = Math.min(R.WEAK_LINE_MAX, painShare(S) + R.WEAK_STACK * n.weak);
  return Math.floor(n.init * pct);
}

function reaction(S,n){                       // 잔량 → 반응 등급
  const line = killLine(S,n);
  if(n.val<=0) return 'none';
  if(n.val>line) return null;                 // 아직 못 뽑는다
  const edge = line/2;                        // 강·약 경계 = 처치선의 절반
  let r = n.val>edge ? 'strong' : 'weak';
  if(r==='strong' && n.demoted) r='weak';     // 진단 2회차 영구 강등
  return r;
}

function drawCount(S){
  const d = active(S).filter(n=>n.sym==='호흡곤란' && !n.muted);
  let cut = 0; for(const n of d) cut += sp(n,'호흡곤란') * (n.evolved?R.EVO_X2:1);
  return Math.max(1, R.HAND - Math.round(cut) + (S.drawBonus||0));
}

/* ── 사건 기록 ────────────────────────────────────────────────
   판에서 무슨 일이 어느 차례로 났는가를 그대로 적어 둔다. 무대가 이것을 읽어
   연출을 짠다 — 전에는 전후 판을 견줘서 되짚었고, 되짚기로는 못 보는 것이 있었다
   (같은 자리를 두 번 억제하면 한 번으로 뭉치고, 아무것도 안 움직인 튕김은 아예 안 보이고,
   촉발·전이는 UI 가 커널을 따로 흉내 내다 틀렸다).

   이것은 훅이 아니라 자료다 — 커널은 화면을 부르지 않고 배열에 밀어 넣기만 한다.
   30-core 는 여전히 화면을 한 번도 안 쓴다.

   S.ev 가 없으면 아무것도 쌓지 않는다. 무대가 손을 부르기 직전에만 켜므로
   탐색 · 배치 · 자동 진행에는 비용이 없다. */
//@ 커널.사건 — 무대가 켤 때만 쌓는다. 끄면 비용 0
function ev(S, e){ if(S.ev) S.ev.push(e) }

/* ── 억제 ───────────────────────────────────────────────────── */
//@ 커널.억제 — 억제 · 무적 판정 · 안정화
/* 억제 amt 가 이 자리에 실제로 들어가는 값.
   화면 예고와 실제 억제가 같은 함수를 쓴다 — 카드에 적힌 수치를 색으로 물들이는
   쪽(화면.카드수치)과 여기가 갈리면 카드가 거짓말을 하게 된다. */
function supAmt(S,n,amt,opt={}){
  if(n.dead||n.val<=0) return 0;
  if(immune(S,n)) return 0;                      // 1막 병 노드 — 완전 무적
  let v = amt;
  if(S.mind==='불안'||S.mind==='공황') v -= R.MIND_ANX_SUP;
  if(v<=0) return 0;
  if(n.role==='disease'){
    if(alive(S).some(x=>x.role!=='disease' && x.val>0)) v = Math.ceil(v*(1-R.DIS_SHIELD));
  } else if(n.shielded && !opt.raw) v = Math.ceil(v*(1-n.shReduc));
  return v;
}
function suppress(S,n,amt,opt={}){
  const v = supAmt(S,n,amt,opt);
  /* 무적이라 한 톨도 안 들어갔다 — 판은 그대로지만 손은 닿았다.
     되짚기로는 볼 수 없던 자리다 (값이 안 변하니 diff 에 안 잡힌다) */
  if(v<=0){ if(amt>0 && immune(S,n)) ev(S,{t:'immune', n}); return 0 }
  const before = n.val;
  n.val = Math.max(0, n.val - v);
  /* 정신 — 한 노드를 한 턴에 두 번 억제하면 악화.
     opt.sweep 는 '판이 스스로 일으킨 억제'라는 표시다 — 처치 광역 억제와 설치물 자동 억제.
     카드가 일으킨 억제는 광역이든 단일이든 전부 센다 (그물·개방 포함). */
  if(!opt.sweep){
    const i = S.nodes.indexOf(n);
    const hits = (S.hitThisTurn[i]||0)+1;
    S.hitThisTurn[i] = hits;
    /* v25 — 3회부터, 그리고 불안까지만. 억제로는 공황에 못 간다 */
    if(hits===R.HIT_ANX && S.mind==='평정') mind(S,+1);
  }
  ev(S,{t:'sup', n, amt:before-n.val, by: opt.raw ? 'rig' : opt.sweep ? 'sweep' : 'card'});
  if(before>0 && n.val===0){ n.dormT = R.DORMANT; mind(S,-1); ev(S,{t:'dorm', n}) }  // 휴면 도달 = 호전
  return before-n.val;
}

/* 1막의 병 노드는 어떤 효과도 받지 않는다 — 진단(재진)만 통한다 */
function immune(S,n){ return S.act===1 && n.role==='disease' }

/* 안정화 amt 가 이 자리에 실제로 쌓이는 값 — 예고와 정산이 같은 함수를 쓴다 */
function stabAmt(S,n,amt){
  if(n.dead||!n.shielded) return 0;
  if(immune(S,n)) return 0;
  if(n.sym==='탈수'&&n.evolved) return 0;               // 탈수 진화 — 못 깎는다
  let v = amt;
  if(S.mind==='평정') v = v*R.MIND_CALM_STAB;
  const dehy = active(S).filter(x=>x.sym==='탈수');
  if(dehy.length) v = v / Math.max(1, ...dehy.map(x=>sp(x,'탈수')));   // 여러 자리면 가장 센 것
  return v;
}
function stabilize(S,n,amt){
  const v = stabAmt(S,n,amt);
  if(v<=0){ if(amt>0 && immune(S,n)) ev(S,{t:'immune', n}); return }
  n.stabAcc += v;
  ev(S,{t:'stab', n, amt:v});
  if(n.stabAcc >= R.SHIELD_MAX){ n.shielded=false; n.shReduc=0; n.stabAcc=0; mind(S,-1); ev(S,{t:'shBreak', n}) }
}

/* ── 완화 ─────────────────────────────────────────────
   진화한 통증·호흡곤란은 '자신을 대상으로 한' 완화를 턴당 한 번 튕겨 낸다.
   판 전체가 아니라 그 자리만이고, 한 턴에 한 번 쓰면 그 턴은 다시 안 튕긴다.
   정신 악화 방어는 완화가 아니므로 이 면역과 무관하게 그대로 붙는다. */
//@ 커널.완화 — 진화한 통증·호흡곤란은 턴당 한 번 튕긴다
function calm(S,n){
  if(!n || n.dead) return false;
  if(n.evolved && (n.sym==='통증'||n.sym==='호흡곤란')){
    if(!n.calmUsed){ n.calmUsed = true; ev(S,{t:'calmBounce', n}); return false }   // 이번 턴 몫으로 한 번 튕긴다
  }
  n.muted = true;
  return true;
}

/* ── 진단 ───────────────────────────────────────────────────── */
/* 진단이 완료된 자리는 「재진」 태그를 단 카드만 다시 연다.
   opt.revisit = true 인 카드만 2회차 이상으로 들어갈 수 있다.
   1막의 병 노드는 무적이지만 재진만은 통한다 (문서: 진단=검사 증거 구조는 동일). */
//@ 커널.진단 — 진단 회차 · 재진 태그
function canDiag(S,n,revisit){
  if(n.dead) return false;
  if(R.DIAG_DEEP_MAX && n.diagRound>=R.DIAG_DEEP_MAX) return false;
  if(n.diagRound>=1 && !revisit) return false;
  return true;
}

/* 진단 amt 가 실제로 쌓이는 값 — 예고와 정산이 같은 함수를 쓴다.
   자리를 보지 않는다. 열 수 있는가(canDiag)는 부르는 쪽이 따로 본다. */
function diagAmt(S, amt){
  let v = amt + (S.diagBonus||0);                   // 그 카드에 얹힌 진단 +N
  if(S.rem) v += R.REM_DIAG_BONUS;                  // 관해 중 진단 +1
  if(S.mind==='불안'||S.mind==='공황') v -= R.MIND_ANX_DIAG;
  if(S.mind==='의식불명') v -= R.MIND_KO_DIAG;
  return v;
}
function diagnose(S,n,amt,opt={}){
  const revisit = !!opt.revisit || !!S.revisitNow;   // 카드 태그 또는 「진행을 붙든다」가 얹은 몫
  if(!canDiag(S,n,revisit)) return 0;
  const v = diagAmt(S, amt);
  if(v<=0) return 0;
  n.diagAcc += v;
  let rounds = 0;
  while(n.diagAcc >= n.diagNeed){
    if(n.diagRound>=1 && !revisit) break;         // 재진 없이는 2회차를 못 연다
    n.diagAcc -= n.diagNeed;
    n.diagRound++; rounds++;
    n.diagNeed += R.DIAG_NEED_UP;                 // 3 → 4 → 5 → 6 …
    if(n.diagRound===1){ n.revealed = true }      // 1회차 — 노출만. 수치는 안 깎인다
    else {
      const k = n.diagRound===R.DIAG_DEMOTE_ROUND ? R.DIAG_CUT_R2 : R.DIAG_CUT_LATE;
      if(!immune(S,n)) n.val = Math.max(0, n.val - Math.ceil(n.init*k));  // 초기값 기준 %p. 보호막 무시
    }
    ev(S,{t:'diag', n, round:n.diagRound});
    if(n.diagRound===R.DIAG_DEMOTE_ROUND){ n.demoted = true; ev(S,{t:'demote', n}) }
    if(n.diagRound===1) mind(S,-1);                      // v25 — 1회차만. 재진은 완화를 주지 않는다
    if(n.val===0 && n.dormT===0) n.dormT = R.DORMANT;
    if(R.DIAG_DEEP_MAX && n.diagRound>=R.DIAG_DEEP_MAX) break;
  }
  return rounds;
}

/* ── 사혈 ── 환자 최대 체력을 지불해 한 장의 값을 산다 ──────
   하한 1  · 지불 후 체력이 1 이상 남을 때만 낼 수 있다. 사혈이 직접 죽이지 않는다.
   턴 상한 15% · 한 턴에 3단 하나 또는 1단+2단까지.
   정신 연동 · 한 턴에 최대 체력의 15% 이상 잃으면 정신이 한 단계 무너진다 (턴당 1회). */
//@ 커널.사혈 — 최대 체력을 지불해 카드값을 산다
function bleedPay(S,tier){ return Math.ceil(S.hpMax * (R.BLEED_PAY[tier]||0)) }

function canBleed(S,tier){
  if(!tier) return true;
  const rate = R.BLEED_PAY[tier]||0;
  if((S.bledRate||0) + rate > R.BLEED_TURN_CAP + 1e-9) return false;   // 턴 상한
  return S.hp - bleedPay(S,tier) >= R.BLEED_FLOOR;                     // 하한 1
}

function doBleed(S,tier){
  if(!tier) return true;
  if(!canBleed(S,tier)) return false;
  const pay = bleedPay(S,tier);
  S.hp -= pay;
  ev(S,{t:'hp', amt:pay, why:'bleed'});
  S.bledRate = (S.bledRate||0) + (R.BLEED_PAY[tier]||0);
  S.lostThisTurn = (S.lostThisTurn||0) + pay;
  if(!S.bigHitFired && S.lostThisTurn >= S.hpMax*R.MIND_BIGHIT){ S.bigHitFired = true; mind(S,+1) }
  return true;
}

/* ── 지연 ── 진화를 N턴 미루고 미룬 턴 1당 자리를 초기값의 10% 키운다 ── */
//@ 커널.지연 — 진화를 미루고 그만큼 수치를 키운다
function delay(S,n,k){
  if(n.dead || immune(S,n)) return 0;
  n.evoLeft += k;
  n.delayed = (n.delayed||0) + k;
  const add = Math.ceil(n.init * R.DELAY_GROW) * k;
  n.val = Math.min(Math.floor(n.init*R.VAL_CAP), n.val + add);
  ev(S,{t:'delay', n, add});
  return add;
}

/* ── 관해 ── 관해도를 지불하고 전장을 멈춘다 ────────────────
   개시 초기값 3 · 상한 10 · 매 턴 시작에 3 지불 · 모자라면 종료
   내과 카드를 낼 때마다 +1. 관해 중 처치 불가. */
//@ 커널.관해 — 관해 게이지 · 유지비
function remStart(S){
  if(S.rem) return false;
  S.rem = true; S.remGauge = R.REM_START; S.remTurns = 0; S.remOpened = true;
  ev(S,{t:'rem', gauge:S.remGauge});
  return true;
}

function remGain(S,k){ if(!S.rem) return; S.remGauge = Math.min(R.REM_MAX, S.remGauge + k); ev(S,{t:'rem', gauge:S.remGauge}) }

function remUpkeep(S){
  if(!S.rem) return null;
  if(S.remGauge >= R.REM_UPKEEP){ S.remGauge -= R.REM_UPKEEP; S.remTurns++; ev(S,{t:'rem', gauge:S.remGauge}); return 'keep' }
  S.rem = false; S.remGauge = 0; ev(S,{t:'rem', gauge:0}); return 'end';
}

function mind(S,d){
  if(S.mind==='의식불명') return;
  if(d>0 && S.mindGuard){ S.mindGuard=false; return }   // 「붕대 감기」 — 악화 1회 방어
  let i = MINDS.indexOf(S.mind);
  i = Math.max(0, Math.min(2, i+d));
  const was = S.mind;
  S.mind = MINDS[i];
  if(S.mind!==was) ev(S,{t:'mind', to:S.mind, worse:d>0});
}

/* ── 처치 ───────────────────────────────────────────────────── */
//@ 커널.처치 — 처치 · 광역 억제 보상 · 반응 발동
function canKill(S,n){
  if(n.dead) return false;
  // 통증 진화 — 통증 아닌 자리는 끊지 못한다. 판마다 부르는 자리라 배열을 만들지 않는다
  if(n.sym!=='통증' && S.nodes.some(x=>!x.dead && x.val>0 && x.sym==='통증' && x.evolved)) return false;
  return reaction(S,n)!==null;
}

/* 광역 억제량 — 잔량을 초기값 50%에서 캡한 뒤 1/3 (올림) */
function sweepAmt(n){
  const cap = Math.floor(n.init*R.SWEEP_CAP);
  return Math.ceil(Math.min(n.val, cap) * R.SWEEP_K);
}

function doKill(S,n){
  if(S.rem) return false;                        // 관해 중에는 뜯지 못한다
  if(!canKill(S,n)) return false;                // 통증 진화 봉쇄를 여기서 본다.
                                                 // v19 는 AI 의 수 고르기(moves)에만 걸려 있어
                                                 // 사람이 손으로는 봉쇄를 뚫고 뽑을 수 있었다.
  const r = reaction(S,n);
  if(r===null) return false;
  if(S.energy < R.KILL_COST) return false;
  /* 공황 — 손이 늦다. 코스트는 지금 나가고 처치는 다음 턴 시작에 터진다.
     터질 때 다시 판정하므로 그 사이 자리가 처치선 위로 올라가면 헛손질로 끝난다.
     코스트는 돌려주지 않는다. 예약은 코스트가 닿는 만큼 여러 개 걸 수 있다. */
  if(S.mind==='공황'){
    const i = S.nodes.indexOf(n);
    if((S.pendKill||[]).includes(i)) return false;   // 같은 자리에 두 번 걸어도 두 번 터지지 않는다
    S.energy -= R.KILL_COST;
    (S.pendKill = S.pendKill||[]).push(i);
    S.acts=(S.acts||0)+1; S.played++;
    S.lastKillPended = true;                          // 손이 예약인지 실제인지 화면에 알린다
    if(S.rec) S.rec.push(`처치 예약 ${n.sym}`);
    return true;
  }
  S.lastKillPended = false;
  return killNow(S,n);
}

/* 실제로 뜯는다 — 공황이 아니면 곧바로, 공황이면 다음 턴 시작에 */
function killNow(S,n){
  const r = reaction(S,n);
  if(r===null) return false;
  if(S.energy < R.KILL_COST) return false;
  /* 불응이 걸어 둔 처치 저항 — 손과 코스트는 나가고 처치는 안 된다.
     공황 예약이 헛손질로 끝나도 코스트를 안 돌려주는 것과 같은 잣대다.
     반응 판정 뒤에 둔다: 애초에 못 끊는 자리는 저항을 쓰지 않는다 */
  if(n.resist > 0){
    S.energy -= R.KILL_COST;
    n.resist--;
    S.acts = (S.acts||0)+1; S.played++;
    const back = !!n.resistBack;
    if(back){ n.val = n.init; n.resistBack = false }
    ev(S,{t:'resist', n, back});
    if(S.rec) S.rec.push(`불응 ${n.sym}`);
    return true;
  }
  S.energy -= R.KILL_COST;
  S.energy += R.REFUND;
  const amt = sweepAmt(n);
  n.dead = true; n.val = 0;
  S.killed++; S.acts=(S.acts||0)+1;
  if(S.rec) S.rec.push(`처치 ${n.sym}`);
  S.rush = Math.min(R.RUSH_MAX, S.rush + R.RUSH_PER);   // 참조 카드가 없어도 쌓인다. 계기판만 가린다
  ev(S,{t:'kill', n, grade:r});
  ev(S,{t:'rush', v:S.rush});
  mind(S,-1);                                     // 처치 성공 = 호전
  // ① 광역 억제 먼저 — 다른 노드가 처치선 아래로 내려가 연쇄가 열린다
  const before = alive(S);          // alive 가 이미 새 배열을 낸다 — 한 벌 더 뜨지 않는다
  for(const m of before) if(m!==n) suppress(S,m,amt,{sweep:true});
  // ② 반응 발동. 전이로 새로 생긴 노드는 ①을 못 받는다
  if(r!=='none') fireReactions(S,n,r);
  if(r==='strong') mind(S,+1);
  return true;
}

/* 배선 목록에 '끊은 자리'를 도로 넣어야 한다.
   doKill 이 n.dead 를 먼저 찍기 때문에, 살아 있는 노드만으로 배선을 다시 계산하면
   출발 자리의 증상이 목록에서 빠지고 L.a===src.sym 인 줄이 하나도 안 남는다.
   v20 까지 기본형 촉발·전이가 한 번도 터지지 않은 원인이다. */
function fireReactions(S,src,grade){
  const strong = grade==='strong';
  const syms = [...new Set([src.sym, ...S.nodes.filter(n=>!n.dead).map(n=>n.sym)])];
  const lines = [...basicLines(syms), ...S.enh];
  for(const L of lines) if(L.a===src.sym) fireLine(S, src, L, strong, lines);
}

/* ── 배선 하나를 터뜨린다 ────────────────────────────────────
   기본형 키워드가 「무엇을 하는가」를, 강화형이 「누구에게 · 얼마나」를 정한다.

     확산  대상 하나가 아니라 살아 있는 모든 자리에 건다.
           강반응이면 재워 둔 자리를 먼저 깨우고 건다.
     연쇄  대상에서 배선을 타고 다음 자리로 이어 건다. 지나온 배선의 키워드가
           효과에 더해진다. 약반응은 한 칸, 강반응은 갈 데가 없을 때까지.
     만개  대상의 진화 시계를 반으로. 강반응이면 즉시 진화 —
           전이 배선에 얹혀 있으면 새로 나는 자리가 진화한 채로 선다.
     불응  대상에 처치 저항 한 번. 강반응이면 튕길 때 초기값으로 되돌린다.

   차례가 규칙이다: **전이 · 부설이 먼저**, 그 다음이 촉발이다. 만개가 같은
   배선의 전이로 태어난 자리를 진화한 채로 세우려면 그 자리가 이미 있어야 한다. */
function fireLine(S, src, L, strong, lines){
  const ks   = linkKws(L);
  const mods = ks.filter(isEnhKw);
  const base = ks.filter(k => !isEnhKw(k));
  const bloom = mods.includes('만개');

  /* ① 전이 · 부설 — 새것이 생긴다 */
  for(const k of base){
    if(k==='부설'){ layLink(S, src, L, strong); continue }
    if(kindOf(k)!=='trans') continue;
    if(alive(S).find(n=>n.sym===L.b && n!==src)) continue;   // 이미 있으면 안 생긴다
    const nn = transmit(S, src, L, k, strong);
    /* 만개가 얹힌 전이 + 강반응 — 태어나면서 진화한 채로 선다 */
    if(nn && bloom && strong) bloomNow(S, nn, true);
  }

  /* ② 촉발 계열 — 대상 자리를 건드린다. 강화형만 있는 배선도 여기로 온다 */
  const trig = base.filter(k => kindOf(k)==='trig');
  const act  = [...trig, ...mods.filter(k => k==='만개' || k==='불응')];
  if(!act.length) return;
  const first = alive(S).find(n=>n.sym===L.b && n!==src);
  if(!first) return;

  /* 확산 — 대상 하나가 아니라 판 전체. 강반응이면 재운 자리를 먼저 깨운다 */
  if(mods.includes('확산')){
    if(strong) for(const n of S.nodes){
      if(n.role==='disease' || n.dead || n.val>0) continue;
      n.dormT = 0; n.val = n.init; n.shielded = true; n.shReduc = R.SHIELD_CUT; n.stabAcc = 0;
      ev(S,{t:'revive', n});
    }
    for(const n of alive(S)) if(n!==src && n.val>0) applyLine(S, src, n, act, strong);
  } else {
    applyLine(S, src, first, act, strong);
  }

  /* 연쇄 — 배선을 타고 이어 건다. 지나온 배선의 키워드가 효과에 더해진다.
     지나온 자리를 세어 두지 않으면 A→B→A 같은 고리에서 안 멈춘다 */
  if(mods.includes('연쇄')){
    const seen = new Set([src, first]);
    let cur = first, carry = act, hops = 0;
    const CAP = strong ? S.nodes.length + 2 : 1;        // 약반응은 한 칸
    while(hops < CAP){
      const nx = lines.find(M => M.a===cur.sym && !isEnhKw(linkHead(M)) &&
                            (n=>n&&!seen.has(n))(alive(S).find(n=>n.sym===M.b)));
      if(!nx) break;
      const t = alive(S).find(n=>n.sym===nx.b);
      carry = [...new Set([...carry, ...linkKws(nx).filter(k=>kindOf(k)==='trig'||isEnhKw(k))])];
      applyLine(S, src, t, carry, strong);
      seen.add(t); cur = t; hops++;
    }
  }
}

/* 자리 하나에 키워드 묶음을 건다 — 확산과 연쇄가 이것을 여러 자리에 되쓴다 */
function applyLine(S, src, tgt, kws, strong){
  if(!tgt || tgt.dead || tgt===src) return;
  const LK = R.LINK;
  for(const k of kws){
    if(k==='가속'){ tgt.grow += strong?LK.가속.강:LK.가속.약;
                    ev(S,{t:'trigger', from:src, to:tgt, kind:k, grade:strong?'strong':'weak'}) }
    else if(k==='경화'){ tgt.shielded=true; tgt.stabAcc=0; tgt.shReduc = strong?LK.경화.강:R.SHIELD_CUT;
                    ev(S,{t:'trigger', from:src, to:tgt, kind:k, grade:strong?'strong':'weak'}) }
    /* 점화는 목표가 공격 증상일 때만 걸린다 — 무대가 이 조건을 따로 흉내 내다 틀렸던 자리다 */
    else if(k==='점화'){ if(SYM[tgt.sym] && SYM[tgt.sym].atk){
                    ev(S,{t:'trigger', from:src, to:tgt, kind:k, grade:strong?'strong':'weak'});
                    hurtPatient(S, Math.ceil(tgt.val*R.ATK_K*(strong?LK.점화.강:LK.점화.약)), 'atk', tgt) } }
    else if(k==='만개'){ bloomNow(S, tgt, strong);
                    ev(S,{t:'trigger', from:src, to:tgt, kind:k, grade:strong?'strong':'weak'}) }
    /* 불응 — 강반응으로 건 저항은 튕길 때 자리를 초기값으로 되돌린다. 되돌림은
       저항마다 세지 않고 자리에 한 벌만 둔다: 겹쳐 걸리면 강반응이 이긴다 */
    else if(k==='불응'){ tgt.resist = (tgt.resist||0) + 1;
                    if(strong) tgt.resistBack = true;
                    ev(S,{t:'trigger', from:src, to:tgt, kind:k, grade:strong?'strong':'weak'}) }
  }
}

/* 진화 한 번 — 턴 종료(6)와 만개 강반응이 **같은 손**을 쓴다.
   갈리면 「만개로 진화한 발열」과 「시계가 다 돌아 진화한 발열」이 다른 값을
   갖게 되고, 화면은 둘을 구분해 주지 않으므로 아무도 못 알아본다.
   차례가 규칙이다 — 피해가 먼저, 그 뒤에 진화로 인한 수치 증가. */
function evolveNow(S, n){
  n.evolved = true; n.evoLeft = 0;
  ev(S,{t:'evolve', n});
  hurtPatient(S, Math.ceil(n.val*(R.EVO_HIT[n.sym]||0)*policyDmg(S)), 'evo', n);   // 진화 '시점' 수치
  if(n.sym==='발열') n.val = Math.min(Math.floor(n.init*R.VAL_CAP), Math.ceil(n.val*sp(n,'발열')));
  if(n.sym==='출혈') n.growVal = sp(n,'출혈') * R.EVO_BLEED_ACC;   // 진화 배수는 규칙값 그대로
  if(n.sym==='감염') n.diagNeed += R.EVO_INF_DIAG;
  mind(S,+1);
  S.evoLog++;
}

/* 만개 — 진화 시계를 반으로. 1턴 남은 자리는 더 줄 데가 없다.
   강반응이면 그 자리에서 진화시킨다 */
function bloomNow(S, n, strong){
  if(!n || n.dead || n.role==='disease' || n.evolved) return;
  if(!strong){ n.evoLeft = Math.max(1, Math.floor(n.evoLeft/2)); return }
  evolveNow(S, n);
}

/* 전이 — 새 자리를 낳는다. 낳은 자리를 돌려준다 (만개가 이어서 잡는다) */
function transmit(S, src, L, k, strong){
  const init = Math.floor(src.init*(strong?R.LINK.발현.강:R.LINK.발현.약));
  const nn = {sym:L.b, init, val:init, shielded:true, shReduc:R.SHIELD_CUT, stabAcc:0,
              grow: k==='무장발현' ? (strong?R.LINK.무장발현.강:R.LINK.무장발현.약) : 0,
              evo: S.board.evoBase + (EVO_ADJ[L.b]||0), evoLeft: S.board.evoBase + (EVO_ADJ[L.b]||0),
              evolved:false, dead:false, dormT:0, rig:0, rigUp:0, rigCap:0, rigLent:0, delayed:0, weak:0,
              diagRound:0, diagAcc:0, diagNeed:R.DIAG_NEED, resist:0, resistBack:false, demoted:false,
              revealed:false, spawned:true, born:S.turn, role:'sym'};
  S.nodes.push(nn);
  ev(S,{t:'spawn', from:src, n:nn, kind:k, grade:strong?'strong':'weak'});
  return nn;
}

/* 부설 — 대상 B 에서 나가는 배선을 하나 새로 놓는다.
   약반응은 기본형 종류, 강반응은 강화형 종류다. 도착점은 살아 있는 다른 자리에서
   고른다. 판의 난수를 쓴다 — 탐색 복제본은 rng 가 ()=>0.5 로 고정이라 갈래가
   흔들리지 않는다 (clone 이 그렇게 잡아 둔 까닭과 같다) */
function layLink(S, src, L, strong){
  const rnd = (S.rng || Math.random);
  const from = L.b;
  const outs = alive(S).filter(n => n.role!=='disease' && n.sym!==from && n.val>0);
  if(!outs.length) return;
  const to = outs[Math.floor(rnd()*outs.length) % outs.length].sym;
  /* 부설이 부설을 놓게 두면 배선이 기하급수로 는다 — 뽑기 통에서 자기를 뺀다 */
  const pool = BASE_KW.filter(k => k!=='부설');
  const pick = a => a[Math.floor(rnd()*a.length) % a.length];
  const base = pick(pool);
  /* 강반응은 「강화형 연결선」을 놓는다. 강화형만 홀로 놓으면 안 되는 까닭:
     연쇄와 확산은 **같은 배선의 다른 키워드**를 옮겨 나르는 물건이라 얹힐 것이
     없으면 아무 일도 안 난다. 강반응 부설의 절반이 죽은 선을 놓고 있었다.
     기본형 하나에 강화형을 얹어 놓으면 늘 무언가를 한다 */
  const k = strong ? [base, pick(ENH_KW)] : base;
  const has = x => x.a===from && x.b===to && linkKws(x).join()===linkKws({k}).join();
  if(S.enh.some(has)) return;                              // 같은 것을 두 벌로 안 놓는다
  S.enh.push({a:from, b:to, k});
  ev(S,{t:'lay', from:src, a:from, b:to, kind:k, grade:strong?'strong':'weak'});
}

/* ── 성장량 — 화면 예고와 실제 정산이 같은 함수를 쓴다 ──────
   출혈은 '현재 수치'의 비율로 자란다 (v21). 그 밖의 성장률은 초기값 기준. */
/* 감염 총량 배분 ────────────────────────────────────────────
   감염 한 자리가 만드는 총 성장 = 그 자리 '현재 수치' × 얹는 비율 (진화하면 두 배).
   총량을 올림한 뒤 대상 자리들이 나눠 갖는다. 배분은 내림이고 나머지는 수치가 큰 자리부터.
   성장이 멈춘 자리의 몫은 재배분하지 않고 사라진다 — 멈추는 카드가 총량을 깎는 손이 된다.
   자리마다 따로 얹던 v22 까지는 노드 넷이면 판 전체 성장이 네 배였다. */
function infPool(S){
  const pool = new Map();
  /* 감염이 없는 판이 대부분이다. 그때는 배열을 하나도 만들지 않고 나간다 */
  if(!S.nodes.some(n=>!n.dead && n.val>0 && n.sym==='감염')) return pool;
  const infs = active(S).filter(f=>f.sym==='감염');
  const tgtAll = active(S).filter(n=>n.role!=='disease');
  for(const f of infs){
    const tgt = tgtAll.filter(n=>n!==f);
    if(!tgt.length) continue;
    const total = Math.ceil(f.val * sp(f,'감염') * (f.evolved?R.EVO_X2:1));
    if(total<=0) continue;
    ev(S,{t:'inf', n:f, total});      // 이 감염 자리가 판 전체에 얹는 총량 (무대의 「판 +N」)
    const each = Math.floor(total/tgt.length);
    const rest = total - each*tgt.length;
    const order = tgt.slice().sort((a,b)=>b.val-a.val || a.sym.localeCompare(b.sym));
    for(const n of tgt) pool.set(n, (pool.get(n)||0) + each);
    for(let i=0;i<rest;i++) pool.set(order[i], (pool.get(order[i])||0) + 1);
  }
  return pool;
}

//@ 커널.성장 — 턴마다 자라는 양. 예고와 정산이 같은 함수를 쓴다
function growAmt(S,n,pool){
  if(n.role==='disease') return 0;
  if(n.growHold>0) return 0;                       // 성장 정지 — 이 자리는 이번 턴 자라지 않는다
  let add = n.grow>0 ? Math.ceil(n.init*n.grow) : 0;
  add += (pool||infPool(S)).get(n) || 0;           // 감염이 나눠 준 몫
  if(n.sym==='출혈') add += Math.ceil(n.val*sp(n,'출혈'));
  if(n.sym==='출혈' && R.BLEED_ABS>0) add = Math.min(add, R.BLEED_ABS);
  return add;
}

/* 「편하게」 완화 — 턴 종료 시 통증 비활성 · 호흡곤란 비활성 · 공황 아님.
   충족한 항목 하나마다 이번 턴 환자 피해가 20% 줄어든다 */
//@ 커널.피해 — 편하게 완화 · 방침 배수 · 환자 피해
function comfortCuts(S){
  if(S.policy!=='편하게') return [];
  const off = sym => !active(S).some(n=>n.role!=='disease' && n.sym===sym && !n.muted);
  const out=[];
  if(off('통증')) out.push('통증 비활성');
  if(off('호흡곤란')) out.push('호흡곤란 비활성');
  if(S.mind!=='공황') out.push('공황 아님');
  return out;
}

/* 방침이 얹는 피해 배수 — 「편하게」는 병을 놔두는 대가로 환자가 더 맞는다 */
function policyDmg(S){
  const P = (typeof SR!=='undefined' && SR.POLICY) ? SR.POLICY[S.policy] : null;
  return 1 + ((P && P.dmgUp) || 0);
}

/* noDeath 판은 체력이 0이 되지 않는다 — 문구 그대로 바닥을 1로 깐다.
   v21.2 까지는 사망 판정만 건너뛰고 값은 계속 내려가서 스토리 자동 진행이
   체력 −1985 같은 숫자를 찍었다. 화면과 예고가 전부 무의미해졌다. */
/* src = 이 피해를 낸 자리. 턴 공격처럼 여러 자리가 함께 낸 것은 비워 둔다
   (그쪽은 자리별 원값을 t:'atk' 로 따로 적어 두고 무대가 총계를 나눠 갖는다).
   진화 즉발과 점화는 자리 하나가 낸 것이라 여기서 바로 붙는다 —
   붙여 두지 않으면 무대의 의도 칩이 그 몫을 통째로 놓친다. */
function hurtPatient(S, amt, why, src){
  if(amt<=0) return;
  const floor = (S.board && S.board.noDeath) ? 1 : -Infinity;
  const before = S.hp;
  S.hp = Math.max(floor, S.hp - amt);
  const real = before - S.hp;                    // 바닥에 걸리면 실제로 깎인 만큼만 센다
  if(real<=0) return;
  ev(S,{t:'hp', amt:real, why: why||'atk', n: src||null});
  S.lostThisTurn = (S.lostThisTurn||0) + real;
  if(!S.bigHitFired && S.lostThisTurn >= S.hpMax*R.MIND_BIGHIT){ S.bigHitFired=true; mind(S,+1) }
}

/* ── 턴 경계 ────────────────────────────────────────────────────
   턴 종료와 턴 시작이 한 함수 안에 순서대로 들어 있다. 이 순서가 유일한 정의이고
   같은 말을 규칙 문장으로 따로 적지 않는다. 자리를 옮기려면 여기만 옮긴다.

     턴 종료   1 손패 버림          호출부 (endTurnHand)
               2 병 박자 · 병기 시계  호출부 (storyPhase)
               3 성장 · 성장 정지 −1
               4 설치물 자동 억제
               5 환자 피해
               6 진화
               7 휴면 부활
               8 결과 판정          호출부 (읽기만 한다)
     턴 시작   9 처치대기 발동
              10 관해도 지불 · 관해 종료
              11 드로우
              12 완화 해제 · 각종 소멸
              13 코스트 리필

   9 가 12 보다 앞이라 완화로 열어 둔 처치선이 예약 판정까지 살아 있다.
   9 가 10 보다 앞이라 예약은 관해를 아예 보지 않는다 — 관해를 언제 켜고 끄든 결과가 같다.
   3·5·6 은 이번 턴에 태어난 자리를 건너뛴다. 전이로 생긴 노드가 광역 억제를 못 받는 것과 같은 이유다. */
//@ 커널.턴종료 — 턴 해결 순서. 종료 여섯 · 시작 다섯
function turnResolve(S){
  const born = n => n.born === S.turn;          // 이번 턴에 태어난 자리는 이번 정산을 건너뛴다

  /* ── 턴 종료 ── */
  // 3 성장 — 관해 중에는 자라지 않는다. 감염 배분은 판 하나에 한 번만 센다
  if(!S.rem){
    const pool = infPool(S);
    for(const n of active(S)){
      if(n.role==='disease' || born(n)) continue;
      const add = growAmt(S,n,pool);
      if(add>0){ n.val = Math.min(Math.floor(n.init*R.VAL_CAP), n.val+add); ev(S,{t:'grow', n, amt:add}) }
    }
    for(const n of S.nodes) if(n.growHold>0) n.growHold--;   // 멈춰 둔 턴을 하나 깎는다
  }
  // 4 설치 억제 — 설치물은 보호막을 무시하고 매 턴 종료 시 자동으로 깎는다
  for(const n of active(S)){
    if(n.rig>0)     suppress(S,n,n.rig,{sweep:true, raw:true});
    if(n.rigLent>0) suppress(S,n,n.rigLent,{sweep:true, raw:true});
  }
  // 5 공격 — 관해 중에는 때리지 않는다
  let dmg = 0;
  if(!S.rem) for(const n of active(S))
    if(n.role!=='disease' && !born(n) && SYM[n.sym].atk){
      const raw = Math.ceil(n.val*R.ATK_K);
      dmg += raw;
      /* 자리마다의 원값 — 방침 배수가 붙기 전의 수다. 무대의 의도 칩이 이것을 읽어
         「이 자리를 끊으면 얼마가 준다」를 말한다. 배수는 합에 한 번만 붙으므로
         칩은 이 원값들로 총계를 나눠 갖는다 (무대.의도칩) */
      ev(S,{t:'atk', n, raw});
    }
  const cuts = comfortCuts(S);
  /* 완화는 방침 배수에서 뺀다 (합연산).
     곱연산이면 두 겹만 채워도 배수가 1 아래로 떨어져 도피 방침이 되레 피해를 줄여 준다.
     합연산은 셋을 다 채워도 1.5 − 0.6 = 0.9 에서 멈춘다 — 벌을 깎을 뿐 뒤집지 못한다. */
  if(dmg>0) dmg = Math.ceil(dmg * Math.max(0, policyDmg(S) - R.COMFORT_CUT*cuts.length));
  hurtPatient(S, dmg, 'turn');      // 점화의 'atk' 와 가른다 — 칩이 턴 공격만 나눠 갖는다
  // 6 진화 — 피해가 먼저, 그 뒤에 진화로 인한 수치 증가
  for(const n of active(S)){
    if(n.role==='disease' || n.evolved || born(n)) continue;
    n.evoLeft--;
    if(n.evoLeft>0) continue;
    evolveNow(S, n);
  }
  // 7 휴면 부활 — 관해 중에는 일어나지 않는다
  if(!S.rem) for(const n of S.nodes){
    if(n.role==='disease' || n.dead || n.val>0) continue;
    if(n.dormT>0){ n.dormT--; if(n.dormT===0){ n.val=n.init; n.shielded=true; n.shReduc=R.SHIELD_CUT; n.stabAcc=0; ev(S,{t:'revive', n}) } }
  }
  // 8 결과 판정 — 호출부가 읽는다. 여기서는 아무것도 하지 않는다

  /* ── 턴 시작 ── */
  S.turn++;
  ev(S,{t:'turn', turn:S.turn});
  S.played = 0;
  S.hitThisTurn = {};
  S.bledRate = 0;                                  // 사혈 턴 상한 초기화
  S.lostThisTurn = 0; S.bigHitFired = false;       // 여기부터 새 턴 몫이다 — 9의 피해가 새 턴으로 센다
  /* 9 처치대기 — 공황이 미뤄 둔 처치. 코스트는 예약할 때 이미 냈으므로 여기서 보지 않는다.
     완화는 아직 걸려 있고 성장·진화·휴면 부활은 이미 지나갔다. 그래서 그 셋으로만 헛손질이 된다. */
  S.killLate = [];
  if(S.pendKill && S.pendKill.length){
    const q = S.pendKill; S.pendKill = [];
    for(const i of q){
      const n = S.nodes[i];
      if(!n || n.dead || !canKill(S,n)){ S.killLate.push({sym:n?n.sym:'?', ok:false}); continue }
      const free = S.energy; S.energy = R.KILL_COST;
      const ok = killNow(S,n);
      S.energy = free + (ok ? R.REFUND : 0);
      S.killLate.push({sym:n.sym, ok});
    }
  }
  // 10 관해도 지불 — 모자라면 관해가 끝난다. 끝난 턴은 그 턴 성장·공격을 그대로 맞는다
  S.remLast = remUpkeep(S);
  // 11 드로우 — 지금 판에 살아 있는 호흡곤란만 본다
  drawTurn(S);
  // 12 완화 해제 · 완화 면역 회복 · 정신 방어 소멸
  for(const n of S.nodes){ n.muted = false; n.calmUsed = false }
  S.mindGuard = false;
  // 13 코스트 리필
  S.energy = R.ENERGY;
}

/* ── 전투 상태 ──────────────────────────────────────────────── */
//@ 커널.판상태 — 판 하나를 연다
function newState(board, opt={}){
  return {board, nodes:board.nodes, enh:board.enh, hp:board.hp, hpMax:board.hpMax,
          mind: opt.mind||'평정', turn:1, energy:R.ENERGY, played:0, hitThisTurn:{},
          killed:0, rush:0, rushArmed:!!opt.rushArmed, evoLog:0, over:false,
          rem:false, remTurns:0, remGauge:0, remOpened:false, remLast:null,
          bledRate:0, lostThisTurn:0, bigHitFired:false, revisitOn:{}, revisitNow:false, diagPlus:{}, diagBonus:0, drawQueue:[], pendKill:[], killLate:[],
          drawBonus:0, mindGuard:false,
          hand:[], deck:[], discard:[], exiled:[], keepUses:{}};
}

/* 결과 5단계 */
//@ 커널.결과 — 완치 · 호전 · 연명 · 악화 · 사망
function outcome(S, coreSym){
  if(S.hp<=0) return '사망';
  const act = active(S);
  if(act.length) return '악화';
  const core = S.nodes.find(n=>n.sym===coreSym) || S.nodes[0];
  const dorm = S.nodes.filter(n=>!n.dead && n.val<=0);
  if(core && !core.dead) return '연명';
  if(dorm.length || S.evoLog>0) return '호전';
  return '완치';
}
