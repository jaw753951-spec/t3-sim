/* ══════════════════════════════════════════════════════════════════
   증상표 · 연결선 · 밴드 · 레벨표
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
//@ 커널.증상표 — 증상 여덟 · 병 노드
const SYM = {
  병:      {atk:false, disease:true},   // 스토리 전용 — 성장·공격·진화를 타지 않는다
  발열:    {atk:true},
  출혈:    {atk:true},
  감염:    {atk:false},
  탈수:    {atk:false},
  통증:    {atk:false},
  호흡곤란:{atk:false},
};

const ALLSYM = Object.keys(SYM).filter(s=>!SYM[s].disease);

/* 기본형 배선 — 조합이 판에 있으면 항상 생기고 항상 보인다 (정연 7/28 확정) */
//@ 커널.연결선 — 촉발 · 전이 조합
const TRIG  = [['감염','발열','가속'],['감염','통증','가속'],['발열','통증','가속'],
               ['출혈','통증','경화'],['통증','호흡곤란','가속']];

const TRANS = [['출혈','호흡곤란','발현'],['발열','탈수','무장발현']];

/* 레벨표 */
//@ 커널.레벨표 — 밴드 · 레벨표 · 진화 보정
const BAND = {I:35, II:50, III:65, IV:80, V:95};

const LVTAB = {
  /* v26 — 체력 열을 걷었다. 환자 체력은 병의 난이도가 아니라 몸(체격)에서 나온다.
     BODY_HP(10-config/levels.js)를 본다. 진화 카운터는 전 레벨 일괄 +1 —
     SW.evoRef 도 6→7 로 함께 밀었다. 둘은 한 몸이다. */
  1:{n:[1,1], main:'I',  sub:null,  atkCap:1, basic:[0,0], enh:[0,0], evo:7, shield:'none', dis:40},
  2:{n:[2,2], main:'II', sub:'I',   atkCap:1, basic:[1,1], enh:[0,0], evo:6, shield:'one',  dis:75},
  3:{n:[2,3], main:'III',sub:'II',  atkCap:2, basic:[1,2], enh:[0,1], evo:5, shield:'all',  dis:120},
  4:{n:[3,4], main:'IV', sub:'II',  atkCap:2, basic:[2,3], enh:[1,2], evo:4, shield:'all',  dis:180},
  5:{n:[4,5], main:'V',  sub:'III', atkCap:3, basic:[3,4], enh:[2,3], evo:4, shield:'all',  dis:250},
};

/* 병기가 설 수 있는 범위 — **레벨표가 곧 범위다.** 병기 번호가 항목별 레벨의
   기본값이므로(커널.레벨표 · SLV) 레벨표에 없는 병기는 세울 데가 없다.
   전에는 만들기 · 병 노드 탭이 「3~5」를 마크업에 손으로 적고 disStages 가
   또 한 번 3 으로 잘랐다 — 네 곳이 같은 말을 하니 한 곳만 고치면 화면과
   자르는 자가 갈렸다. 시작 병기 1 을 열려면 그 넷을 다 찾아야 했다.

   상수로 둔다 — 목록(BODY_LIST 등)이 함수인 것은 저 아래 표를 앞에서 부르기
   때문인데, LVTAB 은 바로 위에 있어서 미룰 까닭이 없다. */
//@ 커널.병기범위 — 레벨표가 곧 병기 범위다
const STAGE_LV = Object.keys(LVTAB).map(Number);
const STAGE_LO = Math.min(...STAGE_LV);
const STAGE_HI = Math.max(...STAGE_LV);

const EVO_ADJ = {출혈:-1, 통증:+1, 호흡곤란:+1};

/* 명부 i번째 자리의 밴드 — main 에서 한 칸씩 내려가되 sub 아래로는 안 간다 */
const BAND_ORDER = ['I','II','III','IV','V'];

/* 증상마다 가진 고유 수치 — 자리에 적어 둔 값이 없으면 여기 def 가 답이다.
   key = 그 값이 노드의 어느 속성에 들어 있는가. sp() 가 이 둘만 쓴다.

   이름표 · 증감 단위 · 설명문은 화면 것이라 여기 없다 — SYMDOC(60-text)에 있다.
   이 층은 자름 커널 구간 안이고, 그 구간의 계약은 화면을 쓰지 않는 것이다. */
//@ 커널.증상비율 — 증상마다 다른 효과 비율
const SYMPARAM = {
  출혈:     {key:'growVal', def:()=>R.BLEED_G},
  감염:     {key:'infG',    def:()=>R.INF_G},
  탈수:     {key:'dehy',    def:()=>R.DEHY_STAB},
  발열:     {key:'evoK',    def:()=>R.EVO_FEVER_GROW},
  통증:     {key:'painT',   def:()=>R.PAIN_T},
  호흡곤란: {key:'drawCut', def:()=>R.DRAW_CUT},
};

/* ── 정신 상태 ──────────────────────────────────────────────── */
//@ 커널.정신 — 평정 · 불안 · 공황
const MINDS = ['평정','불안','공황'];
