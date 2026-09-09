/* ══════════════════════════════════════════════════════════════════
   §6 스토리 3막
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* v26 — 자리가 태어날 때 진화 카운터를 어디서 받는가.
   전에는 경로마다 달랐다: 명부가 있는 보스는 레벨표에서 읽고(laySpot),
   명부가 없는 보스(어부·송이)는 4 가 손으로 박혀 있었다. 그래서 어부·송이는
   진화 시계를 어떤 손잡이로도 못 만졌고, 송이에 지정된 진화 레벨(lv.evo)도
   읽히지 않는 죽은 값이었다. 이제 세 경로가 이 자 하나를 본다 —
   3막 진입 씨앗 · 명부대로 세우기 · 명부 없는 보스의 분화 폴백.
   병 노드 자신(evo 99)은 여기를 지나지 않는다. 병 노드는 진화하지 않는 것이 설계다. */
//@ 스토리.자리진화 — 자리가 갖고 태어나는 진화 카운터
function spotEvo(bossKey, stage, sym){
  const T = LVTAB[SLV(bossKey,'evo',stage)] || LVTAB[3];
  return Math.max(1, T.evo + (EVO_ADJ[sym]||0));
}

/* 자리 하나를 짓는다. 자리가 나는 네 경로가 전부 여기를 지난다 —
   3막 진입 씨앗 · 명부대로 세우기(laySpot) · 명부 없는 보스의 분화 · 어부 「긁는다」.

   ★ 진화 카운터를 밖에서 받지 않는다. 전에는 이 자가 4 를 박아 두고 부르는 쪽이
     세 줄 뒤에 덮어썼는데, 덮어쓰기를 잊은 경로가 그대로 4 로 굳었다 —
     어부·송이가 실제로 그랬다. 새 경로를 더해도 다시 그러지 않게 여기서 챙긴다.
   turn 을 안 주면 씨앗이다. 3막 전에 이미 서 있던 자리라 '태어난 턴'이 없고,
   그 열쇠는 turnResolve 가 「이번 턴에 난 자리는 이번 정산을 건너뛴다」에 쓴다. */
//@ 스토리.병노드 — 자리 하나를 세운다. 진화 카운터까지 여기서 챙긴다
function mkSpot(bossKey, stage, sym, init, turn){
  const e = spotEvo(bossKey, stage, sym);
  const n = {sym, init, val:init, shielded:true, shReduc:R.SHIELD_CUT, stabAcc:0,
    grow:0, evo:e, evoLeft:e, evolved:false, dead:false, dormT:0,
    rig:0, rigBase:0, rigParts:[], rigPartMax:0, rigCap:0, rigLent:0, delayed:0, weak:0, diagRound:0, diagAcc:0, diagNeed:R.DIAG_NEED,
    resist:0, resistBack:false, demoted:false, revealed:false, spawned:turn!=null, role:'sym'};
  if(turn!=null) n.born = turn;
  return n;
}

/* ── 병기별 손잡이 ──────────────────────────────────────────
   병 노드 정의(BOSS[key])가 병기마다 다른 값을 적어 둘 수 있다. 안 적으면
   지금까지 쓰던 전역값이 그대로 나온다 — 세 자는 그 갈림만 맡는다.
   「만들기 · 병 노드」가 커스텀 병 노드를 여기에 적는다. */
//@ 스토리.병기시계 — 이 병기의 시계가 몇 턴인가
function stageTurns(bossKey, stage){
  const c = (BOSS[bossKey]||{}).clock;
  return (c && c[stage]) || SR.STAGE_TURNS;
}

//@ 스토리.병기수치 — 이 병기의 병 노드 수치
function stageDisVal(bossKey, stage){
  const v = (BOSS[bossKey]||{}).disVal;
  return (v && v[stage]) || SR.DIS_BASE[SLV(bossKey,'dis',stage)];
}

/* 병기가 오를 때 깎아 둔 몫을 얼마나 들고 가는가 — 0 ~ 1.
     1  깎아 둔 비율이 그대로 유지된다 (비례 이월)
     0  새 병기의 수치로 되돌아간다 — 깎아 둔 것이 통째로 없던 일이 된다
     사이  그만큼만 들고 간다
   적어 두지 않으면 null 이고, 그때는 창 기믹(SR.GIMMICK.PRORATE)이 정하던
   지금까지의 셈을 그대로 쓴다 — 권위본 병기 셋은 한 자리도 안 움직인다.
   PRORATE=false 의 '절대 이월'(늘어난 몫만 얹는다)은 이 0~1 자로는 적을 수 없다.
   결이 다른 셈이라 억지로 한 자에 욱여넣지 않고 기믹 쪽에 남겨 둔다. */
//@ 스토리.이월 — 병기가 오를 때 깎아 둔 몫을 얼마나 들고 가는가
function stageCarry(bossKey, stage){
  const c = (BOSS[bossKey]||{}).carry;
  return (c && c[stage]!==undefined && c[stage]!==null)
    ? Math.max(0, Math.min(1, +c[stage])) : null;
}

/* ── 판 짓기 ── */
function makeDisease(key, rng){
  const b = BOSS[key];
  const stage = b.stage0;
  const v0 = stageDisVal(key, stage);
  const dis = {sym:'병', role:'disease', init:v0, val:v0,
    shielded:false, shReduc:0, stabAcc:0, grow:0, evo:99, evoLeft:99, evolved:false,
    dead:false, dormT:0, rig:0, rigBase:0, rigParts:[], rigPartMax:0, rigCap:0, rigLent:0, delayed:0, weak:0, diagRound:0, diagAcc:0,
    diagNeed:R.DIAG_NEED, resist:0, resistBack:false, demoted:false, revealed:false, spawned:false,
    stage, stageMax:b.stageMax, stageClock:stageTurns(key, stage), beat:0};
  const nodes=[dis];
  b.seed.forEach((s,i)=>{
    const band = b.roster ? (b.roster[stage].find(r=>r[0]===s)||[,SR.ROSTER_MISS])[1] : SR.FREE_BASE;
    const init = b.roster ? band + Math.floor(rng()*SR.SPOT_SPREAD)
                          : SR.FREE_BASE + Math.floor(rng()*SR.FREE_SPREAD);
    nodes.push(mkSpot(key, stage, s, init));   // 턴을 안 준다 — 3막 전에 이미 서 있는 자리다
  });
  let hp=b.hp;
  return {nodes, enh:[], hp, hpMax:hp, noDeath:!!b.noDeath, level:5, core:'병', boss:key, evoBase:3, S:0, tags:b.tags};
}

/* 카드로 병 노드를 치는 것도 정신 판정에 든다 — sweep 를 붙이지 않는다 */
function hitDisease(S, dis, amt){ return K.suppress(S, dis, amt) }

