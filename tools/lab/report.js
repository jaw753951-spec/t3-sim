#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   lab/report.js — 잰 값을 견준다.

     node lab/report.js A AB              → 판본들을 나란히
     node lab/report.js --defs A          → 「여백」 정의 후보를 갈라 본다
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const BOSSES = ['아이', '어부', '송이'], POLS = ['완치', '연명', '편하게'];

const load = v => JSON.parse(fs.readFileSync(path.join(__dirname, 'data', `${v}.json`), 'utf8'));
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const med = a => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y), m = b.length >> 1;
                   return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2 };
const f2 = x => x.toFixed(2), f1 = x => x.toFixed(1);

/* 한 보스의 값 한 벌 */
function stat(rows, boss, pol) {
  const R = rows.filter(r => r.boss === boss && (!pol || r.pol === pol));
  const real = R.map(r => r.real), sh = R.map(r => r.shadow);
  const book = {};
  for (const r of real) for (const k in r.book) book[k] = (book[k] || 0) + r.book[k];
  const bookSum = Object.keys(book).reduce((a, k) => a + book[k], 0) || 1;
  return {
    n: R.length,
    여백:      mean(real.map(r => r.hp / r.hpMax)),
    그림자최저: mean(real.map(r => r.shadowMin / r.hpMax)),
    그림자총피해: mean(real.map(r => r.total)),
    그림자총피해비: mean(real.map(r => r.total / r.hpMax)),
    최대단타:  mean(real.map(r => r.maxHit)),
    최대단타비: mean(real.map(r => r.maxHit / r.hpMax)),
    진화중앙:  med(real.map(r => r.evo)),
    진화평균:  mean(real.map(r => r.evo)),
    턴수:      mean(real.map(r => r.turns)),
    완치율:    real.filter(r => r.out === '완치').length / (R.length || 1),
    사망률벗김: sh.filter(r => r.out === '사망').length / (R.length || 1),
    벗긴판최저: mean(sh.map(r => r.hp / r.hpMax)),
    장부:      Object.fromEntries(Object.entries(book).sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => [k, Math.round(v / bookSum * 1000) / 10])),
  };
}

function table(vars) {
  const D = {}; for (const v of vars) D[v] = load(v).rows;
  const KEYS = [['여백', f2], ['그림자최저', f2], ['그림자총피해', f1], ['최대단타', f1],
                ['진화중앙', f1], ['진화평균', f2], ['턴수', f1], ['완치율', f2], ['사망률벗김', f2]];
  for (const boss of BOSSES) {
    /* 판 수를 글자로 박아 두면 --seeds 3 으로 돌려도 「180판」이라 적힌다.
       잰 것에서 읽는다 — 이 저장소의 「값을 글자로 박지 않는다」가 검사 도구에도 걸린다 */
    const n = D[vars[0]].filter(r => r.boss === boss).length;
    console.log(`\n━━ ${boss} ━━ (씨앗 ${n / POLS.length} × 방침 ${POLS.length} = ${n}판)`);
    console.log('  ' + '지표'.padEnd(14) + vars.map(v => v.padStart(12)).join(''));
    for (const [k, f] of KEYS)
      console.log('  ' + k.padEnd(14) + vars.map(v => f(stat(D[v], boss)[k]).padStart(12)).join(''));
    console.log('  ── 방침별 여백 ──');
    for (const p of POLS)
      console.log('    ' + p.padEnd(12) + vars.map(v => f2(stat(D[v], boss, p).여백).padStart(12)).join(''));
    console.log('  ── 증상별 피해 장부 (%) ──');
    const keys = new Set(); for (const v of vars) for (const k in stat(D[v], boss).장부) keys.add(k);
    for (const k of [...keys].sort())
      console.log('    ' + k.padEnd(12) + vars.map(v => (stat(D[v], boss).장부[k] ?? 0).toFixed(1).padStart(12)).join(''));
  }
}

/* 자리가 갖고 태어난 진화 카운터 — 증상별 분포 */
function spots(vars) {
  console.log('\n━━ 자리가 갖고 태어난 진화 카운터 ━━');
  for (const boss of BOSSES) {
    console.log(`\n  ${boss}`);
    for (const v of vars) {
      const rows = load(v).rows.filter(r => r.boss === boss);
      const agg = {};
      for (const r of rows) for (const s in r.real.spot)
        for (const e in r.real.spot[s]) { agg[s] = agg[s] || {}; agg[s][e] = (agg[s][e] || 0) + r.real.spot[s][e] }
      const txt = Object.keys(agg).sort().map(s =>
        `${s} ${Object.keys(agg[s]).sort((a, b) => a - b).map(e => `${e}(${agg[s][e]})`).join(' ')}`).join(' · ');
      console.log(`    ${v.padEnd(14)} ${txt}`);
    }
  }
}

const arg = process.argv.slice(2);
if (arg[0] === '--spots') spots(arg.slice(1));
else { table(arg); spots(arg) }
