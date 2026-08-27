/* ══════════════════════════════════════════════════════════════════
   §9.2 설명 등록기 둘
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 툴팁 ═══════════════════════════════════════════════════
   글 위에 마우스를 올리면 옆에 설명이 뜬다. 내용은 등록기(TIPS)에 넣고
   화면에는 열쇠만 심는다 — 따옴표·꺾쇠를 속성 안에 넣지 않기 위해서다.
   등록기는 그릴 때마다 비운다. */
/* 등록기가 둘이다.
   TIPS 는 판을 다시 그릴 때마다 비운다 — 카드·노드처럼 매번 새로 그리는 것들.
   FIXT 는 안 비운다 — 규칙 칸과 자동 진행 규칙처럼 한 번 그려 두고 오래 남는 판.
   전에는 이쪽도 TIPS 를 쓰다가 render() 가 등록기를 비우면서 열쇠가 끊겼다. */
//@ 화면.툴팁 — §9.2 설명 등록기 둘
let TIPS = {}, TIPN = 0;

const FIXT = {};

function tipReset(){ TIPS = {}; TIPN = 0 }

/* 등록만 하고 열쇠를 돌려준다. 속성 문자열이 아니라 열쇠가 필요한 자리
   (setAttribute 로 직접 다는 무대 쪽)가 쓴다 */
function tipKey(html){ if(!html) return ''; const k='t'+(++TIPN); TIPS[k]=html; return k }

function tip(html){ const k = tipKey(html); return k ? ` data-tip="${k}"` : '' }

function tipFixReset(panel){
  for(const k of Object.keys(FIXT)) if(k.startsWith(panel+':')) delete FIXT[k];
  FIXT[panel+':n'] = 0;
}

function tipFix(panel, html){
  if(!html) return '';
  const n = (FIXT[panel+':n'] = (FIXT[panel+':n']||0) + 1);
  const k = panel+':'+n; FIXT[k] = html;
  return ` data-tip="${k}"`;
}

(function(){
  const box = () => document.getElementById('tip');
  document.addEventListener('mouseover', e=>{
    const el = e.target.closest && e.target.closest('[data-tip]');
    const b = box(); if(!b) return;
    const body = el ? (TIPS[el.dataset.tip] ?? FIXT[el.dataset.tip]) : null;
    if(!body){ b.style.display='none'; return }
    b.innerHTML = body;
    b.style.display = 'block';
    const r = el.getBoundingClientRect(), w = b.offsetWidth, h = b.offsetHeight;
    let x = r.right + 12, y = r.top;
    if(x + w > innerWidth - 8) x = Math.max(8, r.left - w - 12);
    if(y + h > innerHeight - 8) y = Math.max(8, innerHeight - h - 8);
    b.style.left = x+'px'; b.style.top = y+'px';
  });
  document.addEventListener('mouseout', e=>{
    const el = e.target.closest && e.target.closest('[data-tip]');
    if(el){ const b=box(); if(b) b.style.display='none' }
  });
  addEventListener('scroll', ()=>{ const b=box(); if(b) b.style.display='none' }, true);
})();

function beatTip(S,n){
  const b = nextBeat(S,n);
  if(b==='고유'){
    const k = `${S.board.boss}:${n.stage}`;
    return UNIQTIP[k] || BEATTIP['고유'];
  }
  return BEATTIP[b] || null;
}

/* ── 방침 ── */
function policyTip(k){
  const P = SR.POLICY[k]; if(!P) return null;
  const dbuf = [];
  if(P.disCut) dbuf.push(`병 노드 수치 <b>−${(P.disCut*100)|0}%</b>`);
  if(P.stageBonus) dbuf.push(`병기 시계 <b>+${P.stageBonus}</b>`);
  if(P.painCut) dbuf.push(`통증 · 호흡곤란 수치 <b>−${(P.painCut*100)|0}%</b>`);
  if(P.dmgUp) dbuf.push(`환자가 받는 피해 <b>+${(P.dmgUp*100)|0}%</b>`);
  const win = {
    '완치':'병 노드를 처치선까지 내려 끊는다.',
    '연명':`활성 부수 증상을 하나도 남기지 않는다. 병 노드는 보지 않는다.`,
    '편하게':'병이 최종 병기의 시계를 다 돌 때까지 환자가 살아 있으면 이긴다.',
  }[k];
  let body = `<b>승리 조건</b><br>${win}<br><br><b>판에 새기는 것</b><br>`
    + (dbuf.length ? dbuf.join(' · ') : '없다')
    + `<br><span class="d">오진이면 병 노드 수치 감소와 통증 완화가 붙지 않는다. 병기 시계 보정은 그대로 붙는다.</span>`;
  if(k==='편하게'){
    body += `<br><br><b>대가</b><br>병을 놔두는 대신 환자가 받는 피해가 <b>50%</b> 늘어난다. 턴 피해와 진화 피해 둘 다에 걸린다.`
          + `<br><br><b>버프</b><br>턴 종료 시 <b>통증 비활성</b> · <b>호흡곤란 비활성</b> · <b>공황 아님</b> 중`
          + ` 충족한 항목 하나마다 이번 턴 환자 피해가 <b>20%</b> 줄어든다.`
          + `<br><span class="d">완화는 방침 배수에서 뺀다. 셋을 모두 채워도 1.5 − 0.6 = <b>0.9</b> 에서 멈춘다 — 벌을 깎을 뿐 뒤집지 못한다.</span>`;
  }
  return TT(k, body);
}

function markKw(text){
  let out = esc(text);
  const slot = [];
  const put = html => { slot.push(html); return `\u0000${slot.length-1}\u0000` };
  /* 사혈은 단수마다 다른 설명을 단다 */
  out = out.replace(/사혈 ?([123])단/g, (m,d)=>put(`<span class="kw"${tip(KWTIP['사혈'+d])}>${m}</span>`));
  out = out.replace(/사혈/g, m=>put(`<span class="kw"${tip(KWTIP['사혈'])}>${m}</span>`));
  for(const k of KWORDS){
    if(!KWTIP[k]) continue;
    out = out.split(k).join(put(`<span class="kw"${tip(KWTIP[k])}>${k}</span>`));
  }
  return out.replace(/\u0000(\d+)\u0000/g, (m,i)=>slot[+i]);
}