/* ── 병 노드 행동 ── */
/* 자리 하나를 명부대로 세운다 */
function laySpot(S, slot, turn, stage){
  const init = slot[1] + Math.floor(S.rng()*SR.SPOT_SPREAD);
  /* v25 — 레벨표를 그대로 본다. build() 와 달리 EVO_ADJ 가 빠져 있어서
     같은 턴에 깔린 자리들이 같은 턴에 진화했다. 그게 체력 절벽의 원인이었다.
     v26 — 그 계산은 mkSpot 안으로 들어갔다. 씨앗·분화도 같은 자를 본다. */
  const nd = mkSpot(S.board.boss, stage, slot[0], init, turn);
  S.nodes.push(nd);
  return nd;
}

/* ── 정원 ────────────────────────────────────────────────────
   자리가 몇까지 서는가. **명부 길이가 아니다** — 명부(roster)는 증상 '종류의 통'이고
   상한은 여기 하나가 쥔다. 전에는 명부 있는 보스만 명부 길이로 잘려서, 아이 병기3 은
   자리가 둘까지만 서고 악보의 둘째 분화가 늘 성장으로 샜다.

   연명은 이 자를 양쪽에서 민다 — 처치한 자리가 닫혀 상한이 줄고(closedN),
   병기가 오를 때마다 하나씩 는다(spawnBonus). 그 둘이 연명의 경주다.

   ★ 여기서 세는 것은 **살아 있는 자리**(휴면 포함)다. 휴면은 자리를 비운 것이 아니라
     눌러 둔 것이라 분화가 그 위에 덧세우면 안 된다. 병 노드 공격이 세는 것은 이것이
     아니라 **활성 자리**다 (disAtkAmt) — 두 셈이 다르다. 헷갈리면 여기를 볼 것. */
//@ 스토리.정원 — 자리가 몇까지 서는가
function spotCap(S, dis){
  const base = SR.SPAWN_LV[SLV(S.board.boss,'spots',dis.stage)];
  return Math.max(0, base - (S.closedN||0) + (S.spawnBonus||0));
}
const liveSpots = S => K.alive(S).filter(n=>n.role!=='disease').length;
const freeSpot  = (S, dis) => liveSpots(S) < spotCap(S, dis);

/* 분화가 세울 증상 하나. 명부가 있으면 아직 안 선 종류를 먼저 쓰고, 종류가 다 찼는데
   정원이 남았으면 통에서 하나를 다시 고른다 — 같은 증상이 두 자리에 설 수 있다.
   명부가 없는 보스는 dupType 한 종류거나 공용 통이다.
   ★ 「옮아 앉는다」(어부)도 이 자를 본다. 두 곳에 적으면 갈린다. */
//@ 스토리.분화통 — 분화가 세울 증상 하나
function dupPick(S, dis){
  const b = BOSS[S.board.boss];
  if(b.roster){
    const have = new Set(K.alive(S).filter(n=>n.role!=='disease').map(n=>n.sym));
    const pool = b.roster[dis.stage];
    const fresh = pool.find(r=>!have.has(r[0]));
    return (fresh || pool[Math.floor(S.rng()*pool.length) % pool.length])[0];
  }
  const pool = b.dupType ? [b.dupType] : ['발열','통증','호흡곤란','감염','탈수'];
  return pool[Math.floor(S.rng()*pool.length) % pool.length];
}

/* 분화 한 번. 정원이 찼으면 null 을 돌려주고 부르는 쪽이 폴백을 쓴다 */
//@ 스토리.분화 — 자리를 하나 세운다
function spawnSpot(S, dis){
  if(!freeSpot(S, dis)) return null;
  const b = BOSS[S.board.boss];
  const sym = dupPick(S, dis);
  if(b.roster){
    const slot = b.roster[dis.stage].find(r=>r[0]===sym) || [sym, SR.ROSTER_MISS];
    return laySpot(S, slot, S.turn, dis.stage);
  }
  const init = SR.DUP_BASE + Math.floor(S.rng()*SR.DUP_SPREAD);
  const nd = mkSpot(S.board.boss, dis.stage, sym, init, S.turn);
  S.nodes.push(nd);
  return nd;
}

/* 병기 진입 — 명부 앞 n−1개를 한꺼번에 깐다. 나머지는 분화가 채운다.
   정원을 넘겨 깔지 않는다 — 연명에서 자리가 닫혀 정원이 줄었을 수 있다 */
function layStage(S, dis){
  const b = BOSS[S.board.boss];
  if(!b.roster) return;
  const set = b.roster[dis.stage].slice(0, Math.max(1, b.roster[dis.stage].length-1));
  for(const slot of set){ if(!freeSpot(S, dis)) break; laySpot(S, slot, S.turn, dis.stage) }
}

/* 3막 진입 — 그 병기의 명부를 세운다. 이미 서 있는 자리는 건드리지 않는다 */
function layAct3(S, dis){
  const b = BOSS[S.board.boss];
  if(!b) return;
  const live = new Set(alive(S).filter(n=>n.role!=='disease').map(n=>n.sym));
  if(b.roster){
    const set = b.roster[dis.stage].slice(0, Math.max(1, b.roster[dis.stage].length-1));
    for(const slot of set) if(!live.has(slot[0])) laySpot(S, slot, S.turn, dis.stage);
    return;
  }
  const cap = spotCap(S, dis);
  const seeds = b.seed || [];
  for(let i=0;i<seeds.length && live.size<cap;i++){
    if(live.has(seeds[i])) continue;
    laySpot(S, [seeds[i], stageBand(S.board.boss, dis.stage, i)], S.turn, dis.stage);
    live.add(seeds[i]);
  }
}

/* ── 소멸 ── 처치가 아닌 제거 ──────────────────────────────
   창(아이)과 옮아 앉는다(어부)가 이 손을 쓴다. 처치와 무엇이 다른가:
     · 기세도 정신 완화도 안 붙고 광역 억제도 없다
     · 촉발 · 전이가 안 터진다
     · **연명에서 자리를 안 닫는다** — 다음 분화가 그 자리를 다시 채운다

   마지막 줄이 이 표시(n.vanished)의 존재 이유 전부다. 자리 닫기(closeKilled)가
   dead 만 보면 소멸도 닫아 버리고, 그러면 아이와 어부의 연명이 「병이 스스로
   판을 비워 주는」 판이 된다 — 진척을 0으로 되돌리려던 장치가 되레 승리 버튼이 된다.

   창은 **활성 자리만** 쓴다. 휴면(val<=0)은 안 쓸리고 흡수 대상도 아니다.
   돌려주는 것은 쓸어 간 수와 소멸 직전 수치의 합이다 (흡수량이 그 합에서 나온다) */
//@ 스토리.소멸 — 처치가 아닌 제거. 자리를 닫지 않는다
function wipeSpots(S){
  let n=0, sum=0;
  for(const x of S.nodes) if(x.role!=='disease' && !x.dead && x.val>0){
    sum += x.val; x.dead=true; x.vanished=true; x.val=0; n++;
  }
  return {n, sum};
}

