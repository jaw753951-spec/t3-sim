/* ══════════════════════════════════════════════════════════════════
   §3 카드 규칙
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   카드 레이어 v19 — 단계 3
   조건 축 넷을 데이터로 둔다. 효과 함수 안에 숨기지 않는다 —
   v18에서 「거치」가 손패에 다섯 장 쌓인 원인이 그것이었다.
   출처: 시스템기획_정리 「조건 축」 · 「분과 키워드」 · 「데모 카드 종류」
   ═══════════════════════════════════════════════════════════════ */

/* ── 축 ① 나갈 곳 ── 기본값 'discard' 는 카드에 표기하지 않는다
   ── 축 ② 낼 조건 ── once(한 턴 한 번) · first(첫 수) · open(조건부 개방)
   ── 축 ③ 잔류 부속 ── keep:N 을 가진 카드만 가진다
   ── 축 ④ 시점 ── when: 'play'(기본) · 'endTurn' · 'onKill' · 'set' · 'last' */

/* ── 축 ⑤ 사혈 ── bleed:N 을 가진 카드는 코스트 옆에 단수 아이콘을 단다.
   낼 때 최대 체력의 4/9/15% 를 먼저 지불하고, 못 내면 카드가 나가지 않는다. */

/* 한 자리에 설치물 칸이 둘이다.
   rig     = 보통 설치물. 설치 카드로 쌓이고 개방으로 태운다. 상한은 설치 카드 수치의 3배(최소 3)
   rigLent = 「빌려온 물건」 전용 칸. 남의 손을 타지 않는다 — 쌓지도 태우지도 못한다.
   둘 다 있으면 턴 종료 시 각각 따로 억제한다. */
//@ 카드.설치 — 설치물 두 칸 · 개방
const rigTotal = n => (n.rig||0) + (n.rigLent||0);

/* 설치 amt 로 처음 놓았을 때의 상한. 카드가 아니라 규칙이 정한다 */
const rigCapOf = amt => Math.max(R.RIG_CAP_MIN, amt * R.RIG_CAP_MUL);
/* 이 자리에 amt 짜리 설치를 더 얹을 수 있는가 — rigSet 과 같은 잣대를 쓴다.
   카드의 need 가 이것을 부른다. 화면이 낼 수 있는지 미리 보는 데 쓴다 */
const canRig = (n, amt) => !(n.rig>0 && n.rig >= (n.rigCap || rigCapOf(amt)));

function rigSet(S,n,amt){
  if(n.rig>0){
    const cap = Math.max(R.RIG_CAP_MIN, n.rigCap||rigCapOf(amt));
    if(n.rig>=cap) return false;
    n.rig = Math.min(cap, n.rig+amt); n.rigUp++;
  } else {
    n.rig = amt; n.rigUp = 0; n.rigCap = rigCapOf(amt);
  }
  return true;
}

/* 개방 — 보통 설치물만 태운다. 빌려온 물건은 대상이 아니다 */
function rigOpen(S,n,mult){
  if(!(n.rig>0)) return 0;
  const amt = n.rig*(mult||R.RIG_OPEN_MULT);
  const got = K.suppress(S,n,amt,{raw:true});
  n.rig=0; n.rigUp=0; n.rigCap=0;
  return got;
}

/* 카드 코스트 — 판 상태에 따라 값이 바뀌는 카드가 있다 */
//@ 카드.코스트 — 판 상태에 따라 값이 바뀌는 카드
function cardCost(S,id){
  const c = CARDS[id]; if(!c) return 0;
  return (S && c.costWhen) ? c.costWhen(S) : c.cost;
}
/* 이 카드가 지금 내는 수치 한 벌.
   v 의 값이 함수면 판을 넣어 부른다 — 규칙 덮어쓰기가 R 을 바꾸면
   카드에 적힌 숫자도 따라 바뀌어야 하기 때문이다.
   구조 필드(cost·picks·bleed)도 같이 실어 준다. 본문이 그 숫자를 쓴다. */
//@ 카드.수치 — 카드 하나의 숫자를 한 벌로 꺼낸다
function cardNums(S, id){
  const c = CARDS[id]; if(!c) return {};
  const out = {cost: cardCost(S,id)};
  if(c.picks) out.picks = c.picks;
  if(c.bleed) out.bleed = c.bleed;
  for(const k in (c.v||{})){ const x = c.v[k]; out[k] = typeof x==='function' ? x(S) : x }
  return out;
}
/* 이 카드가 지금 이 자리에 넣는 억제 '원값' — 수정자가 붙기 전의 수.
   기세처럼 판을 보고 커지는 카드는 raw 에 식을 적어 둔다. */
function cardRaw(S, id, n){
  const c = CARDS[id]; if(!c) return 0;
  const v = cardNums(S, id);
  return c.raw ? c.raw(S, n, v) : (v.sup || 0);
}

//@ 카드.덱조작 — 섞기 · 뽑기 · 덱 세우기
function shuffle(a,rng){ for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a }

function draw(S,k){
  for(let i=0;i<k;i++){
    if(!S.deck.length){
      if(!S.discard.length) return;
      S.deck = shuffle(S.discard.slice(), S.rng); S.discard.length=0; S.shuffles=(S.shuffles||0)+1;
    }
    S.hand.push(S.deck.pop());
  }
}

function setupDeck(S, list, rng){
  S.rng = rng;
  S.deck = shuffle(list.slice(), rng);
  S.hand=[]; S.discard=[]; S.exiled=[]; S.keepUses={}; S.shuffles=0; S.acts=0;
  /* 기세는 항상 쌓인다. rushArmed 는 계기판을 켤지만 정한다 —
     참조 카드가 없으면 숫자가 장식으로 올라가기만 하므로 숨긴다 */
  S.rushArmed = list.some(id=>CARDS[id] && CARDS[id].rushCard);
  drawTurn(S);
}

