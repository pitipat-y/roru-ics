(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase(); // ō = o
const fmt = (n, d=2) => (Math.round(n*1000)/1000).toLocaleString('th-TH',{maximumFractionDigits:d});
const colName = i => XLSX.utils.encode_col(i);
const UA = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
const isAndroid = /Android/.test(UA);

/* ---------- Icons ---------- */
const ICONS={
  history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  sheet:'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M12 11v8"/>',
  download:'<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
  upload:'<path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  login:'<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
  columns:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M15 4v16"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  reset:'<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  skip:'<path d="m5 4 10 8-10 8z"/><path d="M19 5v14"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  checks:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
  layers:'<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  calc:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  arrow:'<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  chart:'<path d="M4 20V11"/><path d="M10 20V5"/><path d="M16 20v-7"/><path d="M3 20h18"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h3"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z"/><path d="M4 20a2 2 0 0 0 2 2h13v-4"/><path d="M8 7h7"/><path d="M8 11h5"/>'
};
const ic=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]||''}</svg>`;
const setLbl=(b,t)=>{ const l=b.querySelector('.lbl'); (l||b).textContent=t; };
document.querySelectorAll('[data-icon]').forEach(el=>el.insertAdjacentHTML('afterbegin',ic(el.dataset.icon)));

const MASTER_DEFAULT_NAME='MaisonrRoru-ICS-06Oct69.xlsx (ค่าเริ่มต้น)';
const MASTER_HISTORY_KEY='ics-master-history';
const MASTER_ACTIVE_KEY='ics-master-active';
const MASTER_HISTORY_MAX=15;
let master = DEFAULT_MASTER, masterName = MASTER_DEFAULT_NAME, activeMasterId='default';
(function initMaster(){
  // migrate the old single-slot master (pre-history versions) into master history once
  try{
    const legacy = JSON.parse(localStorage.getItem('ics-master')||'null');
    if(legacy && legacy.groups?.length && !loadMasterHistory().length){
      const id='m'+Date.now().toString(36);
      addMasterHistoryEntry({id, ts:Date.now(), name: legacy.name||'Master ที่เคยอัปโหลด', groups: legacy.groups});
      setActiveMaster(id);
      localStorage.removeItem('ics-master');
    }
  }catch(_){}
  const activeId=getActiveMaster();
  if(activeId && activeId!=='default'){
    const h=loadMasterHistory().find(x=>x.id===activeId);
    if(h){ master=h.groups; masterName=h.name; activeMasterId=h.id; return; }
  }
  activeMasterId='default';
})();

let sales = [];
let source = null;
let result = null, tab = 'sum', salesF = 'all';
let salesSort = {key:'qty', dir:'desc'}; // sortable columns in รายการขาย
let lastPreview = null;

function toast(msg){ const t=$('#toast'); t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>t.hidden=true,2600); }

function menuIndex(){ const m=new Map(); master.forEach(g=>g.items.forEach(it=>{ const k=norm(it.menu); if(!m.has(k)) m.set(k,new Set()); m.get(k).add(g.name); })); return m; }

function compute(){
  const agg = new Map();
  sales.forEach(r => { const k=norm(r.desc); if(!k) return; const a=agg.get(k)||{desc:r.desc.trim(),qty:0,lines:0}; a.qty+=r.qty; a.lines++; agg.set(k,a); });
  const groups = master.map(g => {
    const items = g.items.map(it => { const q=agg.get(norm(it.menu))?.qty||0; return {...it, qty:q, total:q*it.w}; });
    const total = items.reduce((s,i)=>s+i.total,0);
    return {...g, items, total, result: total/(g.div||1)};
  });
  const idx = menuIndex();
  const salesAgg = [...agg.entries()].map(([k,a]) => ({...a, ings: idx.has(k)?[...idx.get(k)]:[]})).sort((a,b)=>b.qty-a.qty);
  result = {groups, salesAgg};
}

function renderSource(){
  const has=!!source;
  $('#uploadEmpty').hidden=has; $('#uploadLoaded').hidden=!has;
  $('#btnCopy').disabled=!has; $('#btnExport').disabled=!has;
  if(!has) return;
  $('#srcName').textContent = source.name;
  const m = result.salesAgg.filter(s=>s.ings.length), u = result.salesAgg.filter(s=>!s.ings.length);
  $('#stRows').textContent = fmt(sales.length,0);
  $('#stMatched').textContent = fmt(m.length,0)+' เมนู';
  $('#stUnmatched').textContent = fmt(u.length,0)+' เมนู';
  $('#btnRepreview').hidden = !P.wb;
}

function renderSum(){
  if(!source){ $('#sumList').innerHTML='<div class="px-4 py-10 text-center text-muted">ยังไม่มีข้อมูล อัปโหลดไฟล์ยอดขายด้านบนเพื่อเริ่มคำนวณ</div>'; return; }
  const hide = $('#hideZero').checked;
  const gs = result.groups.filter(g => !hide || g.total>0);
  if(!gs.length){ $('#sumList').innerHTML='<div class="px-4 py-8 text-center text-muted">ยังไม่มีวัตถุดิบที่ถูกใช้จากยอดขายนี้</div>'; return; }
  $('#sumList').innerHTML = gs.map(g => {
    const used = g.items.filter(i=>i.qty>0);
    const div = g.div && g.div!==1;
    return `<details class="border-t border-line first:border-t-0">
      <summary class="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_150px_170px] gap-x-3 gap-y-0.5 items-center px-4 py-3 hover:bg-sunken ${g.total?'':'opacity-50'}">
        <div class="flex items-center gap-2 min-w-0 row-span-2 sm:row-span-1">
          <span class="chev text-muted text-xs">▶</span>
          <span class="font-semibold truncate">${esc(g.name)}</span>
          <span class="text-muted text-xs whitespace-nowrap">${used.length}/${g.items.length} เมนู</span>
        </div>
        <div class="text-right num text-muted sm:text-ink">${fmt(g.total)} <span class="text-xs text-muted">${esc(g.base||'')}</span></div>
        <div class="text-right">
          <span class="num text-[17px] font-semibold ${g.total?'text-accent':''}">${fmt(g.result,3)}</span>
          <span class="text-sm">${esc(g.unit||'')}</span>
          ${div?`<div class="text-[11px] text-muted num">÷ ${fmt(g.div,0)} ${esc(g.base||'')}/${esc(g.unit||'')}</div>`:''}
        </div>
      </summary>
      <div class="px-4 pb-3 scroll-x">
        <table class="text-sm">
          <thead class="text-muted text-xs"><tr><th class="text-left py-1.5 pr-3 font-medium">เมนู (C)</th><th class="text-right py-1.5 px-3 font-medium">นน.ที่ใช้ (D)</th><th class="text-right py-1.5 px-3 font-medium">ขาย (F)</th><th class="text-right py-1.5 pl-3 font-medium">นน.รวม (G)</th></tr></thead>
          <tbody>${g.items.map(i=>`<tr class="border-t border-line ${i.qty?'':'text-muted'}"><td class="py-1.5 pr-3">${esc(i.menu)}</td><td class="text-right px-3 num">${fmt(i.w,3)} ${esc(i.u||'')}</td><td class="text-right px-3 num ${i.qty?'font-semibold':''}">${fmt(i.qty,0)}</td><td class="text-right pl-3 num ${i.qty?'font-semibold':''}">${fmt(i.total)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </details>`;
  }).join('');
}