/* 「소멸이 만든 빈 판은 한 턴 안 친다」는 유예(S.wiped)를 걷었다. **되살리지 않는다.**
   승리 조건이 「활성 부수 0」이던 동안에는 그 유예가 필요했다 — 턴 차례가
   「판정 → 플레이어 → 병 → 정산」이라 창이 판을 쓸면 다음 분화가 오기 전에 판정이
   먼저 떨어져서, 아이 연명이 40판 중 40판을 창이 떨어지는 그 턴에 이겼다.

   승리 조건이 **자리를 다 닫는 것**으로 바뀌면서 그 구멍이 저절로 막혔다:
   소멸은 자리를 안 닫으므로 창이 아무리 판을 쓸어도 정원이 한 칸도 안 준다.
   플래그를 세워 두면 「병이 판을 쓸어 줬는데 왜 안 이기나」를 화면이 설명할 길이
   없어지고, 푸는 자리를 자리마다 챙겨야 하는 짐만 남는다. */

/* 성장 비트 — 폴백으로도 쓴다.
   ★ **현재 수치** 기준이다 (v27). 초기값 기준이던 동안은 깎아 놓은 자리에도 늘 같은
     값이 얹혀서, 화면에 뜬 숫자로 다음 턴을 셈할 수가 없었다. 폴백이라 매 턴 붙을 수
     있으므로 비율은 억제율 아래로 내려 두었다 (SR.BEAT.성장). */
function growBeat(S){
  for(const n of K.active(S)) if(n.role!=='disease')
    n.val=Math.min(Math.floor(n.init*R.VAL_CAP), n.val+Math.ceil(n.val*SR.BEAT.성장));
  return '증상이 자란다';
}

/* 폴백으로 나가는 성장. **판이 비면 성장은 아무 일도 안 한다** — 그때 병을 놀리지
   않으려고 사다리를 둔다: 분화 → 깨우기 → 성장.

   ★ 이음표에 막다른 길이 있다. 어부의 「옮아 앉는다」 줄은 후보가 번진다 · 몰린다 ·
     성장 셋인데 빈 판에서는 앞의 둘이 다 떨어진다. 성장은 lastAct 를 안 덮으므로
     다음 턴도 같은 줄을 보고, 앵커로 넘겨 봐야 옮아 앉는다도 쓸 자리가 없어 도로
     성장이다 — 실측에서 **11턴이 통째로 비었다.**
     이음표를 손보는 대신 여기서 막는다. 표는 저자가 짠 것이고, 「병이 노는 턴을
     만들지 않는다」는 표 하나가 아니라 판 전체에 걸리는 규약이기 때문이다.
     새 보스가 새 이음표를 들고 와도 같은 함정에 다시 안 빠진다.

   ★ 깨우기가 왜 필요한가. 자리를 **재우기만 하는** 플레이는 정원을 한 칸도 안 닫으면서
     (휴면은 자리를 안 닫는다) 병이 세울 자리는 다 막는다 — 활성이 0이라 성장도 못 하고,
     빈 자리가 없어 분화도 못 한다. 실측에서 어부 연명이 그 꼴로 열한 턴을 굴렀다.
     재워 둔 자리를 깨우면 병은 할 일이 생기고, 플레이어는 「재우기로 시간을 벌 수
     없다」를 배운다. 휴면은 2턴이면 어차피 스스로 일어난다(R.DORMANT) — 앞당길 뿐이다. */
function growFallback(S, dis){
  if(!K.active(S).some(n=>n.role!=='disease')){
    const nd = spawnSpot(S, dis);                    // ① 세울 자리가 있으면 세운다
    if(nd){ dis.lastAct = '분화'; dis.growRun = 0; return `분화 — ${nd.sym}` }
    /* ② 세울 데가 없다 — 재워 둔 자리를 깨운다 */
    const d = S.nodes.find(n=>n.role!=='disease' && !n.dead && n.val<=0);
    if(d){
      d.val=d.init; d.dormT=0; d.shielded=true; d.shReduc=R.SHIELD_CUT; d.stabAcc=0;
      dis.growRun = 0;
      return `재워 둔 자리가 일어난다 — ${d.sym}`;
    }
  }
  return growBeat(S);                                // ③ 그래도 없으면 성장
}

/* ── 병 노드 공격 ── 판 반비례 ─────────────────────────────
   피해 = max(0, 기본값 − 활성 부수 자리 수 × 자리당 감소).
   **세는 것은 자리 수이지 증상 종류가 아니다** — 통증처럼 매 턴 피해가 없는 증상도
   자리로 센다. 부수를 다 뽑아 놓을수록 병이 직접 때린다: 「자리를 비우면 편해진다」를
   뒤집는 것이 이 규칙의 값이다.

   화면의 예고 숫자와 실제 피해가 이 함수 하나를 본다 — 갈리면 의도 아이콘이
   거짓말을 한다 (커널.억제의 supAmt 와 같은 잣대다).
   방침 배수는 여기서 곱한다. 진화 즉발 피해와 같은 자리다 — 「편하게」의 완화는
   턴 끝 정산의 몫이라 병 박자에는 안 붙는다. */
//@ 스토리.병공격 — 판 반비례 타격. 예고와 실제가 같은 함수를 본다
function disAtkAmt(S, dis){
  const a = (BOSS[S.board.boss]||{}).atk;
  if(!a) return 0;
  const base = (a.base||{})[dis.stage] || 0;
  const spots = K.active(S).filter(n=>n.role!=='disease').length;
  return Math.ceil(Math.max(0, base - spots*(a.per||0)) * policyDmg(S));
}

/* diseaseAct 가 모르는 이름을 받았을 때 돌려주는 줄의 머리.
   검사기가 이 말로 찾으므로 두 곳에 따로 적지 않는다 */
const BEAT_UNKNOWN = '모르는 박자';

/* 쉬는 비트(「같은 박자」)를 걷었다. 되살리지 않는다 —
   악보에 아무 일도 안 하는 칸을 두면 병기 지속을 악보 길이와 그 칸 수 두 곳에서
   정하게 된다. 지속은 악보 길이 하나가 정한다. 「진행」(병기 시계를 당기는 칸)과
   그 별명 「병기 가속」·「가속」, 그리고 「굳는다」도 같은 자리에서 걷었다:
   진행은 지속을 두 곳에서 정했고, 굳는다는 병 노드 피해 절반(R.DIS_SHIELD)이
   폐기되면서 설 자리가 없어졌다.
   검사기의 '쉬는 비트는 봐 준다' 예외도 함께 걷혔다 — 이제 모든 박자가 판을 움직여야 한다. */

/* 병이 쓸 수 있는 박자 한 벌 — diseaseAct 가 '이름으로' 다루는 것이 여기 전부다.
   「만들기 · 악보」가 고를 수 있는 것도 이 목록이고, 불변 조건이 이 목록을 훑는다.
   설명문은 화면 것이라 여기 없다 — BEATDOC(60-text)에 있다.
   이 층은 자름 커널 구간 안이고, 그 구간의 계약은 화면을 쓰지 않는 것이다. */
//@ 스토리.박자표 — 병이 쓸 수 있는 박자 한 벌
const BEAT_LIST = ['분화','성장','공격','몰린다','엮는다','번진다','치민다','가라앉는다',
                   ...Object.keys(UNIQ)];   // 고유 한 수도 제 이름으로 고른다

