const DATA_URL='./timetable-data.json';
let BUS_DATA=null;
function getDefaultDay(){ const dow=new Date().getDay(); return (dow===0||dow===6)?'holiday':'weekday'; }
const state={stop:'通信研究所',day:getDefaultDay(),mode:'next',theme:null};

const stopSelect=document.getElementById('stopSelect');
const nextWrap=document.getElementById('nextWrap');
const timeline=document.getElementById('timeline');
const laneHeader=document.getElementById('laneHeader');
const tableTitle=document.getElementById('tableTitle');
const nextSection=document.getElementById('nextSection');
const tableSection=document.getElementById('tableSection');
const clockDisplay=document.getElementById('clockDisplay');
const root=document.documentElement;
const themeBtn=document.querySelector('[data-theme-toggle]');

['YRP野比駅','通信研究所','光の丘2番'].forEach(s=>{
  const o=document.createElement('option');o.value=s;o.textContent=s;
  if(s===state.stop)o.selected=true;
  stopSelect.appendChild(o);
});


function applyTheme(t){
  state.theme=t;root.setAttribute('data-theme',t);
  themeBtn.innerHTML=t==='dark'
    ?'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
    :'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}
function getDefaultTheme(){ const h=new Date().getHours(); return (h>=6&&h<18)?'light':'dark'; }
applyTheme(getDefaultTheme());
themeBtn.addEventListener('click',()=>applyTheme(state.theme==='dark'?'light':'dark'));


function toMins(hhmm){const[h,m]=hhmm.split(':').map(Number);return h*60+m;}

function nowMins(){const n=new Date();return n.getHours()*60+n.getMinutes();}

function currentData(){return BUS_DATA?.[state.day]?.[state.stop]||[];}

function flatten(){
  return currentData().flatMap(s=>s.times.map(t=>({...s,time:t,mins:toMins(t)}))).sort((a,b)=>a.mins-b.mins);
}


const ABBR={'通信研究所':'通研','横須賀市民病院':'病院','光の丘2番':'丘2番','YRPセンター':'YRP'};
const abbr=s=>ABBR[s]||s;

// destination は「行先（○○経由）」形式。行先と経由地に分解する
function laneInfo(dep){
  const note=dep.note||'';
  const bay=note.includes('1番')?'1':note.includes('2番')?'2':'';
  const m=dep.destination.match(/^(.+?)（(.+?)）$/);
  const via=m?m[2].replace(/経由$/,''):'';
  return{
    main:abbr(m?m[1]:dep.destination),
    via:via==='直通'?'':abbr(via),
    bay:bay,
    full:dep.destination
  };
}

function laneKey(dep){const i=laneInfo(dep);return`${i.main}|${i.via}|${i.bay}`;}


function orderedKeys(all){
  const seen=new Map();
  all.forEach(d=>{const k=laneKey(d);if(!seen.has(k))seen.set(k,laneInfo(d));});
  const keys=[...seen.keys()];
  if(state.stop!=='YRP野比駅')return keys;
  // のりば順（①→②）を優先し、その中を行先順に並べる
  const order=['丘2番','病院','通研'];
  const rank=i=>[i.bay==='1'?0:i.bay==='2'?1:2,(order.indexOf(i.main)+1||99)];
  return keys.sort((a,b)=>{
    const x=rank(seen.get(a)),y=rank(seen.get(b));
    return x[0]-y[0]||x[1]-y[1];
  });
}


function titleFor(){
  if(state.stop==='YRP野比駅')return'YRP野比駅 → 通信研究所';
  if(state.stop==='通信研究所')return'通信研究所 → YRP野比駅';
  return'光の丘2番 → YRP野比駅';
}


function updateClock(){ const now=new Date(); clockDisplay.textContent=now.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }


function renderNext(){
  const all=flatten(),nm=nowMins();
  const upcoming=all.filter(x=>x.mins>=nm).slice(0,3);

  if(!upcoming.length){nextWrap.innerHTML='<div class="empty">本日の運行は終了しています。</div>';return;}
  nextWrap.innerHTML='';
  upcoming.forEach((bus,idx)=>{
    const diff=bus.mins-nm,info=laneInfo(bus);
    const b=document.createElement('div');b.className='next-box'+(idx===0?' primary':'');
    b.innerHTML=`<div class="next-box-label">${['先発','次発','次々発'][idx]}</div>
      <div class="next-box-time">${bus.time}</div>
      <div class="next-box-meta">${diff}分後${info.bay?` · ${info.bay}番のりば`:''}</div>
      <div class="next-box-dest">${info.full}</div>`;
    nextWrap.appendChild(b);
  });
}


function renderTable(){
  const all=flatten(),nm=nowMins();
  const nextTime=all.find(x=>x.mins>=nm)?.time;
  tableTitle.textContent=titleFor();
  timeline.innerHTML='';
  if(!all.length){timeline.innerHTML='<div class="empty">該当する時刻がありません。</div>';return;}
  const minM=Math.floor(all[0].mins/15)*15;
  const maxM=Math.ceil(all[all.length-1].mins/15)*15;
  const PPM=2.8,LANE_GAP=28;
  const ax=document.createElement('div');ax.className='tl-axis';timeline.appendChild(ax);
  const axisX=ax.offsetLeft;
  const scrollW=timeline.parentElement.clientWidth||600;
  const usable=scrollW-axisX-24;
  const keys=orderedKeys(all),laneX={};
  const laneStep=Math.floor(usable/keys.length);
  keys.forEach((k,i)=>laneX[k]=axisX+16+i*laneStep);

  // ラベル幅を実測し、サブ列を隙間なく並べられるようにする
  const probe=document.createElement('div');probe.className='lbl';
  probe.style.visibility='hidden';probe.innerHTML='<span class="lbl-time">00:00</span>';
  timeline.appendChild(probe);
  const LBL_W=Math.ceil(probe.getBoundingClientRect().width)+2;
  probe.remove();

  // 見出し（のりば／経由／行先）。スクロール領域の外に置くため、
  // 縦スクロールバーは時刻の領域だけに現れる
  laneHeader.innerHTML='';
  const bar=document.createElement('div');bar.className='tl-lanes';
  // 見出しの中でも縦軸を切らさず上まで繋ぐ
  const axisHead=document.createElement('span');axisHead.className='tl-axis-head';
  axisHead.style.left=`${axisX}px`;bar.appendChild(axisHead);
  const keyCol=document.createElement('span');keyCol.className='tl-lane-keys';
  keyCol.style.width=`${axisX-6}px`;
  keyCol.innerHTML=['のりば','経由','行先'].map(t=>`<span class="lh-row">${t}</span>`).join('');
  bar.appendChild(keyCol);
  keys.forEach(k=>{
    const i=laneInfo(all.find(d=>laneKey(d)===k));
    const h=document.createElement('span');h.className='tl-lane-head';
    // 先頭列（メインの時刻列）の中心に合わせる。左右は隣のレーンとキー列を侵さない幅に収める
    const center=laneX[k]+(LBL_W-2)/2;
    h.dataset.lane=laneX[k];
    const half=Math.min((laneStep-6)/2,center-(axisX+4),scrollW-8-center);
    h.style.left=`${center-half}px`;h.style.width=`${half*2}px`;
    h.innerHTML=`<span class="lh-row">${i.bay?i.bay+'番':'―'}</span>`
      +`<span class="lh-row lh-via">${i.via||'―'}</span>`
      +`<span class="lh-row">${i.main}</span>`;
    bar.appendChild(h);
  });
  laneHeader.appendChild(bar);
  const headH=Math.ceil(Math.max(...[...bar.querySelectorAll('.tl-lane-head,.tl-lane-keys')].map(h=>h.getBoundingClientRect().height)));
  bar.style.height=`${headH+16}px`;
  const TOP=20;

  timeline.style.height=`${Math.max(400,TOP+(maxM-minM)*PPM+40)}px`;
  for(let t=minM;t<=maxM;t+=15){
    const y=TOP+(t-minM)*PPM,isHour=t%60===0,isNoon=t===720;
    const tick=document.createElement('div');
    tick.className='tick '+(isNoon?'noon':isHour?'major':'minor');
    tick.style.top=`${y}px`;timeline.appendChild(tick);
    const lbl=document.createElement('div');
    lbl.className='tlabel '+(isHour?'major':'minor');
    lbl.style.top=`${y}px`;
    lbl.textContent=isHour?`${String(Math.floor(t/60)).padStart(2,'0')}:00`:`${String(t%60).padStart(2,'0')}`;
    timeline.appendChild(lbl);
  }
  if(nm>=minM&&nm<=maxM){
    const nl=document.createElement('div');nl.className='now-line';
    nl.style.top=`${TOP+(nm-minM)*PPM}px`;timeline.appendChild(nl);
  }
  // レーンに横幅の余裕があれば列を分け、混雑時間帯の時刻ズレを抑える
  const subCols=Math.max(1,Math.floor(laneStep/LBL_W));
  const placed={};
  all.forEach(dep=>{
    const k=laneKey(dep),by=TOP+(dep.mins-minM)*PPM;
    const cols=placed[k]||(placed[k]=new Array(subCols).fill(-Infinity));
    let col=0,y=Infinity;
    cols.forEach((last,c)=>{const cand=Math.max(by,last+LANE_GAP);if(cand<y){y=cand;col=c;}});
    cols[col]=y;
    const lx=laneX[k]+col*LBL_W,isNext=dep.time===nextTime;
    const dot=document.createElement('div');dot.className='dot'+(isNext?' next':'');
    dot.style.top=`${by}px`;timeline.appendChild(dot);
    const ldr=document.createElement('div');ldr.className='ldr'+(isNext?' next':'');
    ldr.style.top=`${by}px`;ldr.style.left=`${axisX}px`;
    ldr.style.width=`${(y===by?lx:lx-12)-axisX}px`;
    timeline.appendChild(ldr);
    const lbl=document.createElement('div');lbl.className='lbl'+(isNext?' next':'');
    lbl.style.top=`${y}px`;lbl.style.left=`${lx}px`;
    lbl.title=`${dep.time} ${dep.destination}${dep.note?' '+dep.note:''}`;
    lbl.innerHTML=`<span class="lbl-time">${dep.time}</span>`;
    timeline.appendChild(lbl);
    if(y!==by){
      const vr=document.createElement('div');vr.className='ldr-v'+(isNext?' next':'');
      vr.style.top=`${by}px`;vr.style.left=`${lx-12}px`;vr.style.height=`${y-by}px`;
      timeline.appendChild(vr);
      const br=document.createElement('div');br.className='ldr'+(isNext?' next':'');
      br.style.top=`${y}px`;br.style.left=`${lx-12}px`;br.style.width='12px';
      timeline.appendChild(br);
    }
  });
}


function render(){
  updateClock();
  const showNext=state.mode==='next';
  nextSection.hidden=!showNext;tableSection.hidden=showNext;
  if(!BUS_DATA){nextWrap.innerHTML='<div class="empty">読み込み中...</div>';return;}
  showNext?renderNext():renderTable();
}

// 選択中を示す下敷き。切り替えるとスライドして移動する
const thumbs=[...document.querySelectorAll('.pill-toggle')].map(group=>{
  const thumb=document.createElement('span');
  thumb.className='pill-thumb';
  group.insertBefore(thumb,group.firstChild);
  return{group,thumb};
});

function syncThumbs(animate=true){
  thumbs.forEach(({group,thumb})=>{
    const active=group.querySelector('button.active');
    if(!active)return;
    if(!animate)thumb.style.transition='none';
    thumb.style.width=`${active.offsetWidth}px`;
    thumb.style.height=`${active.offsetHeight}px`;
    thumb.style.transform=`translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    // 初期表示や画面幅の変化ではアニメーションさせずに位置だけ合わせる
    if(!animate){void thumb.offsetWidth;thumb.style.transition='';}
  });
}

syncThumbs(false);
document.fonts?.ready.then(()=>syncThumbs(false));

// 見出しはスクロール領域の外にあるため、横スクロールには手動で追従させる
timeline.parentElement.addEventListener('scroll',e=>{
  laneHeader.scrollLeft=e.target.scrollLeft;
});

stopSelect.addEventListener('change',e=>{state.stop=e.target.value;render();});
document.querySelectorAll('[data-day]').forEach(b=>b.addEventListener('click',()=>{
  state.day=b.dataset.day;
  document.querySelectorAll('[data-day]').forEach(x=>x.classList.toggle('active',x===b));
  syncThumbs();render();
}));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
  state.mode=b.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));
  syncThumbs();render();
}));


async function loadData(){
  try{
    const r=await fetch(DATA_URL);if(!r.ok)throw 0;
    BUS_DATA=await r.json();render();
  }catch{nextWrap.innerHTML='<div class="empty">データを読み込めませんでした</div>';}
}
render();loadData();setInterval(render,60000);
setInterval(updateClock,1000);
let resizeTimer;
window.addEventListener('resize',()=>{
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{render();syncThumbs(false);},1);
});