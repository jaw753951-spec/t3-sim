/* ══════════════════════════════════════════════════════════════════
   §9.21 악보 짜기
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 악보 ═══════════════════════════════════════════════════
   병이 매 턴 무엇을 하는가. 병기마다 악보가 하나 있고, 한 턴에 한 비트씩
   나아가다 끝에 닿으면 처음으로 돌아온다. 병기가 오르면 다시 1번부터다.

   여기서 짠 악보는 CUSTOM.score 에 얹히고 buildCustom 이 board.score 로
   판에 싣는다. 판에 악보가 실려 있으면 scoreOf(30-core/story.js)가 그것을
   먼저 보므로, 고른 병 노드의 악보는 기본값 노릇만 한다.

   고를 수 있는 이름은 BEAT_LIST 가, 그 뜻풀이는 BEATDOC(60-text)가 쥔다 —
   여기에 목록을 또 적지 않는다. 두 벌로 적으면 언젠가 갈라진다. */
//@ 화면.악보 — §9.21 병 노드 악보 짜기

/* 지금 손대는 병기. 패턴 서랍이 여기 끝에 붙인다 */
let SCORE_AIM = null;

/* 편집할 병기 — 시작 병기부터 최종 병기까지 */
function scStages(){ return CUSTOM.dis ? disStages(CUSTOM.dis) : [] }

/* 그 병기의 악보. 이제 정의가 제 악보를 들고 있으므로 여기서 되짚을 것이 없다 —
   전에는 CUSTOM.score 를 따로 두고 「손댔는가」를 살펴 기본값과 갈랐다.
   병 노드가 보스 정의 한 벌이 되면서 악보는 그 정의의 한 칸이 됐다 */
function scLine(st){
  const d = CUSTOM.dis;
  if(!d) return [];
  if(!d.beats) d.beats = {};
  if(!d.beats[st] || !d.beats[st].length) d.beats[st] = bossScore(d.from || '아이', st).slice();
  return d.beats[st];
}

function scSet(st, i, v){ scLine(st)[i] = v; SCORE_AIM = st; scTouch(); renderScore() }

/* 앞뒤로 민다. 양 끝에서는 화면이 화살표를 꺼 두므로 넘어갈 자리가 없다 */
function scMove(st, i, d){
  const L = scLine(st), j = i + d;
  if(j < 0 || j >= L.length) return;
  const x = L[i]; L[i] = L[j]; L[j] = x;
  SCORE_AIM = st; scTouch(); renderScore();
}

function scDel(st, i){
  const L = scLine(st);
  if(L.length <= 1) return;              // 빈 악보는 둘 수 없다 — 병이 할 일이 없어진다
  L.splice(i, 1); SCORE_AIM = st; scTouch(); renderScore();
}

function scAdd(st, beat){ scLine(st).push(beat || '성장'); SCORE_AIM = st; scTouch(); renderScore() }

/* 그 병기만 기본값 악보로 되돌린다 */
function scReset(st){
  if(CUSTOM.dis && CUSTOM.dis.beats) delete CUSTOM.dis.beats[st];
  SCORE_AIM = st; scTouch(); renderScore();
}

/* 병 노드를 통째로 갈아 끼운다 — 고른 밑그림을 다시 뜬다 */
function scResetAll(){
  if(!CUSTOM.dis) return;
  const keep = CUSTOM.dis.from;
  CUSTOM.dis = disFrom(keep);
  scTouch(); renderScore();
}

/* 병 노드 정의의 한 칸을 고친다. 경로는 「lv.evo」·「disVal.3」처럼 점으로 적는다 */
function scSetDis(path, v){
  const seg = String(path).split('.');
  let o = CUSTOM.dis;
  for(let i=0;i<seg.length-1;i++){ if(!o[seg[i]]) o[seg[i]] = {}; o = o[seg[i]] }
  const k = seg[seg.length-1];
  o[k] = (typeof o[k]==='boolean') ? !!v : (typeof o[k]==='number' || o[k]===undefined ? (v===''?undefined:(isNaN(+v)?v:+v)) : v);
  if(o[k]===undefined) delete o[k];
  scTouch(); renderScore();
}