function drawTurn(S){
  const k = Math.max(1, K.drawCount(S) - (S.drawCutNow||0));
  draw(S,k);
  S.drawCutNow = 0;
}

/* 이 카드가 지금 재진을 달고 나가는가 — 「진행을 붙든다」가 얹어 둔 몫을 본다 */
//@ 카드.사용 — 낼 수 있는가 · 낸다 · 턴 끝에 버린다
function hasRevisit(S, id){
  const c = CARDS[id]; if(!c) return false;
  return !!c.revisit || !!(S.revisitOn||{})[id];
}

function canPlay(S, id){
  const c = CARDS[id]; if(!c) return false;
  /* 카드는 손에서 나간다. 그동안 이 전제는 부르는 쪽에만 있었고 여기엔 없었다 —
     부르는 자리 열네 곳이 모두 S.hand 에서 골라 넘겼기 때문에 드러나지 않았을 뿐이다.
     그 전제가 한 번 깨지면 play() 가 손에서 빼지도 않고 버림에만 넣어서 카드가
     불어난다 (i>=0 일 때만 빼고, 넣는 것은 언제나 넣는다).
     실제로 두 번 깨졌다 — 빔 탐색이 clone 에서 짠 계획을 그대로 얹을 때,
     그리고 무대에서 카드를 겨눈 채 되돌리기를 했을 때. 둘 다 그 자리에서 고쳤지만
     세 번째 자리가 생기면 또 조용히 불어난다. 전제를 여기 적어 둔다. */
  if(!S.hand.includes(id)) return false;
  if(cardCost(S,id) > S.energy) return false;
  if(c.once && (S.oncePlayed||{})[id]) return false;
  if(c.bleed && !K.canBleed(S, c.bleed)) return false;      // 사혈을 못 치르면 못 낸다
  if(c.need && c.need.length>=2 && !c.need(null,S)) return false;
  if(c.target==='hand' && !c.allowNone && !handPicks(S,id).length) return false;
  return true;
}

/* 이 카드가 고를 수 있는 손패 — 자기 자신은 뺀다 */
function handPicks(S, id){
  const c = CARDS[id]; if(!c || c.target!=='hand') return [];
  const rest = S.hand.slice();
  const me = rest.indexOf(id); if(me>=0) rest.splice(me,1);
  return rest.filter(x=>c.pick(S,x));
}

/* 몇 장을 고르는가 — 손패가 모자라면 있는 만큼만 고른다 */
function pickNeed(S, id){
  const c = CARDS[id];
  return Math.min(c.picks||1, handPicks(S,id).length);
}

/* arg = 손패를 대상으로 잡는 카드가 고른 카드 이름 */
function play(S, id, node, arg){
  const c = CARDS[id];
  if(!canPlay(S,id)) return false;
  if(c.need && c.need.length<2 && node && !c.need(node)) return false;
  if(c.target==='node' && !node) return false;
  if(c.target==='hand'){
    const want = pickNeed(S,id);
    if(!Array.isArray(arg) || arg.length!==want) return false;
    const pool = handPicks(S,id);
    for(const x of arg){ const i=pool.indexOf(x); if(i<0) return false; pool.splice(i,1) }
  }
  if(c.bleed && !K.doBleed(S, c.bleed)) return false;        // 지불이 먼저
  S.energy -= cardCost(S,id);
  /* 한 번 붙은 재진과 얹은 진단은 이번 전투 내내 이 카드에 남는다 — 쓴다고 빠지지 않는다 */
  if(c.verb==='진단'){
    if((S.revisitOn||{})[id]) S.revisitNow = true;
    S.diagBonus = (S.diagPlus||{})[id] || 0;
  }
  c.fx(S, node, arg, cardNums(S, id));
  S.revisitNow = false; S.diagBonus = 0;
  if(S.rem && c.dept==='내과' && id!=='관해 유도') K.remGain(S, R.REM_GAIN);  // 관해도 수입
  S.played++; S.acts=(S.acts||0)+1;
  if(S.rec) S.rec.push(node ? `${id} → ${node.sym}` : (arg&&arg.length ? `${id} → ${arg.join('·')}` : id));
  (S.oncePlayed = S.oncePlayed||{})[id] = true;
  // 축 ① 나갈 곳
  const i = S.hand.indexOf(id); if(i>=0) S.hand.splice(i,1);
  if(c.keep){
    const u = (S.keepUses[id]||0)+1;
    S.keepUses[id]=u;
    if(u >= c.keep) S.exiled.push(id);      // 다 쓰면 판에서 빠진다 — 더미로 안 간다
    else S.hand.push(id);                    // 손에 남는다
  } else {
    S.discard.push(id);
  }
  return true;
}

/* 턴 종료 — 손패 전량 버림. 축①의 「손에 남는다」만 예외 */
function endTurnHand(S){
  const keep=[], drop=[];
  for(const id of S.hand){ (CARDS[id]&&CARDS[id].keep) ? keep.push(id) : drop.push(id) }
  S.discard.push(...drop);
  S.hand = keep;
  S.oncePlayed = {};
  S.drawCutNow = S.nextDrawCut||0; S.nextDrawCut=0;
  /* 곗날이 밀어 둔 몫 — 다음 턴부터 한 장씩 갚는다 */
  if(S.drawQueue && S.drawQueue.length) S.drawCutNow -= (S.drawQueue.shift()||0);
}
