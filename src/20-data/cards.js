/* ══════════════════════════════════════════════════════════════════
   데모 22장
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
//@ 카드.목록 — 데모 22장. 카드를 더하거나 고치는 자리
const CARDS = {
/* ── 기본 10장 ───────────────────────────────────────────── */
/* 대상을 못 고르는 것이 이 카드의 값이다 — 판이 골라 주므로 낼지 말지만 정한다.
   가장 얇은 자리를 처치선으로 밀어 첫 처치를 한 턴 앞당기는 자리다 */
'소독하겠습니다': {cost:0, dept:'공통', verb:'억제', target:'none', sup:5,
  text:'수치가 가장 낮은 자리에 억제 −5',
  fx:(S)=>{ const c=K.active(S).filter(n=>n.role!=='disease');
            if(!c.length) return;
            const t=c.reduce((a,b)=> b.val<a.val ? b : a);
            K.suppress(S,t,5) }},
'멈춰!': {cost:1, dept:'내과', verb:'보조', target:'node',
  text:'이 자리의 성장을 세 턴 멈춘다. 감염이 살아 있어도 그동안 몫을 받지 않는다',
  fx:(S,n)=>{ if(n && !n.dead) n.growHold = R.GROW_HOLD }},
'감초 탕약': {cost:1, dept:'내과', verb:'억제', target:'node', sup:6,
  text:'억제 −6',
  fx:(S,n)=>K.suppress(S,n,6)},
'수액 투여': {cost:1, dept:'내과', verb:'억제', sub:'안정화', target:'node',
  /* 탈수가 살아 있으면 안정화 계산에서 알아서 나뉜다 — 카드가 따로 깎지 않는다 */
  text:'안정화 5',
  fx:(S,n)=>K.stabilize(S,n,5)},
'환기하세요': {cost:1, dept:'내과', verb:'진단', target:'node',
  text:'진단 +2',
  fx:(S,n)=>K.diagnose(S,n,2)},
'창상봉합술': {cost:2, dept:'외과', verb:'억제', target:'node', sup:14,
  text:'억제 −14',
  fx:(S,n)=>K.suppress(S,n,14)},
'지혈 압박': {cost:0, dept:'외과', verb:'억제', target:'node', sup:6,
  text:'억제 −3. 출혈이면 −6',
  fx:(S,n)=>K.suppress(S,n, n.sym==='출혈'?6:3)},
'붕대 감기': {cost:0, dept:'공통', verb:'보조', sub:'완화', target:'node',
  text:'정신 악화를 한 번 막는다. 통증이나 호흡곤란에 쓰면 그 자리를 이번 턴 재운다',
  fx:(S,n)=>{ if(n && (n.sym==='통증'||n.sym==='호흡곤란')) K.calm(S,n); S.mindGuard=true }},
'도와드릴까요?': {cost:1, dept:'공통', verb:'보조', target:'none',
  text:'두 장 뽑는다',
  fx:(S)=>draw(S,2)},
'소매를 걷습니다': {cost:0, dept:'공통', verb:'보조', target:'none', once:true,
  text:'이번 턴 코스트 +2. 한 턴에 한 번',
  fx:(S)=>{ S.energy += 2 }},

/* ── 분과 보급 6장 ────────────────────────────────────────── */
'박리': {cost:1, dept:'외과', verb:'억제', kw:'약화', target:'node', sup:4,
  text:'억제 −4, 약화 1 부여',
  fx:(S,n)=>{ K.suppress(S,n,4); n.weak += 1 }},
'몰아붙인다': {cost:1, dept:'외과', verb:'억제', kw:'기세', target:'node', sup:4, rushCard:true, per:6,
  /* 기세 하나가 사는 억제는 이 카드의 수치다. 규칙이 아니라 카드가 정한다 */
  text:'억제 −4. 기세를 전부 소비하고 소비한 기세 당 추가 억제 −6',
  fx:(S,n)=>{ const st=S.rush; S.rush=0; K.suppress(S,n, 4 + st*6) }},
