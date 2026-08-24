/* ══════════════════════════════════════════════════════════════════
   §6 스토리 3막
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
//@ 스토리.병노드 — 병 노드를 세운다
function mkSpot(sym, init, turn){
  return {sym, init, val:init, shielded:true, shReduc:R.SHIELD_CUT, stabAcc:0,
    grow:0, evo:4, evoLeft:4, evolved:false, dead:false, dormT:0,
    rig:0, rigUp:0, rigCap:0, rigLent:0, delayed:0, weak:0, diagRound:0, diagAcc:0, diagNeed:R.DIAG_NEED,
    demoted:false, revealed:false, spawned:true, born:turn, role:'sym'};
}

/* ── 판 짓기 ── */
function makeDisease(key, rng){
  const b = BOSS[key];
  const stage = b.stage0;
  const dis = {sym:'병', role:'disease', init:SR.DIS_BASE[SLV(key,'dis',stage)], val:SR.DIS_BASE[SLV(key,'dis',stage)],
    shielded:false, shReduc:0, stabAcc:0, grow:0, evo:99, evoLeft:99, evolved:false,
    dead:false, dormT:0, rig:0, rigUp:0, rigCap:0, rigLent:0, delayed:0, weak:0, diagRound:0, diagAcc:0,
    diagNeed:R.DIAG_NEED, demoted:false, revealed:false, spawned:false,
    stage, stageMax:b.stageMax, stageClock:SR.STAGE_TURNS, beat:0};
  const nodes=[dis];
  b.seed.forEach((s,i)=>{
    const band = b.roster ? (b.roster[stage].find(r=>r[0]===s)||[,50])[1] : 40;
    const init = b.roster ? band + Math.floor(rng()*15) : 40 + Math.floor(rng()*20);
    nodes.push({sym:s, init, val:init, shielded:true, shReduc:R.SHIELD_CUT, stabAcc:0,
      grow:0, evo:4, evoLeft:4, evolved:false, dead:false, dormT:0,
      rig:0, rigUp:0, rigCap:0, rigLent:0, delayed:0, weak:0, diagRound:0, diagAcc:0, diagNeed:R.DIAG_NEED,
      demoted:false, revealed:false, spawned:false, role:'sym'});
  });
  let hp=b.hp;
  return {nodes, enh:[], hp, hpMax:hp, noDeath:!!b.noDeath, level:5, core:'병', boss:key, evoBase:3, S:0, tags:b.tags};
}

/* 카드로 병 노드를 치는 것도 정신 판정에 든다 — sweep 를 붙이지 않는다 */
function hitDisease(S, dis, amt){ return K.suppress(S, dis, amt) }

/* ── 병 노드 행동 ── */
/* 자리 하나를 명부대로 세운다 */
function laySpot(S, slot, turn, stage){
  const init = slot[1] + Math.floor(S.rng()*15);
  const nd = mkSpot(slot[0], init, turn);
  /* v25 — 레벨표를 그대로 본다. build() 와 달리 EVO_ADJ 가 빠져 있어서
     같은 턴에 깔린 자리들이 같은 턴에 진화했다. 그게 체력 절벽의 원인이었다. */
  const T = LVTAB[SLV(S.board.boss,'evo',stage)] || LVTAB[3];
  const e = Math.max(1, T.evo + (EVO_ADJ[slot[0]]||0));
  nd.evo = e; nd.evoLeft = e;
  S.wiped = false;                                 // 자리가 다시 섰다 — 연명 판정이 열린다
  S.nodes.push(nd);
  return nd;
}

/* 병기 진입 — 명부 앞 n−1개를 한꺼번에 깐다. 나머지 하나는 첫 분화가 채운다 */
function layStage(S, dis){
  const b = BOSS[S.board.boss];
  if(!b.roster) return;
  const set = b.roster[dis.stage].slice(0, Math.max(1, b.roster[dis.stage].length-1));
  for(const slot of set) laySpot(S, slot, S.turn, dis.stage);
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
  const cap = SR.SPAWN_LV[SLV(S.board.boss,'spots',dis.stage)];
  const seeds = b.seed || [];
  for(let i=0;i<seeds.length && live.size<cap;i++){
    if(live.has(seeds[i])) continue;
    laySpot(S, [seeds[i], stageBand(S.board.boss, dis.stage, i)], S.turn, dis.stage);
    live.add(seeds[i]);
  }
}

/* 창 — 부수가 무너진다. 휴면이 아니라 사망이다 */
function wipeSpots(S){
  let k=0;
  for(const n of S.nodes) if(n.role!=='disease' && !n.dead){ n.dead=true; n.val=0; k++ }
  return k;
}

