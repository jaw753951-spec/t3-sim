/* ══════════════════════════════════════════════════════════════════
   §9.8 한 수 무르기
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 되돌리기 ═══════════════════════════════════════════════
   v18 은 턴 시작 시점만 되돌렸다. 여기서는 한 수 단위로 쌓는다.
   난수는 mulberry32 의 내부 상태를 함께 저장해 같은 흐름으로 복원된다. */
//@ 화면.되돌리기 — §9.8 한 수 무르기
function snapS(S){
  if(!S) return null;
  /* ev 는 뜨지 않는다 — pushUndo 는 playCard 안에서, 즉 무대가 사건 기록을 켜 둔
     동안에 불린다. 그대로 두면 노드 객체를 문 사건 배열이 통째로 직렬화된다 */
  const {rng, board, ev, ...rest} = S;
  const c = JSON.parse(JSON.stringify({...rest, board:{...board, nodes:null}}));
  c.__rng = (rng && rng.state) ? rng.state() : null;
  return c;
}

function loadS(c){
  if(!c) return null;
  const S2 = {...c}; delete S2.__rng;
  S2.board = {...c.board, nodes:S2.nodes};
  const r = mulberry32(0); if(c.__rng!==null && c.__rng!==undefined) r.set(c.__rng);
  S2.rng = r;
  return S2;
}

function pushUndo(label){
  if(!S) return;
  UNDO.push({label, s:snapS(S), log:LOG.slice(), sel:SEL,
             sess: SESS ? JSON.parse(JSON.stringify({...SESS, def:null})) : null});
  if(UNDO.length>60) UNDO.shift();
  const b=$('btnundo'); if(b) b.disabled=false;
}

function undoStep(){
  /* 고르는 중이었다면 아직 아무것도 나가지 않았다 — 고르기만 물린다 */
  if(PICK){ cancelPick(); return }
  const u = UNDO.pop();
  if(!u) return;
  S = loadS(u.s); BOARD = S.board; LOG = u.log; SEL = u.sel;
  if(u.sess && SESS){ const def=SESS.def; SESS = {...u.sess, def} }
  log(`<span class="d">되돌렸다 — ${esc(u.label)}</span>`);
  const b=$('btnundo'); if(b) b.disabled = !UNDO.length;
  render();
}
