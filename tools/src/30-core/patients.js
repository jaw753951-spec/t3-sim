/* ══════════════════════════════════════════════════════════════════
   §4 대본 → 판
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ── 판 만들기 ── */
//@ 환자.생성 — 대본 한 줄에서 판을 만든다
function makePatient(id, seed){
  const p = SCRIPT[id];
  if(!p) throw new Error('모르는 환자: '+id);
  const b = L.makeBoard(p.lv, K.mulberry32(seed), {syms:p.syms, tags:p.tags, core:p.core});
  if(!b) throw new Error('판 생성 실패: '+id);
  b.script = p;
  b.core = p.core;
  if(p.enh) b.enh = p.enh.map(e=>({...e, kind:'trig', hidden:true}));
  if(p.chronic) for(const n of b.nodes) n.chronic = true;
  return b;
}

//@ 환자.예산 — 턴 예산. 메모 · 대본 · 계산 셋 중 하나
let BUDGET_SRC = 'memo';                       // 'memo' | 'script' | 'calc'

/* 'calc' = 실측 표준턴표(STD_REAL)로 그때그때 계산한다.
   v19 는 budgetOf 와 STD_REAL 을 선언만 하고 아무 데서도 부르지 않았다. */
function sessBudget(d){
  if(BUDGET_SRC==='script') return d.scriptBudget;
  if(BUDGET_SRC==='calc')   return budgetOf(d.list, STD_REAL);
  return d.memoBudget ?? d.scriptBudget;
}
