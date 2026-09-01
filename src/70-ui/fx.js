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

/* 연출 배속. 연출은 줄을 서서 하나씩 나가므로 기다림이 그대로 더해진다 —
   자리 다섯 판을 재 보니 턴 종료 정산이 평균 2519ms, 많을 때 6932ms(연출 8개)로
   연출 하나당 850ms 였다. 손이 잠긴 채로 7초를 보는 것은 못 쓸 물건이다.

   낱낱을 손보지 않고 여기 하나로 줄인다. 서로의 박자를 맞춰 고른 값들이라
   따로 깎으면 그 균형이 깨진다 — 0.5 는 그 균형을 그대로 둔 채 전부 반으로
   줄인다. 이보다 더 줄이면(0.35 언저리) 억제·안정화가 눈에 안 걸리고 지나간다.

   JS 안에서 못 박은 지속(transform 전이 · 클래스 떼는 setTimeout)도 같은
   배속을 타야 한다. 안 그러면 기다림만 먼저 끝나 다음 연출이 앞의 것을
   덮어쓴다 — fxDur() 를 거치게 한 까닭이다. */
//@ 연출.배속 — 기다림을 한 곳에서 줄인다
const FX_RATE = 0.5;
const fxDur = ms => Math.round(ms * FX_RATE);
const fxWait = ms => new Promise(r=>setTimeout(r, FX_ON ? fxDur(ms) : 0));

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
    f.appendChild(s); setTimeout(()=>s.remove(), fxDur(700));
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
    el.classList.add('pls'); setTimeout(()=>el.classList.remove('pls'), fxDur(620));
  },
  shake(el){
    if(!el) return;
    el.classList.add('shk'); setTimeout(()=>el.classList.remove('shk'), fxDur(340));
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
    if(f){ f.style.filter='brightness(2.4)'; setTimeout(()=>f.style.filter='brightness(1)', fxDur(80)) }
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
  /* 900+400+280 이었다. 같은 턴에 둘이 진화하면 그것만 1580ms 였고, 그동안
     판이 어두워졌다 밝아졌다를 두 번 했다. 어둠을 세게 바꾼 뒤로는 둘이
     한꺼번에 나므로 길이를 줄여도 「무거운 사건」으로 읽힌다 */
  async evolve(n){
    const el = stageEl(n); if(!el) return;
    fxDarkOn();
    el.classList.add('evoing');
    el.style.transition = `transform ${fxDur(520)}ms cubic-bezier(.2,1.4,.4,1)`;
    el.style.transform = 'translate(-50%,-50%) scale(1.2)';
    FX.steam(el, 10, 'rgba(150,160,150,.65)');
    await fxWait(300);
    el.style.transform = 'translate(-50%,-50%) scale(1.06)';
    await fxWait(520);
    el.style.transform = 'translate(-50%,-50%) scale(1)';
    fxDarkOff();
    el.classList.remove('evoing');
    await fxWait(180);
  },
  /* 병기 한 칸 — 진화보다 무거운 소식이라 판을 어둡게 깔고 계기만 남긴다 */
  async stageUp(n, stage){
    const el = stageEl(n); if(!el) return;
    fxDarkOn();
    el.classList.add('stgup');
    FX.shake(el);
    FX.steam(el, 12, 'rgba(201,164,74,.7)');
    FX.float(el, '병기 '+stage, 'dn big');
    await fxWait(580);
    FX.shards(el, 8, 'rgba(201,164,74,.9)');
    await fxWait(520);
    el.classList.remove('stgup');
    fxDarkOff();
    await fxWait(160);
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
    setTimeout(()=>el.classList.remove('bounce'), fxDur(420));
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
    d.style.transition = `left ${fxDur(ms)}ms ease-in-out,top ${fxDur(ms)}ms ease-in-out`;
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
    d.style.transition = `left ${fxDur(800)}ms cubic-bezier(.3,.1,.3,1),top ${fxDur(800)}ms cubic-bezier(.3,.1,.3,1)`;
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
    p.classList.add('hurt'); setTimeout(()=>p.classList.remove('hurt'), fxDur(480));
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
    /* 칸 이름으로도, 그 칸으로도 부를 수 있다 — 병기는 병 노드 계기 위에 떠야
       하는데 그 계기에는 id 가 없다 (자리 번호로 세는 물건이다) */
    const g = (typeof id === 'string') ? $(id) : id; if(!g) return;
    FX.pulse(g, up ? 'var(--t3b)' : 'var(--anno)');
    if(text) FX.float(g, text, up?'up':'dn');
    await fxWait(360);
  },
  async deny(sel){
    const c = document.querySelector(sel); if(!c) return;
    c.classList.add('deny'); setTimeout(()=>c.classList.remove('deny'), fxDur(360));
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

/* 줄에 넣을 때 「무엇을 건드리는가」를 같이 적는다. 자리 번호 · 'pat' · 'hand'
   같은 이름표다. 안 적으면(null) 판 전체를 건드리는 것으로 보고 혼자 나간다 */
function fxq(fn, keys){ if(FX_ON) FXQ.push({fn, keys: keys || null}) }

/* 한 번에 몇 개까지 겹쳐 낼 것인가. 넷을 넘기면 어느 자리에서 무슨 일이
   났는지 눈이 못 따라간다 — 빠른 것과 안 보이는 것은 다르다 */
const FX_BATCH = 4;

/* 판을 어둡게 까는 연출(진화 · 병기)이 둘 이상 겹쳐 날 수 있다. 각자
   add/remove 하면 먼저 끝난 쪽이 아직 도는 쪽의 어둠을 걷어 간다 — 세어서
   마지막 하나가 끝날 때만 걷는다. 이 셈이 있어야 진화 둘을 한꺼번에 낼 수 있고,
   그래야 자리마다 판이 어두워졌다 밝아졌다를 되풀이하지 않는다 */
let FX_DARK = 0;
function fxDarkOn(){ const bd = stageBoard(); if(bd && FX_DARK++===0) bd.classList.add('dark') }
function fxDarkOff(){ const bd = stageBoard(); if(bd && --FX_DARK<=0){ FX_DARK=0; bd.classList.remove('dark') } }

/* ── 줄 흘리기 ──────────────────────────────────────────────────
   연출은 오래 한 줄로만 나갔다. 그런데 기다림이 그대로 더해져서, 자리 다섯
   판의 턴 종료가 연출 8개일 때 6932ms 였다 (배속 0.5 를 먹인 뒤에도 3516ms).
   손이 잠긴 채로 그만큼 보고 있어야 한다.

   차례를 지켜야 하는 것은 **같은 자리를 건드리는 것끼리**다. 서로 다른 자리에
   나는 일은 실제로도 같은 턴에 한꺼번에 나므로 줄을 세울 까닭이 없다.
   그래서 이름표가 겹치지 않는 것끼리 앞에서부터 묶어 한꺼번에 낸다.

   묶는 것은 **연달아 붙어 있는 것끼리만**이다. 건너뛰어 묶으면 촉발 → 전이
   처럼 커널이 적어 준 차례가 흐트러진다. 이름표가 없는 것(진화 · 병기처럼
   판을 통째로 어둡게 까는 것)은 앞뒤로 아무것도 안 묶고 혼자 나간다. */
async function fxFlush(after){
  if(!FX_ON){ FXQ.length = 0; if(after) after(); stageRender(); return }
  FX_BUSY = true; document.body.classList.add('fxbusy');
  while(FXQ.length){
    if(!STAGE_ON){ FXQ.length = 0; break }   // 한창일 때 나갔다 — 남은 줄은 버린다
    const batch = [FXQ.shift()];
    if(batch[0].keys){
      const used = new Set(batch[0].keys);
      while(FXQ.length && FXQ[0].keys && batch.length < FX_BATCH
            && FXQ[0].keys.every(k=>!used.has(k))){
        const it = FXQ.shift();
        for(const k of it.keys) used.add(k);
        batch.push(it);
      }
    }
    /* 하나가 깨져도 나머지는 끝까지 간다 — 판은 이미 옳다 */
    await Promise.all(batch.map(b=>{ try{ return Promise.resolve(b.fn()).catch(()=>{}) }
                                     catch(e){ return Promise.resolve() } }));
    stageSync();
  }
  FX_BUSY = false; document.body.classList.remove('fxbusy');
  if(after) after();
  stageRender();
}

/* 연출 없이 한 번에 — 되돌리기 · 자동 진행이 쓴다.
   도는 동안은 무대를 안 그리고, 끝나고 딱 한 번 그린다. 그리는 일을 여기서
   맡는 이유는 부르는 쪽이 잊으면 무대가 옛 판을 그대로 이고 있기 때문이다 */
function fxSilent(fn){
  const was = FX_ON, wasQ = STAGE_QUIET;
  FX_ON = false; STAGE_QUIET = true;
  try{ fn() } finally { FX_ON = was; STAGE_QUIET = wasQ; FXQ.length = 0 }
  stageRender();
}
