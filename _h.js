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
 // 칩 합 = 「턴 끝 −N」 을 여러 판 · 여러 턴에 걸쳐 본다
 const out=await pg.evaluate(()=>{
  const res={bad:[], turns:0, wires:0, noTip:0, chips:0, chipNoTip:0, spread:0};
  const run=(setup)=>{
    setup();
    for(let t=0;t<9;t++){
      if(!eval("S")||!eval("alive(S).length")) break;
      eval("stageSync()");
      const f=eval("forecast()");
      let sum=0;
      for(const el of document.querySelectorAll('#sg .gz .icp.dmg b')) sum += Math.abs(parseInt(el.textContent.replace(/[^0-9]/g,""),10))||0;
      if(sum!==f.dmg) res.bad.push(`턴 ${eval("S.turn")} 칩합 ${sum} ≠ 예고 ${f.dmg}`);
      res.turns++;
      for(const g of document.querySelectorAll('#sg_links .wirem')){ res.wires++; if(!g.getAttribute('data-tip')) res.noTip++ }
      res.spread += document.querySelectorAll('#sg_links .spread').length;
      for(const c of document.querySelectorAll('#sg .gz .icp,#sg .gz .imk')){ res.chips++; if(!c.getAttribute('data-tip')) res.chipNoTip++ }
      eval("aiTurn(S); endTurnHand(S); turnResolve(S); S.turn++");
    }
  };
  for(const lv of ['3','4','5']) for(const sd of ['42','7']){
    run(()=>{ setMode('one'); document.getElementById('lv').value=lv;
      document.getElementById('seed').value=sd; newGame(); eval("stageOpen()") });
  }
  for(const pol of ['완치','편하게']){
    run(()=>{ setMode('story'); document.getElementById('boss').value='송이';
      document.getElementById('sk_pol').value=pol; document.getElementById('sk_evid').value='4';
      newStory(); eval("stageOpen()") });
  }
  return res;
 });
 console.log(`턴 ${out.turns} · 배선 메달 ${out.wires}(설명 없는 것 ${out.noTip}) · `
   +`퍼짐 선 ${out.spread} · 칩/딱지 ${out.chips}(설명 없는 것 ${out.chipNoTip})`);
 console.log(out.bad.length ? '칩 합이 어긋난 턴:\n  '+out.bad.slice(0,8).join('\n  ') : '칩 합 = 「턴 끝 −N」 — 한 턴도 안 틀렸다');
 console.log('오류', errs.length, errs.slice(0,2));
 await b.close();
})();