/* 밑그림을 바꾼다 — 고른 병 노드를 통째로 다시 뜬다 */
function scPickFrom(key){ CUSTOM.dis = disFrom(key); SCORE_AIM = null; scTouch(); renderScore() }

function scOn(){ if(!CUSTOM.dis) mkToggleDis(); renderScore() }

/* 그 병기의 활성 부수 명부 — 비우면 명부 없는 병 노드가 되어 자리 상한까지 분화가 뿜는다 */
function scSymAdd(st){
  const d = CUSTOM.dis; d.syms = d.syms || {};
  d.syms[st] = (d.syms[st] || []).concat(ALLSYM[0]);
  scTouch(); renderScore();
}
function scSymSet(st, i, v){ CUSTOM.dis.syms[st][i] = v; scTouch(); renderScore() }
function scSymDel(st, i){
  const L = CUSTOM.dis.syms[st];
  L.splice(i, 1);
  if(!L.length) CUSTOM.dis.syms[st] = null;
  scTouch(); renderScore();
}

/* ── 저장 ── 손으로 짠 병 노드는 브라우저에 남는다 ──────────
   localStorage 한 칸에 이름 → 정의로 담는다. 부팅 때 BOSS 표에 올리므로
   스토리 탭의 병기 고르개와 만들기 탭에서 그대로 고를 수 있다. */
//@ 만들기.병노드저장 — 브라우저에 남는 커스텀 병 노드
const DIS_STORE = 'intern.dis.v1';

function disSaved(){
  try{ return JSON.parse(localStorage.getItem(DIS_STORE) || '{}') }
  catch(e){ return {} }                     // 읽을 수 없으면 없는 것으로 친다
}
function disSaveAll(all){
  try{ localStorage.setItem(DIS_STORE, JSON.stringify(all)); return true }
  catch(e){ return false }                  // 사생활 모드 · 저장 공간 참 — 조용히 실패하지 않는다
}
/* 저장한 것을 BOSS 표에 올린다. 부팅과 저장 직후에 부른다 */
function disRegisterSaved(){
  const all = disSaved();
  for(const nm in all) disRegister(all[nm], nm);
  return Object.keys(all);
}

let SC_SAVE_OPEN = false, SC_DIRTY = false;

function scSaveOpen(){ SC_SAVE_OPEN = true; renderScore() }
function scSaveClose(){ SC_SAVE_OPEN = false; renderScore() }
function scSaveDo(){
  const nm = ($('sc_savename').value || '').trim();
  if(!nm){ mkNote('이름을 적어야 저장한다.'); return }
  if(BOSS[nm] && !BOSS[nm].custom){ mkNote(`「${nm}」 은 권위본 병 노드의 이름이다. 다른 이름을 쓴다.`); return }
  const all = disSaved();
  all[nm] = JSON.parse(JSON.stringify(CUSTOM.dis));
  all[nm].name = nm;
  if(!disSaveAll(all)){ mkNote('브라우저가 저장을 막았다 — 사생활 모드인지 본다.'); return }
  disRegister(all[nm], nm); renderBossPick();
  CUSTOM.dis.name = nm; SC_DIRTY = false; SC_SAVE_OPEN = false;
  mkNote(`「${nm}」 으로 저장했다. 스토리 탭의 병기 고르개에도 뜬다.`);
  renderScore();
}
function scSaveLoad(nm){
  const all = disSaved(); if(!all[nm]) return;
  CUSTOM.dis = JSON.parse(JSON.stringify(all[nm]));
  SC_DIRTY = false; SCORE_AIM = null;
  mkNote(`「${nm}」 을 불러왔다.`);
  renderScore();
}
function scSaveDrop(nm){
  const all = disSaved(); delete all[nm];
  disSaveAll(all); delete BOSS[nm]; renderBossPick();
  mkNote(`「${nm}」 을 지웠다.`);
  renderScore();
}
/* 저장하지 않고 나가려 할 때 — 막지는 않고 한 번 알린다 */
function scLeave(){
  if(SC_DIRTY){
    SC_DIRTY = false;                       // 한 번 알렸으면 다음 누름은 그냥 보낸다
    mkNote('손댄 병 노드를 아직 저장하지 않았다. 한 번 더 누르면 저장하지 않고 넘어간다.');
    renderScore(); return;
  }
  setMode('make');
}