/* ── 이음표의 조건 ────────────────────────────────────────────
   최종 병기에서 후보를 고를 때만 본다. **고정 악보에 박힌 칸에는 조건이 없다** —
   거기 적힌 것은 조건 없이 발동하고 헛돌면 폴백으로 받는다 (문서 §5.1 · §5.3).
   여기 없는 박자는 늘 통과다.

   확률이 없다. 판 상태와 직전 행동만 본다 — 같은 판에서 두 번 물으면 같은 답이다.
   「공격」의 문턱만 보스마다 다르므로 보스 정의(BOSS[].atk.when)에서 받는다:
   'half' 는 정원 절반 이하, 숫자면 그 수 이하. */
//@ 스토리.이음조건 — 후보를 고를 때 보는 것
const BEAT_COND = {
  '공격': (S, dis) => {
    const w = ((BOSS[S.board.boss]||{}).atk||{}).when;
    const n = K.active(S).filter(x=>x.role!=='disease').length;
    return w==='half' ? n <= spotCap(S, dis)/2 : n <= (w ?? 99);
  },
  '분화':   (S, dis) => freeSpot(S, dis),
  '몰린다': S => K.active(S).some(n=>n.role!=='disease'),
  '엮는다': S => {
    const syms=[...new Set(K.active(S).filter(x=>x.role!=='disease').map(x=>x.sym))];
    if(syms.length<2) return false;
    return syms.some(p=>syms.some(q=>p!==q && !(S.enh||[]).some(e=>e.a===p&&e.b===q)));
  },
  '가슴을 쥡니다': S => K.active(S).some(n=>n.role!=='disease' && n.sym==='호흡곤란'),
  '긁는다': (S, dis) => K.active(S).filter(n=>n.role!=='disease'&&n.sym==='통증').length>=SR.BEAT_SCRATCH_N
                        && !K.active(S).some(n=>n.sym==='감염') && freeSpot(S, dis),
  '번진다': S => K.active(S).some(n=>n.role!=='disease' && n.sym==='통증'),
  '치민다':     S => K.active(S).some(n=>n.role!=='disease'),
  '가라앉는다': S => K.active(S).some(n=>n.role!=='disease'),
  '지금이면 괜찮아진다': S => S.nodes.some(n=>n.role!=='disease' && !n.dead && n.val<=0),
};

/* 이 병기가 따르는 악보. 판에 손으로 짠 악보가 실려 있으면 그것이 먼저다 —
   「만들기 · 악보」가 board.score 에 넣는다. 없으면 고른 병 노드의 악보를 본다.
   ★ 예전에는 뒤쪽 폴백이 b[dis.stage0] 이었는데, stage0 은 보스 정의에만 있고
     병 노드에는 없는 열쇠라 늘 undefined 였다 — 즉 한 번도 돈 적 없는 갈래다.
     보스의 첫 병기를 보라는 뜻이 분명하므로 BOSS[].stage0 으로 바로잡았다.
     이 갈래는 악보에 없는 병기로 커스텀 판을 세울 때만 닿는다. */
//@ 스토리.보스악보 — 고른 병 노드가 그 병기에 쓰는 악보
function bossScore(bossKey, stage){
  const b = BOSS[bossKey];
  return b.beats[stage] || b.beats[b.stage0] || ['분화','성장'];   // 「고유」는 이제 없는 이름이다
}

//@ 스토리.악보 — 이 병기가 따르는 악보
function scoreOf(S, stage){
  const own = S.board && S.board.score;
  if(own && own[stage] && own[stage].length) return own[stage];
  return bossScore(S.board.boss, stage);
}

/* 이 병기가 앵커 + 이음표로 도는가. 차례가 규칙이다 —
     ① 판에 손으로 짠 악보가 실려 있으면 그것이 먼저다 (「만들기 · 악보」)
     ② 최종 병기이고 이음표가 있으면 이음표
     ③ 아니면 고정 악보
   ②를 ①보다 앞에 두면 악보 탭에서 짠 최종 병기 악보가 판에서 안 돈다 */
//@ 스토리.이음판 — 이 병기가 이음표로 도는가
function linkStage(S, dis){
  const own = S.board && S.board.score;
  if(own && own[dis.stage] && own[dis.stage].length) return null;
  const b = BOSS[S.board.boss];
  return (b && b.link && dis.stage >= dis.stageMax) ? b : null;
}

/* ── 최종 병기 — 앵커와 이음표 ─────────────────────────────
   앵커  = 보스 고유 기믹. 병기 진입 후 ANCHOR_EVERY 턴마다 첫 칸에 온다.
           ANCHOR_LOOPS 바퀴까지만 발동하고 그 뒤로는 성장으로 대체된다.
   이음표 = 나머지 칸. 직전 행동을 키로 후보를 얻어 **위에서부터** 조건을 보고
           처음 통과하는 것을 쓴다. 전부 실패하면 성장이다.

   같은 행동은 두 번 연속 오지 않는다 — 후보에서 직전 행동을 뺀다.
   확률이 없다: S.rng 를 한 번도 안 쓴다. 그래서 같은 판에서 몇 번을 물어도 같은 답이고,
   예고(화면.예고)가 복제본에서 미리 돌려 봐도 실제와 갈리지 않는다. */
function pickLink(S, dis, b){
  const i = dis.beat|0;
  const every = Math.max(1, SR.ANCHOR_EVERY);
  if(i % every === 0)
    return (Math.floor(i/every) < SR.ANCHOR_LOOPS) ? b.anchor : '성장';
  const cands = (b.link||{})[dis.lastAct] || [];
  for(const c of cands){
    if(c === dis.lastAct) continue;                 // 같은 행동을 두 번 잇지 않는다
    const cond = BEAT_COND[c];
    if(!cond || cond(S, dis)) return c;
  }
  return '성장';
}

/* 이번 턴에 병이 무엇을 하는가.
   ★ **같은 턴 안에서는 한 번만 정하고 기억한다.** 고정 악보 구간은 순수 조회라
     몇 번을 불러도 같았지만, 이음표는 판 상태를 보므로 그 성질이 저절로 서지 않는다 —
     화면은 그리기마다 이것을 부르고(무대.병노드 · 화면.자리표딱지), 예고는 복제본에서
     한 번 더 부른다. 기억해 두지 않으면 「예고에 뜬 것과 실제로 나온 것이 다르다」가
     난다. 턴이 바뀌면 저절로 다시 정해진다. */
//@ 스토리.박자 — 병이 이번 턴에 무엇을 하는가
function nextBeat(S,dis){
  if(dis.beatTurn === S.turn && dis.beatPick) return dis.beatPick;
  const b = linkStage(S, dis);
  const pick = b ? pickLink(S, dis, b)
                 : (sc => sc[dis.beat % sc.length])(scoreOf(S, dis.stage));
  dis.beatTurn = S.turn; dis.beatPick = pick;
  return pick;
}

/* 이 턴의 문안 — 진단하면 열리는 텍스트 층이 읽는다 (화면.박자텍스트).
   고정 악보는 칸마다, 이음표는 박자 이름마다 적어 둔다. 없으면 박자 이름 그대로다 */
