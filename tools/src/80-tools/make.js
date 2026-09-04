/* ══════════════════════════════════════════════════════════════════
   §9.20 환자 직접 짜기
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 환자 만들기 ════════════════════════════════════════════
   v18 의 cbuild 자리. 판을 손으로 짜서 규칙을 시험한다 —
   질환도감의 한 항목을 판으로 옮겨 볼 때 쓰는 통로다. */
//@ 화면.만들기 — §9.20 환자 직접 짜기
/* score = 병기별 악보. null 이면 고른 병 노드의 악보를 그대로 쓴다.
   scoreFrom = 그 악보를 어느 병 노드에서 떠 왔는가 (「악보」 탭이 갈림을 알린다) */
let CUSTOM = {
  /* hp 는 체격표에서 시작한다. 전에는 280 이 박혀 있었는데 그건 걷어낸 LVTAB[3].hp 의
     사본이라, 태그 칸이 「체격 120」이라 적어 놓고 체력은 280 인 판이 나왔다 —
     체격 규칙이 유일하게 안 통하는 화면이 하필 환자를 손으로 짜는 화면이었다 */
  name:'커스텀 환자', hp:hpOfTags([]), level:3, core:'', talk:3, tags:[], score:null, scoreFrom:null,
  nodes:[{sym:'발열', init:65, evo:4, shielded:true, grow:0, p:''},
         {sym:'통증', init:50, evo:5, shielded:true, grow:0, p:''}],
  enh:[],
  dis:null,
};

/* 알림 줄 — 「만들기」와 「악보」 두 곁판에 같은 말을 띄운다.
   mkStart 는 두 곳에서 부르는데 전에는 mk_note 에만 적어서,
   악보 탭에서 누르면 실패해도 아무 말이 없었다 */
function mkNote(txt){
  for(const id of ['mk_note','sc_note']){ const e=$(id); if(e) e.textContent=txt }
}

function mkSet(path, v){
  const seg=path.split('.'); let o=CUSTOM;
  for(let i=0;i<seg.length-1;i++) o=o[seg[i]];
  const k=seg[seg.length-1];
  o[k] = (typeof o[k]==='number') ? (+v||0) : (typeof o[k]==='boolean' ? !!v : v);
  if(k==='sym') o.p = '';        // 증상이 바뀌면 앞 증상의 효과 비율은 버린다
  renderMake();
}

function mkAddNode(){ CUSTOM.nodes.push({sym:'감염', init:50, evo:4, shielded:true, grow:0, p:''}); renderMake() }

function mkDelNode(i){ CUSTOM.nodes.splice(i,1); renderMake() }

function mkAddEnh(){ CUSTOM.enh.push({a:'감염', b:'발열', k:'가속'}); renderMake() }

/* 배선 하나에 기본형 하나 + 강화형 여럿. 강화형만 든 배선도 판이 받는다
   (명부의 d2_3 감염→통증 불응이 그 꼴이다) — 그래서 기본형에 「없음」이 있다.

   강화형이 없으면 문자열 하나로 도로 눕힌다. 늘 배열로 적으면 옛 JSON 을
   내보내고 되읽는 자리가 갈리고, 명부·저장판이 아직 문자열을 쓴다. */
function mkKwSet(i, base, mods){
  const ks = [...(base && base!=='없음' ? [base] : []), ...mods];
  /* 하나도 안 고른 상태를 '가속' 으로 되밀지 않는다. 되밀면 「없음」을 고른 뒤
     강화형을 켜는 순간 기본형이 되살아나 **강화형만 든 배선**(명부 d2_3 의
     감염→통증 불응)을 작업대에서 만들 길이 없어진다. 빈 배선은 커널이 그냥
     아무 일도 안 하고 지나가므로 그대로 두고, 표에서 눈에 띄게 적는다 */
  CUSTOM.enh[i].k = ks.length===1 ? ks[0] : ks;
  renderMake();
}
function mkKwBase(i, v){ mkKwSet(i, v, linkKws(CUSTOM.enh[i]).filter(isEnhKw)) }
function mkKwMod(i, k, on){
  const ks = linkKws(CUSTOM.enh[i]);
  const mods = ks.filter(x => isEnhKw(x) && x!==k);
  if(on) mods.push(k);
  mkKwSet(i, ks.find(x => !isEnhKw(x)) || '없음', mods);
}

