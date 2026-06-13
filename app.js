const STORAGE_KEY = 'lifeTrackerDataV1';

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt = date => date ? new Date(date + 'T00:00:00').toLocaleDateString('de-DE') : '-';
const daysBetween = (a, b) => Math.ceil((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const addInterval = (date, interval, unit) => {
  const d = new Date(date + 'T00:00:00');
  if (unit === 'days') d.setDate(d.getDate() + Number(interval));
  if (unit === 'weeks') d.setDate(d.getDate() + Number(interval) * 7);
  if (unit === 'months') d.setMonth(d.getMonth() + Number(interval));
  if (unit === 'years') d.setFullYear(d.getFullYear() + Number(interval));
  return d.toISOString().slice(0, 10);
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

let data = loadData();

function loadData() {
  const fallback = { consumption: [], appointments: [], goals: [], activities: [] };
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || fallback; }
  catch { return fallback; }
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); renderAll(); }
function el(id) { return document.getElementById(id); }
function clearInputs(ids) { ids.forEach(id => el(id).value = ''); }

function avgConsumptionDays(name) {
  const finished = data.consumption.filter(i => i.name.toLowerCase() === name.toLowerCase() && i.finishedDate);
  if (!finished.length) return null;
  const total = finished.reduce((sum, i) => sum + Math.max(0, daysBetween(i.boughtDate, i.finishedDate)), 0);
  return total / finished.length;
}
function predictEmpty(item) {
  const avg = avgConsumptionDays(item.name);
  if (!avg) return null;
  const predicted = new Date(item.boughtDate + 'T00:00:00');
  predicted.setDate(predicted.getDate() + Math.round(avg));
  return predicted.toISOString().slice(0, 10);
}
function statusBadge(days) {
  if (days < 0) return '<span class="badge danger">überfällig</span>';
  if (days <= 7) return '<span class="badge warn">bald</span>';
  return '<span class="badge">ok</span>';
}

function renderConsumption() {
  const list = el('consList');
  const filter = el('consFilter').value;
  let items = [...data.consumption].sort((a,b) => b.createdAt - a.createdAt);
  if (filter === 'active') items = items.filter(i => !i.finishedDate);
  if (filter === 'finished') items = items.filter(i => i.finishedDate);
  list.innerHTML = items.length ? '' : '<p class="muted-empty">Noch keine Einträge.</p>';
  items.forEach(item => {
    const avg = avgConsumptionDays(item.name);
    const predicted = predictEmpty(item);
    const daysLeft = predicted ? daysBetween(todayISO(), predicted) : null;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-head">
        <div>
          <div class="card-title">${escapeHTML(item.name)}</div>
          <div class="meta">${escapeHTML(item.category || 'Ohne Kategorie')} · ${escapeHTML(item.amount || 'Menge offen')}</div>
        </div>
        ${item.finishedDate ? '<span class="badge">aufgebraucht</span>' : (predicted ? statusBadge(daysLeft) : '<span class="badge">lernt</span>')}
      </div>
      <div class="meta">
        Gekauft: ${fmt(item.boughtDate)}<br>
        ${item.finishedDate ? `Aufgebraucht: ${fmt(item.finishedDate)} · Dauer: ${daysBetween(item.boughtDate, item.finishedDate)} Tage` : ''}
        ${!item.finishedDate && predicted ? `Voraussichtlich leer: ${fmt(predicted)} (${daysLeft >= 0 ? 'in ' + daysLeft + ' Tagen' : 'seit ' + Math.abs(daysLeft) + ' Tagen'})` : ''}
        ${avg ? `<br>Durchschnitt: ${avg.toFixed(1)} Tage` : '<br>Noch kein Durchschnitt vorhanden.'}
      </div>
      <div class="card-actions">
        ${!item.finishedDate ? `<button class="small-btn" data-action="finish-cons" data-id="${item.id}">Aufgebraucht heute</button>` : ''}
        <button class="small-btn delete-btn" data-action="delete-cons" data-id="${item.id}">Löschen</button>
      </div>`;
    list.appendChild(card);
  });
}

function renderAppointments() {
  const list = el('apptList');
  const items = [...data.appointments].sort((a,b) => addInterval(a.lastDate,a.interval,a.unit).localeCompare(addInterval(b.lastDate,b.interval,b.unit)));
  list.innerHTML = items.length ? '' : '<p class="muted-empty">Noch keine Termine.</p>';
  items.forEach(item => {
    const next = addInterval(item.lastDate, item.interval, item.unit);
    const left = daysBetween(todayISO(), next);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-head"><div><div class="card-title">${escapeHTML(item.name)}</div><div class="meta">Letztes Mal: ${fmt(item.lastDate)}</div></div>${statusBadge(left)}</div>
      <div class="meta">Nächstes Mal: ${fmt(next)} (${left >= 0 ? 'in ' + left + ' Tagen' : 'überfällig seit ' + Math.abs(left) + ' Tagen'})<br>Intervall: ${item.interval} ${unitLabel(item.unit)}</div>
      <div class="card-actions">
        <button class="small-btn" data-action="done-appt" data-id="${item.id}">Heute erledigt</button>
        <button class="small-btn delete-btn" data-action="delete-appt" data-id="${item.id}">Löschen</button>
      </div>`;
    list.appendChild(card);
  });
}
function unitLabel(unit) { return { days:'Tage', weeks:'Wochen', months:'Monate', years:'Jahre' }[unit] || unit; }

function renderGoals() {
  const list = el('goalList');
  list.innerHTML = data.goals.length ? '' : '<p class="muted-empty">Noch keine Ziele.</p>';
  data.goals.forEach(item => {
    const start = Number(item.start), current = Number(item.current), target = Number(item.target);
    const percent = target === start ? 100 : Math.max(0, Math.min(100, ((current - start) / (target - start)) * 100));
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-head"><div><div class="card-title">${escapeHTML(item.name)}</div><div class="meta">${current} von ${target}</div></div><span class="badge">${percent.toFixed(1)}%</span></div>
      <div class="progress-wrap"><div class="progress" style="width:${percent}%"></div></div>
      <div class="card-actions">
        <button class="small-btn" data-action="update-goal" data-id="${item.id}">Aktualisieren</button>
        <button class="small-btn delete-btn" data-action="delete-goal" data-id="${item.id}">Löschen</button>
      </div>`;
    list.appendChild(card);
  });
}

function renderActivities() {
  const list = el('actList');
  const items = [...data.activities].sort((a,b) => b.date.localeCompare(a.date));
  list.innerHTML = items.length ? '' : '<p class="muted-empty">Noch keine Aktivitäten.</p>';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-head"><div><div class="card-title">${escapeHTML(item.name)}</div><div class="meta">${fmt(item.date)} · ${item.minutes} Minuten</div></div></div>
      ${item.note ? `<div class="meta">${escapeHTML(item.note)}</div>` : ''}
      <div class="card-actions"><button class="small-btn delete-btn" data-action="delete-act" data-id="${item.id}">Löschen</button></div>`;
    list.appendChild(card);
  });
}

function renderDashboard() {
  const active = data.consumption.filter(i => !i.finishedDate).map(i => ({...i, predicted: predictEmpty(i)})).filter(i => i.predicted).sort((a,b) => a.predicted.localeCompare(b.predicted)).slice(0,5);
  el('soonEmpty').innerHTML = active.length ? active.map(i => `<div class="card"><strong>${escapeHTML(i.name)}</strong><div class="meta">voraussichtlich ${fmt(i.predicted)}</div></div>`).join('') : '<p class="muted-empty">Noch keine Prognosen. Markiere Einträge als aufgebraucht, damit die App lernt.</p>';

  const appts = data.appointments.map(i => ({...i, next:addInterval(i.lastDate,i.interval,i.unit)})).sort((a,b) => a.next.localeCompare(b.next)).slice(0,5);
  el('soonDue').innerHTML = appts.length ? appts.map(i => `<div class="card"><strong>${escapeHTML(i.name)}</strong><div class="meta">${fmt(i.next)}</div></div>`).join('') : '<p class="muted-empty">Noch keine Termine.</p>';

  el('goalSummary').innerHTML = data.goals.length ? data.goals.slice(0,5).map(i => {
    const p = Number(i.target) === Number(i.start) ? 100 : Math.max(0, Math.min(100, ((Number(i.current)-Number(i.start))/(Number(i.target)-Number(i.start)))*100));
    return `<div class="card"><strong>${escapeHTML(i.name)}</strong><div class="progress-wrap"><div class="progress" style="width:${p}%"></div></div><div class="meta">${p.toFixed(1)}%</div></div>`;
  }).join('') : '<p class="muted-empty">Noch keine Ziele.</p>';

  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now); monday.setDate(now.getDate() - day + 1); monday.setHours(0,0,0,0);
  const weekly = data.activities.filter(a => new Date(a.date + 'T00:00:00') >= monday);
  const total = weekly.reduce((s,a) => s + Number(a.minutes), 0);
  el('activitySummary').textContent = weekly.length ? `${weekly.length} Einträge · ${(total/60).toFixed(1)} Stunden diese Woche` : 'Noch keine Aktivitäten diese Woche.';
}
function renderAll() { renderConsumption(); renderAppointments(); renderGoals(); renderActivities(); renderDashboard(); }
function escapeHTML(str) { return String(str ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

// Events
document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
  btn.classList.add('active'); el(btn.dataset.view).classList.add('active-view');
}));
el('backupToggle').addEventListener('click', () => el('backupMenu').classList.toggle('open'));
document.addEventListener('click', e => { if (!e.target.closest('.toolbar')) el('backupMenu').classList.remove('open'); });