//@ 스토리.박자문안 — 그 칸의 환자 쪽 말
function beatSay(S, dis){
  const b = BOSS[S.board.boss] || {};
  const beat = nextBeat(S, dis);
  if(!linkStage(S, dis)){
    const line = (b.say||{})[dis.stage];
    if(line && line[dis.beat % line.length]) return line[dis.beat % line.length];
  }
  return (b.sayBeat||{})[beat] || beat;
}

/* 손으로 짠 악보를 판에 싣기 전에 훑는다 — 모르는 이름과 빈 병기를 떨군다.
   화면이 무엇을 넣든 커널에 들어오는 것은 BEAT_LIST 안의 이름뿐이다. */
//@ 스토리.악보검사 — 손으로 짠 악보를 훑는다
function scoreClean(sc){
  if(!sc) return null;
  const out = {}; let any = false;
  for(const st in sc){
    const line = (sc[st]||[]).filter(b=>BEAT_LIST.includes(b));
    if(line.length){ out[st] = line; any = true }
  }
  return any ? out : null;
}

/* ── 병이 한 수를 둔다 ──────────────────────────────────────
   돌려주는 값이 그 턴의 줄이다. 헛돌면 폴백으로 받는다 — 보통 성장이고,
   BEAT_FALLBACK 에 적힌 박자만 다른 것으로 받는다 (송이의 「지금이면 괜찮아진다」).

   ★ 성장이 SR.GROW_RUN_MAX 번 연달아 나오면 다음 한 칸은 앵커로 넘긴다.
     판이 좁아지면(자리가 다 죽어 대상 없는 박자가 줄줄이 폴백으로 새는 구간) 병이
     성장만 반복하며 헛돈다 — 악보를 아무리 잘 짜도 그 구간은 배열이 만드는 것이라
     비트 하나하나의 규약으로는 못 막는다 (story_probe sweep ②가 세던 것이 이것이다).
     ★ 폴백으로 나간 성장은 dis.lastAct 를 **덮지 않는다.** 덮으면 이음표에 「성장」이라는
       없는 키가 서서 표가 거기서 끊긴다. 직전 행동은 마지막으로 실제로 나간 한 수다. */
function diseaseAct(S, dis, act){
  const beat = nextBeat(S, dis);
  dis.beat++;
  dis.beatTurn = null; dis.beatPick = null;        // 이 턴 몫은 썼다 — 다음 턴에 다시 정한다

  /* 성장으로 받되, 연달아 물리면 앵커로 갈아탄다 */
  const fall = (why) => {
    const b = BOSS[S.board.boss] || {};
    const alt = BEAT_FALLBACK[why];
    if(alt) return run(alt, true);
    dis.growRun = (dis.growRun||0) + 1;
    if(dis.growRun > SR.GROW_RUN_MAX && b.anchor && b.anchor!==why){
      dis.growRun = 0;
      return run(b.anchor, true);
    }
    return growFallback(S, dis);
  };

  /* 박자 하나를 실제로 낸다. deep 이면 폴백에서 들어온 것이라 다시 폴백하지 않는다 */
  function run(beat, deep){
    if(beat==='분화'){
      const nd = spawnSpot(S, dis);
      if(!nd) return deep ? growFallback(S, dis) : fall(beat);
      dis.lastAct = '분화'; dis.growRun = 0;
      return `분화 — ${nd.sym}`;
    }
    if(beat==='성장'){ dis.growRun = (dis.growRun||0)+1; return growFallback(S, dis) }
    /* 공격 — **고르는 조건이 없다.** 이음표가 후보를 추릴 때만 조건을 보고(스토리.이음조건),
       악보에 박힌 칸은 조건 없이 발동한다.
       ★ 다만 판이 꽉 차서 피해가 0 으로 막히면 대상 없는 박자와 같다 — §4.3 의 폴백
         규약을 그대로 탄다. 안 그러면 그 턴이 통째로 빈다: 아이 병기3(기본 10 · 자리당 −5)에
         자리가 셋이면 정확히 0 이라, 악보에 박힌 공격 칸이 늘 노는 턴이 됐다.
         불변 조건 ③ㄷ 가 세 보스에서 여섯 자리를 그렇게 잡았다. */
    if(beat==='공격'){
      const amt = disAtkAmt(S, dis);
      if(amt<=0) return deep ? growFallback(S, dis) : fall(beat);
      hurtPatient(S, amt, 'atk', dis);
      dis.lastAct = beat; dis.growRun = 0;
      return `병이 때린다 — 체력 ${amt}`;
    }
    if(beat==='몰린다'){
      const ns = active(S).filter(x=>x.role!=='disease');
      if(!ns.length) return deep ? growFallback(S, dis) : fall(beat);
      const x = ns.slice().sort((p,q)=>p.val-q.val)[0];
      /* 병 노드 **기준값**의 몫이다 — 자리의 초기값도 현재값도 아니고, 완치가 병 노드를
         깎아도 안 바뀐다 (stageDisVal 은 레벨표의 값을 낸다) */
      const add = Math.ceil(stageDisVal(S.board.boss, dis.stage) * SR.BEAT_CROWD);
      x.val = Math.min(Math.floor(x.init*R.VAL_CAP), x.val + add);
      dis.lastAct = beat; dis.growRun = 0;
      return `몰린다 — ${x.sym} +${add}`;
    }
    if(beat==='엮는다'){
      const syms = [...new Set(active(S).filter(x=>x.role!=='disease').map(x=>x.sym))];
      if(syms.length<2) return deep ? growFallback(S, dis) : fall(beat);
      S.enh = S.enh || [];
      for(let g=0; g<30; g++){
        const p = syms[Math.floor(S.rng()*syms.length)], q = syms[Math.floor(S.rng()*syms.length)];
        if(p===q) continue;
        if(S.enh.some(e=>e.a===p && e.b===q)) continue;
        S.enh.push({a:p, b:q, k:['가속','경화','점화'][Math.floor(S.rng()*3)], kind:'trig', hidden:false});
        dis.lastAct = beat; dis.growRun = 0;
        return '엮는다 — '+p+' → '+q;
      }
      return deep ? growFallback(S, dis) : fall(beat);      // 더 엮을 쌍이 없다 — 헛돈 것이다
    }
    if(beat==='번진다'){                            // 어부 — 통증만 골라 현재값 비율로 오른다
      const ps = active(S).filter(x=>x.role!=='disease' && x.sym==='통증');
      if(!ps.length) return deep ? growFallback(S, dis) : fall(beat);
      for(const x of ps) x.val = Math.min(Math.floor(x.init*R.VAL_CAP), x.val + Math.ceil(x.val*SR.BEAT.번진다));
      dis.lastAct = beat; dis.growRun = 0;
      return '번진다';
    }
    if(beat==='치민다'){                            // 송이 — 금단의 정점
      const ns = active(S).filter(x=>x.role!=='disease');
      const mind0 = S.mind;
      for(const x of ns) x.val = Math.min(Math.floor(x.init*R.VAL_CAP), x.val + Math.ceil(x.val*SR.BEAT.치민다));
      mind(S,+1);
      if(!ns.length && S.mind===mind0) return deep ? growFallback(S, dis) : fall(beat);
      dis.lastAct = beat; dis.growRun = 0;
      return '치민다';
    }
    if(beat==='가라앉는다'){                         // 송이 — 정점을 지나면 저절로 내려간다. 0 까지는 안 간다
      const ns = active(S).filter(x=>x.role!=='disease');
      if(!ns.length) return deep ? growFallback(S, dis) : fall(beat);
      for(const x of ns) x.val = Math.max(1, x.val - Math.ceil(x.val*SR.BEAT.가라앉는다));
      dis.lastAct = beat; dis.growRun = 0;
      return '가라앉는다';
    }
    /* 고유 한 수 — 악보에 제 이름으로 적힌다. 헛돌면 폴백으로 대신한다 */
    if(UNIQ[beat]){
      const line = UNIQ[beat](S, dis);
      if(!line) return deep ? growFallback(S, dis) : fall(beat);
      dis.lastAct = beat; dis.growRun = 0;
      return line;
    }
    /* 여기까지 왔다면 이 자가 모르는 이름이다. 악보를 손으로 짤 수 있게 된 뒤로는
       오타나 옛 이름이 여기 닿을 수 있다 — 전에는 그대로 「고유」로 새서, 병이 엉뚱한
       한 수를 두고도 아무도 몰랐다. 성장으로 받되 이름을 적어 돌려준다.
       불변 조건이 이 줄을 찾아 BEAT_LIST 와 diseaseAct 가 갈라졌는지 본다. */
    growBeat(S);
    return `${BEAT_UNKNOWN} 「${beat}」 — 성장으로 대신한다`;
  }

  return run(beat, false);
}