/* 성장 비트 — 폴백으로도 쓴다 */
function growBeat(S){
  for(const n of K.active(S)) if(n.role!=='disease')
    n.val=Math.min(Math.floor(n.init*R.VAL_CAP), n.val+Math.ceil(n.init*0.15));
  return '증상이 자란다';
}

//@ 스토리.박자 — 병이 이번 턴에 무엇을 하는가
function nextBeat(S,dis){ const b=BOSS[S.board.boss].beats; const sc=b[dis.stage]||b[dis.stage0]||['분화','고유']; return sc[dis.beat % sc.length] }

function diseaseAct(S, dis, act){
  const b = BOSS[S.board.boss];
  const beat = nextBeat(S, dis);
  dis.beat++;
  if(beat==='분화'){
    if(b.roster){                                   // 명부가 있으면 빈 자리를 채운다
      const have = new Set(K.alive(S).filter(n=>n.role!=='disease').map(n=>n.sym));
      const slot = b.roster[dis.stage].find(r=>!have.has(r[0]));
      if(!slot) return growBeat(S);                 // 자리가 다 찼으면 폴백
      laySpot(S, slot, S.turn, dis.stage);
      return `분화 — ${slot[0]}`;
    }
    const cnt = K.active(S).filter(n=>n.role!=='disease').length;
    const capN = SR.SPAWN_LV[SLV(S.board.boss,'spots',dis.stage)];
    if(cnt < capN){
      const bd=BOSS[S.board.boss];
      const pool = bd.dupType ? [bd.dupType] : ['발열','통증','호흡곤란','감염','탈수'];
      const s = pool[Math.floor(S.rng()*pool.length)];
      const init = 35 + Math.floor(S.rng()*25);
      S.nodes.push({sym:s, init, val:init, shielded:true, shReduc:R.SHIELD_CUT, stabAcc:0,
        grow:0, evo:4, evoLeft:4, evolved:false, dead:false, dormT:0, rig:0, rigUp:0, rigCap:0, rigLent:0, delayed:0, weak:0,
        diagRound:0, diagAcc:0, diagNeed:R.DIAG_NEED, demoted:false, revealed:false,
        spawned:true, born:S.turn, role:'sym'});
      return `분화 — ${s}`;
    }
    return '분화 — 자리가 다 찼다';
  }
  if(beat==='병기 가속' || beat==='진행' || beat==='가속'){ dis.stageClock -= 1; return '병기 시계가 당겨진다' }   // 그 턴의 자연 감소 1이 따로 겹친다 — 합쳐 2
  /* ── v25 신설 ── 창은 아이 전용. 나머지 셋은 공용, 아래 넷은 보스 고유 ── */
  if(beat==='창'){                                  // 판이 무너진다 — 다음 비트 턴이 무방비다
    if(S.act!==3 || !SR.GIMMICK.WINDOW) return growBeat(S);
    wipeSpots(S);
    S.wiped = true;                                // 창이 만든 빈 판은 연명으로 안 쳐 준다.
                                                   // 병이 자리를 다시 세울 때까지 판정이 열리지 않는다
    return '판이 무너진다';
  }
  if(beat==='굳는다'){                               // 벗겨진 보호막을 전부 다시 두른다
    const bare = active(S).filter(x=>x.role!=='disease' && !x.shielded);
    if(!bare.length) return growBeat(S);
    for(const x of bare){ x.shielded=true; x.shReduc=R.SHIELD_CUT; x.stabAcc=0 }
    return '굳는다 — 자리 '+bare.length+'곳이 다시 덮인다';
  }
  if(beat==='몰린다'){                               // 가장 옅은 자리 하나만 크게 밀어 올린다
    const ns = active(S).filter(x=>x.role!=='disease');
    if(!ns.length) return growBeat(S);
    const x = ns.slice().sort((p,q)=>p.val-q.val)[0];
    x.val = Math.min(Math.floor(x.init*R.VAL_CAP), x.val + Math.ceil(x.init*0.40));
    return '몰린다 — '+x.sym;
  }
  if(beat==='엮는다'){                               // 살아 있는 증상 둘 사이에 촉발 배선을 놓는다
    const syms = [...new Set(active(S).filter(x=>x.role!=='disease').map(x=>x.sym))];
    if(syms.length<2) return growBeat(S);
    S.enh = S.enh || [];
    for(let g=0; g<30; g++){
      const p = syms[Math.floor(S.rng()*syms.length)], q = syms[Math.floor(S.rng()*syms.length)];
      if(p===q) continue;
      if(S.enh.some(e=>e.a===p && e.b===q)) continue;
      S.enh.push({a:p, b:q, k:['가속','경화','점화'][Math.floor(S.rng()*3)], kind:'trig', hidden:false});
      return '엮는다 — '+p+' → '+q;
    }
    return '엮는다 — 더 엮을 자리가 없다';
  }
  if(beat==='번진다'){                               // 어부 — 통증만 골라 초기값 비율로 오른다
    const ps = active(S).filter(x=>x.role!=='disease' && x.sym==='통증');
    if(!ps.length) return growBeat(S);
    for(const x of ps) x.val = Math.min(Math.floor(x.init*R.VAL_CAP), x.val + Math.ceil(x.init*0.25));
    return '번진다';
  }
  if(beat==='아문다'){                               // 어부 — 가장 옅은 자리 하나가 스스로 가라앉는다
    const ns = active(S).filter(x=>x.role!=='disease');
    if(!ns.length) return growBeat(S);
    const x = ns.slice().sort((p,q)=>p.val-q.val)[0];
    x.val = 0; x.dormT = R.DORMANT;
    return '아문다 — '+x.sym;
  }
  if(beat==='치민다'){                               // 송이 — 금단의 정점
    const ns = active(S).filter(x=>x.role!=='disease');
    for(const x of ns) x.val = Math.min(Math.floor(x.init*R.VAL_CAP), x.val + Math.ceil(x.init*0.30));
    mind(S,+1);
    return '치민다';
  }
  if(beat==='가라앉는다'){                            // 송이 — 정점을 지나면 저절로 내려간다. 0 까지는 안 간다
    const ns = active(S).filter(x=>x.role!=='disease');
    if(!ns.length) return growBeat(S);
    for(const x of ns) x.val = Math.max(1, x.val - Math.ceil(x.init*0.25));
    return '가라앉는다';
  }
  if(beat==='성장') return growBeat(S);
  if(beat==='같은 박자') return '같은 박자';
  return b.unique(S, dis) || growBeat(S);           // 고유가 헛돌면 성장으로 대신한다
}

