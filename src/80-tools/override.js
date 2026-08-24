/* ══════════════════════════════════════════════════════════════════
   §9.6~7 R · SR 덮어쓰기
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ═══ 규칙 덮어쓰기 ═══════════════════════════════════════════
   권위본 값이 기본이고, 여기 적은 키만 덮어쓴다. 덮어쓴 키는 배지로 남고
   배치 결과표에도 같이 찍힌다 — 어떤 값으로 뽑은 숫자인지 잃어버리지 않게. */
const R0 = JSON.parse(JSON.stringify(R)), SR0 = JSON.parse(JSON.stringify(SR));

//@ 화면.규칙덮기 — §9.6 R · SR 을 화면에서 덮어쓴다
let OVR_KEYS = [];

function mergeInto(dst, src, tag, keys){
  for(const k of Object.keys(src)){
    const v = src[k];
    if(v && typeof v==='object' && !Array.isArray(v)){
      if(!dst[k] || typeof dst[k]!=='object' || Array.isArray(dst[k])) dst[k] = {};
      mergeInto(dst[k], v, `${tag}.${k}`, keys);   // 잎까지 내려간다 — 가지째 덮으면 형제 값이 지워진다
    } else { dst[k]=v; keys.push(`${tag}.${k}`) }
  }
}

function resetRules(){
  for(const k of Object.keys(R)) delete R[k];  Object.assign(R,  JSON.parse(JSON.stringify(R0)));
  for(const k of Object.keys(SR)) delete SR[k]; Object.assign(SR, JSON.parse(JSON.stringify(SR0)));
  OVR_KEYS = [];
}

function applyOvr(){
  const txt = $('ovr').value.trim();
  resetRules();
  if(txt){
    try{
      const o = JSON.parse(txt);
      const keys=[];
      if(o.R)  mergeInto(R,  o.R,  'R',  keys);
      if(o.SR) mergeInto(SR, o.SR, 'SR', keys);
      OVR_KEYS = keys;
    }catch(e){ $('ovrshow').innerHTML = `<span class="badred">JSON 을 읽지 못했다 — ${esc(e.message)}</span>`; return }
  }
  ovrPull();
  renderOvr();
  log(OVR_KEYS.length ? `<b>규칙 덮어쓰기</b> ${OVR_KEYS.length}개 — ${OVR_KEYS.join(' · ')}` : '<span class="d">규칙을 권위본으로 되돌렸다.</span>');
  render();
}

function clearOvr(){ OVRV={}; $('ovr').value=''; applyOvr() }

let OVRV = {};                                   // '길' → 값

function ovrKey(root, path){ return root+'.'+path.join('.') }

function ovrSet(root, pathStr, raw){
  const path = pathStr.split('.');
  const key = ovrKey(root, path);
  const orig0 = pathDig(root==='R'?R0:SR0, path);   // 권위본 값으로 형을 본다
  let v;
  if(typeof orig0 === 'boolean') v = (raw===true||raw==='true');
  else { v = parseFloat(raw); if(!isFinite(v)) { delete OVRV[key]; ovrSync(); return } }
  if(v === orig0) delete OVRV[key]; else OVRV[key] = v;
  ovrSync();
}

function pathDig(o, path){ for(const k of path) o = o[k]; return o }

/* OVRV → JSON 문자열 → applyOvr */
function ovrSync(){
  const out = {};
  for(const key in OVRV){
    const seg = key.split('.'), root = seg[0];
    let o = (out[root] = out[root] || {});
    for(let i=1;i<seg.length-1;i++) o = (o[seg[i]] = o[seg[i]] || {});
    o[seg[seg.length-1]] = OVRV[key];
  }
  $('ovr').value = Object.keys(out).length ? JSON.stringify(out) : '';
  applyOvr();
}

function ovrReset(){ OVRV = {}; $('ovr').value=''; applyOvr() }

function ovrCopy(){
  if(navigator.clipboard) navigator.clipboard.writeText($('ovr').value || '{}');
  log('<span class="d">고친 규칙을 베꼈다.</span>');
}