function stageUp(S, dis){
  const b = BOSS[S.board.boss];
  if(dis.stage >= dis.stageMax){
    dis.finished = true;                                   // 「편하게」 승리 신호는 여기서 한 번 뜬다
    /* 최종 병기가 이음표로 돌면 악보를 되감지 않는다. dis.beat 이 곧 앵커의 바퀴 수라
       0 으로 되돌리면 앵커 상한(ANCHOR_LOOPS)이 영영 안 걸리고, 고유 기믹만 네 턴마다
       끝없이 나오는 판이 된다. 시계는 계속 돌지만 병기가 더 오를 데가 없다. */
    if(linkStage(S, dis)){ dis.stageClock = stageTurns(S.board.boss, dis.stage); return false }
    if(!(SR.GIMMICK.LOOP && b.roster)) return false;
    dis.beat = 0; dis.stageClock = stageTurns(S.board.boss, dis.stage);   // 악보를 처음으로 되돌린다
    layStage(S, dis);
    return false;                                          // 병기는 안 오른다
  }
  const was = dis.stage;
  dis.stage++;
  if(dis.stage >= dis.stageMax) dis.finished = true;      // 최종 병기에 「닿는」 순간이 편하게의 승리다
  const carry = stageCarry(S.board.boss, dis.stage);
  const next = stageDisVal(S.board.boss, dis.stage);
  const ratio = dis.val / dis.init;
  if(carry !== null){
    /* 적어 둔 이월 비율 — 깎아 둔 몫(1−ratio)을 그만큼만 들고 간다.
       1 이면 비례 이월과 같고, 0 이면 새 수치 그대로다 */
    dis.init = next;
    dis.val = Math.ceil(next * (1 - carry*(1 - ratio)));
  }else if(SR.GIMMICK.PRORATE){                            // 비례 이월 — 깎아 둔 비율이 그대로 유지된다
    dis.init = next;
    dis.val = Math.ceil(next * ratio);
  }else{                                                   // 절대 이월 — 늘어난 몫만 얹는다
    dis.val += next - stageDisVal(S.board.boss, was);
    dis.init = next;
  }
  dis.beat = 0;
  dis.beatTurn = null; dis.beatPick = null;                // 병기가 바뀌었다 — 정해 둔 다음 박자를 버린다
  dis.stageClock = stageTurns(S.board.boss, dis.stage);
  /* 연명 전용 — 병기가 오를 때 정원이 하나 는다. 자리 닫기와 반대 방향으로 미는 손이다.
     정원이 늘지 않으면 닫기만 쌓여 연명이 거저 성립하고, 늘기만 하면 영영 안 성립한다 */
  if(S.policy==='연명') S.spawnBonus = (S.spawnBonus||0) + SR.LINGER_SPAWN;
  layStage(S, dis);
  return true;
}

/* ── 자리 닫기 (연명 전용) ──────────────────────────────────
   **처치한 자리만 닫힌다.** 분화가 거기 다시 못 서므로 정원이 그만큼 줄고,
   연명(활성 부수 0)이 비로소 손에 닿는다.
     · 휴면(val<=0 · dead 아님)은 안 닫는다 — 눌러 둔 것이지 없앤 것이 아니다
     · 소멸(vanished)도 안 닫는다 — 창과 옮아 앉는다가 그것이다
   ★ 이 경계가 어긋나면 아이와 어부의 연명이 무너진다. 소멸까지 닫으면 병이 스스로
     판을 비워 주는 셈이 되어, 진척을 0으로 되돌리려던 장치가 승리 버튼이 된다.

   자리마다 한 번만 센다(n.closed). 처치는 플레이어 턴에도(storyTurn) 턴 시작에도
   (공황이 미뤄 둔 처치 · turnResolve 9) 나므로, 병이 움직이기 직전과 턴이 끝난 뒤
   두 곳에서 훑는다 — 둘 다 이 표시 덕분에 몇 번을 불러도 같다. */
//@ 스토리.자리닫기 — 처치만 닫는다. 휴면도 소멸도 안 닫는다
function closeKilled(S){
  if(S.policy!=='연명') return;
  for(const n of S.nodes){
    if(n.role==='disease' || !n.dead || n.vanished || n.closed) continue;
    n.closed = true;
    S.closedN = (S.closedN||0) + 1;
  }
}

/* ═══ 규칙 한 벌 ══════════════════════════════════════
   v19 는 스토리를 수동 UI 와 배치 엔진에 각각 따로 구현했고 둘이 어긋나 있었다.
   ① 1막 병 행동 주기 (배치=2턴마다 / 수동=매턴 / 자동진행=없음)
   ② 방침별 승리조건 (배치에만 있었다 — 손으로는 연명·편하게로 이길 수 없었다)
   ③ 방침 painCut (배치에만 적용됐다)
   아래 넷이 유일한 구현이고, 수동·자동·배치가 전부 이것을 부른다.
   ═══════════════════════════════════════════════════════════ */