'관해 유도': {cost:2, dept:'내과', verb:'보조', kw:'관해', target:'none',
  costWhen:S=>S.rem?0:2,                        // 관해 중에는 0코스트로 되돌린다
  text:'관해 시작. 관해 중 재사용 시 관해를 즉시 끝낸다',
  fx:(S)=>{ if(S.rem){ S.rem=false; S.remGauge=0; S.remLast='end' } else K.remStart(S) }},
'진행을 붙든다': {cost:1, dept:'내과', verb:'보조', kw:'재진', target:'hand',
  /* 붙은 재진과 얹은 진단은 이번 전투 내내 그 카드에 남는다 */
  pick:(S,id)=>CARDS[id] && CARDS[id].verb==='진단',
  text:'손패의 진단 카드 한 장에 재진을 부여한다. 이미 재진이 붙어 있으면 대신 그 카드가 이번 전투 동안 진단 +1',
  picks:1,
  fx:(S,_,picked)=>{ const id=(picked||[])[0]; if(!id) return;
                     S.revisitOn=S.revisitOn||{}; S.diagPlus=S.diagPlus||{};
                     if(S.revisitOn[id]) S.diagPlus[id] = (S.diagPlus[id]||0)+1;
                     else S.revisitOn[id] = true }},
'거치': {cost:1, dept:'의공학', verb:'억제', kw:'설치', target:'node', rig:4,
  need:n=>!(n.rig>0 && n.rig>=(n.rigCap||12)),
  text:'설치 4',
  fx:(S,n)=>{ rigSet(S,n,4) }},
'출력 개방': {cost:1, dept:'의공학', verb:'억제', kw:'개방', target:'node',
  need:n=>n.rig>0,
  text:'설치물 개방',
  fx:(S,n)=>{ rigOpen(S,n,2) }},

/* ── NPC 6장 ─────────────────────────────────────────────── */
'그물': {cost:2, dept:'외과', verb:'억제', target:'all', sup:6,
  text:'판 위 모든 자리에 억제 −6',
  fx:(S)=>{ for(const n of K.alive(S)) K.suppress(S,n,6) }},
'곗날': {cost:0, dept:'내과', verb:'보조', target:'hand', picks:2, allowNone:true,
  pick:(S,id)=>true,
  text:'카드 두 장을 버리고 다음 두 턴 동안 한 장씩 더 뽑는다. 버릴 카드가 없어도 낼 수 있다',
  /* 버린 장수만큼 다음 턴부터 한 장씩 나눠서 갚는다 (v20 은 다음 턴에 몰아서 갚았다) */
  fx:(S,_,picked)=>{ const drop = picked||[];
            for(const c of drop){ const i=S.hand.indexOf(c); if(i>=0) S.hand.splice(i,1) }
            S.discard.push(...drop);
            S.drawQueue = S.drawQueue || [];
            for(let i=0;i<drop.length;i++) S.drawQueue.push(1) }},
'손이 기억한다': {cost:1, dept:'내과', verb:'억제', kw:'지연', target:'node', sup:6,
  text:'억제 −6, 지연 1',
  fx:(S,n)=>{ K.suppress(S,n,6); K.delay(S,n,1) }},
'빌려온 물건': {cost:1, dept:'의공학', verb:'억제', kw:'설치', target:'node', when:'set', rig:6,
  need:n=>!(n.rigLent>0),
  text:'설치 6. 이 설치물은 따로 놓이고 강화되지도 개방되지도 않는다',
  fx:(S,n)=>{ if(!(n.rigLent>0)) n.rigLent = 6 }},
'매듭 짓다': {cost:1, dept:'외과', verb:'억제', kw:'사혈', bleed:1, target:'node', sup:14,
  text:'사혈 1단 · 억제 −14',
  fx:(S,n)=>{ K.suppress(S,n,14) }},
'눈 딱 감고': {cost:1, dept:'외과', verb:'억제', target:'node', sup:16,
  text:'억제 −16. 다음 턴에 한 장 덜 뽑는다',
  fx:(S,n)=>{ K.suppress(S,n,16); S.nextDrawCut=(S.nextDrawCut||0)+1 }},
};