el('addConsBtn').addEventListener('click', () => {
  if (!el('consName').value.trim()) return alert('Bitte Name eingeben.');
  data.consumption.push({ id:uid(), name:el('consName').value.trim(), category:el('consCategory').value.trim(), amount:el('consAmount').value.trim(), boughtDate:el('consBought').value || todayISO(), finishedDate:null, createdAt:Date.now() });
  clearInputs(['consName','consCategory','consAmount','consBought']); saveData();
});
el('addApptBtn').addEventListener('click', () => {
  if (!el('apptName').value.trim()) return alert('Bitte Name eingeben.');
  data.appointments.push({ id:uid(), name:el('apptName').value.trim(), lastDate:el('apptDate').value || todayISO(), interval:el('apptInterval').value || 6, unit:el('apptUnit').value, createdAt:Date.now() });
  clearInputs(['apptName','apptDate','apptInterval']); saveData();
});
el('addGoalBtn').addEventListener('click', () => {
  if (!el('goalName').value.trim()) return alert('Bitte Name eingeben.');
  data.goals.push({ id:uid(), name:el('goalName').value.trim(), start:el('goalStart').value || 0, current:el('goalCurrent').value || 0, target:el('goalTarget').value || 100, createdAt:Date.now() });
  clearInputs(['goalName','goalStart','goalCurrent','goalTarget']); saveData();
});
el('addActBtn').addEventListener('click', () => {
  if (!el('actName').value.trim()) return alert('Bitte Name eingeben.');
  data.activities.push({ id:uid(), name:el('actName').value.trim(), date:el('actDate').value || todayISO(), minutes:el('actMinutes').value || 0, note:el('actNote').value.trim(), createdAt:Date.now() });
  clearInputs(['actName','actDate','actMinutes','actNote']); saveData();
});
el('consFilter').addEventListener('change', renderConsumption);