/* 방침을 판에 새긴다 */
//@ 스토리.방침 — 완치 · 연명 · 편하게
function applyPolicy(S, dis, policy, correct){
  const P = SR.POLICY[policy];
  S.policy = policy; S.act = 3; S.comfort = 0;
  /* 연명의 두 계수기. 방침을 고르는 이 자리에서만 선다 — 다른 방침에서는 0 으로 남고
     spotCap 이 그것을 그대로 더하고 빼므로 갈래를 따로 두지 않는다.
     ★ 여기 들어서기 전에 이미 죽어 있던 자리는 **닫힌 것으로 세지 않는다.** 1막에서
       뽑은 자리까지 세면 방침을 고르는 순간 정원이 통째로 깎여, 병기 3 의 분화가
       첫 턴부터 성장으로 새고 연명이 거저 성립한다 (실제로 그랬다).
       자리 닫기는 3막에서 병과 겨루며 뽑은 것만 센다 — 표시만 찍고 수는 안 올린다. */
  S.closedN = 0; S.spawnBonus = 0;
  for(const n of S.nodes) if(n.role!=='disease' && n.dead) n.closed = true;
  /* v25 — 병기에 들어서면 명부를 세운다. 3막 진입만 이 규칙이 빠져 있어서
     1막에서 자리를 다 지우고 들어오면 판이 빈 채로 시작했다. */
  layAct3(S, dis);
  S.rush = 0;
  dis.stageClock = SR.STAGE_TURNS; dis.beat = 0;   // 1막 길이가 첫 창의 자리를 정하지 않게 한다                                    // 기세는 막 단위다 — 1막에서 쌓은 것은 3막으로 넘어가지 않는다
  if(!P) return null;
  if(correct){                                   // 오진이면 디버프가 안 붙는다
    dis.val = Math.ceil(dis.val*(1-P.disCut));
    dis.stageClock += P.stageBonus;
  }
  if(P.painCut) for(const n of K.active(S))
    if(n.role!=='disease' && (n.sym==='통증'||n.sym==='호흡곤란'))
      n.val = Math.ceil(n.val*(1-P.painCut));
  return correct ? `디버프가 붙는다. 병 노드 ${dis.val}` : '오진이라 디버프가 붙지 않는다';
}

/* 턴 끝 — 병이 움직인다. 1막은 주기적으로, 3막은 매 턴 + 병기 시계 */
function storyPhase(S, dis){
  if(S.act===1){
    S.act1Beat = (S.act1Beat||0)+1;
    if(S.act1Beat % SR.ACT1_SPAWN_EVERY !== 0) return null;
    return {line: diseaseAct(S, dis, null), up:null};
  }
  if(S.act!==3) return null;
  closeKilled(S);                                    // 이번 턴에 뽑은 자리를 먼저 닫는다 — 분화가 그 정원을 본다
  /* 갈망(송이) — 안정화로 깎은 보호막 값의 절반(올림)만큼 병 노드가 회복한다.
     커널이 쌓아 둔 계수기 하나를 읽는다 (커널.억제의 S.stabThisTurn) — 사건으로 읽으면
     무대를 안 켠 판에서는 아무것도 안 쌓여 규칙이 화면 유무로 갈린다. */
  if(S.crave && S.stabThisTurn>0){
    const heal = Math.ceil(S.stabThisTurn * SR.CRAVE_HEAL);
    dis.val = Math.min(Math.floor(dis.init*R.VAL_CAP), dis.val + heal);
    S.craveLast = heal;
  } else S.craveLast = 0;
  const line = diseaseAct(S, dis, null);
  dis.stageClock--;
  let up=null;
  if(dis.stageClock<=0){
    if(stageUp(S,dis)) up = dis.stage;
    else dis.stageClock = SR.STAGE_TURNS;
  }
  return {line, up};
}

/* 「편하게」 — 완화가 몇 겹으로 걸렸는지만 기록해 둔다 (승리 조건은 병기 소진) */
function storyTick(S){
  closeKilled(S);                       // 턴 시작에 터진 처치(공황이 미뤄 둔 것)도 여기서 닫힌다
  if(S.policy!=='편하게') return;
  S.comfort = K.comfortCuts(S).length;
}

/* 판정 — 읽기만 한다. 방침마다 이기는 조건이 다르다 */
function storyVerdict(S, dis, policy){
  if(S.hp<=0 && !S.board.noDeath) return '사망';
  if(dis.dead) return '완치';   // 어떤 방침으로 들어갔든 병을 끊었으면 완치다.
                                //  v19 는 완치 방침에서만 봐서, 연명 중 병을 끊으면
                                //  판정이 영영 나지 않고 턴만 흘렀다.
  if(!policy) return null;
  /* 연명 — **자리를 다 닫으면 이긴다.** 정원이 0 이면 병이 더 세울 데가 없다.
     병 노드는 보지 않는다: 병은 그대로 두고 판만 닫는 것이 연명이다.

     자리를 닫는 것은 **처치뿐이다** (스토리.자리닫기).
       · 휴면은 안 닫는다 — 눌러 둔 것이지 없앤 것이 아니다. 재우기만 해서는 못 이긴다
       · 소멸도 안 닫는다 — 창과 옮아 앉는다가 아무리 판을 쓸어도 정원이 한 칸도 안 준다

     ★ 전에는 「턴 시작에 활성 부수 0」이었다. 그러면 병이 스스로 쓸어 버린 빈 판이
       곧 승리가 되어(아이 연명 40판 중 40판이 창이 떨어지는 그 턴에 끝났다), 그것을
       막으려고 유예 플래그를 따로 세워야 했다. 조건을 정원으로 옮기면 그 구멍이
       저절로 막힌다 — 소멸이 자리를 안 닫는다는 규칙 하나가 그대로 답이 된다.

     ★ 정원 0 이면 살아 있는 자리도 0 이다. 분화는 liveSpots < cap 일 때만 서므로
       판 내내 liveSpots ≤ cap 이 유지되고, 처치는 둘을 함께 1씩 내린다.
       그래서 이 한 줄이 「자리를 다 닫았다」와 「판이 비었다」를 같이 말한다. */
  if(policy==='연명' && !dis.dead && spotCap(S, dis) <= 0) return '연명';
  /* 편하게 — 병이 최종 병기까지 다 간 시점에 환자가 살아 있으면 이긴다.
     스토리 보스 판은 noDeath 라 체력이 0 아래로 내려가도 죽은 것이 아니다.
     생존 판정은 판의 사망 규칙과 같은 잣대를 쓴다. */
  if(policy==='편하게' && dis.finished && (S.hp>0 || S.board.noDeath)) return '호전';
  return null;
}

/* 1막 플레이어 턴 — 진단 카드를 검사 파라미터로 돌린다.
   v19 는 이 분기가 수동 playCard 에만 있어서 자동 진행이 증거를 못 쌓았다 */
//@ 스토리.1막 — 검사 파라미터로 증거를 쌓는다
function act1PlayerTurn(S, aimEvid, ai){
  S.played=0;
  let guard=0;
  while(S.played<R.PLAY_CAP && guard++<40){
    if(S.hand.includes('소매를 걷습니다') && C.canPlay(S,'소매를 걷습니다')){ C.play(S,'소매를 걷습니다'); continue }
    if(S.energy<=0) break;
    const dg = S.hand.filter(id=>C.CARDS[id].verb==='진단' && C.canPlay(S,id))
                     .sort((a,b)=>C.CARDS[a].cost-C.CARDS[b].cost)[0];
    if(dg && S.evid < aimEvid){ spendParam(S, dg); continue }
    const before=S.played;
    (ai||D.aiTurn)(S,{});
    if(S.played===before) break;
    break;
  }
}