function mkDelEnh(i){ CUSTOM.enh.splice(i,1); renderMake() }

/* 병 노드 하나를 새로 뜬다 — 고른 병 노드를 밑그림 삼아 통째로 베낀다.
   ★ 커스텀 병 노드는 '보스 정의 한 벌'이다. 전에는 {boss, stage, init, clock} 몇 칸만
     들고 나머지는 빌려 쓴 보스에게 물었는데, 그러면 SLV·stageBand·명부·자리 상한이
     전부 남의 것이라 손댈 자리가 없었다. 같은 모양으로 들고 있으면 커널의 모든
     조회가 그대로 통한다 — 고칠 곳이 없다. */
/* 손으로 짠 병 노드가 BOSS 표에 앉는 이름. 판이 이 이름을 board.boss 로 들고,
   커널의 모든 조회(SLV · stageBand · 명부 · 자리 상한 · 악보)가 보통 보스처럼 읽는다 */
const DIS_KEY = '커스텀';

/* 편집 중인 정의를 BOSS 표에 올린다. 저장한 병 노드는 제 이름으로 따로 앉는다 */
//@ 만들기.병노드등록 — 손으로 짠 정의를 BOSS 표에 올린다
function disRegister(d, key){
  const sts = disStages(d);
  const only = o => Object.fromEntries(sts.filter(s=>o && o[s]!=null).map(s=>[s, o[s]]));
  /* 밖에서 들어온 태그는 훑는다 — 저장해 둔 병 노드와 JSON 이 여기로 온다 */
  const tags = tagsClean(d.tags);
  const b = {
    name: d.name || '커스텀 병 노드',
    /* 병기는 **자른 것**을 담는다 (disStages). 날것을 담았더니 9 를 적었을 때
       stage0:9 로 앉고 악보 · 수치는 5까지만 있어서, makeDisease 가 init 도 val 도
       undefined 인 병 노드를 세웠다 — 바로 아래 hp 와 똑같은 NaN 이 다시 났다 */
    stage0: sts[0], stageMax: sts[sts.length-1],
    noDeath: !!d.noDeath,
    tags: tags.slice(),
    /* 체력은 태그에서 낸다 — 권위본 보스가 뜰 때 하는 것과 같은 줄이다
       (20-data/bosses.js 의 마무리 고리). 여기 빠뜨렸더니 손으로 짠 병 노드로
       스토리를 열면 mkBoard 가 b.hp 를 undefined 로 받아 첫 피해에서 체력이
       통째로 NaN 이 됐다 — 화면에는 「NaN / NaN」만 뜨고 판정도 영영 안 났다.
       규칙의 집은 hpOfTags 하나다. 값을 베끼지 말고 그 함수를 부른다 */
    hp: hpOfTags(tags),
    seed: (d.seed||[]).slice(),
    lv: {...(d.lv||{})},
    disVal: only(d.disVal), clock: only(d.clock), carry: only(d.carry),
    /* 손으로 적은 악보는 커널에 들기 전에 훑는다 — 모르는 이름은 scoreClean 이 떨군다.
       비면 병이 할 일이 없어지므로 최소한의 악보를 깔아 준다 */
    beats: Object.fromEntries(sts.map(s => {
      const line = scoreClean({[s]: (d.beats||{})[s] || []});
      return [s, line ? line[s] : ['분화','성장']];
    })),
    policy: (BOSS[d.from] || {}).policy,       // 방침 설명문은 밑그림 것을 빌린다
    custom: true,
  };
  if(d.dupType) b.dupType = d.dupType;
  /* 명부 — 병기마다 자리 이름을 적어 두면 그 순서가 곧 밴드 배정 순서다.
     한 병기라도 비어 있으면 명부 없는 보스로 돈다 (disRosterOn) */
  if(disRosterOn(d)){
    b.syms = Object.fromEntries(sts.map(s => [s, d.syms[s].slice()]));
    b.roster = {};
  }
  BOSS[key || DIS_KEY] = b;
  /* 명부의 밴드는 등록한 뒤에 매긴다 — stageBand 가 방금 올린 lv 를 봐야 한다 */
  if(b.syms) for(const s of sts)
    b.roster[s] = b.syms[s].map((sym,i)=>[sym, stageBand(key || DIS_KEY, s, i)]);
  return b;
}

