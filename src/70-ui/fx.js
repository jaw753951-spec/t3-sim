/* ══════════════════════════════════════════════════════════════════
   §9.21 연출
   ──────────────────────────────────────────────────────────────────
   무대에서만 도는 층이다. 규칙을 하나도 모른다 — 「무슨 일이 났는가」를
   받아서 눈에 보이게만 한다. 판을 바꾸지 않는다.

   그림 파일은 한 장도 쓰지 않는다. 증기 · 파편 · 광선은 div 에 CSS
   키프레임을 물린 것이고, 계기판 눈금과 바늘은 인라인 SVG 다.

   연출은 줄을 서서 하나씩 나간다 (FXQ). 줄이 도는 동안 판은 잠긴다 —
   손이 끼어들면 이미 지나간 상태 위에 연출이 얹히기 때문이다.
   ══════════════════════════════════════════════════════════════════ */

/* 연출을 켤 것인가. 배치 · 자동 진행은 초당 수백 판을 돌리므로 꺼야 한다.
   끄면 fxq 로 들어온 것을 아예 실행하지 않고 버린다 */
//@ 연출.스위치 — 켬 · 끔 · 줄
let FX_ON = true;
let FX_BUSY = false;
/* 조용한 구간 — 자동 진행처럼 수십 수를 한 번에 돌릴 때 무대를 매 수마다
   다시 그리지 않는다. 끝나고 한 번만 그린다 */
let STAGE_QUIET = false;

/* 한 화면에 동시에 떠 있을 수 있는 파티클 수. 넘으면 새 것을 만들지 않는다.
   자리 여섯이 한꺼번에 터지는 판에서 60fps 를 지키는 선이다 */
const FX_PARTICLE_CAP = 140;
let FX_PARTICLES = 0;

const fxWait = ms => new Promise(r=>setTimeout(r, FX_ON ? ms : 0));

/* 파티클 하나를 붙였다 스스로 걷는다 — 세는 일도 여기서만 한다 */
function fxSpawn(el, cls, css, life){
  if(!el || FX_PARTICLES >= FX_PARTICLE_CAP) return null;
  const d = document.createElement('div');
  d.className = cls; d.style.cssText = css;
  el.appendChild(d); FX_PARTICLES++;
  setTimeout(()=>{ d.remove(); FX_PARTICLES-- }, life);
  return d;
}

/* ── 프리미티브 넷 ──────────────────────────────────────────
   새 연출은 되도록 이 넷을 섞어 만든다. 색과 개수만 바꾸면 대개 된다. */
//@ 연출.프리미티브 — 증기 · 파편 · 광선 · 스윕
const FX = {
  steam(el, n, color){
    for(let i=0;i<n;i++){
      const sz = 6 + Math.random()*10;
      fxSpawn(el, 'sp',
        `width:${sz}px;height:${sz}px;background:${color};`
        + `left:${30+Math.random()*40}%;top:${38+Math.random()*24}%;`
        + `--dx:${((Math.random()-.5)*90)|0}px;--dy:${(-40-Math.random()*70)|0}px;`
        + `animation:spf ${900+Math.random()*600|0}ms ease-out forwards`, 1600);
    }
  },
  shards(el, n, color){
    for(let i=0;i<n;i++){
      const w = 3 + Math.random()*7;
      fxSpawn(el, 'shard',
        `width:${w}px;height:${w*.6}px;left:48%;top:50%;`
        + (color?`background:${color};`:'')
        + `--dx:${((Math.random()-.5)*140)|0}px;--dy:${((Math.random()-.5)*140)|0}px;`
        + `--r:${((Math.random()-.5)*540)|0}deg;`
        + `animation:shf ${420+Math.random()*260|0}ms ease-out forwards`, 760);
    }
  },
  rays(el, n, color){
    for(let i=0;i<n;i++){
      const L = 40 + Math.random()*70;
      fxSpawn(el, 'ray',
        `--L:${L|0}px;transform:rotate(${Math.random()*360|0}deg);`
        + (color?`background:linear-gradient(90deg,${color},transparent);`:'')
        + `animation:ryf ${500+Math.random()*300|0}ms ease-out forwards`, 900);
    }
  },
  /* 문자판을 훑는 빛 한 줄 */
  sweep(el){
    const f = el && el.querySelector('.face'); if(!f) return;
    const s = document.createElement('div'); s.className='sweep';
    s.innerHTML = '<i style="animation:swf 600ms ease-in-out forwards"></i>';
    f.appendChild(s); setTimeout(()=>s.remove(), 700);
  },
  /* 값 하나가 자리 위로 떠오른다 — 억제량 · 성장량 · 지불액 따위 */
  float(el, text, cls){
    const d = fxSpawn(el, 'fnum '+(cls||''),
      `animation:fnf 1100ms ease-out forwards`, 1200);
    if(d) d.textContent = text;
  },
  /* 테두리가 한 번 뛴다 — 게이지가 늘거나 줄 때 */
  pulse(el, color){
    if(!el) return;
    el.style.setProperty('--pulse', color||'var(--t3b)');
    el.classList.add('pls'); setTimeout(()=>el.classList.remove('pls'), 620);
  },
  shake(el){
    if(!el) return;
    el.classList.add('shk'); setTimeout(()=>el.classList.remove('shk'), 340);
  },
};

