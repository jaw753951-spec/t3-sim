const fs=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
const base=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers';
const exe=fs.readdirSync(base).filter(d=>d.startsWith('chromium')&&!d.includes('headless'))
  .map(d=>path.join(base,d,'chrome-linux','chrome')).find(p=>fs.existsSync(p));
const SETUP={
 one1:()=>{ setMode('one'); document.getElementById('lv').value='1';
   document.getElementById('seed').value='7'; newGame(); eval("stageOpen()") },
 one5:()=>{ setMode('one'); document.getElementById('lv').value='5';
   document.getElementById('seed').value='42'; newGame(); eval("stageOpen()") },
 story:()=>{ setMode('story'); document.getElementById('boss').value='어부';
   document.getElementById('sk_pol').value='완치'; document.getElementById('sk_evid').value='4';
   newStory(); eval("stageOpen()") },
 sess:()=>{ setMode('sess'); sessInit(); SESS.deck=POOL[SESS.def.pool].slice(0,SESS.def.cap);
   SESS.phase='intake'; loadPatient(); eval("stageAskGo()") },
};
(async()=>{
 const b=await chromium.launch({executablePath:exe,args:['--no-sandbox']});
 let bad=0;
 for(const which of Object.keys(SETUP)){
  const pg=await b.newPage({viewport:{width:1920,height:1080}});
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('file://'+path.resolve('intern_sim.html'));
  await pg.waitForTimeout(300);
  await pg.evaluate(`(${SETUP[which].toString()})()`);
  await pg.waitForTimeout(800);
  const o=await pg.evaluate(()=>{
   const st=document.getElementById('sg_stage').getBoundingClientRect(), k=st.width/1920;
   const R=s=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect();
     return {x:(r.x-st.x)/k, y:(r.y-st.y)/k, w:r.width/k, h:r.height/k}};
   const cards=[...document.querySelectorAll('#sg_hand .card')].map(e=>{const r=e.getBoundingClientRect();
     return {t:(r.y-st.y)/k, b:(r.bottom-st.y)/k}});
   return {zone:R('#sg_handzone'), cards, exit:R('#sg_exit'), chartwrap:R('#sg_chartwrap'),
     board:R('#sg_board'), doc:R('#sg_doc'), pat:R('#sg_pat'), bar:R('#sg_pat .hpbar'),
     who:(document.getElementById('sg_pwho')||{}).textContent,
     hp:(document.getElementById('sg_hp')||{}).textContent,
     mind:(document.getElementById('sg_mind')||{}).textContent,
     gz:[...document.querySelectorAll('#sg .gz')].map(e=>{const r=e.getBoundingClientRect();
       return {x:Math.round((r.x-st.x)/k), y:Math.round((r.y-st.y)/k), w:Math.round(r.width/k)}})};
  });
  const say=[]; const zt=o.zone.y, zb=o.zone.y+o.zone.h;
  for(const c of o.cards) if(c.t<zt-0.5||c.b>zb+0.5) say.push(`카드가 줄 밖 ${Math.round(c.t)}~${Math.round(c.b)} (줄 ${Math.round(zt)}~${Math.round(zb)})`);
  const ov=(a,c)=>!(a.x+a.w<=c.x||c.x+c.w<=a.x||a.y+a.h<=c.y||c.y+c.h<=a.y);
  if(ov(o.exit,o.chartwrap)) say.push('나가기가 차트와 겹친다');
  if(o.board.y+o.board.h>zt+0.5) say.push('판이 손패 줄을 파고든다');
  if(o.doc.h>0 && o.doc.y+o.doc.h>zt+0.5) say.push('의사 패널이 손패 줄을 파고든다');
  if(o.pat.y+o.pat.h>(o.doc.h>0?o.doc.y:zt)+0.5) say.push('환자칸이 아래를 파고든다');
  for(const g of o.gz) if(g.x<o.pat.x+o.pat.w) say.push(`계기(${g.x})가 환자칸(~${Math.round(o.pat.x+o.pat.w)})을 침범`);
  console.log(`${which.padEnd(6)} 오류${errs.length}  이름「${o.who}」 체력「${o.hp}」 ${o.mind}  `
    +`판 ${Math.round(o.board.w)}×${Math.round(o.board.h)}  줄 ${Math.round(zt)}~  막대높이 ${Math.round(o.bar.h)}`);
  if(errs.length) say.push('오류: '+errs[0]);
  for(const t of new Set(say)){ console.log('   ✗ '+t); bad++ }
  await pg.screenshot({path:`${process.argv[2]}/g_${which}.png`});
  await pg.close();
 }
 console.log(bad? `\n걸린 것 ${bad}건` : '\n네 판 다 깨끗하다');
 await b.close();
})();
