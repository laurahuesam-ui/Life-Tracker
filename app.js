const STORAGE_KEY = 'life_tracker_v2';
const defaultData = {
  categories: ['Lebensmittel','Getränke','Haushalt','Hygiene','Tiere','Garten','Medizin','Finanzen','Sonstiges'],
  masterItems: [],
  consumption: [],
  appointments: [],
  goals: []
};
let data = loadData();
const el = id => document.getElementById(id);
const todayISO = () => new Date().toISOString().slice(0,10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

function loadData(){try{const raw=localStorage.getItem(STORAGE_KEY)||localStorage.getItem('life_tracker_data');return raw?normalize(JSON.parse(raw)):structuredClone(defaultData)}catch{return structuredClone(defaultData)}}
function normalize(d){
  const normalized={...structuredClone(defaultData),...d,categories:d.categories?.length?d.categories:structuredClone(defaultData.categories),masterItems:d.masterItems||[],consumption:d.consumption||[],appointments:d.appointments||[],goals:d.goals||[]};
  normalized.masterItems = normalized.masterItems.map(i=>({...i, amount:i.amount||''}));
  return normalized;
}
function saveData(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));renderAll()}
function escapeHTML(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmt(date){return date?new Date(date+'T00:00:00').toLocaleDateString('de-DE'):'kein Datum'}
function daysBetween(a,b){return Math.ceil((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000)}
function addInterval(date,n,unit){if(!date)return '';const d=new Date(date+'T00:00:00');n=Number(n)||0;if(unit==='days')d.setDate(d.getDate()+n);if(unit==='weeks')d.setDate(d.getDate()+n*7);if(unit==='months')d.setMonth(d.getMonth()+n);if(unit==='years')d.setFullYear(d.getFullYear()+n);return d.toISOString().slice(0,10)}
function unitLabel(u){return {days:'Tage',weeks:'Wochen',months:'Monate',years:'Jahre'}[u]||u}
function badgeForDays(left){if(left==='')return '<span class="badge">ohne Datum</span>';if(left<0)return `<span class="badge danger">${Math.abs(left)} Tage überfällig</span>`;if(left<=14)return `<span class="badge warn">in ${left} Tagen</span>`;return `<span class="badge">in ${left} Tagen</span>`}
function clear(ids){ids.forEach(id=>{if(el(id))el(id).value=''})}
function categoryValue(selectId,newId){const custom=el(newId)?.value.trim();if(custom){if(!data.categories.includes(custom))data.categories.push(custom);return custom}return el(selectId)?.value||'Sonstiges'}
function masterById(id){return data.masterItems.find(i=>i.id===id)}

function fillSelects(){
  const catOptions=data.categories.map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
  ['consCategorySelect','apptCategorySelect','goalCategorySelect','masterCategorySelect'].forEach(id=>{if(el(id))el(id).innerHTML=catOptions});
  const consMasters=data.masterItems.filter(i=>i.type==='consumption').sort((a,b)=>a.name.localeCompare(b.name,'de'));
  el('consItemSelect').innerHTML='<option value="">Artikel auswählen oder neu eingeben</option>'+consMasters.map(i=>`<option value="${i.id}">${escapeHTML(i.name)}</option>`).join('');
  const apptMasters=data.masterItems.filter(i=>i.type==='appointment').sort((a,b)=>a.name.localeCompare(b.name,'de'));
  el('apptItemSelect').innerHTML='<option value="">Termin auswählen oder neu eingeben</option>'+apptMasters.map(i=>`<option value="${i.id}">${escapeHTML(i.name)}</option>`).join('');
}
function applyMasterToConsumption(){const m=masterById(el('consItemSelect').value);if(!m)return;el('consCategorySelect').value=m.category||'Sonstiges';el('consEstimate').value=m.estimate||'';el('consAmount').value=m.amount||'';el('consNewName').value=''}
function applyMasterToAppointment(){const m=masterById(el('apptItemSelect').value);if(!m)return;el('apptCategorySelect').value=m.category||'Sonstiges';el('apptInterval').value=m.estimate||'';el('apptUnit').value=m.unit||'months';el('apptNewName').value=''}

function averageConsumptionDays(name){
  const finished=data.consumption.filter(i=>i.name===name&&i.openedDate&&i.finishedDate).map(i=>daysBetween(i.openedDate,i.finishedDate)).filter(n=>n>=0);
  if(!finished.length)return null;return finished.reduce((a,b)=>a+b,0)/finished.length;
}
function prediction(item){if(!item.openedDate||item.finishedDate)return null;const avg=averageConsumptionDays(item.name)||Number(item.estimateDays)||null;return avg?addInterval(item.openedDate,Math.round(avg),'days'):null}

function renderConsumption(){
  const filter=el('consFilter').value;let items=[...data.consumption];
  if(filter==='active')items=items.filter(i=>!i.finishedDate);if(filter==='finished')items=items.filter(i=>i.finishedDate);if(filter==='nodate')items=items.filter(i=>!i.openedDate);
  items.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const list=el('consList');list.innerHTML=items.length?'':'<p class="muted-empty">Noch keine Verbrauchseinträge.</p>';
  items.forEach(item=>{const avg=averageConsumptionDays(item.name);const pred=prediction(item);const left=pred?daysBetween(todayISO(),pred):'';const c=document.createElement('div');c.className='card';c.innerHTML=`
    <div class="card-head"><div><div class="card-title">${escapeHTML(item.name)}</div><div class="meta">${escapeHTML(item.category||'Sonstiges')} · ${escapeHTML(item.amount||'ohne Menge')}</div></div>${item.finishedDate?'<span class="badge">aufgebraucht</span>':badgeForDays(left)}</div>
    <div class="meta">Geöffnet/gestartet: ${fmt(item.openedDate)}<br>${item.finishedDate?`Leer/erledigt: ${fmt(item.finishedDate)}<br>`:''}${pred&&!item.finishedDate?`Voraussichtlich leer: ${fmt(pred)}<br>`:''}${avg?`Durchschnitt: ${avg.toFixed(1)} Tage`:`Schätzung: ${item.estimateDays||'keine'} Tage`}</div>
    <div class="card-actions">${!item.finishedDate?`<button class="small-btn" data-action="finish-cons-today" data-id="${item.id}">Heute leer</button><button class="small-btn" data-action="finish-cons-date" data-id="${item.id}">Leer am Datum</button>`:''}<button class="small-btn edit-btn" data-action="edit-cons" data-id="${item.id}">Bearbeiten</button><button class="small-btn delete-btn" data-action="delete-cons" data-id="${item.id}">Löschen</button></div>`;list.appendChild(c)})
}
function renderAppointments(){
  const items=[...data.appointments].sort((a,b)=>(a.bookedDate||addInterval(a.lastDate,a.interval,a.unit)||'9999').localeCompare(b.bookedDate||addInterval(b.lastDate,b.interval,b.unit)||'9999'));
  const list=el('apptList');list.innerHTML=items.length?'':'<p class="muted-empty">Noch keine Termine.</p>';
  items.forEach(item=>{const due=addInterval(item.lastDate,item.interval,item.unit);const shown=item.bookedDate||due;const left=shown?daysBetween(todayISO(),shown):'';const c=document.createElement('div');c.className='card';c.innerHTML=`
    <div class="card-head"><div><div class="card-title">${escapeHTML(item.name)}</div><div class="meta">${escapeHTML(item.category||'Sonstiges')}</div></div>${item.bookedDate?'<span class="badge">vereinbart</span>':badgeForDays(left)}</div>
    <div class="meta">Letztes Mal/erledigt: ${fmt(item.lastDate)}<br>Wäre fällig: ${fmt(due)}<br>${item.bookedDate?`Neuer Termin ist vereinbart am: ${fmt(item.bookedDate)}<br>`:''}Intervall: ${item.interval||'-'} ${unitLabel(item.unit)}</div>
    <div class="card-actions"><button class="small-btn" data-action="done-appt-today" data-id="${item.id}">Heute erledigt</button><button class="small-btn" data-action="done-appt-date" data-id="${item.id}">Erledigt am Datum</button><button class="small-btn" data-action="book-appt" data-id="${item.id}">Termin vereinbart</button><button class="small-btn edit-btn" data-action="edit-appt" data-id="${item.id}">Bearbeiten</button><button class="small-btn delete-btn" data-action="delete-appt" data-id="${item.id}">Löschen</button></div>`;list.appendChild(c)})
}
function renderGoals(){
  const list=el('goalList');list.innerHTML=data.goals.length?'':'<p class="muted-empty">Noch keine Ziele.</p>';
  data.goals.forEach(item=>{const start=Number(item.start)||0,current=Number(item.current)||0,target=Number(item.target)||100;const p=target===start?100:Math.max(0,Math.min(100,((current-start)/(target-start))*100));const monthly=Number(item.monthly)||0;const months=monthly>0?Math.ceil((target-current)/monthly):null;const c=document.createElement('div');c.className='card';c.innerHTML=`
    <div class="card-head"><div><div class="card-title">${escapeHTML(item.name)}</div><div class="meta">${escapeHTML(item.category||'Sonstiges')} · ${current} von ${target}</div></div><span class="badge">${p.toFixed(1)}%</span></div>
    <div class="progress-wrap"><div class="progress" style="width:${p}%"></div></div><div class="meta">${months&&months>0?`Bei ${monthly}/Monat noch ca. ${months} Monate.`:'Keine Prognose ohne monatliche Schätzung.'}</div>
    <div class="card-actions"><button class="small-btn" data-action="update-goal" data-id="${item.id}">Aktuell ändern</button><button class="small-btn edit-btn" data-action="edit-goal" data-id="${item.id}">Bearbeiten</button><button class="small-btn delete-btn" data-action="delete-goal" data-id="${item.id}">Löschen</button></div>`;list.appendChild(c)})
}
function renderMaster(){
  const list=el('masterList');list.innerHTML=data.masterItems.length?'':'<p class="muted-empty">Noch keine Stammdaten.</p>';
  data.masterItems.slice().sort((a,b)=>a.name.localeCompare(b.name,'de')).forEach(item=>{const c=document.createElement('div');c.className='card';c.innerHTML=`<div class="card-head"><div><div class="card-title">${escapeHTML(item.name)}</div><div class="meta">${item.type==='consumption'?'Verbrauch':'Termin'} · ${escapeHTML(item.category||'Sonstiges')}${item.type==='consumption'&&item.amount?' · Menge: '+escapeHTML(item.amount):''}</div></div><span class="badge">${item.estimate||'-'} ${unitLabel(item.unit||'days')}</span></div>${item.note?`<div class="meta">${escapeHTML(item.note)}</div>`:''}<div class="card-actions"><button class="small-btn edit-btn" data-action="edit-master" data-id="${item.id}">Bearbeiten</button><button class="small-btn delete-btn" data-action="delete-master" data-id="${item.id}">Löschen</button></div>`;list.appendChild(c)})
}
function renderDashboard(){
  const active=data.consumption.filter(i=>!i.finishedDate).map(i=>({...i,pred:prediction(i)})).filter(i=>i.pred).sort((a,b)=>a.pred.localeCompare(b.pred)).slice(0,6);
  el('soonEmpty').innerHTML=active.length?active.map(i=>`<div class="card"><strong>${escapeHTML(i.name)}</strong><div class="meta">voraussichtlich ${fmt(i.pred)}</div></div>`).join(''):'<p class="muted-empty">Noch keine Prognosen. Nutze Schätzungen oder markiere Dinge als leer.</p>';
  const appts=data.appointments.map(i=>({...i,shown:i.bookedDate||addInterval(i.lastDate,i.interval,i.unit)})).filter(i=>i.shown).sort((a,b)=>a.shown.localeCompare(b.shown)).slice(0,6);
  el('soonDue').innerHTML=appts.length?appts.map(i=>`<div class="card"><strong>${escapeHTML(i.name)}</strong><div class="meta">${i.bookedDate?'vereinbart: ':'fällig: '}${fmt(i.shown)}</div></div>`).join(''):'<p class="muted-empty">Noch keine Termine.</p>';
  el('goalSummary').innerHTML=data.goals.length?data.goals.slice(0,6).map(i=>{const p=(Number(i.target)===Number(i.start))?100:Math.max(0,Math.min(100,((Number(i.current)-Number(i.start))/(Number(i.target)-Number(i.start)))*100));return `<div class="card"><strong>${escapeHTML(i.name)}</strong><div class="progress-wrap"><div class="progress" style="width:${p}%"></div></div><div class="meta">${p.toFixed(1)}%</div></div>`}).join(''):'<p class="muted-empty">Noch keine Ziele.</p>'
}
function renderAll(){fillSelects();renderConsumption();renderAppointments();renderGoals();renderMaster();renderDashboard()}

function getConsumptionForm(){const m=masterById(el('consItemSelect').value);const name=el('consNewName').value.trim()||m?.name;if(!name)return null;const category=categoryValue('consCategorySelect','consNewCategory')||m?.category||'Sonstiges';const estimate=el('consEstimate').value||m?.estimate||'';const amount=el('consAmount').value.trim()||m?.amount||'';if(!data.masterItems.some(i=>i.type==='consumption'&&i.name===name))data.masterItems.push({id:uid(),type:'consumption',name,category,amount,estimate,unit:'days',note:''});return {id:uid(),name,category,amount,openedDate:el('consOpened').value||'',estimateDays:estimate,finishedDate:null,createdAt:Date.now()}}
function getAppointmentForm(){const m=masterById(el('apptItemSelect').value);const name=el('apptNewName').value.trim()||m?.name;if(!name)return null;const category=categoryValue('apptCategorySelect','apptNewCategory')||m?.category||'Sonstiges';const interval=el('apptInterval').value||m?.estimate||6;const unit=el('apptUnit').value||m?.unit||'months';if(!data.masterItems.some(i=>i.type==='appointment'&&i.name===name))data.masterItems.push({id:uid(),type:'appointment',name,category,estimate:interval,unit,note:''});return {id:uid(),name,category,lastDate:el('apptLastDate').value||'',interval,unit,bookedDate:el('apptBookedDate').value||'',createdAt:Date.now()}}

document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));btn.classList.add('active');el(btn.dataset.view).classList.add('active-view')}));
el('backupToggle').addEventListener('click',()=>el('backupMenu').classList.toggle('open'));document.addEventListener('click',e=>{if(!e.target.closest('.toolbar'))el('backupMenu').classList.remove('open')});
el('consItemSelect').addEventListener('change',applyMasterToConsumption);el('apptItemSelect').addEventListener('change',applyMasterToAppointment);el('consFilter').addEventListener('change',renderConsumption);
el('addConsBtn').addEventListener('click',()=>{const item=getConsumptionForm();if(!item)return alert('Bitte Artikel auswählen oder neuen Namen eingeben.');data.consumption.push(item);clear(['consItemSelect','consNewName','consNewCategory','consAmount','consOpened','consEstimate']);saveData()});
el('addApptBtn').addEventListener('click',()=>{const item=getAppointmentForm();if(!item)return alert('Bitte Termin auswählen oder neuen Namen eingeben.');data.appointments.push(item);clear(['apptItemSelect','apptNewName','apptNewCategory','apptLastDate','apptInterval','apptBookedDate']);saveData()});
el('addGoalBtn').addEventListener('click',()=>{if(!el('goalName').value.trim())return alert('Bitte Zielnamen eingeben.');data.goals.push({id:uid(),name:el('goalName').value.trim(),category:categoryValue('goalCategorySelect','goalNewCategory'),start:el('goalStart').value||0,current:el('goalCurrent').value||0,target:el('goalTarget').value||100,monthly:el('goalMonthly').value||'',createdAt:Date.now()});clear(['goalName','goalNewCategory','goalStart','goalCurrent','goalTarget','goalMonthly']);saveData()});
el('addMasterBtn').addEventListener('click',()=>{if(!el('masterName').value.trim())return alert('Bitte Namen eingeben.');data.masterItems.push({id:uid(),name:el('masterName').value.trim(),type:el('masterType').value,category:categoryValue('masterCategorySelect','masterNewCategory'),amount:el('masterAmount').value.trim(),estimate:el('masterEstimate').value||'',unit:el('masterUnit').value,note:el('masterNote').value.trim(),createdAt:Date.now()});clear(['masterName','masterNewCategory','masterAmount','masterEstimate','masterNote']);saveData()});