/* 명부가 도는가 — **전부 아니면 전무다.** 한 병기라도 비어 있으면 커널이
   명부 없는 보스로 돌린다 (위 disRegister 가 b.syms 를 아예 안 싣는다).
   화면도 이것을 봐야 한다: 병 노드 탭이 '이 병기에 적힌 것'만 보고 따로 판단하다
   「명부대로」라 적었는데 실제로는 분화가 뿜는 일이 있었다 — 잣대는 여기 하나다 */
//@ 만들기.명부돎 — 명부가 실제로 도는가
function disRosterOn(d){
  const sts = disStages(d);
  return sts.length > 0 && sts.every(s => ((d.syms||{})[s]||[]).length);
}

/* 이 정의가 도는 병기들 */
function disStages(d){
  /* 자르는 범위는 레벨표에서 읽는다 (커널.병기범위) — 화면의 min · max 도 같은 자를 쓴다 */
  const lo = STAGE_LO, hi = STAGE_HI;
  const a = Math.max(lo, Math.min(hi, +d.stage || lo));
  const b = Math.max(lo, Math.min(hi, +d.stageMax || a));
  const out = [];
  for(let s = Math.min(a,b); s <= Math.max(a,b); s++) out.push(s);
  return out;
}

//@ 만들기.병노드뜨기 — 고른 병 노드를 통째로 베껴 온다
function disFrom(key){
  const b = BOSS[key];
  const sts = [];
  for(let s=b.stage0; s<=b.stageMax; s++) sts.push(s);
  const pick = (o, dflt) => Object.fromEntries(sts.map(s => [s, o ? o[s] : dflt(s)]));
  return {
    from: key,                                   // 어느 병 노드를 밑그림으로 떴는가
    name: b.name,
    stage: b.stage0, stageMax: b.stageMax,
    noDeath: !!b.noDeath,
    tags: (b.tags||[]).slice(),
    seed: (b.seed||[]).slice(),
    dupType: b.dupType || '',
    lv: {...(b.lv||{})},                         // 항목별 레벨 — band · evo · spots · dis · enh
    disVal: pick(null, s => stageDisVal(key, s)),   // 병기별 병 노드 수치
    clock:  pick(null, s => stageTurns(key, s)),    // 병기별 시계
    carry:  pick(null, s => stageCarry(key, s)),    // 병기별 이월 비율
    syms:   Object.fromEntries(sts.map(s => [s, b.syms && b.syms[s] ? b.syms[s].slice() : null])),
    beats:  Object.fromEntries(sts.map(s => [s, bossScore(key, s).slice()])),
  };
}

function mkToggleDis(){
  CUSTOM.dis = CUSTOM.dis ? null : disFrom('아이');
  renderMake();
}

/* 태그가 바뀌면 체력도 따라간다 — 단, 손으로 적어 넣었으면 그것을 지킨다.
   '손댔는가'를 따로 들고 있지 않아도 바꾸기 전 값과의 비교 하나로 갈린다.
   체격과 체력 태그가 같은 손을 쓴다 — 둘 다 hpOfTags 를 움직이므로 */
function mkTags(next){
  const was = hpOfTags(CUSTOM.tags);
  CUSTOM.tags = next;
  if(+CUSTOM.hp === was) CUSTOM.hp = hpOfTags(CUSTOM.tags);
  renderMake();
}
function mkPickBody(t){ mkTags(bodySet(CUSTOM.tags, t)) }
function mkToggleTag(t){ mkTags(tagToggle(CUSTOM.tags, t)) }

