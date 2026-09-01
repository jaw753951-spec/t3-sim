const fs=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
const base=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers';
const exe=fs.readdirSync(base).filter(d=>d.startsWith('chromium')&&!d.includes('headless'))
  .map(d=>path.join(base,d,'chrome-linux','chrome')).find(p=>fs.existsSync(p));
(async()=>{
 const b=await chromium.launch({executablePath:exe,args:['--no-sandbox']});
 const pg=await b.newPage({viewport:{width:1920,height:1080}});
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('file://'+path.resolve('intern_sim.html'));
 await pg.waitForTimeout(300);
 const out=await pg.evaluate(()=>{
  const r={badge:{미진단:0,진단후:0,진화함:0}, warn:0, evoCls:0, ring:0, beat:0, stg:new Set(), turns:0, bad:[]};
  const snap=()=>{
    eval("stageSync()");
    for(const n of eval("alive(S)")){
      const el=eval("stageEl")(n); if(!el) continue;
      const pies=[...el.querySelectorAll('.atts g')].length;
      const hasQ = el.querySelector('.atts')?.innerHTML.includes('>?<');
      if(n.role!=='disease'){
        if(hasQ) r.bad.push(`물음표 배지가 남았다 (${n.sym})`);
        if(n.evolved) r.badge.진화함++;
        else if(n.revealed) r.badge.진단후++;
        else r.badge.미진단++;
        if(!n.evolved && n.revealed && n.evoLeft<=1 && !el.classList.contains('warn'))
          r.bad.push(`진화 직전인데 안 떤다 (${n.sym})`);
        if(el.classList.contains('warn')) r.warn++;
        if(n.evolved && !el.classList.contains('evo')) r.bad.push(`진화했는데 겉이 그대로 (${n.sym})`);
        if(n.evolved) r.evoCls++;
      } else {
        const h=el.querySelector('.atts').innerHTML;
        if(h.includes('#C9A44A')) r.ring++;
        if(el.dataset.stg) r.stg.add(el.dataset.stg);
        if(h.split('<circle').length>1) r.beat++;
      }
    }
    r.turns++;
  };
  const run=(setup,T)=>{ setup(); for(let t=0;t<T;t++){ if(!eval("alive(S).length")) break;
    snap(); eval("aiTurn(S); endTurnHand(S); turnResolve(S); S.turn++") } };
  for(const boss of ['아이','어부','송이'])
    run(()=>{ setMode('story'); document.getElementById('boss').value=boss;
      document.getElementById('sk_pol').value='연명'; document.getElementById('sk_evid').value='4';
      newStory(); eval("stageOpen()") }, 22);
  run(()=>{ setMode('one'); document.getElementById('lv').value='5';
    document.getElementById('seed').value='42'; newGame(); eval("stageOpen()") }, 16);
  r.stg=[...r.stg].sort();
  return r;
 });
 console.log(JSON.stringify(out,null,1));
 console.log('오류', errs.length, errs.slice(0,3));
 await b.close();
})();