/* 진단 카드 한 장을 검사 파라미터로 쓴다 */
function spendParam(S, id){
  const cost = C.cardCost(S, id);
  if(cost > S.energy) return false;
  S.energy -= cost;
  /* 카드마다 파라미터 몫이 다르다 — 안 적은 카드는 1 */
  S.paramAcc += (C.cardNums(S,id).param ?? 1) + ((S.diagPlus||{})[id] || 0);
  const i=S.hand.indexOf(id); if(i>=0) S.hand.splice(i,1);
  S.discard.push(id); S.played++;
  if(S.rec) S.rec.push(`${id} → 검사`);
  let gained=0;
  while(S.paramAcc>=SR.PARAM_NEED && S.evid<SR.EVID_TOTAL){ S.paramAcc-=SR.PARAM_NEED; S.evid++; gained++ }
  return gained;
}

/* 남은 후보 수 — 증거가 후보를 지운다 */
const candLeft = S => Math.max(1, SR.CAND_BASE - (S.evid-1)*2);

/* ── 1막 — 병명을 밝힌다 ─────────────────────────────────── */
function act1(S, deck, opt={}){
  const dis = S.nodes[0];
  S.param = 0; S.evid = 1;                    // 문진에서 무조건 하나 받는다
  S.paramAcc = 0;
  S.act = 1; S.act1Beat = 0;
  let t=0;
  const cap = opt.act1Cap || SR.ACT1_CAP;
  const ai = opt.ai==='H' ? H.aiTurn : D.aiTurn;
  while(t<cap){
    if(S.hp<=0 && !BOSS[S.board.boss].noDeath) return {out:'사망', turns:t};
    t++;
    act1PlayerTurn(S, opt.aimEvid||SR.EVID_AIM, ai);
    storyPhase(S, dis);                                  // 공용 — 주기는 여기서만 정한다
    C.endTurnHand(S); K.turnResolve(S);
    if(S.evid >= (opt.aimEvid||SR.EVID_AIM)) break;
  }
  /* 병명 선언 — 남은 후보 수가 곧 확률 */
  const cand = candLeft(S);
  const correct = S.rng() < 1/cand;
  return {out:'진행', turns:t, evid:S.evid, cand, correct};
}

/* ── 3막 ─────────────────────────────────────────────────── */
//@ 스토리.3막 — 방침대로 끝까지
function act3(S, policy, correct, opt={}){
  const dis = S.nodes[0];
  applyPolicy(S, dis, policy, correct);            // 공용 — painCut 포함
  let t = 0;
  const cap = opt.act3Cap || SR.ACT3_CAP;
  while(t<cap){
    const v = storyVerdict(S, dis, policy);        // 공용 — 수동 화면도 같은 판정을 쓴다
    if(v) return {out:v, turns:t, stage:dis.stage};
    t++;
    S.played=0;
    storyTurn(S, dis, policy);
    storyPhase(S, dis);
    C.endTurnHand(S); K.turnResolve(S);
    storyTick(S);
  }
  return {out:'악화', turns:t, stage:dis.stage};
}

//@ 스토리.턴 — 스토리 한 턴
function storyTurn(S, dis, policy){
  let guard=0;
  while(S.played<R.PLAY_CAP && guard++<40){
    if(S.hand.includes('소매를 걷습니다') && C.canPlay(S,'소매를 걷습니다')){ C.play(S,'소매를 걷습니다'); continue }
    if(S.energy<=0) break;
    /* 병 노드를 0까지 내렸으면 끊는다. 표적 판단보다 앞에 둔다 —
       wantDis 에 묶여 있으면 수치가 0이 되는 순간 표적에서 빠져 영영 못 끊는다. */
    if(policy==='완치' && !dis.dead && dis.val<=0 && S.energy>=R.KILL_COST){
      S.energy-=R.KILL_COST; dis.dead=true; S.played++;
      if(S.rec) S.rec.push('처치 병 노드'); return;
    }
    const others = K.active(S).filter(n=>n.role!=='disease');
    let killable = others.filter(n=>K.reaction(S,n)!==null);
    /* 「편하게」는 병 노드를 표적에서 뺀다.
       그 밖에는 부수 증상이 다 사라졌을 때뿐 아니라,
       이번 턴에 뽑을 수 있는 부수 증상이 하나도 없고 이미 한 수를 둔 뒤라면 병 노드를 친다.
       분화가 부수 증상을 계속 뿜기 때문에 '부수가 다 없어지면'만 보면 그 순간이 오지 않는다. */
    /* 연명은 승리선까지만 내리면 된다. 그 아래로 더 때리는 대신 부수 증상을 재우러 간다. */
    /* v25 — 연명은 병 노드에 손대지 않는다. 이길 조건이 부수 자리에만 걸려 있다 */
    const wantDis = policy==='완치' && dis.val > 0
                    && (!others.length || (S.played>0 && !killable.length));

    const sup = S.hand.filter(id=>C.CARDS[id].verb==='억제' && C.CARDS[id].sub!=='안정화' && C.canPlay(S,id));
    if(!sup.length) break;
    const card = sup.sort((a,b)=>(C.CARDS[b].v.sup||6)/Math.max(1,C.CARDS[b].cost)-(C.CARDS[a].v.sup||6)/Math.max(1,C.CARDS[a].cost))[0];
    const cd = C.CARDS[card];
    if(wantDis){
      S.energy-=C.cardCost(S,card); hitDisease(S,dis,cd.v.sup||6); S.played++;
      if(S.rec) S.rec.push(`${card} → 병 노드`);
      const i=S.hand.indexOf(card); S.hand.splice(i,1); S.discard.push(card);
      continue;
    }
    /* 부수 증상 — 뽑을 수 있으면 뽑는다 */
    const kn = killable.slice().sort((a,b)=>K.sweepAmt(b)-K.sweepAmt(a))[0];
    /* v25 버그 — doKill 은 이미 예약된 자리에 false 를 돌려준다. 그 반환을 안 봐서
       공황 판에서 같은 자리를 열 번 다시 예약하며 턴을 통째로 태웠다. */
    if(kn && S.energy>=R.KILL_COST){
      if(K.doKill(S,kn)){ S.played++; continue }
      const j=killable.indexOf(kn); if(j>=0) killable.splice(j,1);
    }
    const tgt = others.sort((a,b)=>b.val-a.val)[0];
    if(!tgt) break;
    if(!C.play(S, card, tgt)) break;
  }
}

/* ── 한 판 ── */
//@ 스토리.러너 — 화면 없이 3막 완주
function runStory(bossKey, deck, seed, policy, opt={}){
  const rng = K.mulberry32(seed);
  const board = makeDisease(bossKey, rng);
  const S = K.newState(board, opt); S.board=board; S.rng=rng;
  C.setupDeck(S, deck, K.mulberry32(seed+1));
  S.rng = rng;
  const a1 = act1(S, deck, opt);
  if(a1.out==='사망') return {out:'사망', act:1, turns:a1.turns, evid:a1.evid};
  const a3 = act3(S, policy, a1.correct, opt);
  return {...a3, act:3, evid:a1.evid, correct:a1.correct, act1Turns:a1.turns};
}
