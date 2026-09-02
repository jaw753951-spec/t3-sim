/* ══════════════════════════════════════════════════════════════════
   데모 22장
   ──────────────────────────────────────────────────────────────────
   카드 하나의 숫자는 v 한 곳에만 적는다.
     v      이 카드의 수치. 본문의 {열쇠} 와 fx 의 세 번째 인자가 같은 것을 본다.
            값이 함수면 판을 넣어 부른다 — 규칙 덮어쓰기가 R 을 바꾸면
            카드에 적힌 숫자도 따라 바뀌어야 한다.
     text   본문. {sup} 처럼 v 의 열쇠를 감싸면 화면이 그 자리에 숫자를 넣는다.
            판 상태에 따라 값이 달라지는 열쇠(VAL_KIND)는 색이 붙는다.
     raw    이 카드가 지금 이 자리에 넣는 억제 '원값'. 안 적으면 v.sup.
            기세처럼 판을 보고 커지는 카드가 여기에 식을 적는다.
     fx     실제 효과. 숫자는 v 에서만 꺼내 쓴다 — 리터럴을 적지 않는다.

   숫자를 고치려면 v 만 고친다. 본문과 효과가 같이 따라온다.
   ══════════════════════════════════════════════════════════════════ */

/* 카드 수치의 열쇠마다 — 판 상태가 이 값을 바꾸는가, 바꾼다면 무엇이 바꾸는가.
   여기 적힌 열쇠만 화면에서 색이 바뀐다. 나머지는 판과 무관한 고정 수치다. */
//@ 카드.수치종류 — 어떤 수치가 판 상태를 타는가
const VAL_KIND = {
  sup:'억제', supLow:'억제',
  stab:'안정화',
  diag:'진단',
  cost:'코스트',
};