function mkLoadFrom(){
  const id=$('mk_from').value; if(!id) return;
  const p=SCRIPT[id], b=makePatient(id, +$('seed').value);
  CUSTOM = {name:p.name, hp:b.hp, level:p.lv, core:p.core, talk:p.talk??3, tags:(p.tags||[]).slice(),
    nodes:b.nodes.map(n=>({sym:n.sym, init:n.init, evo:n.evo, shielded:n.shielded, grow:n.grow})),
    enh:(b.enh||[]).map(e=>({a:e.a,b:e.b,k:Array.isArray(e.k)?e.k.slice():e.k})),
    dis:null, score:null, scoreFrom:null};
  mkNote(`${p.name} 을(를) 본으로 가져왔다.`);
  renderMake();
}

function mkToJson(){ $('mk_json').value = JSON.stringify(CUSTOM, null, 1); mkNote('JSON 으로 내보냈다.') }

function mkFromJson(){
  try{ const o=JSON.parse($('mk_json').value); if(!o.nodes) throw new Error('nodes 가 없다');
       /* 모르는 태그는 여기서 떨군다 (생성기.태그훑기). 그냥 실었더니 태그 칸이
          부르는 hpOfTags 가 터져서, 한 번 잘못 읽어들이면 만들기 탭이 그 뒤로
          영영 안 그려졌다 — 「읽어들였다」고 적힌 채로 */
       const drop = tagsUnknown(o.tags);
       o.tags = tagsClean(o.tags);
       CUSTOM=o;
       mkNote('읽어들였다.' + (drop.length?` 모르는 태그는 뺐다 — ${drop.join(' · ')}`:''));
       renderMake() }
  catch(e){ mkNote('읽지 못했다 — '+e.message) }
}

function buildCustom(){
  const mk = o => {
    const n = {sym:o.sym, init:+o.init, val:+o.init, shielded:!!o.shielded,
      shReduc:o.shielded?R.SHIELD_CUT:0, stabAcc:0, grow:+o.grow||0, evo:+o.evo, evoLeft:+o.evo,
      evolved:false, dead:false, dormT:0, rig:0, rigUp:0, rigCap:0, rigLent:0, delayed:0, weak:0, diagRound:0, diagAcc:0,
      diagNeed:R.DIAG_NEED, demoted:false, revealed:false, spawned:false, role:'sym'};
    /* 자리에 적어 둔 효과 비율만 싣는다. 비워 두면 권위본 값을 그대로 쓴다 */
    const d = SYMPARAM[o.sym];
    if(d && o.p!==undefined && o.p!==null && o.p!=='' && Number.isFinite(+o.p)) n[d.key] = +o.p;
    return n;
  };
  const syms = CUSTOM.nodes.map(mk);
  const lvl = Math.min(5, Math.max(1, +CUSTOM.level||3));
  const board = {nodes:syms, enh:CUSTOM.enh.map(e=>({...e, kind:'trig', hidden:true})),
    hp:+CUSTOM.hp, hpMax:+CUSTOM.hp, level:lvl, evoBase:LVTAB[lvl].evo,
    tags:CUSTOM.tags.slice(), core: CUSTOM.core || (syms[0]?syms[0].sym:'발열'),
    script:{name:CUSTOM.name, talk:+CUSTOM.talk||0, tried:'없음', lv:lvl}};
  if(CUSTOM.dis){
    const d=CUSTOM.dis;
    disRegister(d);                       // BOSS['커스텀'] 로 올린다 — 커널은 보통 보스로 읽는다
    const st = +d.stage, v0 = stageDisVal(DIS_KEY, st);
    const dis={sym:'병', role:'disease', init:v0, val:v0, shielded:false, shReduc:0,
      stabAcc:0, grow:0, evo:99, evoLeft:99, evolved:false, dead:false, dormT:0, rig:0, rigUp:0,
      weak:0, diagRound:0, diagAcc:0, diagNeed:R.DIAG_NEED, resist:0, resistBack:false,
      demoted:false, revealed:false,
      spawned:false, stage:st, stageMax:+d.stageMax, stageClock:stageTurns(DIS_KEY, st), beat:0};
    board.nodes = [dis, ...syms];
    board.boss = DIS_KEY; board.core='병'; board.noDeath = !!d.noDeath;
  }
  board.S = S_of({nodes:syms, enh:board.enh, evoBase:board.evoBase});
  board.lvCalc = lv_of(board.S);
  return board;
}

