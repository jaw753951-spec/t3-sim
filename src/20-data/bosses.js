/* ══════════════════════════════════════════════════════════════════
   최종 병기 정의
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ── 보스 정의 ── */
/* ── 보스 — v18 CASES 의 정연 정의를 그대로 옮긴다 ──────────
   ★ 셋 다 noDeath. 이 판에서 환자 체력은 0이 되지 않는다.
   ★ 방침 승리 조건은 케이스마다 다르다 (도피 갈래가 특히). */
//@ 스토리.병기 — 최종 병기의 단계와 박자
const BOSS = {
  아이:{name:'쓰러진 아이 · 수막알균', stage0:3, stageMax:5, hp:{lv:4}, tags:['소아'],
    lv:{enh:1},
    noDeath:true, seed:['통증'],
    /* 병기별 자리 명부 — 앞 n−1개가 진입 세트, 나머지는 분화가 채운다.
       빈 자리가 생기면 그 자리의 밴드로 다시 온다. 자리 상한 = 명부 길이. */
    syms:{3:['통증','발열'],
          4:['발열','출혈','통증'],
          5:['발열','출혈','통증','호흡곤란']},
    /* 악보 — 마지막 비트 다음 턴이 창이다 */
    /* v25 악보 — 병기마다 여섯 비트로 시계와 맞춘다. 되감김이 없다 */
    beats:{3:['분화','고유','같은 박자','창','고유','같은 박자'],
           4:['분화','굳는다','고유','창','분화','몰린다'],
           5:['분화','성장','고유','창','분화','엮는다']},
    unique:(S,dis)=>{
      if(dis.stage===3){                       // 「파고든다」 — 신경계 노드 진화 시계를 당긴다
        for(const n of K.active(S)) if(n.role!=='disease' && (n.sym==='통증'||n.sym==='호흡곤란')) n.evoLeft=Math.max(1,n.evoLeft-SR.BEAT_EVO_PULL);
        return '파고든다';
      }
      if(dis.stage===4){                       // 「알아듣지 못한다」 — 정신을 한 단계 무너뜨린다
        if(S.mind==='공황') return null;        // 더 갈 데가 없으면 폴백
        K.mind(S,+1); return '알아듣지 못한다';
      }
      /* Lv5 「터진다」 — 병을 억제한 턴에 걷어낸 자리가 다시 일어난다 */
      const dorm=S.nodes.filter(n=>!n.dead && n.val<=0 && n.role!=='disease');
      if(!dorm.length) return null;            // 재울 자리가 없으면 폴백
      const n=dorm[0]; n.val=n.init; n.dormT=0; n.shielded=true; n.shReduc=R.SHIELD_CUT; n.stabAcc=0;
      return '터진다';
    },
    policy:{완치:'병 노드를 처치선까지 내려 끊는다', 연명:'활성 부수 증상을 하나도 남기지 않는다',
            편하게:'병기 시계가 다 돌 때까지 환자를 버티게 한다'}},

  어부:{name:'어부 · 접촉성 피부염', stage0:3, stageMax:3, hp:{lv:1}, tags:['노동자'],
    lv:{band:2, evo:3, spots:5, enh:1},
    noDeath:true, seed:['통증'], dupType:'통증',
    beats:{3:['분화','번진다','고유','아문다','몰린다','아문다']},
    /* 「긁는다」 — 활성 통증 자리가 둘 이상이면 긁어서 이차 감염이 앉는다 */
    unique:(S)=>{
      const pain=K.active(S).filter(n=>n.role!=='disease'&&n.sym==='통증');
      if(pain.length>=SR.BEAT_SCRATCH_N && K.active(S).filter(n=>n.sym==='감염').length===0){
        S.nodes.push(mkSpot('감염', SR.DUP_BASE+Math.floor(S.rng()*SR.DUP_SPREAD), S.turn));
        return '긁어서 이차 감염이 앉는다';
      }
      return '긁는다 — 아직 자리가 모자란다';
    },
    policy:{완치:'병 노드를 처치선까지 내려 끊는다', 연명:'활성 부수 증상을 하나도 남기지 않는다',
            편하게:'병기 시계가 다 돌 때까지 환자를 버티게 한다'}},

  송이:{name:'송이 · 아편 중독 금단', stage0:3, stageMax:3, hp:{lv:1}, tags:['영양실조'],
    lv:{band:3, evo:1, spots:2, enh:1},
    noDeath:true, seed:['탈수','통증'],
    beats:{3:['성장','고유','치민다','가라앉는다','고유','가라앉는다']},
    /* 「지금이면 괜찮아진다」 — 재워둔 자리 하나를 깨우고 정신을 한 단계 무너뜨린다 */
    unique:(S)=>{
      const dorm=S.nodes.filter(n=>!n.dead && n.val<=0 && n.role!=='disease');
      if(dorm.length){ const n=dorm[0]; n.val=n.init; n.dormT=0; n.shielded=true; n.shReduc=R.SHIELD_CUT; n.stabAcc=0 }
      K.mind(S,+1);
      return '지금이면 괜찮아진다';
    },
    policy:{완치:'병 노드를 처치선까지 내려 끊는다 (정점을 넘기는 경주)',
            연명:'활성 부수 증상을 하나도 남기지 않는다',
            편하게:'병기 시계가 다 돌 때까지 환자를 버티게 한다'}},
};

/* ── v25 — 보스 정의를 편다 ────────────────────────────────
   syms 는 명부로, hp:{lv} 는 레벨표 × 체력 태그로. 손으로 적던 수치가 사라진다. */
//@ 스토리.펼침 — 보스 정의를 레벨표로 편다
for(const key in BOSS){
  const b = BOSS[key];
  if(b.syms){
    b.roster = {};
    for(const st in b.syms)
      b.roster[st] = b.syms[st].map((sym,i)=>[sym, stageBand(key, +st, i)]);
  }
  if(b.hp && typeof b.hp === 'object'){
    let hp = LVTAB[b.hp.lv].hp;
    for(const t of (b.tags||[])) hp = Math.round(hp * (HP_TAG[t]||1));
    b.hp = hp;
  }
}