function renderSales(){
  if(!source){ $('#salesBody').innerHTML='<tr><td colspan="3" class="px-4 py-8 text-center text-muted">ยังไม่มีข้อมูล อัปโหลดไฟล์ยอดขายก่อน</td></tr>'; return; }
  const q = norm($('#salesSearch').value);
  const rows = result.salesAgg.filter(s => (salesF==='all' || (salesF==='m')===(s.ings.length>0)) && (!q || norm(s.desc).includes(q)));
  const {key,dir}=salesSort, sign=dir==='asc'?1:-1, txt=(a,b)=>a.localeCompare(b,'th',{numeric:true,sensitivity:'base'});
  rows.sort((a,b)=>{
    if(key==='qty') return sign*(a.qty-b.qty) || txt(a.desc,b.desc);
    if(key==='ings'){ // เมนูที่ "ไม่มีในสูตร" อยู่ท้ายเสมอ
      if(!a.ings.length !== !b.ings.length) return a.ings.length?-1:1;
      return sign*txt(a.ings.join(', '),b.ings.join(', ')) || txt(a.desc,b.desc);
    }
    return sign*txt(a.desc,b.desc);
  });
  document.querySelectorAll('#salesHead th[data-sort]').forEach(th=>{
    const on=th.dataset.sort===key;
    th.setAttribute('aria-sort', on?(dir==='asc'?'ascending':'descending'):'none');
    th.querySelector('.sort-ind').textContent = on?(dir==='asc'?'▲':'▼'):'↕';
  });
  $('#salesBody').innerHTML = rows.map(s=>`<tr class="border-t border-line"><td class="px-4 py-2">${esc(s.desc)}</td><td class="px-4 py-2 text-right num font-medium">${fmt(s.qty)}</td><td class="px-4 py-2">${s.ings.length? s.ings.map(n=>`<span class="inline-block mr-1 mb-0.5 px-2 py-0.5 rounded-full bg-good-soft text-good text-xs">${esc(n)}</span>`).join('') : '<span class="text-warn text-xs">ไม่มีในสูตร</span>'}</td></tr>`).join('') || '<tr><td colspan="3" class="px-4 py-6 text-center text-muted">ไม่พบรายการ</td></tr>';
  document.querySelectorAll('.sf').forEach(b=>{ const on=b.dataset.f===salesF; b.classList.toggle('bg-ink',on); b.classList.toggle('text-bg',on); b.classList.toggle('bg-surface',!on); });
}

function renderMaster(){
  $('#masterName').textContent = masterName;
  const q = norm($('#masterSearch').value);
  const open = q || matchMedia('(min-width:640px)').matches ? ' open' : ''; // mobile: collapsed unless searching
  const groups = !q ? master : master.map(g=> norm(g.name).includes(q) ? g : {...g, items:g.items.filter(i=>norm(i.menu).includes(q))}).filter(g=>g.items.length);
  $('#masterList').innerHTML = (groups.map(g=>`<details class="mcard rounded-xl border border-line bg-surface p-4"${open}>
    <summary class="flex items-baseline justify-between gap-2 cursor-pointer select-none"><span class="font-semibold">${esc(g.name)} <span class="text-xs text-muted num font-normal">(${g.items.length})</span></span><span class="text-xs text-muted num">${g.div&&g.div!==1?`÷${fmt(g.div,0)} → ${esc(g.unit)}`:esc(g.unit||'')}<span class="chev ml-1 inline-block">▾</span></span></summary>
    <ul class="mt-2 text-sm divide-y divide-[var(--line)]">${g.items.map(i=>`<li class="flex justify-between gap-3 py-1"><span class="min-w-0 break-words">${esc(i.menu)}</span><span class="num text-muted whitespace-nowrap">${fmt(i.w,3)} ${esc(i.u||'')}</span></li>`).join('')}</ul>
  </details>`).join('')) || '<div class="text-muted text-sm py-6 text-center">ไม่พบรายการ</div>';
}

function renderTabs(){
  document.querySelectorAll('.tab').forEach(b=>{ const on=b.dataset.tab===tab; b.setAttribute('aria-selected',on); b.classList.toggle('border-accent',on); b.classList.toggle('text-ink',on); b.classList.toggle('border-transparent',!on); b.classList.toggle('text-muted',!on); });
  ['sum','sales','master'].forEach(t=>$('#panel-'+t).hidden = t!==tab);
}

function renderAll(){ compute(); renderSource(); renderSum(); renderSales(); renderMaster(); renderTabs(); }

/* ---------- Upload & preview ---------- */
const P = { wb:null, name:'', sheet:'', grid:[], header:0, desc:-1, qty:-1, pick:'desc' };

function toNum(v){ if(typeof v==='number') return v; const s=String(v??'').replace(/,/g,'').trim(); if(s==='') return NaN; const n=Number(s); return n; }

function autoDetect(grid){
  const descRe=/^item\s*desc(ription)?$|^itemdesc$|^description$|^menu|รายการ|ชื่อสินค้า/i, qtyRe=/^qty$|^quantity$|^จำนวน/i;
  let best=null;
  for(let r=0;r<Math.min(grid.length,30);r++){
    const row=grid[r]||[]; let d=-1,q=-1;
    row.forEach((c,i)=>{ const s=String(c).trim(); if(d<0 && descRe.test(s)) d=i; });
    row.forEach((c,i)=>{ const s=String(c).trim(); if(qtyRe.test(s) && (q<0 || (d>=0 && Math.abs(i-d)<Math.abs(q-d)))) q=i; });
    if(d>=0 && q>=0){ best={header:r,desc:d,qty:q,found:true}; break; }
    if(d>=0 && !best) best={header:r,desc:d,qty:-1,found:false};
  }
  if(!best) best={header:0,desc:-1,qty:-1,found:false};
  const width=Math.max(0,...grid.slice(best.header,best.header+50).map(r=>r.length));
  const body=grid.slice(best.header+1,best.header+80);
  if(best.desc<0){ // longest text column
    let sc=-1; for(let i=0;i<width;i++){ const s=body.reduce((a,r)=>a+(typeof r[i]==='string'&&isNaN(toNum(r[i]))?String(r[i]).length:0),0); if(s>sc){sc=s;best.desc=i;} }
  }
  if(best.qty<0){ // first mostly-integer column right of desc
    for(let i=0;i<width;i++){ if(i===best.desc) continue; const vals=body.map(r=>toNum(r[i])).filter(v=>!isNaN(v)); if(vals.length>body.length*0.8 && vals.every(v=>Number.isInteger(v)&&v>=0&&v<1000)){ best.qty=i; if(i>best.desc) break; } }
  }
  return best;
}

function loadSheet(name, detect=true){
  P.sheet=name;
  P.grid = XLSX.utils.sheet_to_json(P.wb.Sheets[name],{header:1,defval:'',raw:true,blankrows:true});
  if(detect){ const a=autoDetect(P.grid); Object.assign(P,{header:a.header,desc:a.desc,qty:a.qty,found:a.found}); }
}

function parsed(){
  const out=[]; let skipped=0, badQty=0;
  for(let r=P.header+1;r<P.grid.length;r++){
    const row=P.grid[r]||[]; const d=String(row[P.desc]??'').trim(); const qv=row[P.qty]; const q=toNum(qv);
    if(!d && (qv===''||qv==null)) continue;
    if(!d){ skipped++; continue; }
    if(isNaN(q)){ badQty++; skipped++; continue; }
    out.push({desc:d,qty:q,row:r+1});
  }
  return {rows:out,skipped,badQty};
}

