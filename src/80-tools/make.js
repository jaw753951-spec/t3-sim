/* ══════════════════════════════════════════════════════════════════
   §9.20 환자 직접 짜기
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 환자 만들기 ════════════════════════════════════════════
   v18 의 cbuild 자리. 판을 손으로 짜서 규칙을 시험한다 —
   질환도감의 한 항목을 판으로 옮겨 볼 때 쓰는 통로다. */
//@ 화면.만들기 — §9.20 환자 직접 짜기
let CUSTOM = {
  name:'커스텀 환자', hp:280, level:3, core:'', talk:3, tags:[],
  nodes:[{sym:'발열', init:65, evo:4, shielded:true, grow:0, p:''},
         {sym:'통증', init:50, evo:5, shielded:true, grow:0, p:''}],
  enh:[],
  dis:null,
};

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

function mkDelEnh(i){ CUSTOM.enh.splice(i,1); renderMake() }

function mkToggleDis(){
  CUSTOM.dis = CUSTOM.dis ? null
    : {boss:'아이', stage:3, stageMax:5, init:SR.DIS_BASE[3], clock:SR.STAGE_TURNS, noDeath:true};
  renderMake();
}

function mkToggleTag(t){
  CUSTOM.tags = CUSTOM.tags.includes(t)
    ? CUSTOM.tags.filter(x=>x!==t)
    : tagAdd(CUSTOM.tags, t);
  renderMake();
}

function mkLoadFrom(){
  const id=$('mk_from').value; if(!id) return;
  const p=SCRIPT[id], b=makePatient(id, +$('seed').value);
  CUSTOM = {name:p.name, hp:b.hp, level:p.lv, core:p.core, talk:p.talk??3, tags:(p.tags||[]).slice(),
    nodes:b.nodes.map(n=>({sym:n.sym, init:n.init, evo:n.evo, shielded:n.shielded, grow:n.grow})),
    enh:(b.enh||[]).map(e=>({a:e.a,b:e.b,k:e.k})), dis:null};
  $('mk_note').textContent = `${p.name} 을(를) 본으로 가져왔다.`;
  renderMake();
}

function mkToJson(){ $('mk_json').value = JSON.stringify(CUSTOM, null, 1); $('mk_note').textContent='JSON 으로 내보냈다.' }

function mkFromJson(){
  try{ const o=JSON.parse($('mk_json').value); if(!o.nodes) throw new Error('nodes 가 없다');
       CUSTOM=o; $('mk_note').textContent='읽어들였다.'; renderMake() }
  catch(e){ $('mk_note').textContent='읽지 못했다 — '+e.message }
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
    const dis={sym:'병', role:'disease', init:+d.init, val:+d.init, shielded:false, shReduc:0,
      stabAcc:0, grow:0, evo:99, evoLeft:99, evolved:false, dead:false, dormT:0, rig:0, rigUp:0,
      weak:0, diagRound:0, diagAcc:0, diagNeed:R.DIAG_NEED, demoted:false, revealed:false,
      spawned:false, stage:+d.stage, stageMax:+d.stageMax, stageClock:+d.clock, beat:0};
    board.nodes = [dis, ...syms];
    board.boss = d.boss; board.core='병'; board.noDeath = !!d.noDeath;
  }
  board.S = S_of({nodes:syms, enh:board.enh, evoBase:board.evoBase});
  board.lvCalc = lv_of(board.S);
  return board;
}

function mkStart(){
  const b = buildCustom();
  if(!b.nodes.length){ $('mk_note').textContent='자리가 하나는 있어야 한다.'; return }
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
     <div class="bar">체력 태그</div>
     <div class="tags">${Object.keys(HP_TAG).map(t=>`<label><input type="checkbox" ${CUSTOM.tags.includes(t)?'checked':''} onchange="mkToggleTag('${t}')">${t} <span class="d">×${HP_TAG[t]}</span></label>`).join('')}</div>

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
     <table><tr><th>from</th><th>to</th><th>키워드</th><th></th></tr>`
    + CUSTOM.enh.map((e,i)=>`<tr>
        <td><select onchange="mkSet('enh.${i}.a',this.value)">${symOpt(e.a)}</select></td>
        <td><select onchange="mkSet('enh.${i}.b',this.value)">${symOpt(e.b)}</select></td>
        <td><select onchange="mkSet('enh.${i}.k',this.value)">${['가속','경화','점화'].map(k=>`<option ${k===e.k?'selected':''}>${k}</option>`).join('')}</select></td>
        <td><button class="mini" onclick="mkDelEnh(${i})">뺀다</button></td></tr>`).join('')
    + `</table>
     <div class="bar">병 노드 <span class="right"><button class="mini" onclick="mkToggleDis()">${CUSTOM.dis?'끈다':'켠다'}</button></span></div>`
    + (CUSTOM.dis ? `<div class="note">악보(분화·고유·진행)는 고른 보스의 것을 빌려 쓴다. 병기가 오를 때의 수치는 SR.DIS_BASE 를 따른다 — 그 값을 바꾸려면 「규칙 덮어쓰기」를 쓴다.</div>
       <div class="mkgrid">
         <label class="mk">악보<select onchange="mkSet('dis.boss',this.value)">${Object.keys(BOSS).map(k=>`<option ${k===CUSTOM.dis.boss?'selected':''}>${k}</option>`).join('')}</select></label>
         <label class="mk">시작 병기<input type="number" min="3" max="5" value="${CUSTOM.dis.stage}" onchange="mkSet('dis.stage',this.value)"></label>
         <label class="mk">최대 병기<input type="number" min="3" max="5" value="${CUSTOM.dis.stageMax}" onchange="mkSet('dis.stageMax',this.value)"></label>
         <label class="mk">병 노드 수치<input type="number" value="${CUSTOM.dis.init}" onchange="mkSet('dis.init',this.value)"></label>
         <label class="mk">병기 시계<input type="number" value="${CUSTOM.dis.clock}" onchange="mkSet('dis.clock',this.value)"></label>
         <label class="mk">체력 0이 안 된다<input type="checkbox" ${CUSTOM.dis.noDeath?'checked':''} onchange="mkSet('dis.noDeath',this.checked)"></label>
       </div>` : '<div class="note">켜면 스토리(1막·방침·병기)로 돈다.</div>');
  $('log').innerHTML=LOG.map(t=>`<div>${t}</div>`).join('');
  renderAIW();
}