/* JSON 을 손으로 적었을 때 칸 쪽을 맞춘다 */
function ovrPull(){
  OVRV = {};
  const walk = (root, o, path) => {
    for(const k in o){
      const v = o[k];
      if(v && typeof v === 'object') walk(root, v, path.concat(k));
      else OVRV[ovrKey(root, path.concat(k))] = v;
    }
  };
  try{
    const txt = $('ovr').value.trim();
    if(txt){ const j = JSON.parse(txt); if(j.R) walk('R', j.R, []); if(j.SR) walk('SR', j.SR, []) }
  }catch(e){}
}

function renderOvrForm(){
  const box = $('ovrform'); if(!box) return;
  tipFixReset('ovr');
  const cell = (root, path) => {
    const key = ovrKey(root, path), name = path[path.length-1];
    const cur = pathDig(root==='R'?R:SR, path), orig = pathDig(root==='R'?R0:SR0, path);
    const off = cur !== orig;
    const label = path.join(' · ');
    const doc = RULE_DOC[key] || RULE_DOC[root+'.'+path[0]] || RULE_DOC[name] || RULE_DOC[path[0]] || '';
    const tp = tipFix('ovr', TT(label, (doc||'설명 없음') + `<br><br><span class="d">권위본 ${orig}${off?` · 지금 ${cur}`:''}</span><br><span class="d">${key}</span>`));
    if(typeof orig === 'boolean')
      return `<label class="mk"${tp}>${label}${off?' <span class="badred" style="border:0;padding:0">•</span>':''}
        <input type="checkbox" ${cur?'checked':''} onchange="ovrSet('${root}','${path.join('.')}',this.checked)"></label>`;
    const step = Math.abs(orig)<1 && orig!==0 ? 0.05 : 1;
    return `<label class="mk"${tp}>${label}${off?' <span class="badred" style="border:0;padding:0">•</span>':''}
      <input type="number" step="${step}" value="${cur}" onchange="ovrSet('${root}','${path.join('.')}',this.value)"></label>`;
  };
  /* 한 열쇠 아래 숫자 잎을 전부 편다 (두 단계까지) */
  const leaves = (root, k) => {
    const v = pathDig(root==='R'?R0:SR0, [k]);
    if(v === undefined) return [];
    if(typeof v === 'number' || typeof v === 'boolean') return [[k]];
    if(v && typeof v === 'object' && !Array.isArray(v)){
      const out = [];
      for(const k2 in v){
        const v2 = v[k2];
        if(typeof v2 === 'number' || typeof v2 === 'boolean') out.push([k,k2]);
        else if(v2 && typeof v2 === 'object' && !Array.isArray(v2))
          for(const k3 in v2) if(typeof v2[k3]==='number') out.push([k,k2,k3]);
      }
      return out;
    }
    return [];
  };
  let html = '';
  for(const root of ['R','SR']){
    const src = root==='R'?R0:SR0;
    const used = new Set();
    html += `<div class="bar" style="margin:12px 0 4px">${root==='R'?'전투 공통 규칙 · R':'스토리 전용 규칙 · SR'}</div>`;
    for(const [title, keys] of RULE_GROUP[root]){
      const cells = [];
      for(const k of keys){ used.add(k); for(const path of leaves(root,k)) cells.push(cell(root,path)) }
      if(cells.length) html += `<div class="note" style="margin:8px 0 3px">${title}</div><div class="mkgrid">${cells.join('')}</div>`;
    }
    const rest = [];
    for(const k in src) if(!used.has(k)) for(const path of leaves(root,k)) rest.push(cell(root,path));
    if(rest.length) html += `<div class="note" style="margin:8px 0 3px">그 밖</div><div class="mkgrid">${rest.join('')}</div>`;
  }
  box.innerHTML = html;
}

function renderOvr(){
  renderOvrForm();
  $('ovrshow').innerHTML = OVR_KEYS.length
    ? OVR_KEYS.map(k=>`<span class="badred">${esc(k)}</span>`).join('')
    : '<span class="d">권위본 그대로</span>';
}

const ovrNote = () => OVR_KEYS.length ? ` · <span class="badred">덮어쓴 값 ${OVR_KEYS.length}개</span>` : '';