/* ── 그리기 ── */
function renderScore(){
  tipReset();
  const host = $('sc_body');
  if(!host) return;

  if(!CUSTOM.dis){
    host.innerHTML =
      `<div class="chart">병 노드가 없다</div>
       <div class="note">병 노드는 스토리 판의 한가운데다 — 병기를 올리며 자리를 뿜고, 악보대로 매 턴 한 수를 둔다.<br>
         「만들기」의 병 노드를 켜거나, 아래 단추로 바로 켠다.</div>
       <button onclick="scOn()">병 노드를 켠다</button>`;
    $('sc_side').innerHTML = '';
    $('log').innerHTML = LOG.map(t=>`<div>${t}</div>`).join('');
    return;
  }

  const d = CUSTOM.dis, sts = scStages();
  if(SCORE_AIM === null || !sts.includes(SCORE_AIM)) SCORE_AIM = sts[0];

  const opt = cur => BEAT_LIST.map(x =>
    `<option value="${esc(x)}" ${x===cur?'selected':''}>${esc(x)}</option>`).join('');
  const symOpt = cur => ALLSYM.map(x =>
    `<option value="${esc(x)}" ${x===cur?'selected':''}>${esc(x)}</option>`).join('');
  const doc = b => {
    const e = BEATDOC[b];
    return e ? TT(b + (e.of?' · '+e.of:'') + ' — ' + e.label, e.why()) : TT(b, '설명이 아직 없는 박자다.');
  };
  const hp = hpOfTags(d.tags||[]);

  /* ① 이름 · 체력 ─────────────────────────────────────────── */
  let h = `<div class="chart">병 노드 — ${esc(d.name||'이름 없음')} · 밑그림 <b>${esc(d.from||'—')}</b>`
        + ` · 병기 ${sts[0]}${sts.length>1?`~${sts[sts.length-1]}`:''} · 체력 ${hp}${SC_DIRTY?' <span style="color:var(--blood)">· 저장 안 됨</span>':''}</div>

     <div class="bar">이름과 몸</div>
     <div class="mkgrid">
       <label class="mk">이름<input value="${esc(d.name||'')}" onchange="scSetDis('name',this.value)"></label>
       <label class="mk">시작 병기<input type="number" min="3" max="5" value="${d.stage}" onchange="scSetDis('stage',this.value)"></label>
       <label class="mk">최종 병기<input type="number" min="3" max="5" value="${d.stageMax}" onchange="scSetDis('stageMax',this.value)"></label>
       <label class="mk">체력 0이 안 된다<input type="checkbox" ${d.noDeath?'checked':''} onchange="scSetDis('noDeath',this.checked)"></label>
     </div>
     <div class="bar">체격 · 체력 태그 <span class="right d">체력 ${hp}</span></div>
     <div class="tags">${TAG_LIST().map(x=>`<label><input type="checkbox" ${(d.tags||[]).includes(x)?'checked':''}
        onchange="scTag('${esc(x)}')">${esc(x)} <span class="d">${esc(tagLabel(x))}</span></label>`).join('')}</div>

     <div class="bar">씨앗 자리 <span class="right d">3막에 들어설 때 이미 서 있는 자리</span></div>
     <div class="scline">`
     + (d.seed||[]).map((s,i)=>`<span class="beat">
          <b class="n">${i+1}</b>
          <select onchange="scSeedSet(${i},this.value)">${symOpt(s)}</select>
          <button class="mini" onclick="scSeedDel(${i})" title="뺀다">×</button>
        </span>`).join('')
     + `<button class="mini addb" onclick="scSeedAdd()" title="씨앗 하나 더">+</button></div>`;

  /* ② 병기별 — 수치 · 시계 · 이월 · 활성 부수 ────────────────── */
  h += `<div class="bar">병기별</div>
     <div class="note">수치는 그 병기에 들어설 때 병 노드가 갖는 값이다.
       이월은 앞 병기에서 깎아 둔 몫을 얼마나 들고 가는가 —
       <b>1</b> 이면 깎아 둔 비율이 그대로 유지되고, <b>0</b> 이면 새 수치로 되돌아간다.
       시계는 그 병기가 몇 턴 만에 다음으로 넘어가는가다.</div>`;

  for(const st of sts){
    const roster = (d.syms||{})[st];
    h += `<div class="bar">병기 ${st}${st===+d.stage?' · 시작':''}${st===+d.stageMax?' · 최종':''}</div>
      <div class="mkgrid">
        <label class="mk">병 노드 수치<input type="number" value="${(d.disVal||{})[st] ?? ''}"
               placeholder="${SR.DIS_BASE[SLV(d.from||'아이','dis',st)]}" onchange="scSetDis('disVal.${st}',this.value)"></label>
        <label class="mk">병기 시계<input type="number" min="1" max="30" value="${(d.clock||{})[st] ?? ''}"
               placeholder="${SR.STAGE_TURNS}" onchange="scSetDis('clock.${st}',this.value)"></label>
        <label class="mk">이월 비율<input type="number" min="0" max="1" step="0.1" value="${(d.carry||{})[st] ?? ''}"
               placeholder="${SR.GIMMICK.PRORATE?1:0}" onchange="scSetDis('carry.${st}',this.value)"></label>
      </div>
      <div class="bar">활성 부수 <span class="right d">${roster&&roster.length
          ? '명부대로 — 앞 '+Math.max(1,roster.length-1)+'개가 진입 세트, 나머지는 분화가 채운다'
          : '명부 없음 — 자리 상한('+SR.SPAWN_LV[SLV(d.from||'아이','spots',st)]+')까지 분화가 뿜는다'}</span></div>
      <div class="scline">`
      + (roster||[]).map((s,i)=>`<span class="beat">
            <b class="n">${i+1}</b>
            <select onchange="scSymSet(${st},${i},this.value)">${symOpt(s)}</select>
            <button class="mini" onclick="scSymDel(${st},${i})" title="뺀다">×</button>
          </span>`).join('')
      + `<button class="mini addb" onclick="scSymAdd(${st})" title="자리 하나 더">+</button></div>`;
  }

  /* ③ 항목별 레벨 ──────────────────────────────────────────── */
  const LVITEM = [['band','자리 수치 밴드'],['evo','진화 시계'],['spots','자리 상한'],
                  ['dis','병 노드 수치'],['enh','연결선']];
  h += `<div class="bar">항목별 레벨</div>
     <div class="note">병기 번호가 곧 레벨이다. 항목마다 어긋나게 하고 싶을 때만 적는다 —
       비우면 병기 번호를 그대로 쓴다. 위의 「병 노드 수치」를 직접 적었으면 그쪽이 먼저다.</div>
     <div class="mkgrid">`
    + LVITEM.map(([k,nm])=>`<label class="mk">${nm}<input type="number" min="1" max="5"
         value="${(d.lv||{})[k] ?? ''}" placeholder="병기 번호" onchange="scSetDis('lv.${k}',this.value)"></label>`).join('')
    + `</div>`;

  /* ④ 악보 ─────────────────────────────────────────────────── */
  h += `<div class="bar">악보</div>
     <div class="note">한 턴에 한 비트씩 나아가고, 끝에 닿으면 처음으로 돌아온다.
       병기가 오르면 다시 1번부터다.<br>
       헛도는 비트는 「성장」으로 대신 나간다 — 병이 통째로 노는 턴은 만들지 않는다.</div>`;

  for(const st of sts){
    const L = scLine(st), n = L.length, aim = st === SCORE_AIM;
    const clk = (d.clock||{})[st] || SR.STAGE_TURNS;
    const fit = n === clk ? `시계와 딱 맞는다 — 매 병기가 같은 흐름이다`
      : n < clk ? `시계가 다 돌기 전에 악보가 한 바퀴 돈다 — 앞 ${clk-n}박자가 한 번 더 나온다`
      : `뒤 ${n-clk}박자는 시계가 늘어져야 나온다`;
    h += `<div class="bar">병기 ${st}
        <span class="right">
          <button class="mini" onclick="scAim(${st})"${aim?' disabled':''}>악보 선택</button>
          <button class="mini" onclick="scReset(${st})">기본값으로</button>
        </span></div>
      <div class="scline${aim?' aim':''}">`
      + L.map((b,i)=>`<span class="beat">
            <b class="n">${i+1}</b>
            <select${tip(doc(b))} onchange="scSet(${st},${i},this.value)">${opt(b)}</select>
            <button class="mini" onclick="scMove(${st},${i},-1)" title="앞으로"${i===0?' disabled':''}>◀</button>
            <button class="mini" onclick="scMove(${st},${i},1)" title="뒤로"${i===n-1?' disabled':''}>▶</button>
            <button class="mini" onclick="scDel(${st},${i})" title="뺀다"${n<=1?' disabled':''}>×</button>
          </span>`).join('')
      + `<button class="mini addb" onclick="scAdd(${st})" title="끝에 한 박자 더">+</button></div>
      <div class="scfoot"><span class="note">${n}박자 · 시계 ${clk}턴 · ${fit}</span></div>
      <div class="scflow">${L.map(b=>esc(b)).join(' <span class="d">→</span> ')} <span class="d">↻</span></div>`;
  }

  h += `<div class="bar">쓸 수 있는 패턴 <span class="right d">누르면 병기 ${SCORE_AIM} 악보 끝에 붙는다</span></div>
     <div class="note">이름 위에 손을 올리면 그 박자가 무엇을 하는지 나온다.</div>
     <div class="scpal">`
    + BEAT_LIST.map(b=>{
        const e = BEATDOC[b];
        return `<button class="pal"${tip(doc(b))} onclick="scAdd(${SCORE_AIM},'${esc(b)}')">
            <b>${esc(b)}</b><span class="d">${e?esc(e.label):''}</span></button>`;
      }).join('')
    + `</div>`;

  /* 저장 창 */
  if(SC_SAVE_OPEN){
    const saved = Object.keys(disSaved());
    h += `<div class="scsave">
        <div class="bar">커스텀 병 노드 저장 <span class="right"><button class="mini" onclick="scSaveClose()">닫는다</button></span></div>
        <div class="note">브라우저에 남는다. 저장하면 스토리 탭의 병기 고르개와 만들기 탭에서 고를 수 있다.</div>
        <label class="mk">이름<input id="sc_savename" value="${esc(d.name||'')}"></label>
        <button class="go" onclick="scSaveDo()">이 이름으로 저장</button>`
      + (saved.length ? `<div class="bar">저장해 둔 것</div>` + saved.map(nm=>
          `<div class="scrow"><b>${esc(nm)}</b>
             <span class="right">
               <button class="mini" onclick="scSaveLoad('${esc(nm)}')">불러온다</button>
               <button class="mini" onclick="scSaveDrop('${esc(nm)}')">지운다</button>
             </span></div>`).join('') : '')
      + `</div>`;
  }

  host.innerHTML = h;

  const saved = Object.keys(disSaved());
  $('sc_side').innerHTML =
    `<label>밑그림 병 노드</label>
     <select onchange="scPickFrom(this.value)">${Object.keys(BOSS).filter(k=>!BOSS[k].custom||saved.includes(k)).map(k=>
        `<option ${k===d.from?'selected':''}>${esc(k)}</option>`).join('')}</select>
     <div class="note">고른 병 노드를 통째로 떠 온다. 지금 손댄 것은 사라진다.</div>
     <button onclick="scResetAll()">병 노드 변경</button>
     <button onclick="scSaveOpen()">커스텀 병 노드 저장</button>
     <button onclick="scLeave()">만들기로 간다</button>`;

  $('log').innerHTML = LOG.map(t=>`<div>${t}</div>`).join('');
}

/* 태그 · 씨앗 — 정의의 몸 쪽 칸들 */
function scTag(x){
  const d = CUSTOM.dis;
  d.tags = (d.tags||[]).includes(x) ? d.tags.filter(y=>y!==x) : tagAdd(d.tags||[], x);
  scTouch(); renderScore();
}
function scSeedAdd(){ const d=CUSTOM.dis; d.seed=(d.seed||[]).concat(ALLSYM[0]); scTouch(); renderScore() }
function scSeedSet(i,v){ CUSTOM.dis.seed[i]=v; scTouch(); renderScore() }
function scSeedDel(i){ CUSTOM.dis.seed.splice(i,1); scTouch(); renderScore() }

function scAim(st){ SCORE_AIM = st; renderScore() }

/* 손댄 자국 — 편집하는 자들이 renderScore 를 부르기 전에 이것을 켠다.
   scAim 처럼 보기만 바꾸는 것은 켜지 않는다 */
function scTouch(){ SC_DIRTY = true }