function renderPreview(){
  $('#dlgTitle').textContent=P.name;
  $('#selSheet').innerHTML=P.wb.SheetNames.map(n=>`<option ${n===P.sheet?'selected':''}>${esc(n)}</option>`).join('');
  $('#selHeader').value=P.header+1;
  const hdr=P.grid[P.header]||[];
  const width=Math.max(hdr.length,...P.grid.slice(P.header,P.header+40).map(r=>r.length),1);
  const opt=sel=>'<option value="-1">— เลือกคอลัมน์ —</option>'+Array.from({length:width},(_,i)=>`<option value="${i}" ${i===sel?'selected':''}>${colName(i)} : ${esc(String(hdr[i]??'').slice(0,40))||'(ว่าง)'}</option>`).join('');
  $('#selDesc').innerHTML=opt(P.desc); $('#selQty').innerHTML=opt(P.qty);
  $('#dlgAuto').innerHTML = P.found
    ? `<span class="text-good font-medium">ตรวจพบอัตโนมัติ</span> <span class="text-muted">หัวตารางแถว ${P.header+1}, ItemDesc = คอลัมน์ ${colName(P.desc)}, Qty = คอลัมน์ ${colName(P.qty)}</span>`
    : `<span class="text-warn font-medium">ไม่พบหัวคอลัมน์ ItemDesc/Qty ชัดเจน</span> <span class="text-muted">ระบบเดาคอลัมน์ให้แล้ว กรุณาตรวจสอบและเลือกใหม่ถ้าไม่ถูกต้อง</span>`;
  // raw table
  const cls=i=> i===P.desc?'col-desc':i===P.qty?'col-qty':'';
  const rows=P.grid.slice(P.header+1,P.header+16);
  $('#rawTable').innerHTML = `<thead class="sticky top-0 bg-sunken"><tr><th class="px-2 py-1 text-muted text-left font-medium">แถว</th>${Array.from({length:width},(_,i)=>`<th data-col="${i}" class="${cls(i)} px-2 py-1 text-left cursor-pointer hover:underline whitespace-nowrap font-semibold" title="คลิกเพื่อตั้งเป็น ${P.pick==='desc'?'ItemDesc':'Qty'}"><div class="text-muted text-[10px] num">${colName(i)}${i===P.desc?' · ItemDesc':i===P.qty?' · Qty':''}</div>${esc(String(hdr[i]??'').slice(0,30))}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r,ri)=>`<tr class="border-t border-line"><td class="px-2 py-1 text-muted num">${P.header+2+ri}</td>${Array.from({length:width},(_,i)=>`<td class="${cls(i)} px-2 py-1 whitespace-nowrap max-w-[220px] truncate">${esc(r[i])}</td>`).join('')}</tr>`).join('')}</tbody>`;
  $('#rawNote').textContent=`แสดง 15 แถวแรกจากทั้งหมด ${Math.max(0,P.grid.length-P.header-1)} แถว`;
  document.querySelectorAll('.pm').forEach(b=>{ const on=b.dataset.pick===P.pick; b.classList.toggle('bg-accent',on&&P.pick==='desc'); b.classList.toggle('bg-good',on&&P.pick==='qty'); b.classList.toggle('text-accent-ink',on); b.classList.toggle('text-white',on&&P.pick==='qty'); });
  // parsed
  const warn=[]; let stats='', list='';
  if(P.desc<0||P.qty<0){ warn.push(['warn','กรุณาเลือกคอลัมน์ ItemDesc และ Qty ให้ครบ']); }
  else if(P.desc===P.qty){ warn.push(['warn','ItemDesc และ Qty เป็นคอลัมน์เดียวกัน กรุณาเลือกใหม่']); }
  else{
    const p=parsed(), idx=menuIndex();
    const matched=p.rows.filter(r=>idx.has(norm(r.desc)));
    const tq=p.rows.reduce((s,r)=>s+r.qty,0);
    if(p.rows.length && p.badQty>p.rows.length*0.3) warn.push(['warn',`คอลัมน์ Qty มีค่าที่ไม่ใช่ตัวเลข ${p.badQty} แถว อาจเลือกคอลัมน์ผิด`]);
    if(p.rows.length && !matched.length) warn.push(['warn','ไม่มีชื่อเมนูที่ตรงกับสูตรเลย คอลัมน์ ItemDesc อาจไม่ถูกต้อง']);
    if(p.rows.length && p.rows.some(r=>!Number.isInteger(r.qty))) warn.push(['info','พบ Qty ที่เป็นทศนิยม ตรวจสอบว่าไม่ได้เลือกคอลัมน์ราคาแทนจำนวน']);
    const st=(l,v,c='')=>`<div class="rounded-lg bg-sunken px-3 py-2"><div class="text-xs text-muted">${l}</div><div class="num text-lg font-semibold ${c}">${v}</div></div>`;
    stats=st('แถวที่ดึงได้',fmt(p.rows.length,0))+st('Qty รวม',fmt(tq))+st('ตรงกับสูตร',fmt(matched.length,0)+' แถว','text-good')+st('ข้ามไป',fmt(p.skipped,0)+' แถว',p.skipped?'text-warn':'');
    list=p.rows.slice(0,300).map((r,i)=>{ const m=idx.has(norm(r.desc)); return `<tr class="border-t border-line"><td class="px-3 py-1 text-muted num text-xs">${r.row}</td><td class="px-3 py-1">${esc(r.desc)}</td><td class="px-3 py-1 text-right num">${fmt(r.qty,3)}</td><td class="px-3 py-1">${m?'<span class="text-good text-xs font-medium">ตรงกับสูตร</span>':'<span class="text-muted text-xs">ไม่มีในสูตร</span>'}</td></tr>`; }).join('');
    P._parsed=p;
  }
  $('#dlgStats').innerHTML=stats;
  $('#dlgParsed').innerHTML=list||'<tr><td colspan="4" class="px-3 py-4 text-center text-muted">ไม่มีข้อมูล</td></tr>';
  $('#dlgWarn').innerHTML=warn.map(([t,m])=>`<div class="rounded-lg px-3 py-2 text-sm ${t==='warn'?'bg-warn-soft text-warn':'bg-sunken text-muted'}">${esc(m)}</div>`).join('');
  $('#dlgOk').disabled = !(P.desc>=0&&P.qty>=0&&P.desc!==P.qty&&P._parsed?.rows.length);
  }

async function openSalesFile(file){
  try{
    const buf=await file.arrayBuffer();
    P.wb=XLSX.read(buf,{type:'array',cellDates:false}); P.name=file.name; P.pick='desc'; P._parsed=null;
    // choose sheet: first where detection finds headers
    let chosen=P.wb.SheetNames[0];
    for(const n of P.wb.SheetNames){ const g=XLSX.utils.sheet_to_json(P.wb.Sheets[n],{header:1,defval:'',blankrows:true}); if(autoDetect(g).found){ chosen=n; break; } }
    loadSheet(chosen);
    renderPreview(); lastPreview=true;
    $('#dlg').showModal();
  }catch(e){ toast('อ่านไฟล์ไม่ได้: '+(e.message||e)); }
}

$('#fileSales').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) openSalesFile(f); e.target.value=''; });
const drop=$('#drop');
['dragenter','dragover'].forEach(ev=>document.addEventListener(ev,e=>{ if(!e.dataTransfer?.types?.includes('Files')) return; e.preventDefault(); drop.classList.add('is-over');}));
['dragleave','drop'].forEach(ev=>document.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.remove('is-over');}));
document.addEventListener('drop',e=>{ if($('#app').hidden || $('#dlg').open || !ICS_AUTH.can('material','w')) return; const f=e.dataTransfer?.files?.[0]; if(f) openSalesFile(f); });

/* ---------- Clear ---------- */
const clearBtn=$('#btnClear');
clearBtn.addEventListener('click',()=>{
  if(!clearBtn.dataset.armed){ clearBtn.dataset.armed='1'; setLbl(clearBtn,'กดอีกครั้งเพื่อยืนยันการล้าง'); clearBtn.classList.add('is-armed'); clearTimeout(clearBtn._t); clearBtn._t=setTimeout(resetClear,3500); return; }
  resetClear();
  sales=[]; source=null; P.wb=null; P._parsed=null; $('#salesSearch').value=''; tab='sum';
  renderAll(); toast('ล้างข้อมูลแล้ว');
});
function resetClear(){ delete clearBtn.dataset.armed; setLbl(clearBtn,'ล้างข้อมูล'); clearBtn.classList.remove('is-armed'); }

$('#selSheet').addEventListener('change',e=>{ loadSheet(e.target.value); renderPreview(); });
$('#selHeader').addEventListener('change',e=>{ P.header=Math.max(0,(parseInt(e.target.value)||1)-1); renderPreview(); });
$('#selDesc').addEventListener('change',e=>{ P.desc=+e.target.value; renderPreview(); });
$('#selQty').addEventListener('change',e=>{ P.qty=+e.target.value; renderPreview(); });
$('#pickMode').addEventListener('click',e=>{ const b=e.target.closest('[data-pick]'); if(b){ P.pick=b.dataset.pick; renderPreview(); } });
$('#rawTable').addEventListener('click',e=>{ const th=e.target.closest('th[data-col]'); if(!th) return; const c=+th.dataset.col; if(P.pick==='desc'){ P.desc=c; P.pick='qty'; } else { P.qty=c; P.pick='desc'; } renderPreview(); });
const closeDlg=()=>$('#dlg').close();
$('#dlgClose').addEventListener('click',closeDlg); $('#dlgCancel').addEventListener('click',closeDlg);
$('#dlgOk').addEventListener('click',()=>{
  if(!P._parsed) return;
  sales=P._parsed.rows.map(r=>({desc:r.desc,qty:r.qty}));
  source={name:`${P.name} · ${P.sheet} · ${colName(P.desc)}/${colName(P.qty)}`};
  saveEntrySafe('sales', {
    id: Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    ts: Date.now(),
    fileName: P.name,
    sheet: P.sheet,
    rowCount: sales.length,
    sales: sales.map(s=>({d:s.desc,q:s.qty}))
  });
  closeDlg(); tab='sum'; renderAll(); toast(`คำนวณจาก ${sales.length} รายการแล้ว`);
});
$('#btnRepreview').addEventListener('click',()=>{ if(P.wb){ renderPreview(); $('#dlg').showModal(); } });

/* ---------- History ---------- */
const HISTORY_KEY='ics-history';
const HISTORY_MAX=15;
function loadHistory(){ try{ return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]'); }catch(_){ return []; } }
function saveHistory(list){ try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); return true; }catch(_){ return false; } }
function addHistoryEntry(entry){
  let list=loadHistory();
  list.unshift(entry);
  while(list.length>HISTORY_MAX) list.pop();
  while(list.length && !saveHistory(list)) list.pop(); // drop oldest if quota exceeded
}
function fmtWhen(ts){ return new Date(ts).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}); }

/* ---------- Storage quota ---------- */
const STORAGE_QUOTA_BYTES = 5*1024*1024; // conservative estimate (Safari's typical per-origin limit)
function estimateStorageUsage(){
  let used=0;
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      const v=localStorage.getItem(k)||'';
      used += new Blob([k+v]).size;
    }
  }catch(_){}
  return { usedBytes: used, quotaBytes: STORAGE_QUOTA_BYTES, remainingBytes: Math.max(0, STORAGE_QUOTA_BYTES-used) };
}
function fmtBytes(n){
  if(n<1024) return n+' B';
  if(n<1024*1024) return (n/1024).toFixed(1)+' KB';
  return (n/1024/1024).toFixed(2)+' MB';
}
function renderStorageUsage(elId){
  const el=$('#'+(elId||'historyStorageInfo')); if(!el) return;
  const {usedBytes,quotaBytes,remainingBytes}=estimateStorageUsage();
  const pct=Math.min(100,Math.round(usedBytes/quotaBytes*100));
  el.textContent=`ใช้พื้นที่ไป ${fmtBytes(usedBytes)} จาก ~${fmtBytes(quotaBytes)} (เหลือ ~${fmtBytes(remainingBytes)}, ${pct}%)`;
  el.classList.toggle('text-warn',pct>=80);
  el.classList.toggle('text-muted',pct<80);
}
function willExceedQuota(entry){
  const bytes=new Blob([JSON.stringify(entry)]).size;
  const {usedBytes,quotaBytes}=estimateStorageUsage();
  return (usedBytes+bytes) > quotaBytes;
}
let pendingSave=null; // {type:'sales'|'master', entry}
function saveEntrySafe(type, entry){
  if(willExceedQuota(entry)){
    pendingSave={type, entry};
    renderStorageUsage(); renderStorageUsage('masterHistoryStorageInfo');
    $('#dlgQuotaWarn').showModal();
    return;
  }
  if(type==='sales') addHistoryEntry(entry); else addMasterHistoryEntry(entry);
}
$('#dlgQuotaClose').addEventListener('click',()=>{ pendingSave=null; $('#dlgQuotaWarn').close(); });
$('#dlgQuotaSkip').addEventListener('click',()=>{ pendingSave=null; $('#dlgQuotaWarn').close(); toast('ข้ามการบันทึกประวัติครั้งนี้'); });
$('#dlgQuotaClearSave').addEventListener('click',()=>{
  if(pendingSave){
    if(pendingSave.type==='sales'){ saveHistory([]); addHistoryEntry(pendingSave.entry); }
    else { saveMasterHistory([]); addMasterHistoryEntry(pendingSave.entry); }
    toast('ล้างประวัติเก่าและบันทึกรายการนี้แล้ว');
  }
  pendingSave=null; $('#dlgQuotaWarn').close();
});
$('#dlgQuotaOpenHistory').addEventListener('click',()=>{
  const type=pendingSave?.type; pendingSave=null; $('#dlgQuotaWarn').close();
  if(type==='master'){ renderMasterHistoryList(); $('#dlgMasterHistory').showModal(); return; }
  multiSelectMode=false; selectedHistoryIds.clear(); updateMultiUI(); renderHistoryList(); renderStorageUsage(); $('#dlgHistory').showModal();
});

let multiSelectMode=false;
let selectedHistoryIds=new Set();
function renderHistoryList(){
  renderStorageUsage();
  const list=loadHistory(); const box=$('#historyList');
  if(!list.length){ box.innerHTML='<div class="text-muted text-center py-8">ยังไม่มีประวัติ</div>'; return; }
  box.innerHTML=list.map(h=>{
    const meta=`<div class="min-w-0">
      <div class="font-medium truncate">${esc(h.fileName)}${h.sheet?` · ${esc(h.sheet)}`:''}</div>
      <div class="text-muted text-xs mt-1">${esc(fmtWhen(h.ts))} · <span class="num">${fmt(h.rowCount,0)}</span> แถว</div>
    </div>`;
    if(multiSelectMode){
      const checked=selectedHistoryIds.has(h.id)?'checked':'';
      return `<label class="rounded-xl border border-line bg-surface p-4 flex items-center gap-3 cursor-pointer">
        <input type="checkbox" data-sel="${h.id}" class="accent-[var(--accent)]" ${checked}>
        ${meta}
      </label>`;
    }
    return `<div class="rounded-xl border border-line bg-surface p-4 flex items-center justify-between gap-3">
      ${meta}
      <div class="flex gap-2 shrink-0">
        <button data-use="${h.id}" class="btn btn-primary">${ic('arrow')}ใช้ไฟล์นี้</button>
        <button data-del="${h.id}" data-perm="d" class="btn btn-danger">${ic('trash')}ลบ</button>
      </div>
    </div>`;
  }).join('');
}
function useHistoryEntry(id){
  const h=loadHistory().find(x=>x.id===id); if(!h) return;
  sales=h.sales.map(r=>({desc:r.d,qty:r.q}));
  source={name:`${h.fileName}${h.sheet?` · ${h.sheet}`:''} (จากประวัติ ${fmtWhen(h.ts)})`};
  $('#dlgHistory').close(); tab='sum'; renderAll(); toast(`โหลดจากประวัติ: ${h.fileName}`);
}
function deleteHistoryEntry(id){ selectedHistoryIds.delete(id); saveHistory(loadHistory().filter(x=>x.id!==id)); renderHistoryList(); }
function updateMultiUI(){
  const btn=$('#btnHistoryMulti');
  setLbl(btn, multiSelectMode ? 'ยกเลิกเลือกหลายไฟล์' : 'เลือกหลายไฟล์');
  btn.classList.toggle('is-on',multiSelectMode);
  $('#btnHistoryMerge').hidden = !multiSelectMode;
  updateMergeButton();
}
function updateMergeButton(){
  const n=selectedHistoryIds.size; const btn=$('#btnHistoryMerge');
  setLbl(btn, n>=2 ? `รวมและคำนวณ (${n} ไฟล์)` : 'รวมและคำนวณ');
  btn.disabled = n<2;
}
function mergeSelectedHistory(){
  const list=loadHistory();
  const chosen=list.filter(h=>selectedHistoryIds.has(h.id));
  if(chosen.length<2) return;
  const agg=new Map();
  chosen.forEach(h=>h.sales.forEach(r=>{ const k=norm(r.d); const cur=agg.get(k)||{desc:r.d,qty:0}; cur.qty+=r.q; agg.set(k,cur); }));
  const mergedSales=[...agg.values()];
  const names=chosen.map(h=>h.fileName);
  const label = names.length<=3 ? names.join(', ') : `${names.slice(0,3).join(', ')} +${names.length-3} ไฟล์`;
  sales=mergedSales.map(s=>({desc:s.desc,qty:s.qty}));
  source={name:`รวม ${chosen.length} ไฟล์: ${label}`};
  saveEntrySafe('sales', {
    id: Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    ts: Date.now(),
    fileName: `รวม ${chosen.length} ไฟล์ (${label})`,
    sheet: '',
    rowCount: sales.length,
    sales: sales.map(s=>({d:s.desc,q:s.qty}))
  });
  multiSelectMode=false; selectedHistoryIds.clear(); updateMultiUI();
  $('#dlgHistory').close(); tab='sum'; renderAll();
  toast(`รวม ${chosen.length} ไฟล์แล้ว (${sales.length} เมนู)`);
}
$('#btnHistory').addEventListener('click',()=>{ multiSelectMode=false; selectedHistoryIds.clear(); updateMultiUI(); renderHistoryList(); $('#dlgHistory').showModal(); });
$('#dlgHistoryClose').addEventListener('click',()=>$('#dlgHistory').close());
$('#dlgHistoryCancel').addEventListener('click',()=>$('#dlgHistory').close());
$('#btnHistoryMulti').addEventListener('click',()=>{
  multiSelectMode=!multiSelectMode;
  if(!multiSelectMode) selectedHistoryIds.clear();
  updateMultiUI(); renderHistoryList();
});
$('#btnHistoryMerge').addEventListener('click',mergeSelectedHistory);
$('#historyList').addEventListener('click',e=>{
  const u=e.target.closest('[data-use]'); if(u){ useHistoryEntry(u.dataset.use); return; }
  const d=e.target.closest('[data-del]'); if(d){ deleteHistoryEntry(d.dataset.del); }
});
$('#historyList').addEventListener('change',e=>{
  const cb=e.target.closest('[data-sel]'); if(!cb) return;
  if(cb.checked) selectedHistoryIds.add(cb.dataset.sel); else selectedHistoryIds.delete(cb.dataset.sel);
  updateMergeButton();
});
const histClearBtn=$('#btnHistoryClear');
histClearBtn.addEventListener('click',()=>{
  if(!histClearBtn.dataset.armed){ histClearBtn.dataset.armed='1'; setLbl(histClearBtn,'กดอีกครั้งเพื่อยืนยัน'); histClearBtn.classList.add('is-armed'); clearTimeout(histClearBtn._t); histClearBtn._t=setTimeout(resetHistClear,3500); return; }
  resetHistClear(); saveHistory([]); renderHistoryList(); toast('ล้างประวัติแล้ว');
});
function resetHistClear(){ delete histClearBtn.dataset.armed; setLbl(histClearBtn,'ล้างประวัติทั้งหมด'); histClearBtn.classList.remove('is-armed'); }

/* ---------- Master upload ---------- */
function parseMaster(wb){
  const names=[...wb.SheetNames].sort((a,b)=>(b.toLowerCase()==='template')-(a.toLowerCase()==='template'));
  for(const n of names){
    const ws=wb.Sheets[n]; if(!ws['!ref']) continue;
    const rg=XLSX.utils.decode_range(ws['!ref']); const cell=(r,c)=>ws[XLSX.utils.encode_cell({r,c})];
    const val=(r,c)=>{ const x=cell(r,c); return x?x.v:undefined; };
    const groups=[];
    for(let r=rg.s.r;r<=rg.e.r;r++){
      const b=val(r,1), h=cell(r,7);
      if(!b || !h || !h.f) continue;
      const m=h.f.replace(/\s|\+/g,'').match(/^SUM\(G(\d+)(?::G(\d+))?\)(?:\/([\d.]+))?/i); if(!m) continue;
      const s=+m[1]-1, e=+(m[2]||m[1])-1, d=m[3]?+m[3]:1;
      const items=[]; for(let rr=s;rr<=e;rr++){ const c=val(rr,2), w=val(rr,3); if(c!=null && c!=='' && typeof w==='number') items.push({menu:String(c),w,u:val(rr,4)||''}); }
      if(items.length) groups.push({name:String(b),div:d,unit:val(r,8)||'',base:items[0].u,items});
    }
    if(groups.length) return {groups,sheet:n};
  }
  return null;
}
$('#fileMaster').addEventListener('change',async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  try{
    const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellFormula:true});
    const res=parseMaster(wb);
    if(!res){ toast('ไม่พบสูตรในคอลัมน์ B–I (ต้องมีชื่อวัตถุดิบในคอลัมน์ B และสูตร =SUM(G..) ในคอลัมน์ H)'); return; }
    const entry={ id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), ts:Date.now(), name:`${f.name} · ชีต ${res.sheet}`, groups:res.groups };
    master=entry.groups; masterName=entry.name; activeMasterId=entry.id;
    setActiveMaster(entry.id);
    saveEntrySafe('master', entry);
    renderAll(); toast(`โหลด Master แล้ว ${master.length} วัตถุดิบ`);
  }catch(err){ toast('อ่านไฟล์ Master ไม่ได้: '+(err.message||err)); }
});
$('#btnResetMaster').addEventListener('click',()=>{ master=DEFAULT_MASTER; masterName=MASTER_DEFAULT_NAME; activeMasterId='default'; setActiveMaster('default'); renderAll(); toast('กลับไปใช้ Master ค่าเริ่มต้นแล้ว'); });

/* ---------- Master history ---------- */
function loadMasterHistory(){ try{ return JSON.parse(localStorage.getItem(MASTER_HISTORY_KEY)||'[]'); }catch(_){ return []; } }
function saveMasterHistory(list){ try{ localStorage.setItem(MASTER_HISTORY_KEY, JSON.stringify(list)); return true; }catch(_){ return false; } }
function addMasterHistoryEntry(entry){
  let list=loadMasterHistory();
  list.unshift(entry);
  while(list.length>MASTER_HISTORY_MAX) list.pop();
  while(list.length && !saveMasterHistory(list)) list.pop();
}
function setActiveMaster(id){ try{ localStorage.setItem(MASTER_ACTIVE_KEY,id); }catch(_){} }
function getActiveMaster(){ try{ return localStorage.getItem(MASTER_ACTIVE_KEY)||'default'; }catch(_){ return 'default'; } }
function useMasterEntry(id){
  if(id==='default'){ master=DEFAULT_MASTER; masterName=MASTER_DEFAULT_NAME; activeMasterId='default'; setActiveMaster('default'); }
  else{
    const h=loadMasterHistory().find(x=>x.id===id); if(!h) return;
    master=h.groups; masterName=h.name; activeMasterId=h.id; setActiveMaster(h.id);
  }
  $('#dlgMasterHistory').close(); renderAll(); toast(`ใช้ Master: ${masterName}`);
}
function deleteMasterEntry(id){
  saveMasterHistory(loadMasterHistory().filter(x=>x.id!==id));
  if(activeMasterId===id){ master=DEFAULT_MASTER; masterName=MASTER_DEFAULT_NAME; activeMasterId='default'; setActiveMaster('default'); renderAll(); }
  renderMasterHistoryList();
}
function renameMasterEntry(id, newName){
  newName=newName.trim(); if(!newName) return;
  const list=loadMasterHistory(); const h=list.find(x=>x.id===id); if(!h) return;
  h.name=newName;
  if(!saveMasterHistory(list)){ toast('บันทึกชื่อไม่สำเร็จ (พื้นที่เก็บข้อมูลเต็ม)'); return; }
  if(activeMasterId===id) masterName=newName;
  renderMaster();
}
function renderMasterHistoryList(){
  renderStorageUsage('masterHistoryStorageInfo');
  const list=loadMasterHistory(); const box=$('#masterHistoryList');
  const items=[{id:'default', ts:null, name:MASTER_DEFAULT_NAME, isDefault:true}, ...list];
  box.innerHTML=items.map(h=>{
    const active=h.id===activeMasterId;
    const badge=active?'<div class="mt-1"><span class="text-xs font-semibold text-good">ใช้งานอยู่</span></div>':'';
    const whenLine=h.isDefault?'สูตรในตัว ไม่ต้องอัปโหลด':esc(fmtWhen(h.ts));
    const nameField=h.isDefault
      ? `<div class="font-medium truncate">${esc(h.name)}</div>`
      : `<input data-rename="${h.id}" value="${esc(h.name)}" class="px-2 py-1 rounded-md border border-line bg-bg text-sm font-medium w-full">`;
    return `<div class="rounded-xl border ${active?'border-accent':'border-line'} bg-surface p-4 flex flex-col gap-3">
      <div class="min-w-0">
        ${nameField}
        <div class="text-muted text-xs mt-1">${whenLine}</div>
        ${badge}
      </div>
      <div class="flex flex-wrap justify-end gap-2 shrink-0">
        <button data-dl-master="${h.id}" class="btn btn-good" title="ดาวน์โหลดเป็นไฟล์ Template">${ic('download')}ดาวน์โหลด</button>
        ${active?'':`<button data-use-master="${h.id}" class="btn btn-primary">${ic('check')}ใช้ Master นี้</button>`}
        ${h.isDefault?'':`<button data-del-master="${h.id}" data-perm="d" class="btn btn-danger">${ic('trash')}ลบ</button>`}
      </div>
    </div>`;
  }).join('');
}
$('#btnMasterHistory').addEventListener('click',()=>{ renderMasterHistoryList(); $('#dlgMasterHistory').showModal(); });
$('#dlgMasterHistoryClose').addEventListener('click',()=>$('#dlgMasterHistory').close());
$('#dlgMasterHistoryCancel').addEventListener('click',()=>$('#dlgMasterHistory').close());
$('#masterHistoryList').addEventListener('click',e=>{
  const u=e.target.closest('[data-use-master]'); if(u){ useMasterEntry(u.dataset.useMaster); return; }
  const dl=e.target.closest('[data-dl-master]'); if(dl){ downloadMasterEntry(dl.dataset.dlMaster); return; }
  const d=e.target.closest('[data-del-master]'); if(d){ deleteMasterEntry(d.dataset.delMaster); }
});
$('#masterHistoryList').addEventListener('change',e=>{
  const inp=e.target.closest('[data-rename]'); if(!inp) return;
  renameMasterEntry(inp.dataset.rename, inp.value);
});
const masterHistClearBtn=$('#btnMasterHistoryClear');
masterHistClearBtn.addEventListener('click',()=>{
  if(!masterHistClearBtn.dataset.armed){ masterHistClearBtn.dataset.armed='1'; setLbl(masterHistClearBtn,'กดอีกครั้งเพื่อยืนยัน'); masterHistClearBtn.classList.add('is-armed'); clearTimeout(masterHistClearBtn._t); masterHistClearBtn._t=setTimeout(resetMasterHistClear,3500); return; }
  resetMasterHistClear();
  saveMasterHistory([]);
  if(activeMasterId!=='default'){ master=DEFAULT_MASTER; masterName=MASTER_DEFAULT_NAME; activeMasterId='default'; setActiveMaster('default'); renderAll(); }
  renderMasterHistoryList(); toast('ล้างประวัติ Master แล้ว');
});
function resetMasterHistClear(){ delete masterHistClearBtn.dataset.armed; setLbl(masterHistClearBtn,'ล้างประวัติ Master ทั้งหมด'); masterHistClearBtn.classList.remove('is-armed'); }


/* ---------- Master template (Excel) ---------- */
// Same layout & formulas as the original "Template" sheet:
// B วัตถุดิบ (first row of group) · C ItemDesc · D นน.ที่ใช้ · E หน่วย
// F S102 =SUMIF($K:$K,C,$L:$L) · G นน.รวม =+F*D · H =SUM(G..)/ตัวหาร · I หน่วยเบิก
// K/L = paste ItemDesc / Qty from POS to preview the result in Excel · one blank row between groups
const TPL_SALES_LAST=1000;
function buildMasterTemplate(groups){
  const U=XLSX.utils, wb=U.book_new(), ws={};
  const C={ink:'18202F',muted:'5C6579',line:'DCE1E9',band:'F4F6F9',white:'FFFFFF',accentSoft:'F6E4E6',goodSoft:'E3F1E7'};
  const thin={style:'thin',color:{rgb:C.line}}, box={top:thin,bottom:thin,left:thin,right:thin};
  const st=(o={})=>({font:{name:'Tahoma',sz:10,color:{rgb:C.ink},...(o.font||{})},alignment:{vertical:'center',...(o.al||{})},...(o.border===false?{}:{border:box}),...(o.fill?{fill:{patternType:'solid',fgColor:{rgb:o.fill}}}:{})});
  const H=st({font:{bold:true,color:{rgb:C.white}},fill:C.ink,al:{horizontal:'center'}});
  [['C','ItemDesc'],['D','นน.ที่ใช้'],['E','หน่วย'],['F','S102'],['G','นน.รวม'],['H','ยอดเบิก'],['I','หน่วยเบิก'],['K','ItemDesc'],['L','Qty']]
    .forEach(([c,v])=>{ ws[c+'2']={t:'s',v,s:H}; });
  ws['B2']={t:'s',v:'วัตถุดิบ',s:H};
  const rngK=`$K$3:$K$${TPL_SALES_LAST}`, rngL=`$L$3:$L$${TPL_SALES_LAST}`;
  let r=3;
  groups.forEach((g,gi)=>{
    const s=r, e=r+g.items.length-1, band=gi%2?C.band:C.white;
    g.items.forEach((it,k)=>{
      const first=k===0, cs=st({fill:band});
      ws['B'+r]= first?{t:'s',v:g.name,s:st({fill:band,font:{bold:true}})}:{t:'s',v:'',s:cs};
      ws['C'+r]={t:'s',v:it.menu,s:cs};
      ws['D'+r]={t:'n',v:it.w,s:{...cs,numFmt:'#,##0.###'}};
      ws['E'+r]={t:'s',v:it.u||g.base||'',s:cs};
      ws['F'+r]={t:'n',v:0,f:`SUMIF(${rngK},C${r},${rngL})`,s:{...cs,numFmt:'#,##0'}};
      ws['G'+r]={t:'n',v:0,f:`+F${r}*D${r}`,s:{...cs,numFmt:'#,##0.###'}};
      ws['H'+r]= first?{t:'n',v:0,f:`SUM(G${s}:G${e})`+(g.div&&g.div!==1?`/${g.div}`:''),s:{...st({fill:C.accentSoft,font:{bold:true}}),numFmt:'#,##0.###'}}:{t:'s',v:'',s:cs};
      ws['I'+r]= first?{t:'s',v:g.unit||g.base||'',s:st({fill:C.accentSoft,font:{bold:true}})}:{t:'s',v:'',s:cs};
      r++;
    });
    r++; // blank row between groups (same as original template)
  });
  for(let rr=3; rr<=Math.max(r,40); rr++){ ws['K'+rr]={t:'s',v:'',s:st({fill:C.goodSoft})}; ws['L'+rr]={t:'s',v:'',s:st({fill:C.goodSoft})}; }
  ws['!ref']=`A1:L${Math.max(r,40)}`;
  ws['!cols']=[{wch:4},{wch:15},{wch:40},{wch:9},{wch:7},{wch:8},{wch:9},{wch:10},{wch:10},{wch:3},{wch:34},{wch:8}];
  U.book_append_sheet(wb,ws,'Template');

  const help=[
    ['วิธีทำไฟล์ Master สำหรับ Maison Roru ICS'],
    [''],
    ['1. ใช้ชีตชื่อ "Template" (ระบบอ่านชีตนี้ก่อน) — 1 วัตถุดิบ = 1 กลุ่มแถวติดกัน เว้น 1 แถวว่างระหว่างกลุ่ม'],
    ['2. แถวแรกของกลุ่ม: ใส่ชื่อวัตถุดิบในคอลัมน์ B'],
    ['3. ทุกแถวในกลุ่ม: C = ItemDesc (สะกดให้ตรงกับ POS), D = นน.ที่ใช้ต่อ 1 เมนู (ตัวเลข), E = หน่วย'],
    ['4. F = SUMIF ยอดขายจากคอลัมน์ K/L, G = F × D'],
    ['5. แถวแรกของกลุ่ม คอลัมน์ H ต้องเป็นสูตร =SUM(G<แถวแรก>:G<แถวสุดท้าย>) — ถ้าต้องแปลงหน่วย เช่น กรัม→ถาด 170 กรัม ให้ต่อท้าย /170'],
    ['6. แถวแรกของกลุ่ม คอลัมน์ I = หน่วยเบิก'],
    ['7. คอลัมน์ K/L (สีเขียว) วาง ItemDesc / Qty จาก POS เพื่อดูผลใน Excel ได้ (ไม่จำเป็น เว็บคำนวณเอง)'],
    ['8. บันทึกเป็น .xlsx แล้วกด "อัปโหลด Master ใหม่" ในเว็บ']
  ];
  const wh=U.aoa_to_sheet(help);
  wh['A1'].s={font:{name:'Tahoma',sz:13,bold:true,color:{rgb:C.ink}}};
  for(let i=2;i<=help.length;i++){ if(wh['A'+i]) wh['A'+i].s={font:{name:'Tahoma',sz:10,color:{rgb:C.ink}}}; }
  wh['!cols']=[{wch:110}];
  U.book_append_sheet(wb,wh,'วิธีใช้');
  return wb;
}
function downloadMasterEntry(id){
  let groups;
  if(id==='default') groups=DEFAULT_MASTER;
  else{ const h=loadMasterHistory().find(x=>x.id===id); if(!h){ toast('ไม่พบรายการนี้'); return; } groups=h.groups; }
  deliverWorkbook(buildMasterTemplate(groups), `master-data-${new Date().toLocaleDateString('sv-SE')}.xlsx`); // YYYY-MM-DD
}

/* ---------- Excel workbook with Dashboard ---------- */
function buildWorkbook(){
  const U=XLSX.utils, wb=U.book_new();
  const C={ink:'18202F',muted:'5C6579',faint:'9AA3B5',line:'DCE1E9',accent:'A8343F',accentSoft:'F6E4E6',band:'F4F6F9',white:'FFFFFF',good:'2F7A4A',goodSoft:'E3F1E7'};
  const F='Tahoma';
  const thin={style:'thin',color:{rgb:C.line}}, med={style:'medium',color:{rgb:C.muted}};
  const box=(top=thin)=>({top,bottom:thin,left:thin,right:thin});
  const st=(o={})=>({font:{name:F,sz:10,color:{rgb:C.ink},...(o.font||{})},alignment:{vertical:'center',...(o.al||{})},...(o.fill?{fill:{patternType:'solid',fgColor:{rgb:o.fill}}}:{}),...(o.border?{border:o.border}:{})});
  const nf=v=>Number.isInteger(Math.round(v*1000)/1000)?'#,##0':'#,##0.00#';
  const put=(ws,addr,v,s,extra={})=>{ ws[addr]={t:typeof v==='number'?'n':'s',v,s,...extra}; };

  // --- ยอดขาย sheet (source for SUMIF)
  const salesRows=result.salesAgg;
  const wsS=U.aoa_to_sheet([['ItemDesc','Qty','ใช้ในวัตถุดิบ'],...salesRows.map(x=>[x.desc,x.qty,x.ings.join(', ')])]);
  ['A1','B1','C1'].forEach(a=>wsS[a].s=st({font:{bold:true,color:{rgb:C.white}},fill:C.ink,border:box()}));
  salesRows.forEach((x,i)=>{ const r=i+2; ['A','B','C'].forEach(c=>{ const cell=wsS[c+r]; if(cell) cell.s=st({font:x.ings.length?{}:{color:{rgb:C.faint}},border:box()}); }); });
  wsS['!cols']=[{wch:46},{wch:8},{wch:40}];
  const lastSales=salesRows.length+1;

  // --- Dashboard
  const ws={}; const merges=[]; let r=1;
  const now=new Date();
  const used=result.groups.filter(g=>g.total>0).length;
  const matched=result.salesAgg.filter(x=>x.ings.length).length, unmatched=result.salesAgg.length-matched;
  put(ws,'A1','Maison Roru ICONSIAM · S102 — สรุปการใช้วัตถุดิบ',st({font:{bold:true,sz:15,color:{rgb:C.white}},fill:C.ink,al:{horizontal:'left',indent:1}}));
  for(const c of 'BCDEFGHI') put(ws,c+'1','',st({fill:C.ink}));
  merges.push('A1:I1');
  put(ws,'A2',`ไฟล์ยอดขาย: ${source.name}    ·    ส่งออกเมื่อ ${now.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})}`,st({font:{color:{rgb:C.muted}},al:{indent:1}}));
  merges.push('A2:I2');
  // KPI row
  const kpis=[['รายการขาย',sales.length,'แถว'],['ตรงกับสูตร',matched,'เมนู'],['ไม่มีในสูตร',unmatched,'เมนู'],['วัตถุดิบที่ใช้',used,`/ ${result.groups.length}`]];
  const kcols=[['A','B'],['C','C'],['D','F'],['G','I']];
  kpis.forEach(([l,v,u],i)=>{ const [a,b]=kcols[i];
    put(ws,a+'3',l,st({font:{sz:9,color:{rgb:C.muted}},fill:C.band,al:{indent:1}}));
    put(ws,a+'4',`${v.toLocaleString()} ${u}`,st({font:{bold:true,sz:13,color:{rgb:i===1?C.good:i===2?'9A6212':C.ink}},fill:C.band,al:{indent:1}}));
    if(a!==b){ merges.push(`${a}3:${b}3`,`${a}4:${b}4`); }
    for(const c of 'ABCDEFGHI'.slice('ABCDEFGHI'.indexOf(a)+1,'ABCDEFGHI'.indexOf(b)+1)){ put(ws,c+'3','',st({fill:C.band})); put(ws,c+'4','',st({fill:C.band})); }
  });
  // header
  r=6;
  const heads=['ลำดับ','วัตถุดิบ','ItemDesc','นน.ที่ใช้','หน่วย','S102 (ขาย)','นน.รวม','ยอดเบิก','หน่วยเบิก'];
  heads.forEach((h,i)=>put(ws,U.encode_col(i)+r,h,st({font:{bold:true,color:{rgb:C.white}},fill:C.accent,border:box(),al:{horizontal:i<3?'left':'center'}})));
  r++;
  const summary=[];
  result.groups.forEach((g,gi)=>{
    const start=r, end=r+g.items.length-1, band=gi%2?C.band:C.white, top=med, zero=g.total<=0;
    g.items.forEach((it,ii)=>{
      const bt=ii===0?top:thin, dim=it.qty<=0;
      const base=(extra={})=>st({fill:band,border:box(bt),...extra});
      put(ws,'A'+r,ii===0?gi+1:'',base({al:{horizontal:'center',vertical:'top'},font:{color:{rgb:C.muted}}}));
      put(ws,'B'+r,ii===0?g.name:'',base({al:{vertical:'top'},font:{bold:true,sz:11,color:{rgb:zero?C.faint:C.ink}}}));
      put(ws,'C'+r,it.menu,base({font:{color:{rgb:dim?C.faint:C.ink}}}));
      put(ws,'D'+r,it.w,base({al:{horizontal:'right'},font:{color:{rgb:dim?C.faint:C.ink}}}),{z:nf(it.w)});
      put(ws,'E'+r,it.u||'',base({al:{horizontal:'center'},font:{color:{rgb:C.muted}}}));
      ws['F'+r]={t:'n',v:it.qty,f:`SUMIF('ยอดขาย'!$A$2:$A$${lastSales},C${r},'ยอดขาย'!$B$2:$B$${lastSales})`,z:'#,##0',s:base({al:{horizontal:'right'},font:dim?{color:{rgb:C.faint}}:{bold:true}})};
      ws['G'+r]={t:'n',v:it.total,f:`F${r}*D${r}`,z:nf(it.total),s:base({al:{horizontal:'right'},font:dim?{color:{rgb:C.faint}}:{bold:true}})};
      put(ws,'H'+r,'',base()); put(ws,'I'+r,'',base());
      r++;
    });
    const div=g.div&&g.div!==1;
    ws['H'+start]={t:'n',v:g.result,f:div?`SUM(G${start}:G${end})/${g.div}`:`SUM(G${start}:G${end})`,z:div?'#,##0.000':nf(g.result),
      s:st({fill:zero?band:C.accentSoft,border:box(top),al:{horizontal:'right',vertical:'center'},font:{bold:true,sz:13,color:{rgb:zero?C.faint:C.accent}}})};
    put(ws,'I'+start,g.unit||'',st({fill:zero?band:C.accentSoft,border:box(top),al:{horizontal:'left',vertical:'center'},font:{bold:true,color:{rgb:zero?C.faint:C.accent}}}));
    if(end>start){ merges.push(`A${start}:A${end}`,`B${start}:B${end}`,`H${start}:H${end}`,`I${start}:I${end}`); }
    summary.push([g,start]);
  });
  const lastRow=r-1;
  // side summary K:M
  put(ws,'K6','วัตถุดิบ',st({font:{bold:true,color:{rgb:C.white}},fill:C.ink,border:box()}));
  put(ws,'L6','ยอดเบิก',st({font:{bold:true,color:{rgb:C.white}},fill:C.ink,border:box(),al:{horizontal:'center'}}));
  put(ws,'M6','หน่วย',st({font:{bold:true,color:{rgb:C.white}},fill:C.ink,border:box(),al:{horizontal:'center'}}));
  put(ws,'K5','สรุปยอดเบิก',st({font:{bold:true,sz:11}}));
  summary.forEach(([g,start],i)=>{ const rr=7+i, zero=g.total<=0, band=i%2?C.band:C.white;
    put(ws,'K'+rr,g.name,st({fill:band,border:box(),font:{bold:!zero,color:{rgb:zero?C.faint:C.ink}}}));
    ws['L'+rr]={t:'n',v:g.result,f:`H${start}`,z:g.div&&g.div!==1?'#,##0.000':nf(g.result),s:st({fill:band,border:box(),al:{horizontal:'right'},font:{bold:!zero,color:{rgb:zero?C.faint:C.accent}}})};
    put(ws,'M'+rr,g.unit||'',st({fill:band,border:box(),font:{color:{rgb:zero?C.faint:C.muted}}}));
  });
  put(ws,'A'+(lastRow+2),'F = SUMIF จากชีต "ยอดขาย"  ·  G = F × D  ·  H = SUM(G) ÷ ขนาดบรรจุ (ถ้ามี)',st({font:{sz:9,italic:true,color:{rgb:C.muted}}}));
  ws['!ref']=`A1:M${Math.max(lastRow+2,7+summary.length)}`;
  ws['!merges']=merges.map(m=>U.decode_range(m));
  ws['!cols']=[{wch:6},{wch:15},{wch:50},{wch:10},{wch:8},{wch:11},{wch:11},{wch:13},{wch:10},{wch:3},{wch:16},{wch:11},{wch:9}];
  ws['!rows']=[{hpt:30},{hpt:18},{hpt:16},{hpt:22},{hpt:8},{hpt:22}];
  U.book_append_sheet(wb,ws,'Dashboard');

  // --- สรุป & รายละเอียด (plain tables, styled header)
  const hdr=(sheet,n)=>{ for(let i=0;i<n;i++){ const a=U.encode_col(i)+'1'; if(sheet[a]) sheet[a].s=st({font:{bold:true,color:{rgb:C.white}},fill:C.ink,border:box()}); } };
  const wsSum=U.aoa_to_sheet([['วัตถุดิบ','ใช้รวม','หน่วย','ตัวหาร','ยอดเบิก','หน่วยเบิก'],...summaryRows()]); hdr(wsSum,6); wsSum['!cols']=[{wch:16},{wch:11},{wch:8},{wch:8},{wch:11},{wch:10}];
  U.book_append_sheet(wb,wsSum,'สรุป');
  const det=[['วัตถุดิบ','ItemDesc','นน.ที่ใช้','หน่วย','จำนวนขาย','นน.รวม']]; result.groups.forEach(g=>g.items.forEach(i=>det.push([g.name,i.menu,i.w,i.u,i.qty,+i.total.toFixed(3)])));
  const wsD=U.aoa_to_sheet(det); hdr(wsD,6); wsD['!cols']=[{wch:16},{wch:44},{wch:10},{wch:8},{wch:10},{wch:10}];
  U.book_append_sheet(wb,wsD,'รายละเอียด');
  hdr(wsS,3);
  U.book_append_sheet(wb,wsS,'ยอดขาย');
  return wb;
}
/* ---------- Export ---------- */
function summaryRows(){ return result.groups.map(g=>[g.name, +g.total.toFixed(3), g.base||'', g.div||1, +g.result.toFixed(3), g.unit||'']); }
$('#btnCopy').addEventListener('click',async()=>{
  if(!source) return;
  const tsv=[['วัตถุดิบ','ใช้รวม','หน่วย','ตัวหาร','ยอดเบิก','หน่วยเบิก'],...summaryRows()].map(r=>r.join('\t')).join('\n');
  try{ await navigator.clipboard.writeText(tsv); toast('คัดลอกแล้ว วางใน Excel ได้เลย'); }
  catch(_){ const ta=document.createElement('textarea'); ta.value=tsv; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy'); toast('คัดลอกแล้ว');}catch(e){toast('คัดลอกไม่ได้');} ta.remove(); }
});
function xlsxBlob(wb){
  const out=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  return new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
async function tryShareFile(blob, filename){
  try{
    const file=new File([blob], filename, {type:blob.type});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title:filename});
      return true;
    }
  }catch(e){ if(e?.name==='AbortError') return true; }
  return false;
}
function directDownload(blob, filename){
  try{
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
    return true;
  }catch(e){ return false; }
}
let pendingExport=null;
$('#dlgAndroidCancel').addEventListener('click',()=>{ pendingExport=null; $('#dlgAndroidNotice').close(); });
$('#dlgAndroidContinue').addEventListener('click',()=>{
  $('#dlgAndroidNotice').close();
  if(pendingExport){ if(!directDownload(pendingExport.blob,pendingExport.filename)) toast('ดาวน์โหลดไม่ได้ ลองกดปุ่ม ⋯ แล้วเลือก "เปิดด้วยเบราว์เซอร์อื่น"'); pendingExport=null; }
});
$('#btnExport').addEventListener('click',()=>{
  if(!source) return;
  const base=(source.name.split(' · ')[0]||'sales').replace(/\.[^.]+$/,'');
  deliverWorkbook(buildWorkbook(), `export-ICS-${base}.xlsx`, 'ดาวน์โหลดไม่ได้ ใช้ปุ่ม "คัดลอกตาราง" แทน');
});
// Shared download path: Claude downloads capability → iOS share sheet → Android notice → direct download
function deliverWorkbook(wb, filename, failMsg){ return deliverBlob(xlsxBlob(wb), filename, failMsg); }
async function deliverBlob(blob, filename, failMsg='ดาวน์โหลดไม่ได้ ลองเปิดด้วยเบราว์เซอร์อื่น'){
  const dl = window.claude?.use ? await window.claude.use('downloads').catch(()=>null) : null;
  if(dl){
    try{ await dl.save({filename,data:blob}); toast('บันทึกไฟล์แล้ว'); }
    catch(e){ if(e?.code!=='declined') toast(failMsg); }
    return;
  }
  if(isIOS){
    const shared=await tryShareFile(blob,filename);
    if(shared){ toast('เลือก "บันทึกไปยังไฟล์" จากเมนูแชร์เพื่อเก็บไฟล์'); return; }
    if(!directDownload(blob,filename)) toast('ดาวน์โหลดไม่ได้ ลองกดปุ่ม ⋯ แล้วเลือก "เปิดด้วยเบราว์เซอร์อื่น"');
    return;
  }
  if(isAndroid){
    pendingExport={blob,filename};
    $('#dlgAndroidNotice').showModal();
    return;
  }
  if(!directDownload(blob,filename)) toast(failMsg);
}

/* ---------- misc ---------- */
$('#tabs').addEventListener('click',e=>{ const b=e.target.closest('[data-tab]'); if(b){ tab=b.dataset.tab; renderTabs(); } });
$('#salesFilter').addEventListener('click',e=>{ const b=e.target.closest('[data-f]'); if(b){ salesF=b.dataset.f; renderSales(); } });
$('#salesSearch').addEventListener('input',renderSales);
$('#masterSearch').addEventListener('input',renderMaster);
$('#salesHead').addEventListener('click',e=>{
  const th=e.target.closest('th[data-sort]'); if(!th) return;
  const k=th.dataset.sort;
  salesSort = salesSort.key===k ? {key:k, dir:salesSort.dir==='asc'?'desc':'asc'} : {key:k, dir:k==='qty'?'desc':'asc'};
  renderSales();
});
$('#hideZero').addEventListener('change',renderSum);

/* ---------- Auth: login.html + guard ใน <head> (js/auth.js) ---------- */
$('#btnLogout').addEventListener('click',ICS_AUTH.logout);
renderAll();
})();
