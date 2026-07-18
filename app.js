const DATA_URL='./timetable-data.json';
let BUS_DATA=null;
function getDefaultDay(){ const dow=new Date().getDay(); return (dow===0||dow===6)?'holiday':'weekday'; }
const state={stop:'通信研究所',day:getDefaultDay(),mode:'next',theme:null};

const stopSelect=document.getElementById('stopSelect');
const nextWrap=document.getElementById('nextWrap');
const routeNotes=document.getElementById('routeNotes');
const timeline=document.getElementById('timeline');
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


function laneInfo(dep){
  const bay=(dep.note||'').includes('1番')?'①':(dep.note||'').includes('2番')?'②':'';
  if(state.stop==='YRP野比駅'){
    if(dep.destination.includes('光の丘2番'))return{main:'丘2番',suffix:'',sub:bay,full:dep.destination};
    if(dep.destination.includes('市民病院'))return{main:'病院',suffix:'',sub:bay,full:dep.destination};
    return{main:'通研',suffix:'',sub:bay,full:dep.destination};
  }
  if(state.stop==='通信研究所'){
    if(dep.destination.includes('光の丘2番'))return{main:'丘2番',suffix:'経由',sub:bay||'①',full:dep.destination};
    return{main:'みのり橋',suffix:'経由',sub:bay||'①',full:dep.destination};
  }
  return{main:'YRP野比駅',suffix:'',sub:'',full:dep.destination};
}

function laneKey(dep){const i=laneInfo(dep);return`${i.main}|${i.sub}`;}


function orderedKeys(all){
  if(state.stop==='YRP野比駅'){
    const order=['丘2番','病院','通研'],byMain={};
    all.forEach(d=>{const i=laneInfo(d),k=laneKey(d);(byMain[i.main]||(byMain[i.main]=new Set())).add(k);});
    const out=[];
    order.forEach(m=>{(byMain[m]||[]).forEach(k=>{if(!out.includes(k))out.push(k);});});
    return out;
  }
  const out=[];
  all.forEach(d=>{const k=laneKey(d);if(!out.includes(k))out.push(k);});
  return out;
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
      <div class="next-box-meta">${diff}分後 · ${info.sub||''}</div>
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
  const TOP=20,PPM=2.8;
  timeline.style.height=`${Math.max(400,(maxM-minM)*PPM+60)}px`;
  const ax=document.createElement('div');ax.className='tl-axis';timeline.appendChild(ax);
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
  const keys=orderedKeys(all),laneX={};
  const tlAxis=timeline.querySelector('.tl-axis');
  const axisX=tlAxis?tlAxis.offsetLeft:106;
  const scrollW=timeline.parentElement.clientWidth||600;
  const usable=scrollW-axisX-24;
  const laneStep=Math.floor(usable/keys.length);
  keys.forEach((k,i)=>laneX[k]=axisX+16+i*laneStep);
  const placed={};
  all.forEach(dep=>{
    const k=laneKey(dep),by=TOP+(dep.mins-minM)*PPM;
    const stk=placed[k]||[];let y=by;
    if(stk.length&&Math.abs(y-stk[stk.length-1])<22)y=stk[stk.length-1]+22;
    stk.push(y);placed[k]=stk;
    const lx=laneX[k],info=laneInfo(dep),isNext=dep.time===nextTime;
    const dot=document.createElement('div');dot.className='dot'+(isNext?' next':'');
    dot.style.top=`${by}px`;timeline.appendChild(dot);
    const ldr=document.createElement('div');ldr.className='ldr'+(isNext?' next':'');
    ldr.style.top=`${by}px`;ldr.style.left=`${axisX}px`;ldr.style.width=`${lx-axisX}px`;
    timeline.appendChild(ldr);
    const lbl=document.createElement('div');lbl.className='lbl'+(isNext?' next':'');
    lbl.style.top=`${y}px`;lbl.style.left=`${lx}px`;
    lbl.title=`${dep.time} ${dep.destination}${dep.note?' '+dep.note:''}`;
    lbl.innerHTML=`<span class="lbl-time">${dep.time}</span><span class="lbl-main">${info.main}${info.suffix?`<span class="suffix">${info.suffix}</span>`:''}</span>${info.sub?`<span class="lbl-sub">${info.sub}</span>`:''}`;
    timeline.appendChild(lbl);
    if(y!==by){
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

stopSelect.addEventListener('change',e=>{state.stop=e.target.value;render();});
document.querySelectorAll('[data-day]').forEach(b=>b.addEventListener('click',()=>{
  state.day=b.dataset.day;
  document.querySelectorAll('[data-day]').forEach(x=>x.classList.toggle('active',x===b));render();
}));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
  state.mode=b.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));render();
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
  resizeTimer=setTimeout(render,1);
});