document.body.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'finish-cons') data.consumption = data.consumption.map(i => i.id === id ? {...i, finishedDate:todayISO()} : i);
  if (action === 'delete-cons') data.consumption = data.consumption.filter(i => i.id !== id);
  if (action === 'done-appt') data.appointments = data.appointments.map(i => i.id === id ? {...i, lastDate:todayISO()} : i);
  if (action === 'delete-appt') data.appointments = data.appointments.filter(i => i.id !== id);
  if (action === 'delete-goal') data.goals = data.goals.filter(i => i.id !== id);
  if (action === 'delete-act') data.activities = data.activities.filter(i => i.id !== id);
  if (action === 'update-goal') {
    const g = data.goals.find(i => i.id === id);
    const value = prompt(`Neuer aktueller Wert für ${g.name}:`, g.current);
    if (value !== null) g.current = value;
  }
  saveData();
});

el('exportBackupBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `zeit-verbrauch-backup-${todayISO()}.json`; a.click();
  URL.revokeObjectURL(url);
});
el('importBackupInput').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.consumption || !imported.appointments || !imported.goals || !imported.activities) throw new Error('Ungültiges Backup');
      data = imported; saveData(); alert('Backup importiert.');
    } catch { alert('Backup konnte nicht importiert werden.'); }
  };
  reader.readAsText(file);
});

renderAll();