document.body.addEventListener('click',e=>{const btn=e.target.closest('button[data-action]');if(!btn)return;const {action,id}=btn.dataset;
 if(action==='finish-cons-today')data.consumption=data.consumption.map(i=>i.id===id?{...i,finishedDate:todayISO(),openedDate:i.openedDate||todayISO()}:i);
 if(action==='finish-cons-date'){const i=data.consumption.find(x=>x.id===id);const d=prompt('Leer/erledigt am (JJJJ-MM-TT):',i.finishedDate||todayISO());if(d)data.consumption=data.consumption.map(x=>x.id===id?{...x,finishedDate:d,openedDate:x.openedDate||d}:x)}
 if(action==='delete-cons')data.consumption=data.consumption.filter(i=>i.id!==id);
 if(action==='edit-cons'){const i=data.consumption.find(x=>x.id===id);if(!i)return;i.name=prompt('Name:',i.name)||i.name;i.category=prompt('Kategorie:',i.category)||i.category;i.amount=prompt('Menge:',i.amount)||i.amount;i.openedDate=prompt('Geöffnet/gestartet (leer möglich, JJJJ-MM-TT):',i.openedDate)||'';i.estimateDays=prompt('Grobe Schätzung in Tagen:',i.estimateDays)||i.estimateDays;i.finishedDate=prompt('Leer/erledigt am (leer möglich, JJJJ-MM-TT):',i.finishedDate)||'';}
 if(action==='done-appt-today')data.appointments=data.appointments.map(i=>i.id===id?{...i,lastDate:todayISO(),bookedDate:''}:i);
 if(action==='done-appt-date'){const i=data.appointments.find(x=>x.id===id);const d=prompt('Erledigt am (JJJJ-MM-TT):',i.lastDate||todayISO());if(d)data.appointments=data.appointments.map(x=>x.id===id?{...x,lastDate:d,bookedDate:''}:x)}
 if(action==='book-appt'){const i=data.appointments.find(x=>x.id===id);const d=prompt('Neuer Termin ist vereinbart am (JJJJ-MM-TT):',i.bookedDate||todayISO());if(d)data.appointments=data.appointments.map(x=>x.id===id?{...x,bookedDate:d}:x)}
 if(action==='edit-appt'){const i=data.appointments.find(x=>x.id===id);if(!i)return;i.name=prompt('Name:',i.name)||i.name;i.category=prompt('Kategorie:',i.category)||i.category;i.lastDate=prompt('Letztes Mal/erledigt am (leer möglich, JJJJ-MM-TT):',i.lastDate)||'';i.interval=prompt('Intervall:',i.interval)||i.interval;i.unit=prompt('Einheit: days, weeks, months, years',i.unit)||i.unit;i.bookedDate=prompt('Vereinbarter Termin (leer möglich, JJJJ-MM-TT):',i.bookedDate)||'';}
 if(action==='delete-appt')data.appointments=data.appointments.filter(i=>i.id!==id);
 if(action==='update-goal'){const g=data.goals.find(i=>i.id===id);const v=prompt('Neuer aktueller Wert:',g.current);if(v!==null)g.current=v}
 if(action==='edit-goal'){const g=data.goals.find(i=>i.id===id);if(!g)return;g.name=prompt('Name:',g.name)||g.name;g.category=prompt('Kategorie:',g.category)||g.category;g.start=prompt('Startwert:',g.start)||g.start;g.current=prompt('Aktuell:',g.current)||g.current;g.target=prompt('Zielwert:',g.target)||g.target;g.monthly=prompt('Schätzung pro Monat:',g.monthly)||g.monthly;}
 if(action==='delete-goal')data.goals=data.goals.filter(i=>i.id!==id);
 if(action==='edit-master'){const m=data.masterItems.find(x=>x.id===id);if(!m)return;m.name=prompt('Name:',m.name)||m.name;m.category=prompt('Kategorie:',m.category)||m.category;if(m.type==='consumption')m.amount=prompt('Standardmenge:',m.amount||'')||'';m.estimate=prompt('Schätzung/Intervall:',m.estimate)||m.estimate;m.unit=prompt('Einheit: days, weeks, months, years',m.unit)||m.unit;m.note=prompt('Notiz:',m.note)||m.note;}
 if(action==='delete-master')data.masterItems=data.masterItems.filter(i=>i.id!==id);
 saveData();
});

el('exportBackupBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`life-tracker-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(url)});
el('importBackupInput').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{data=normalize(JSON.parse(reader.result));saveData();alert('Backup importiert.')}catch{alert('Backup konnte nicht importiert werden.')}};reader.readAsText(file)});
renderAll();