function mkStart(){
  const b = buildCustom();
  if(!b.nodes.length){ mkNote('자리가 하나는 있어야 한다.'); return }
  if(CUSTOM.dis){ $('boss').value='custom'; PANES.story.started=true; setMode('story'); newStory() }
  else { $('src').value='custom'; PANES.one.started=true; setMode('one'); newGame() }
}

function renderMake(){
  tipReset();
  const sel=$('mk_from');
  if(sel && !sel.dataset.filled){
    sel.innerHTML = '<option value="">— 빈 판에서 시작 —</option>'
      + Object.keys(SCRIPT).map(k=>`<option value="${k}">${k} · ${SCRIPT[k].name.slice(0,22)}</option>`).join('');
    sel.dataset.filled='1';
  }
  const symOpt = v => ALLSYM.map(s=>`<option ${s===v?'selected':''}>${s}</option>`).join('');
  const b = buildCustom();
  $('mk_body').innerHTML =
    `<div class="chart">환자 만들기 — S ${b.S.toFixed(1)} · 레벨 판정 <b>${b.lvCalc}</b>${CUSTOM.dis?' · 병 노드 있음(스토리)':''}</div>
     <div class="mkgrid">
       <label class="mk">이름<input value="${esc(CUSTOM.name)}" onchange="mkSet('name',this.value)"></label>
       <label class="mk">체력<input type="number" value="${CUSTOM.hp}" onchange="mkSet('hp',this.value)"></label>
       <label class="mk">레벨(진화 기준)<input type="number" min="1" max="5" value="${CUSTOM.level}" onchange="mkSet('level',this.value)"></label>
       <label class="mk">핵심 증상<input value="${esc(CUSTOM.core)}" placeholder="비우면 첫 자리" onchange="mkSet('core',this.value)"></label>
       <label class="mk">말수<input type="number" value="${CUSTOM.talk}" onchange="mkSet('talk',this.value)"></label>
     </div>
     ${tagBoxHTML(CUSTOM.tags, 'mk', 'mkPickBody', 'mkToggleTag')}

     <div class="bar">증상 자리 <span class="right"><button class="mini" onclick="mkAddNode()">+ 자리</button></span></div>
     <div class="note">「효과 비율」은 그 증상을 그 증상이게 만드는 값이다. 증상을 바꾸면 항목도 바뀐다.
        비워 두면 권위본 기본값을 쓰고, 규칙 덮어쓰기로 기본값을 바꾸면 비워 둔 자리만 따라 움직인다.
        「성장률」은 그와 별개로 모든 증상에 붙는 초기값 기준 고정 성장이다.</div>
     <table><tr><th>증상</th><th>초기값</th><th>진화까지</th><th>성장률</th><th>효과 비율</th><th>보호막</th><th></th></tr>`
    + CUSTOM.nodes.map((n,i)=>{
        const d = SYMPARAM[n.sym], dd = SYMDOC[n.sym];
        const cur = (n.p===undefined||n.p===null||n.p==='') ? '' : n.p;
        return `<tr>
        <td><select onchange="mkSet('nodes.${i}.sym',this.value)">${symOpt(n.sym)}</select></td>
        <td><input type="number" value="${n.init}" onchange="mkSet('nodes.${i}.init',this.value)"></td>
        <td><input type="number" value="${n.evo}" onchange="mkSet('nodes.${i}.evo',this.value)"></td>
        <td><input type="number" step="0.05" value="${n.grow}" onchange="mkSet('nodes.${i}.grow',this.value)"></td>
        <td${tip(TT(n.sym+' · '+dd.label, dd.why() + `<br><br><span class="d">기본값 ${d.def()}</span>`))}>
          <span class="d" style="font-size:11px">${dd.label}</span>
          <input type="number" step="${dd.step}" value="${cur}" placeholder="${d.def()}"
                 onchange="mkSet('nodes.${i}.p',this.value)"></td>
        <td><input type="checkbox" ${n.shielded?'checked':''} onchange="mkSet('nodes.${i}.shielded',this.checked)"></td>
        <td><button class="mini" onclick="mkDelNode(${i})">뺀다</button></td></tr>`}).join('')
    + `</table>
     <div class="bar">강화형 연결선 — 이 환자만 <span class="right"><button class="mini" onclick="mkAddEnh()">+ 연결선</button></span></div>
     <div class="note">강화형은 <b>같은 배선의 기본형에 얹힌다</b> — 연쇄와 확산은 얹힐 것이 없으면 아무 일도 안 한다.
       만개와 불응은 혼자서도 걸리므로 기본형을 「없음」으로 둘 수 있다 (명부의 감염→통증 불응이 그 꼴이다).</div>
     <table><tr><th>from</th><th>to</th><th>기본형</th><th>강화형 (얹는다)</th><th></th></tr>`
    + CUSTOM.enh.map((e,i)=>{
        const ks=linkKws(e), base=ks.find(k=>!isEnhKw(k))||'없음', mods=ks.filter(isEnhKw);
        return `<tr>
        <td><select onchange="mkSet('enh.${i}.a',this.value)">${symOpt(e.a)}</select></td>
        <td><select onchange="mkSet('enh.${i}.b',this.value)">${symOpt(e.b)}</select></td>
        <td><select onchange="mkKwBase(${i},this.value)">${['없음',...BASE_KW].map(k=>`<option ${k===base?'selected':''}>${k}</option>`).join('')}</select></td>
        <td>${ENH_KW.map(k=>`<label class="mkchk"${tip(LINKTIP[k]||'')}><input type="checkbox" ${mods.includes(k)?'checked':''} onchange="mkKwMod(${i},'${k}',this.checked)">${k}</label>`).join('')}</td>
        <td><button class="mini" onclick="mkDelEnh(${i})">뺀다</button></td></tr>`}).join('')
    + `</table>
     <div class="bar">병 노드 <span class="right"><button class="mini" onclick="mkToggleDis()">${CUSTOM.dis?'끈다':'켠다'}</button></span></div>`
    + (CUSTOM.dis ? `<div class="note">악보는 고른 병 노드의 것을 밑그림으로 쓴다. 「악보」 탭에서 병기마다 고쳐 짤 수 있다 ${CUSTOM.score?'— <b>지금 손댄 악보가 실려 있다</b>':''}.<br>
         병기가 오를 때의 수치는 SR.DIS_BASE 를 따른다 — 그 값을 바꾸려면 「규칙 덮어쓰기」를 쓴다.
         <button class="mini" onclick="setMode('score')">악보를 짠다</button></div>
       <div class="mkgrid">
         <label class="mk">악보<select onchange="mkSet('dis.boss',this.value)">${Object.keys(BOSS).map(k=>`<option ${k===CUSTOM.dis.boss?'selected':''}>${k}</option>`).join('')}</select></label>
         <label class="mk">시작 병기<input type="number" min="${STAGE_LO}" max="${STAGE_HI}" value="${CUSTOM.dis.stage}" onchange="mkSet('dis.stage',this.value)"></label>
         <label class="mk">최대 병기<input type="number" min="${STAGE_LO}" max="${STAGE_HI}" value="${CUSTOM.dis.stageMax}" onchange="mkSet('dis.stageMax',this.value)"></label>
         <label class="mk">병 노드 수치<input type="number" value="${CUSTOM.dis.init}" onchange="mkSet('dis.init',this.value)"></label>
         <label class="mk">병기 시계<input type="number" value="${CUSTOM.dis.clock}" onchange="mkSet('dis.clock',this.value)"></label>
         <label class="mk">체력 0이 안 된다<input type="checkbox" ${CUSTOM.dis.noDeath?'checked':''} onchange="mkSet('dis.noDeath',this.checked)"></label>
       </div>` : '<div class="note">켜면 스토리(1막·방침·병기)로 돈다.</div>');
  $('log').innerHTML=LOG.map(t=>`<div>${t}</div>`).join('');
  renderAIW();
}