function stageUp(S, dis){
  const b = BOSS[S.board.boss];
  if(dis.stage >= dis.stageMax){
    dis.finished = true;                                   // 「편하게」 승리 신호는 여기서 한 번 뜬다
    if(!(SR.GIMMICK.LOOP && b.roster)) return false;
    dis.beat = 0; dis.stageClock = SR.STAGE_TURNS;         // 악보를 처음으로 되돌린다
    layStage(S, dis);
    return false;                                          // 병기는 안 오른다
  }
  dis.stage++;
  if(dis.stage >= dis.stageMax) dis.finished = true;      // 최종 병기에 「닿는」 순간이 편하게의 승리다
  const dLv = SLV(S.board.boss,'dis',dis.stage), dLvPrev = SLV(S.board.boss,'dis',dis.stage-1);
  if(SR.GIMMICK.PRORATE){                                  // 비례 이월 — 깎아 둔 비율이 유지된다
    const ratio = dis.val / dis.init;
    dis.init = SR.DIS_BASE[dLv];
    dis.val = Math.ceil(dis.init * ratio);
  }else{
    const add = SR.DIS_BASE[dLv] - SR.DIS_BASE[dLvPrev];
    dis.val += add; dis.init = SR.DIS_BASE[dLv];
  }
  dis.beat = 0;
  dis.stageClock = SR.STAGE_TURNS;
  layStage(S, dis);
  return true;
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
  /* v25 — 활성 부수 자리가 하나도 없으면 이긴다. 병 노드는 보지 않는다.
     휴면도 '비운 것'으로 센다 — 눌러서 내보냈고 병은 그대로다. */
  if(policy==='연명' && !dis.dead && !S.wiped
     && !S.nodes.some(n=>n.role!=='disease' && !n.dead && n.val>0)) return '연명';
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
  S.paramAcc += (id==='환기하세요' ? 2 : 1) + ((S.diagPlus||{})[id] || 0);
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
  const cap = opt.act1Cap || 12;
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
  const cap = opt.act3Cap || 30;
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
    const card = sup.sort((a,b)=>(C.CARDS[b].sup||6)/Math.max(1,C.CARDS[b].cost)-(C.CARDS[a].sup||6)/Math.max(1,C.CARDS[a].cost))[0];
    const cd = C.CARDS[card];
    if(wantDis){
      S.energy-=C.cardCost(S,card); hitDisease(S,dis,cd.sup||6); S.played++;
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
