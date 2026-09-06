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
let S=null, BOARD=null, SEL=null, LOG=[], MODE='one', UNDO=[], SESS=null, DB=null, PK=null;

const $ = id => document.getElementById(id);

const log = t => { LOG.unshift(t); if(LOG.length>200) LOG.pop() };

const med = a => { a=[...a].sort((x,y)=>x-y); return a.length?a[a.length>>1]:'—' };

const esc = t => String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* 모드별 판 보관 — 탭을 옮겨도 진행 중인 판이 남는다 (v19 는 매번 새 판을 깔았다) */
//@ 화면.패널 — §9.5 모드별 판 · 가방 상한
const PANES = {one:{started:false}, sess:{started:false}, story:{started:false},
               batch:{started:true}, make:{started:true}, score:{started:true}};

/* ── 수치 물들이기 ─────────────────────────────────────────────
   바탕값(규칙이 정한 값 · 카드에 적힌 값)과 지금 값이 다르면 색으로 알린다.
   세지면 초록, 약해지면 빨강. 무엇이 '좋은' 방향인지는 부르는 쪽이 정한다 —
   코스트와 처치선은 결이 달라서 한 규칙으로 묶을 수 없다.

   카드(cardEff)와 자리(lineEff)가 같은 이 함수를 쓴다. 색 규칙이 두 벌이면
   같은 판을 보고 카드와 자리가 서로 다른 말을 하게 된다. */
//@ 화면.물들이기 — 바탕값과 지금 값이 다르면 색으로 알린다
const numText = x => (typeof x==='number' && !Number.isInteger(x)) ? (Math.round(x*10)/10).toFixed(1) : String(x);

function driftSpan(base, eff, body, upIsGood=true){
  if(base===undefined || eff===undefined) return numText(base===undefined?eff:base);
  if(eff===base) return numText(base);
  const better = upIsGood ? eff>base : eff<base;
  return `<span class="${better?'vup':'vdn'}"${body?tip(body):''}>${numText(eff)}</span>`;
}

/* 강화형 배선이 드러났는가. 작업대와 무대가 **같은 조건을 본다** — 갈리면
   한쪽만 「? → ?」로 감춘다.

   ★ 산 자리만 보면 안 된다. 전에는 양쪽이 `alive(S).some(n=>n.revealed)` 였는데,
     드러남은 **자리**가 아니라 **환자**에 대해 알게 된 사실이다. 진단한 자리를
     처치하는 순간 산 자리에 revealed 가 하나도 안 남아, 이미 읽은 배선이
     「? → ? 진단 필요」로 도로 감춰졌다 (재현: 5레벨 seed 1 — 발열 진단 뒤
     감춰진 0, 발열 처치 뒤 감춰진 2). 죽은 자리도 revealed 를 그대로 들고
     있으므로 판 전체를 본다. */
//@ 문안.배선드러남 — 작업대와 무대가 함께 보는 조건
const enhShown = S => !!S && (S.nodes||[]).some(n=>n.revealed);

/* ↑ 60-text 에 있던 것을 옮겨 왔다. 글을 내는 자가 아니라 **판을 묻는 자**이고,
   부르는 곳이 둘 다 70-ui(작업대 · 무대)다. 문안 층에 두면 화면 조건이
   문안 층에 쌓인다 */

/* ── 체격 · 체력 태그 칸 ────────────────────────────────────
   두 겹을 두 줄로 낸다 (생성기.체력태그). 세 화면 — 단판 사이드바 ·
   환자 만들기 · 병 노드 — 이 하나를 쓴다.

   ★ 전에는 세 곳이 각자 TAG_LIST() 를 한 줄로 늘어놓고 체크상자를 달았다.
     그래서 소아와 노동자를 같이 켤 수 있었고(체격 둘), 체력 태그를 둘 붙이면
     상한에 밀려 체격이 조용히 꺼졌다. 칸을 나누면 화면에서부터 그 일이 안 난다.
   체격이 라디오인 까닭: 하나뿐인 것을 체크상자로 내면 「둘 다 끈 상태」가
   생기는데 그런 몸은 없다. 성인이 그 자리를 맡는다.

   fn 은 화면마다 다른 손 이름이다 — 상태를 어디에 두는지가 다르기 때문이다
   (단판은 ONE_TAGS, 만들기는 CUSTOM.tags, 병 노드는 CUSTOM.dis.tags).
   pre 는 라디오 묶음 이름 — 세 칸이 한 문서에 같이 있으면 이름이 겹쳐
   한쪽을 누를 때 다른 쪽이 꺼진다 */
//@ 화면.태그칸 — 체격(하나) · 체력 태그(둘까지)
function tagBoxHTML(tags, pre, fnBody, fnTag){
  /* 겹을 가르는 잣대는 10-config 것 하나다 (multTags) — 여기서 HP_TAG 를 직접
     물으면 두 표 어디에도 없는 이름 하나에 칸과 tagAdd 의 셈이 갈린다 */
  const t = tags || [], body = bodyOf(t), mult = multTags(t);
  const row = (lab, note, items) =>
    `<div class="bar sub">${lab}<span class="right d">${note}</span></div>`
    + `<div class="tags">${items}</div>`;
  /* 곁의 글은 짧게 둔다 — 단판 사이드바가 좁아서, 「곱해서 걸린다」쯤 되면
     끝이 잘려 나갔다. 체격은 고르는 칸마다 제 값을 달고 있으므로 곁말이 필요 없고,
     곱한 끝값 하나만 아래 줄에 붙인다 */
  return row('체격', '',
      BODY_LIST().map(x=>`<label><input type="radio" name="${esc(pre)}_body" value="${esc(x)}"`
        + `${x===body?' checked':''} onchange="${fnBody}('${esc(x)}')">${esc(x)}`
        /* 곁말은 tagLabel 하나가 낸다 — BODY_HP 를 여기서 직접 읽으면 표기가 두 벌이
           된다. 무대 칩이 HP_TAG 를 직접 읽다 「소아 ×undefined」로 떴던 자리다 */
        + ` <span class="d">${esc(tagLabel(x))}</span></label>`).join(''))
  + row('체력 태그', `${mult.length}/${TAG_CAP} · 체력 ${hpOfTags(t)}`,
      HP_TAG_LIST().map(x=>`<label><input type="checkbox" ${t.includes(x)?'checked':''}`
        + ` onchange="${fnTag}('${esc(x)}')">${esc(x)}`
        + ` <span class="d">${esc(tagLabel(x))}</span></label>`).join(''));
}
