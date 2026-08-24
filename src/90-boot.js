/* ══════════════════════════════════════════════════════════════════
   부팅
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ── 부팅 ── */
renderTagBox();
deckLine('one_deck', ONE_DECK, ONE_CAP);

deckLine('story_deck', STORY_DECK, STORY_CAP);

renderOvr();

PANES.one.started=true;

newGame();
