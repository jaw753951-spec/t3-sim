/* ══════════════════════════════════════════════════════════════════
   §9.21 악보 짜기
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 악보 ═══════════════════════════════════════════════════
   병이 매 턴 무엇을 하는가. 병기마다 악보가 하나 있고, 한 턴에 한 비트씩
   나아가다 끝에 닿으면 처음으로 돌아온다. 병기가 오르면 다시 1번부터다.

   여기서 짠 악보는 CUSTOM.score 에 얹히고 buildCustom 이 board.score 로
   판에 싣는다. 판에 악보가 실려 있으면 scoreOf(30-core/story.js)가 그것을
   먼저 보므로, 고른 병 노드의 악보는 밑그림 노릇만 한다.

   고를 수 있는 이름은 BEAT_LIST 가, 그 뜻풀이는 BEATDOC(60-text)가 쥔다 —
   여기에 목록을 또 적지 않는다. 두 벌로 적으면 언젠가 갈라진다. */
//@ 화면.악보 — §9.21 병 노드 악보 짜기

/* 지금 손대는 병기. 패턴 서랍이 여기 끝에 붙인다 */
let SCORE_AIM = null;
/* 악보 하나에 둘 수 있는 비트 수. 시계보다 길어도 되지만 끝이 없으면 표가 무너진다 */
const SCORE_MAX = 16;

/* 편집할 병기 — 시작 병기부터 최대 병기까지. 손으로 뒤집어 적어도 견딘다 */
function scStages(){
  const d = CUSTOM.dis; if(!d) return [];
  const a = Math.max(3, Math.min(5, +d.stage    || 3));
  const b = Math.max(3, Math.min(5, +d.stageMax || a));
  const out = [];
  for(let s = Math.min(a,b); s <= Math.max(a,b); s++) out.push(s);
  return out;
}

/* 밑그림 — 고른 병 노드가 그 병기에 쓰는 악보.
   scoreOf 의 폴백과 같은 차례로 찾는다. 둘이 갈리면 화면이 거짓말을 한다 */
function scBase(st){
  const b = BOSS[CUSTOM.dis.boss];
  return (b.beats[st] || b.beats[b.stage0] || ['분화','고유']).slice();
}

/* 그 병기의 악보. 아직 손대지 않았으면 밑그림을 그대로 깐다 —
   「기본값은 고른 병 노드의 악보」가 여기 한 줄이다 */
function scLine(st){
  if(!CUSTOM.dis) return [];
  if(!CUSTOM.score) CUSTOM.score = {};
  if(!CUSTOM.score[st] || !CUSTOM.score[st].length){
    CUSTOM.score[st] = scBase(st);
    if(!CUSTOM.scoreFrom) CUSTOM.scoreFrom = CUSTOM.dis.boss;
  }
  return CUSTOM.score[st];
}

function scSet(st, i, v){ scLine(st)[i] = v; SCORE_AIM = st; renderScore() }

/* 앞뒤로 민다. 끝에서 밀면 반대편으로 돈다 — 악보는 돌아가는 것이라 그 결이 맞다 */
function scMove(st, i, d){
  const L = scLine(st), j = (i + d + L.length) % L.length;
  const x = L[i]; L[i] = L[j]; L[j] = x;
  SCORE_AIM = st; renderScore();
}

function scDel(st, i){
  const L = scLine(st);
  if(L.length <= 1) return;              // 빈 악보는 둘 수 없다 — 병이 할 일이 없어진다
  L.splice(i, 1); SCORE_AIM = st; renderScore();
}

function scAdd(st, beat){ scLine(st).push(beat || '성장'); SCORE_AIM = st; renderScore() }

/* 길이를 맞춘다. 늘릴 때는 앞에서부터 되풀이해 채운다 */
function scLen(st, n){
  n = Math.max(1, Math.min(SCORE_MAX, Math.floor(+n) || 1));
  const L = scLine(st), base = L.length;
  while(L.length > n) L.pop();
  while(L.length < n) L.push(L[L.length % base]);
  SCORE_AIM = st; renderScore();
}

function scReset(st){ CUSTOM.score[st] = scBase(st); SCORE_AIM = st; renderScore() }

function scResetAll(){
  CUSTOM.score = {};
  CUSTOM.scoreFrom = CUSTOM.dis ? CUSTOM.dis.boss : null;
  renderScore();
}

/* 만들기 쪽 병 노드 손잡이를 여기서도 돌린다 — 탭을 오갈 일을 줄인다 */
function scSetDis(k, v){ mkSet('dis.'+k, v); renderScore() }

function scOn(){ if(!CUSTOM.dis) mkToggleDis(); renderScore() }

