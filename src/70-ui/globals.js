/* ══════════════════════════════════════════════════════════════════
   §9.1 전역 상태 · 잔손
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 화면 · 배치 · 도구 ═════════════════════════════════════
   v20 — 모드 다섯. 단판 / 세션 / 스토리 / 배치 / 만들기.
   판은 모드마다 따로 살아 있고 탭을 옮겨도 죽지 않는다.
   밸런싱은 배치에서, 손맛은 단판·스토리에서, 실험은 만들기에서 본다.
   ═══════════════════════════════════════════════════════════ */

//@ 화면.전역 — §9.1 전역 상태 · 잔손
let S=null, BOARD=null, SEL=null, LOG=[], MODE='one', UNDO=[], SESS=null, DB=null;

const $ = id => document.getElementById(id);

const log = t => { LOG.unshift(t); if(LOG.length>200) LOG.pop() };

const med = a => { a=[...a].sort((x,y)=>x-y); return a.length?a[a.length>>1]:'—' };

const esc = t => String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* 모드별 판 보관 — 탭을 옮겨도 진행 중인 판이 남는다 (v19 는 매번 새 판을 깔았다) */
//@ 화면.패널 — §9.5 모드별 판 · 가방 상한
const PANES = {one:{started:false}, sess:{started:false}, story:{started:false},
               batch:{started:true}, make:{started:true}};