/* ── 사건 하나짜리 연출 ─────────────────────────────────────
   전부 async 다. 줄이 이것을 하나씩 await 한다. */
//@ 연출.사건 — 판에서 난 일 하나를 눈에 보이게
const FXE = {
  async suppress(n, amt){
    const el = stageEl(n); if(!el) return;
    FX.shards(el, 7); FX.shake(el);
    if(amt) FX.float(el, '−'+amt, 'dn');
    await fxWait(460);
  },
  async stabilize(n, amt){
    const el = stageEl(n); if(!el) return;
    FX.steam(el, 6, 'rgba(122,168,178,.75)');
    if(amt) FX.float(el, '막 +'+amt, 'up');
    await fxWait(420);
  },
  /* 처치선 · 강약 경계를 넘었다 */
  async zone(n, kind){
    const el = stageEl(n); if(!el) return;
    FX.steam(el, 8, kind==='strong' ? 'rgba(158,43,43,.8)' : 'rgba(77,212,200,.7)');
    await fxWait(440);
  },
  async treat(n, kind){
    const el = stageEl(n); if(!el) return;
    FX.steam(el, 9, kind==='strong' ? 'rgba(158,43,43,.8)' : 'rgba(77,212,200,.7)');
    await fxWait(220);
    el.classList.add('gone');
    await fxWait(560);
    /* 다 보여 줬으니 이제 걷는다 — 표를 떼면 다음 맞춤 때 사라진다 */
    delete el.dataset.dying;
    for(const [ix, e] of [...STAGE_ELS]) if(e===el){ e.remove(); STAGE_ELS.delete(ix) }
  },
  async dormant(n){
    const el = stageEl(n); if(!el) return;
    el.classList.add('dorm'); await fxWait(400);
  },
  async revive(n){
    const el = stageEl(n); if(!el) return;
    FX.steam(el, 7, 'rgba(201,164,74,.75)');
    await fxWait(320);
    el.classList.remove('dorm');
    await fxWait(560);
    FX.rays(el, 8);
    await fxWait(280);
  },
  async shieldBreak(n){
    const el = stageEl(n); if(!el) return;
    const g = el.querySelector('.glass'); if(g) g.style.opacity='0';
    FX.shards(el, 14); FX.shake(el);
    await fxWait(640);
  },
  async diagnose(n, round){
    const el = stageEl(n); if(!el) return;
    FX.sweep(el);
    const f = el.querySelector('.face');
    if(f){ f.style.filter='brightness(2.4)'; setTimeout(()=>f.style.filter='brightness(1)', 80) }
    await fxWait(820);
    FX.rays(el, 10);
    if(round) FX.float(el, '진단 '+round+'회', 'up');
    await fxWait(420);
  },
  async demote(n){
    const el = stageEl(n); if(!el) return;
    FX.shards(el, 6, 'rgba(168,80,63,.9)'); FX.shake(el);
    FX.float(el, '반응 강등', 'dn');
    await fxWait(560);
  },
  async evolve(n){
    const el = stageEl(n); if(!el) return;
    const bd = stageBoard(); if(bd) bd.classList.add('dark');
    el.classList.add('evoing');
    el.style.transition = 'transform .9s cubic-bezier(.2,1.4,.4,1)';
    el.style.transform = 'translate(-50%,-50%) scale(1.2)';
    FX.steam(el, 10, 'rgba(150,160,150,.65)');
    await fxWait(400);
    el.style.transform = 'translate(-50%,-50%) scale(1.06)';
    await fxWait(900);
    el.style.transform = 'translate(-50%,-50%) scale(1)';
    if(bd) bd.classList.remove('dark');
    el.classList.remove('evoing');
    await fxWait(280);
  },
  /* 약화 한 스택 — 처치선 눈금이 실제로 위로 밀린다 */
  async weaken(n, add){
    const el = stageEl(n); if(!el) return;
    FX.pulse(el, 'var(--anno)');
    FX.float(el, '약화 +'+add, 'up');
    await fxWait(420);
  },
  /* 설치물 — 놓을 때와 태울 때 */
  async rig(n, amt){
    const el = stageEl(n); if(!el) return;
    FX.pulse(el, '#7AA8B2');
    FX.float(el, '설치 '+amt, 'up');
    await fxWait(400);
  },
  async rigOpen(n, amt){
    const el = stageEl(n); if(!el) return;
    FX.rays(el, 12, 'rgba(122,168,178,.95)'); FX.shake(el);
    FX.float(el, '−'+amt, 'dn');
    await fxWait(620);
  },
  /* 1막 병 노드 — 아무것도 안 통한다 */
  async immune(n){
    const el = stageEl(n); if(!el) return;
    el.classList.add('bounce'); FX.rays(el, 5, 'rgba(180,180,180,.7)');
    setTimeout(()=>el.classList.remove('bounce'), 420);
    await fxWait(440);
  },
  /* 촉발 — 자리에서 자리로 구슬이 건너간다 */
  async trigger(a, b, kind){
    const A = stageEl(a), B = stageEl(b), bd = stageBoard();
    if(!A || !B || !bd) return;
    const ms = kind==='strong' ? 750 : 1000;
    const d = document.createElement('div'); d.className='bead';
    d.style.color = kind==='strong' ? '#c9524a' : '#6fc4b4';
    d.style.left = a.px+'px'; d.style.top = a.py+'px';
    d.style.transition = `left ${ms}ms ease-in-out,top ${ms}ms ease-in-out`;
    bd.appendChild(d);
    await fxWait(30);
    d.style.left = b.px+'px'; d.style.top = b.py+'px';
    await fxWait(ms+10);
    d.remove();
    FX.steam(B, 6, 'rgba(201,164,74,.7)'); FX.shake(B);
    await fxWait(380);
  },
  /* 전이 — 새 자리가 난다 */
  async spawn(from, to){
    const A = stageEl(from), bd = stageBoard();
    if(!A || !bd) return;
    const d = document.createElement('div'); d.className='bead';
    d.style.color = '#C8B79A';
    d.style.left = from.px+'px'; d.style.top = from.py+'px';
    d.style.transition = 'left 800ms cubic-bezier(.3,.1,.3,1),top 800ms cubic-bezier(.3,.1,.3,1)';
    bd.appendChild(d);
    await fxWait(30);
    d.style.left = (to.px||from.px)+'px'; d.style.top = (to.py||from.py)+'px';
    await fxWait(820);
    d.remove();
    await fxWait(120);
  },
  /* 환자 쪽 */
  async patHit(amt){
    const p = $('sg_pat'); if(!p) return;
    p.classList.add('hurt'); setTimeout(()=>p.classList.remove('hurt'), 480);
    if(amt) FX.float(p, '−'+amt, 'dn big');
    await fxWait(320);
  },
  async patPay(amt){
    const p = $('sg_pat'); if(!p) return;
    FX.steam(p, 7, 'rgba(152,48,42,.8)');
    if(amt) FX.float(p, '사혈 −'+amt, 'dn');
    await fxWait(420);
  },
  async mind(step, worse){
    const m = $('sg_mind'); if(!m) return;
    FX.pulse(m, worse ? 'var(--red)' : 'var(--t3b)');
    FX.shake(m);
    await fxWait(360);
  },
  /* 전역 게이지 — 기세 · 관해 · 병기 */
  async gauge(id, text, up){
    const g = $(id); if(!g) return;
    FX.pulse(g, up ? 'var(--t3b)' : 'var(--anno)');
    if(text) FX.float(g, text, up?'up':'dn');
    await fxWait(360);
  },
  async deny(sel){
    const c = document.querySelector(sel); if(!c) return;
    c.classList.add('deny'); setTimeout(()=>c.classList.remove('deny'), 360);
    await fxWait(120);
  },
  async dealHand(){
    const cs = document.querySelectorAll('#sg_hand .card');
    cs.forEach((e,i)=>{ e.classList.add('dealt'); e.style.animationDelay = (i*90)+'ms' });
    await fxWait(440);
  },
  async pause(ms){ await fxWait(ms) },
};

