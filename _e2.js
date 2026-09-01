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
 console.log(await pg.evaluate(()=>{
  const L=[];
  setMode('story'); document.getElementById('boss').value='아이';
  document.getElementById('sk_pol').value='연명'; document.getElementById('sk_evid').value='4';
  newStory(); eval("stageOpen()");
  const sym = eval("alive(S)").find(n=>n.role!=='disease');
  const dis = eval("alive(S)").find(n=>n.role==='disease');
  // 미진단
  eval("stageSync()");
  let el=eval("stageEl")(sym);
  L.push(`미진단 — 배지 ${el.querySelectorAll('.atts g').length}개 · 물음표 ${/>\?</.test(el.querySelector('.atts').innerHTML)}`);
  // 진단 뒤
  sym.revealed=true; sym.evoLeft=3; eval("stageSync()");
  let h=el.querySelector('.atts').innerHTML;
  L.push(`진단 후 — 배지 ${el.querySelectorAll('.atts g').length}개 · 남은 턴 표시 ${/>3</.test(h)} · 떨림 ${el.classList.contains('warn')}`);
  // 진화 한 턴 전
  sym.evoLeft=1; eval("stageSync()");
  L.push(`진화 직전 — 떨림 ${el.classList.contains('warn')} · 테 ${getComputedStyle(el.querySelector('.bezel')).boxShadow.includes('152, 48, 42')}`);
  // 진화 뒤
  sym.evolved=true; eval("stageSync()");
  h=el.querySelector('.atts').innerHTML;
  L.push(`진화 후 — 겉 바뀜 ${el.classList.contains('evo')} · 떨림 ${el.classList.contains('warn')} · 남은턴 숫자 ${/font-family="ui-monospace,monospace" fill="#(98302A|E8E2D2)">\d/.test(h)}`);
  // 병 노드 — 병기 링 · 다음 박자 · 단계별 겉모습
  L.push(`병 노드 — data-stg ${eval("stageEl")(dis).dataset.stg} · 링+박자 ${eval("stageEl")(dis).querySelectorAll('.atts g').length}개`);
  const b0=getComputedStyle(eval("stageEl")(dis).querySelector('.bezel')).background.slice(0,60);
  dis.stage=5; eval("stageSync()");
  const b1=getComputedStyle(eval("stageEl")(dis).querySelector('.bezel')).background.slice(0,60);
  L.push(`병기 3 → 5 로 테가 바뀌는가 ${b0!==b1}`);
  return L.join('\n');
 }));
 // 병기 상승 연출을 실제로 돌린다
 const fx = await pg.evaluate(async()=>{
   const dis = eval("alive(S)").find(n=>n.role==='disease');
   await eval("FXE").stageUp(dis, 4);
   return '병기 상승 연출 — 끝까지 돌았다';
 }).catch(e=>'병기 상승 연출 터짐: '+e.message);
 console.log(fx);
 console.log('오류', errs.length, errs.slice(0,3));
 await b.close();
})();