//@ 카드.목록 — 데모 22장. 카드를 더하거나 고치는 자리
const CARDS = {
/* ── 기본 10장 ───────────────────────────────────────────── */
/* 대상을 못 고르는 것이 이 카드의 값이다 — 판이 골라 주므로 낼지 말지만 정한다.
   가장 얇은 자리를 처치선으로 밀어 첫 처치를 한 턴 앞당기는 자리다 */
'소독하겠습니다': {cost:0, dept:'공통', verb:'억제', target:'none', v:{sup:5},
  text:'수치가 가장 낮은 자리에 억제 −{sup}',
  fx:(S,n,a,v)=>{ const c=K.active(S).filter(x=>x.role!=='disease');
            if(!c.length) return;
            const t=c.reduce((a,b)=> b.val<a.val ? b : a);
            K.suppress(S,t,v.sup) }},
'멈춰!': {cost:1, dept:'내과', verb:'보조', target:'node', v:{hold:()=>R.GROW_HOLD},
  text:'이 자리의 성장을 {hold}턴 멈춘다. 감염이 살아 있어도 그동안 몫을 받지 않는다',
  fx:(S,n,a,v)=>{ if(n && !n.dead){ n.growHold = v.hold; K.ev(S,{t:'hold', n, turns:v.hold}) } }},
'감초 탕약': {cost:1, dept:'내과', verb:'억제', target:'node', v:{sup:6},
  text:'억제 −{sup}',
  fx:(S,n,a,v)=>K.suppress(S,n,v.sup)},
'수액 투여': {cost:1, dept:'내과', verb:'억제', sub:'안정화', target:'node', v:{stab:5},
  /* 탈수가 살아 있으면 안정화 계산에서 알아서 나뉜다 — 카드가 따로 깎지 않는다 */
  text:'안정화 {stab}',
  fx:(S,n,a,v)=>K.stabilize(S,n,v.stab)},
'환기하세요': {cost:1, dept:'내과', verb:'진단', target:'node', v:{diag:2, param:2},
  /* param = 1막에서 검사 파라미터로 쓸 때의 몫. 다른 진단 카드는 1이다 */
  text:'진단 +{diag}',
  fx:(S,n,a,v)=>K.diagnose(S,n,v.diag)},
'창상봉합술': {cost:2, dept:'외과', verb:'억제', target:'node', v:{sup:14},
  text:'억제 −{sup}',
  fx:(S,n,a,v)=>K.suppress(S,n,v.sup)},
/* sup 이 큰 쪽(출혈)이다 — 자동 진행은 sup 을 보고 카드값을 매긴다.
   branch — 대상에 따라 갈리는 카드. 고른 자리에 지금 걸리는 쪽만 실제 값으로
   물들고, 안 걸리는 쪽은 흐려진다 */
'지혈 압박': {cost:0, dept:'외과', verb:'억제', target:'node', v:{sup:6, supLow:3},
  text:'억제 −{supLow}. 출혈이면 −{sup}',
  branch:(S,n)=> n && n.sym==='출혈' ? 'sup' : 'supLow',
  raw:(S,n,v)=> n && n.sym==='출혈' ? v.sup : v.supLow,
  fx:(S,n,a,v)=>K.suppress(S,n, n.sym==='출혈'?v.sup:v.supLow)},
'붕대 감기': {cost:0, dept:'공통', verb:'보조', sub:'완화', target:'node', v:{},
  text:'정신 악화를 한 번 막는다. 통증이나 호흡곤란에 쓰면 그 자리를 이번 턴 재운다',
  fx:(S,n)=>{ if(n && (n.sym==='통증'||n.sym==='호흡곤란')) K.calm(S,n); S.mindGuard=true }},
'도와드릴까요?': {cost:1, dept:'공통', verb:'보조', target:'none', v:{draw:2},
  text:'{draw}장 뽑는다',
  fx:(S,n,a,v)=>draw(S,v.draw)},
'소매를 걷습니다': {cost:0, dept:'공통', verb:'보조', target:'none', once:true, v:{energy:2},
  text:'이번 턴 코스트 +{energy}. 한 턴에 한 번',
  fx:(S,n,a,v)=>{ S.energy += v.energy }},

/* ── 분과 보급 6장 ────────────────────────────────────────── */
'박리': {cost:1, dept:'외과', verb:'억제', kw:'약화', target:'node', v:{sup:4, weak:1},
  text:'억제 −{sup}, 약화 {weak} 부여',
  fx:(S,n,a,v)=>{ K.suppress(S,n,v.sup); n.weak += v.weak; K.ev(S,{t:'weak', n, add:v.weak}) }},
/* 기세 하나가 사는 억제는 이 카드의 수치다. 규칙이 아니라 카드가 정한다 */
/* live — 본문의 이 열쇠는 '적힌 수' 가 아니라 '지금 실제로 들어가는 수' 를 보인다.
   기세가 쌓여 있으면 −4 가 −22 로 물들어 보인다 */
'몰아붙인다': {cost:1, dept:'외과', verb:'억제', kw:'기세', target:'node', rushCard:true, live:'sup', v:{sup:4, per:6},
  text:'억제 −{sup}. 기세를 전부 소비하고 소비한 기세 당 추가 억제 −{per}',
  raw:(S,n,v)=> v.sup + (S.rush||0)*v.per,
  fx:(S,n,a,v)=>{ const st=S.rush; S.rush=0; K.ev(S,{t:'rush', v:0}); K.suppress(S,n, v.sup + st*v.per) }},
'관해 유도': {cost:2, dept:'내과', verb:'보조', kw:'관해', target:'none', v:{},
  costWhen:S=>S.rem?0:CARDS['관해 유도'].cost,   // 관해 중에는 0코스트로 되돌린다
  text:'관해 시작. 관해 중 재사용 시 관해를 즉시 끝낸다',
  fx:(S)=>{ if(S.rem){ S.rem=false; S.remGauge=0; S.remLast='end' } else K.remStart(S) }},
'진행을 붙든다': {cost:1, dept:'내과', verb:'보조', kw:'재진', target:'hand', v:{diagPlus:1},
  /* 붙은 재진과 얹은 진단은 이번 전투 내내 그 카드에 남는다 */
  pick:(S,id)=>CARDS[id] && CARDS[id].verb==='진단',
  text:'손패의 진단 카드 한 장에 재진을 부여한다. 이미 재진이 붙어 있으면 대신 그 카드가 이번 전투 동안 진단 +{diagPlus}',
  picks:1,
  fx:(S,_,picked,v)=>{ const id=(picked||[])[0]; if(!id) return;
                     S.revisitOn=S.revisitOn||{}; S.diagPlus=S.diagPlus||{};
                     if(S.revisitOn[id]) S.diagPlus[id] = (S.diagPlus[id]||0)+v.diagPlus;
                     else S.revisitOn[id] = true }},
'거치': {cost:1, dept:'의공학', verb:'억제', kw:'설치', target:'node', v:{rig:4},
  need:n=>canRig(n, CARDS['거치'].v.rig),
  text:'설치 {rig}',
  fx:(S,n,a,v)=>{ rigSet(S,n,v.rig) }},
'출력 개방': {cost:1, dept:'의공학', verb:'억제', kw:'개방', target:'node', v:{mult:2},
  need:n=>n.rig>0,
  text:'설치물을 태운다 — 설치 수치의 {mult}배로 한 방에 억제한다',
  /* raw 를 적어 두었다가 걷었다. cardRaw 는 live 나 branch 가 그 열쇠를 가리킬 때만
     불리는데 이 카드는 둘 다 없고, mult 는 VAL_KIND 에도 없어 화면이 아예 안 물들인다 —
     막는 이유가 둘 겹쳐 한 번도 안 불렸다. 이 카드가 실제로 넣는 수는 자리의
     설치물 표딱지가 낸다 (−rig×mult).

     되살릴 일이 생기면: 개방은 설치물이 하는 일이라 보호막을 무시한다 (rigOpen 이
     {raw:true} 로 부른다). cardEff 는 supAmt 를 옵션 없이 부르므로 그대로 이으면
     막이 있는 자리에서 화면만 깎인 수를 적는다 — 설치 4 · 막 있음이면 화면 −6, 실제 −8.
     배수에 색을 입힐 것이 아니라 rig×mult 를 내는 열쇠를 따로 두고 {raw:true} 를 넘겨야 한다. */
  fx:(S,n,a,v)=>{ rigOpen(S,n,v.mult) }},

/* ── NPC 6장 ─────────────────────────────────────────────── */
'그물': {cost:2, dept:'외과', verb:'억제', target:'all', v:{sup:6},
  text:'판 위 모든 자리에 억제 −{sup}',
  fx:(S,n,a,v)=>{ for(const x of K.alive(S)) K.suppress(S,x,v.sup) }},
'곗날': {cost:0, dept:'내과', verb:'보조', target:'hand', picks:2, allowNone:true, v:{back:1},
  pick:(S,id)=>true,
  text:'카드 {picks}장을 버리고 버린 장수만큼 다음 턴부터 {back}장씩 더 뽑는다. 버릴 카드가 없어도 낼 수 있다',
  /* 버린 장수만큼 다음 턴부터 한 장씩 나눠서 갚는다 (v20 은 다음 턴에 몰아서 갚았다) */
  fx:(S,_,picked,v)=>{ const drop = picked||[];
            for(const c of drop){ const i=S.hand.indexOf(c); if(i>=0) S.hand.splice(i,1) }
            S.discard.push(...drop);
            S.drawQueue = S.drawQueue || [];
            for(let i=0;i<drop.length;i++) S.drawQueue.push(v.back) }},
'손이 기억한다': {cost:1, dept:'내과', verb:'억제', kw:'지연', target:'node', v:{sup:6, delay:1},
  text:'억제 −{sup}, 지연 {delay}',
  fx:(S,n,a,v)=>{ K.suppress(S,n,v.sup); K.delay(S,n,v.delay) }},
'빌려온 물건': {cost:1, dept:'의공학', verb:'억제', kw:'설치', target:'node', v:{rig:6},
  need:n=>!(n.rigLent>0),
  text:'설치 {rig}. 이 설치물은 따로 놓이고 강화되지도 개방되지도 않는다',
  fx:(S,n,a,v)=>{ if(!(n.rigLent>0)){ n.rigLent = v.rig; K.ev(S,{t:'rig', n, amt:v.rig}) } }},
'매듭 짓다': {cost:1, dept:'외과', verb:'억제', kw:'사혈', bleed:1, target:'node', v:{sup:14},
  text:'사혈 {bleed}단 · 억제 −{sup}',
  fx:(S,n,a,v)=>{ K.suppress(S,n,v.sup) }},
'눈 딱 감고': {cost:1, dept:'외과', verb:'억제', target:'node', v:{sup:16, drawCut:1},
  text:'억제 −{sup}. 다음 턴에 {drawCut}장 덜 뽑는다',
  fx:(S,n,a,v)=>{ K.suppress(S,n,v.sup); S.nextDrawCut=(S.nextDrawCut||0)+v.drawCut }},
};