/* ── 줄 ─────────────────────────────────────────────────────
   판은 이미 다 바뀌어 있고, 줄은 그 사이에 무슨 일이 났는지를 순서대로
   보여 준다. 한 조각이 끝날 때마다 계기판을 다시 맞춘다 — 연출 도중에도
   수치가 실제 판을 따라가야 한다. */
//@ 연출.줄 — 하나씩 차례로
const FXQ = [];

function fxq(fn){ if(FX_ON) FXQ.push(fn) }

async function fxFlush(after){
  if(!FX_ON){ FXQ.length = 0; if(after) after(); stageRender(); return }
  FX_BUSY = true; document.body.classList.add('fxbusy');
  while(FXQ.length){
    if(!STAGE_ON){ FXQ.length = 0; break }   // 한창일 때 나갔다 — 남은 줄은 버린다
    const f = FXQ.shift();
    try{ await f() }catch(e){ /* 연출이 깨져도 판은 이미 옳다 */ }
    stageSync();
  }
  FX_BUSY = false; document.body.classList.remove('fxbusy');
  if(after) after();
  stageRender();
}

/* 연출 없이 한 번에 — 되돌리기 · 자동 진행이 쓴다 */
function fxSilent(fn){
  const was = FX_ON, wasQ = STAGE_QUIET;
  FX_ON = false; STAGE_QUIET = true;
  try{ fn() } finally { FX_ON = was; STAGE_QUIET = wasQ; FXQ.length = 0 }
}
