/* ══════════════════════════════════════════════════════════════════
   부팅
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ── 부팅 ── */
renderTagBox();
deckLine('one_deck', ONE_DECK, ONE_CAP);

packLine();

renderOvr();

/* 저장해 둔 커스텀 병 노드를 BOSS 표에 올린다 — 스토리 탭의 병기 고르개와
   만들기 탭이 그것을 보통 병기처럼 고를 수 있게 된다.
   화면을 그리기 전에 올려야 첫 그리기에 이미 들어 있다 */
try{ disRegisterSaved() }catch(e){ /* 저장 공간을 못 읽는 판에서도 판은 돌아야 한다 */ }
renderBossPick();

PANES.one.started=true;

newGame();