/* ── 그리기 ── */
function renderScore(){
  tipReset();
  const host = $('sc_body');
  if(!host) return;

  if(!CUSTOM.dis){
    host.innerHTML =
      `<div class="chart">악보 — 병 노드가 없다</div>
       <div class="note">악보는 병 노드가 매 턴 무엇을 하는가다. 병 노드를 켜야 짤 것이 생긴다.<br>
         「만들기」의 병 노드를 켜거나, 아래 단추로 바로 켠다.</div>
       <button onclick="scOn()">병 노드를 켠다</button>`;
    $('sc_side').innerHTML = '';
    $('log').innerHTML = LOG.map(t=>`<div>${t}</div>`).join('');
    return;
  }

  const d = CUSTOM.dis, sts = scStages();
  if(SCORE_AIM === null || !sts.includes(SCORE_AIM)) SCORE_AIM = sts[0];

  /* 밑그림을 뜬 뒤에 병 노드를 갈아 끼웠는가 — 손댄 악보를 말없이 지우지 않는다 */
  const drift = CUSTOM.scoreFrom && CUSTOM.scoreFrom !== d.boss;

  const opt = (b, cur) => BEAT_LIST.map(x =>
    `<option value="${esc(x)}" ${x===cur?'selected':''}>${esc(x)}</option>`).join('');
  const doc = b => {
    const e = BEATDOC[b];
    return e ? TT(b + ' · ' + e.label, e.why()) : TT(b, '설명이 아직 없는 박자다.');
  };

  let h = `<div class="chart">악보 — ${esc(CUSTOM.name)} · 밑그림 <b>${esc(d.boss)}</b>`
        + ` · 병기 ${sts[0]}${sts.length>1?`~${sts[sts.length-1]}`:''}</div>
     <div class="note">한 턴에 한 비트씩 나아가고, 끝에 닿으면 처음으로 돌아온다.
       병기가 오르면 다시 1번부터다. 병기 시계는 ${SR.STAGE_TURNS}턴.<br>
       헛도는 비트는 「성장」으로 대신 나간다 — 병이 통째로 노는 턴은 만들지 않는다.</div>`;

  if(drift) h += `<div class="note" style="color:var(--alarm)">
      밑그림은 <b>${esc(CUSTOM.scoreFrom)}</b> 의 악보인데 지금 고른 병 노드는 <b>${esc(d.boss)}</b> 다.
      「고유」는 <b>${esc(d.boss)}</b> 의 한 수로 나간다.
      <button class="mini" onclick="scResetAll()">${esc(d.boss)} 의 악보로 다시 깐다</button></div>`;

  for(const st of sts){
    const L = scLine(st), n = L.length, aim = st === SCORE_AIM;
    const fit = n === SR.STAGE_TURNS ? `시계와 딱 맞는다 — 매 병기가 같은 흐름이다`
      : n < SR.STAGE_TURNS ? `시계가 다 돌기 전에 악보가 한 바퀴 돈다 — 앞 ${SR.STAGE_TURNS-n}박자가 한 번 더 나온다`
      : `뒤 ${n-SR.STAGE_TURNS}박자는 시계가 늘어져야 나온다`;
    h += `<div class="bar">병기 ${st}${st===+d.stage?' · 시작':''}${st===+d.stageMax?' · 최종':''}
        <span class="right">
          <button class="mini" onclick="scAim(${st})"${aim?' disabled':''}>여기에 붙인다</button>
          <button class="mini" onclick="scReset(${st})">밑그림으로</button>
        </span></div>
      <div class="scline${aim?' aim':''}">`
      + L.map((b,i)=>`<span class="beat">
            <b class="n">${i+1}</b>
            <select${tip(doc(b))} onchange="scSet(${st},${i},this.value)">${opt(b,b)}</select>
            <button class="mini" onclick="scMove(${st},${i},-1)" title="앞으로">◀</button>
            <button class="mini" onclick="scMove(${st},${i},1)" title="뒤로">▶</button>
            <button class="mini" onclick="scDel(${st},${i})" title="뺀다"${n<=1?' disabled':''}>×</button>
          </span>`).join('')
      + `<button class="mini addb" onclick="scAdd(${st})" title="끝에 한 박자 더">+</button></div>
      <div class="scfoot">
        <label class="mk">길이<input type="number" min="1" max="${SCORE_MAX}" value="${n}"
               onchange="scLen(${st},this.value)"></label>
        <span class="note">${n}박자 · ${fit}</span>
      </div>
      <div class="scflow">${L.map(b=>esc(b)).join(' <span class="d">→</span> ')} <span class="d">↻</span></div>`;
  }

  h += `<div class="bar">쓸 수 있는 패턴 <span class="right d">누르면 병기 ${SCORE_AIM} 끝에 붙는다</span></div>
     <div class="note">이름 위에 손을 올리면 그 박자가 무엇을 하는지 나온다.</div>
     <div class="scpal">`
    + BEAT_LIST.map(b=>{
        const e = BEATDOC[b];
        return `<button class="pal"${tip(doc(b))} onclick="scAdd(${SCORE_AIM},'${esc(b)}')">
            <b>${esc(b)}</b><span class="d">${e?esc(e.label):''}</span></button>`;
      }).join('')
    + `</div>`;

  host.innerHTML = h;

  $('sc_side').innerHTML =
    `<label>밑그림 병 노드</label>
     <select onchange="scSetDis('boss',this.value)">${Object.keys(BOSS).map(k=>
        `<option ${k===d.boss?'selected':''}>${esc(k)}</option>`).join('')}</select>
     <div class="note">「고유」가 어느 병의 한 수로 나갈지도 이 값이 정한다.</div>
     <button onclick="scResetAll()">밑그림 악보로 전부 되돌린다</button>
     <label>병기</label>
     <div class="row2">
       <input type="number" min="3" max="5" value="${d.stage}" onchange="scSetDis('stage',this.value)">
       <input type="number" min="3" max="5" value="${d.stageMax}" onchange="scSetDis('stageMax',this.value)">
     </div>
     <div class="note">시작 병기 · 최종 병기</div>
     <button onclick="setMode('make')">만들기로 간다</button>`;

  $('log').innerHTML = LOG.map(t=>`<div>${t}</div>`).join('');
}

function scAim(st){ SCORE_AIM = st; renderScore() }
