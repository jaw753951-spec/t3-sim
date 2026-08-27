/* ══════════════════════════════════════════════════════════════════
   §9.15 배치 · §9.9 차트
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 차트 내보내기 ═══════════════════════════════════════════ */
//@ 화면.차트 — §9.9 배치 결과를 글로 뽑는다
function exportChart(){
  const L = [];
  L.push(`INTERN 전투 시뮬레이터 ${VERSION} — 차트`);
  L.push(`뽑은 때 ${new Date().toISOString().slice(0,19).replace('T',' ')}`);
  L.push(`모드 ${MODE} · 시드 ${$('seed').value}`);
  L.push(`규칙 덮어쓰기 ${OVR_KEYS.length ? OVR_KEYS.join(' · ') : '없음 (권위본)'}`);
  if(BOARD){
    const nm = BOARD.script ? BOARD.script.name : (BOARD.boss || ('레벨 '+BOARD.level));
    L.push(`환자 ${nm} · 체력 ${S?S.hp:'-'}/${BOARD.hpMax} · S ${(BOARD.S||0).toFixed(1)} · 태그 ${(BOARD.tags||[]).join(',')||'없음'}`);
  }
  if(S){
    L.push(`턴 ${S.turn} · 정신 ${S.mind} · 낸 카드 누계 ${S.acts||0} · 셔플 ${S.shuffles||0}`);
    L.push(`덱 ${(MODE==='story'?STORY_DECK:(SESS&&SESS.deck)||ONE_DECK).join(' / ')}`);
    L.push(`기세 ${S.rush}/${R.RUSH_MAX} · 관해 ${S.rem?`${S.remTurns}턴째 · 관해도 ${S.remGauge}/${R.REM_MAX}`:'없음'}`
      + ` · 이번 턴 사혈 ${Math.round((S.bledRate||0)*100)}%`);
    L.push('');
    L.push('— 자리 —');
    for(const n of S.nodes) L.push(`  ${n.dead?'[뽑음] ':''}${n.sym}${n.role==='disease'?`(병기 ${n.stage}/${n.stageMax} · 시계 ${n.stageClock})`:''} ${n.val}/${n.init}`
      + ` · 처치선 ${killLine(S,n)}${n.shielded?` · 막 ${Math.floor(n.stabAcc)}/${R.SHIELD_MAX}`:''}`
      + `${n.weak?` · 약화 ${n.weak}`:''}${n.rig?` · 설치물 ${n.rig}/${n.rigCap||n.rig}${n.rigLock?'(잠김)':''}`:''}`
      + `${n.delayed?` · 지연 ${n.delayed}`:''}${n.diagRound?` · 진단 ${n.diagRound}회`:''}${n.evolved?' · 진화함':''}`);
  }
  if(SESS){
    L.push(''); L.push('— 세션 —');
    L.push(`${SESS.def.name} · 라운드 ${SESS.round+1}/${SESS.def.rounds.length} · 남은 예산 ${SESS.budget}턴 · 쓴 턴 ${SESS.used}`);
    for(const r of SESS.results) L.push(`  ${SCRIPT[r.id]?SCRIPT[r.id].name:r.id} → ${r.out} (${r.turns}턴)`);
  }
  L.push(''); L.push('— 기록 —');
  for(const t of LOG.slice().reverse()) L.push('  '+t.replace(/<[^>]+>/g,''));
  const blob = new Blob([L.join('\n')], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `intern_chart_${MODE}_${$('seed').value}.txt`;
  a.click(); URL.revokeObjectURL(a.href);
}

/* ═══ 배치 ═══════════════════════════════════════════════════ */
//@ 화면.배치 — §9.15 여러 판을 한꺼번에 돌린다
let LASTB = {};

const tick = () => new Promise(r=>setTimeout(r,0));

function prog(p){ const b=$('bprog'); b.style.display = p<1?'block':'none'; b.firstElementChild.style.width=(p*100).toFixed(0)+'%' }

function delta(key, field, cur, fmt){
  const prev = LASTB[key] && LASTB[key][field];
  const now = fmt ? fmt(cur) : cur;
  if(prev===undefined || prev===null) return now;
  const d = cur - prev;
  if(Math.abs(d) < 1e-9) return `${now} <span class="d">=</span>`;
  return `${now} <span class="${d>0?'up':'dn'}">${d>0?'▲':'▼'}${fmt?fmt(Math.abs(d)):Math.abs(d).toFixed(1)}</span>`;
}

function stash(key, obj){ LASTB[key]=obj }

function batchDeck(){
  const v=$('bdeck').value;
  return v==='cur' ? ONE_DECK : (PRESETS[{d1:'1일차 8종',d2:'2일차 8종',surg:'외과',med:'내과',eng:'의공학'}[v]] || DECK_D2);
}

async function batch(){
  const n=+$('bn').value, deck=batchDeck(), src=$('bsrc').value, ai=$('bai').value;
  const rows = src==='levels' ? [1,2,3,4,5] : Object.keys(SCRIPT).filter(k=>SCRIPT[k].day<=3);
  const out=[]; let done=0; const total=rows.length*n;
  for(const key of rows){
    const t=[]; let d=0,c=0,sh=0,ac=0; const tally={};
    for(let i=0;i<n;i++){
      const b = src==='levels' ? makeBoard(key, mulberry32(20000+i)) : makePatient(key, 60000+i);
      if(!b) continue;
      const r=runDeck(b,deck,30000+i,{ai});
      tally[r.out]=(tally[r.out]||0)+1;
      if(r.out==='사망') d++; else t.push(r.turns);
      if(r.out==='완치') c++;
      sh+=r.S.shuffles||0; ac+=r.S.acts||0;
      if(++done % 40 === 0){ prog(done/total); await tick() }
    }
    out.push({key, t:med(t), d:d/n, c:c/n, sh:sh/n, ac:ac/n, tally});
  }
  prog(1);
  $('bout').innerHTML = `<div class="chart">단판 · ${ai==='H'?'휴리스틱':'빔 탐색'} · 표본 ${n} · 덱 ${deck.length}장${ovrNote()}</div>`
    +`<table><tr><th>${src==='levels'?'레벨':'환자'}</th><th>중앙 턴</th><th>사망</th><th>완치</th><th>셔플</th><th>조작</th><th>결과 분포</th></tr>`
    +out.map(r=>{
      const k=`one:${src}:${r.key}`;
      const html=`<tr><td>${src==='levels'?'Lv'+r.key:r.key+' <span class="d">'+(SCRIPT[r.key]?SCRIPT[r.key].name.slice(0,16):'')+'</span>'}</td>`
        +`<td>${delta(k,'t',+r.t||0,v=>v.toFixed(0))}</td>`
        +`<td class="${r.d>0.2?'bad':''}">${delta(k,'d',r.d,v=>(v*100).toFixed(0)+'%')}</td>`
        +`<td>${delta(k,'c',r.c,v=>(v*100).toFixed(0)+'%')}</td>`
        +`<td>${r.sh.toFixed(1)}</td><td>${r.ac.toFixed(0)}</td>`
        +`<td class="d">${Object.entries(r.tally).map(([kk,v])=>`${kk} ${(v/n*100).toFixed(0)}%`).join(' · ')}</td></tr>`;
      stash(k,{t:+r.t||0, d:r.d, c:r.c});
      return html;
    }).join('')+'</table>';
  $('bnote').textContent = '앞선 실행과의 차이를 ▲▼ 로 같이 찍는다.';
}

async function batchSession(){
  const n=+$('bn').value, B=+$('bbudget').value, ai=$('bai').value, rows=[];
  let done=0; const keys=Object.keys(SESSIONS); const total=keys.length*n;
  for(const sk of keys){
    const sess=SESSIONS[sk];
    const tally={}; let unseen=0, used=0;
    /* 옛 판본과 견줄 수 있게 같은 대응을 쓴다 — d1→1일차 8종, d2 계열→2일차 8종, 왕진→가방 앞 8장 */
    const deck = sess.pool==='d1' ? DECK_D1 : sess.pool==='d2' ? DECK_D2 : POOL.d3.slice(0, sess.cap);
    for(let i=0;i<n;i++){
      const s=runSession(sess.list, deck, B||sessBudget(sess), 80000+i*13, {ai});
      used+=s.used;
      for(const r of s.rows){ tally[r.out]=(tally[r.out]||0)+1; if(r.auto) unseen++ }
      if(++done % 20 === 0){ prog(done/total); await tick() }
    }
    const tot=n*sess.list.length, k=`sess:${sk}`;
    const cells=TIER.map(t=>{ const v=(tally[t]||0)/tot; const c=delta(k,t,v,x=>(x*100).toFixed(0)+'%'); return `<td>${c}</td>` }).join('');
    stash(k, Object.fromEntries(TIER.map(t=>[t,(tally[t]||0)/tot])));
    rows.push(`<tr><td>${sess.name}</td><td>${B||sessBudget(sess)}턴</td>${cells}<td>${(unseen/n).toFixed(1)}명</td><td>${(used/n).toFixed(1)}턴</td><td class="d">${deck.length}장</td></tr>`);
  }
  prog(1);
  $('bout').innerHTML=`<div class="chart">외래 세션 · 예산 기준 ${BUDGET_SRC==='memo'?'메모(실측)':'대본'} · ${ai==='H'?'휴리스틱':'빔 탐색'}${ovrNote()}</div>`
    +`<table><tr><th>세션</th><th>예산</th>`+TIER.map(t=>`<th>${t}</th>`).join('')
    +`<th>못 본 환자</th><th>소모</th><th>덱</th></tr>`+rows.join('')+'</table>';
}

async function batchStory(){
  const n=+$('bn').value, ai=$('bai').value, rows=[];
  let done=0; const total=Object.keys(BOSS).length*3*n;
  for(const key of Object.keys(BOSS)) for(const pol of ['완치','연명','편하게']){
    if(!BOSS[key].policy[pol]){ rows.push(`<tr><td>${key}</td><td>${pol}</td><td class="d">이 판에 없는 방침</td><td></td><td></td></tr>`); continue }
    const tally={}, t=[]; let ok=0;
    for(let i=0;i<n;i++){
      const r=runStory(key,STORY_DECK,90000+i,pol,{ai});
      tally[r.out]=(tally[r.out]||0)+1; t.push(r.turns);
      if(r.out===({완치:'완치',연명:'연명',편하게:'호전'})[pol]) ok++;
      if(++done % 10 === 0){ prog(done/total); await tick() }
    }
    const k=`story:${key}:${pol}`;
    rows.push(`<tr><td>${key}</td><td>${pol}</td><td>${med(t)}턴</td><td>${delta(k,'ok',ok/n,v=>(v*100).toFixed(0)+'%')}</td>`
      +`<td class="d">${Object.entries(tally).map(([kk,v])=>`${kk} ${(v/n*100).toFixed(0)}%`).join(' · ')}</td></tr>`);
    stash(k,{ok:ok/n});
  }
  prog(1);
  $('bout').innerHTML=`<div class="chart">스토리 방침 · 가방 ${STORY_DECK.length}장 · ${ai==='H'?'휴리스틱':'빔 탐색'}${ovrNote()}</div>`
    +`<table><tr><th>보스</th><th>방침</th><th>중앙</th><th>방침 달성</th><th>결과</th></tr>`+rows.join('')+'</table>';
  $('bnote').textContent = '「방침 달성」 = 그 방침의 승리 조건에 닿은 비율. 수동 화면도 같은 판정을 쓴다.';
}
