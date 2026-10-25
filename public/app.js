const $ = (s) => document.querySelector(s);
const el = (tag, p = {}, ...c) => {
  if (p.title) p.title = t(p.title);
  const e = Object.assign(document.createElement(tag), p);
  e.append(...c.map((x) => (typeof x === 'string' ? t(x) : x)));
  return e;
};

function toast(msg, err) {
  const t = el('div', { className: 'toast' + (err ? ' err' : ''), textContent: msg });
  document.body.append(t); setTimeout(() => t.remove(), 3500);
}

async function api(url, { json, ...o } = {}) {
  if (me.role === 'guest' && (json || o.method === 'POST') && url !== '/logout') throw new Error('Modo invitado: solo lectura');
  o.headers = { 'X-Panel': '1', ...(o.headers || {}) };
  if (json) { o.method = 'POST'; o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(json); }
  const r = await fetch(url, o);
  if (r.status === 401) { location = '/login'; throw null; }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.msg || d.error || 'Error');
  return d;
}
async function post(url, body = {}) {
  try { const d = await api(url, { json: body }); toast(d.msg || 'Listo'); return d; }
  catch (e) { if (e) toast(e.message, true); }
}

let tab = 'console', dir = '', cur = null, LEVEL = 1, me = { name: '', role: 'user' };
function seeAll() { return me.role === 'owner' || me.role === 'guest'; } // el invitado ve lo mismo que el Owner
function fmtUp(s) {
  if (s < 60) return s + 's';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return (d ? d + 'd ' : '') + (h ? h + 'h ' : '') + m + 'm';
}

// ---------- Gráficas ----------
const N = 60, hist = { cpu: [], ram: [] };
function draw(id, data, color, minMax) {
  const c = $('#' + id), dpr = devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
  c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const max = Math.max(minMax, ...data) * 1.15;
  g.strokeStyle = '#334155'; g.lineWidth = 1; g.beginPath();
  [0.25, 0.5, 0.75].forEach((f) => { g.moveTo(0, h * f); g.lineTo(w, h * f); });
  g.stroke();
  if (data.length < 2) return;
  const x = (i) => w - (data.length - 1 - i) * (w / (N - 1)), y = (v) => h - (v / max) * (h - 4) - 2;
  g.beginPath();
  data.forEach((v, i) => (i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v))));
  g.strokeStyle = color; g.lineWidth = 2; g.stroke();
  g.lineTo(w, h); g.lineTo(x(0), h); g.closePath(); g.fillStyle = color + '28'; g.fill();
}
function drawCharts() { draw('cCpu', hist.cpu, '#38bdf8', 100); draw('cRam', hist.ram, '#a78bfa', 512); }
function pushStats(s) {
  hist.cpu.push(s.cpu); hist.ram.push(s.ram);
  if (hist.cpu.length > N) { hist.cpu.shift(); hist.ram.shift(); }
  $('#cpuV').textContent = s.cpu + '%'; $('#ramV').textContent = s.ram + ' MB';
  drawCharts();
}
addEventListener('resize', drawCharts);

// ---------- Colores de la consola ----------
function lineClass(l) {
  if (/\/(ERROR|FATAL)\]|Exception|^\s+at |Caused by/.test(l)) return 'l-err';
  if (/\/WARN\]/.test(l)) return 'l-warn';
  if (/joined the game/.test(l)) return 'l-join';
  if (/left the game|lost connection|was kicked|Disconnecting/.test(l)) return 'l-leave';
  if (/\]: <[^>]+> /.test(l)) return 'l-chat';
  if (/issued server command|\[Server\]|\[Rcon\]/.test(l)) return 'l-cmd';
  if (/Done \(|Starting|Stopping|Preparing|Loading|Saved the game|Saving/.test(l)) return 'l-sys';
  return '';
}

// ---------- Estado ----------
async function refresh() {
  try {
    const s = await api('/api/status');
    const b = $('#status');
    b.className = 'badge ' + (s.running ? 'on' : 'off');
    b.textContent = s.running ? '● Encendido' : '● Apagado';
    $('#stats').textContent = [...(s.running ? [`CPU ${s.cpu}%`, `RAM ${s.ram} MB`, `⏱ ${fmtUp(s.up)}`] : []), ...(s.disk ? [`💽 ${s.disk.free} / ${s.disk.total} GB`] : [])].join(' · ');
    pushStats(s); mcPort = s.mcPort;
    $('#bStart').disabled = s.running;
    $('#bStop').disabled = $('#bRestart').disabled = !s.running;
  } catch {}
}
$('#bStart').onclick = async () => { await post('/api/start'); refresh(); };
$('#bStop').onclick = async () => { if (confirm('¿Apagar el servidor?')) { await post('/api/stop'); refresh(); } };
$('#bRestart').onclick = async () => { if (confirm('¿Reiniciar el servidor?')) { await post('/api/restart'); refresh(); } };
$('#bLogout').onclick = async () => { await post('/logout'); location = '/login'; };

// ---------- Consola ----------
async function logs() {
  if (tab !== 'console' || document.hidden) return;
  try {
    const { log } = await api('/api/logs'), p = $('#log');
    const bottom = p.scrollTop + p.clientHeight >= p.scrollHeight - 30;
    p.replaceChildren(...log.split('\n').map((l) => el('div', { className: lineClass(l), textContent: l })));
    if (bottom) p.scrollTop = p.scrollHeight;
  } catch {}
}
const history = []; let hi = 0;
async function sendCmd() {
  const i = $('#cmd'), c = i.value.trim();
  if (!c) return;
  history.push(c); hi = history.length; i.value = '';
  await post('/api/cmd', { cmd: c }); logs();
}
$('#bCmd').onclick = sendCmd;
$('#cmd').onkeydown = (e) => {
  if (e.key === 'Enter') sendCmd();
  else if (e.key === 'ArrowUp' && hi > 0) { e.target.value = history[--hi]; e.preventDefault(); }
  else if (e.key === 'ArrowDown') { hi = Math.min(hi + 1, history.length); e.target.value = history[hi] || ''; }
};

// ---------- Jugadores ----------
async function loadPlayers() {
  try {
    const d = await api('/api/players');
    $('#pcount').textContent = !d.running ? 'Servidor apagado' : d.pending ? 'Sin respuesta del servidor' : `En línea: ${d.online} / ${d.max}`;
    $('#plist').replaceChildren(...(d.players.length ? d.players.map(playerRow)
      : [el('li', { className: 'muted', textContent: d.running ? 'No hay jugadores conectados.' : 'Enciende el servidor para ver los jugadores.' })]));
  } catch {}
}
async function showCard(name) { // ficha del jugador
  const c = $('#pcard'); c.hidden = false;
  c.replaceChildren(el('span', { className: 'muted', textContent: 'Consultando…' }));
  try {
    const d = await api('/api/player-info?name=' + encodeURIComponent(name));
    const DIM = { overworld: 'Overworld', the_nether: 'Nether', the_end: 'End' };
    const rows = [['📍', `X ${d.pos[0]}  Y ${d.pos[1]}  Z ${d.pos[2]}`], ['❤️', `${d.health} / 20`], ['🌍', DIM[d.dim] || d.dim], ['🎮', d.mode],
      ['⏱', d.online == null ? '—' : `En línea hace ${fmtUp(d.online)}`]];
    c.replaceChildren(avatar(name), el('div', { className: 'grow' }, el('strong', { textContent: name }), ...rows.map(([ic, tx]) => el('div', { textContent: `${ic} ${tx}` }))),
      Object.assign(el('button', { textContent: 'Cerrar' }), { onclick: () => (c.hidden = true) }));
  } catch (e) { c.hidden = true; if (e) toast(e.message, true); }
}
const MORE = [['', 'Más acciones…'], ['tpto', 'Teletransportar a un jugador'], ['tpxyz', 'Teletransportar a coordenadas'],
  ['gm-survival', 'Modo supervivencia'], ['gm-creative', 'Modo creativo'], ['gm-adventure', 'Modo aventura'], ['gm-spectator', 'Modo espectador'],
  ['give', 'Dar un item'], ['heal', 'Curar'], ['clear', 'Vaciar inventario'], ['kill', 'Matar']];
function moreMenu(name) {
  const s = el('select', {}, ...MORE.map(([v, t]) => el('option', { value: v, textContent: t })));
  s.onchange = () => {
    const v = s.value; s.value = '';
    let body = { name, action: v };
    if (!v) return;
    if (v === 'tpto') { const t = prompt('¿A qué jugador?'); if (!t) return; body.target = t.trim(); }
    else if (v === 'tpxyz') { const c = prompt('Coordenadas x y z (ej: 100 64 -50)'); if (!c) return; body.coords = c.trim(); }
    else if (v.startsWith('gm-')) { body.action = 'gamemode'; body.mode = v.slice(3); }
    else if (v === 'give') { openPicker(name); return; }
    else if ((v === 'clear' || v === 'kill') && !confirm(`¿Seguro? (${v} a ${name})`)) return;
    post('/api/player', body);
  };
  return s;
}
function playerRow(name) {
  const btn = (action, label, cls) => {
    const b = el('button', { textContent: label, className: cls });
    b.onclick = async () => {
      const reason = prompt(`${label} a ${name}. Motivo (opcional):`, '');
      if (reason !== null && (await post('/api/player', { action, name, reason }))) setTimeout(() => { loadPlayers(); loadLists(); }, 1200);
    };
    return b;
  };
  return el('li', {}, avatar(name), Object.assign(el('span', { className: 'name', textContent: name, title: 'Ver ficha' }), { onclick: () => LEVEL >= 2 && showCard(name) }), ...(LEVEL >= 2 ? [btn('kick', 'Kick', 'orange'), btn('ban', 'Ban', 'red'), moreMenu(name)] : []));
}
$('#bPlayers').onclick = () => { loadPlayers(); loadLists(); };

// ---------- Avatares, whitelist y baneados ----------
function avatar(name) {
  const i = el('img', { className: 'avatar', alt: '', loading: 'lazy', src: 'https://mc-heads.net/avatar/' + encodeURIComponent(name) + '/32' });
  i.onerror = () => { i.style.visibility = 'hidden'; };
  return i;
}
function fillList(sel, items, empty, label, cls, fn) {
  $(sel).replaceChildren(...(items.length ? items.map((it) => el('li', {}, avatar(it.name),
    el('span', { className: 'name', textContent: it.name + (it.note ? ' — ' + it.note : '') }),
    Object.assign(el('button', { textContent: label, className: cls }), { onclick: () => fn(it.name) })))
    : [el('li', { className: 'muted', textContent: empty })]));
}
let wlOn = false;
async function wl(action, name) { if (await post('/api/whitelist', { action, name })) loadLists(); }
async function loadLists() {
  loadOps();
  try {
    const w = await api('/api/whitelist');
    wlOn = w.enabled;
    $('#wstate').className = 'badge ' + (wlOn ? 'on' : 'off');
    $('#wstate').textContent = wlOn ? 'Activada' : 'Desactivada';
    $('#bWToggle').textContent = wlOn ? 'Desactivar' : 'Activar';
    fillList('#wlist', w.players.map((name) => ({ name })), 'La whitelist está vacía.', 'Quitar', 'orange', (n) => wl('remove', n));
    const b = await api('/api/bans');
    fillList('#banlist', b, 'No hay jugadores baneados.', 'Desbanear', 'green', async (n) => { if (await post('/api/unban', { name: n })) loadLists(); });
  } catch {}
}
$('#bWToggle').onclick = () => wl(wlOn ? 'off' : 'on');
async function addWl() { const n = $('#wname').value.trim(); if (n) { $('#wname').value = ''; await wl('add', n); } }
$('#bWAdd').onclick = addWl;
$('#wname').onkeydown = (e) => { if (e.key === 'Enter') addWl(); };
setInterval(() => { if (tab === 'players' && !document.hidden) loadPlayers(); }, 10000);

// ---------- Archivos ----------
const join = (n) => (dir ? dir + '/' + n : n);

async function list() {
  try {
    const items = await api('/api/files?dir=' + encodeURIComponent(dir));
    $('#path').textContent = '/' + dir;
    $('#list').replaceChildren(...(items.length ? items.map(row) : [el('li', { className: 'muted', textContent: 'Carpeta vacía. Sube o crea un archivo.' })]));
  } catch (e) { if (e) toast(e.message, true); }
}

function row(f) {
  const name = el('span', { className: 'name', textContent: (f.type === 'folder' ? '📁 ' : '📄 ') + f.name });
  name.onclick = () => (f.type === 'folder' ? ((dir = join(f.name)), list()) : openFile(join(f.name)));
  const ren = el('button', { textContent: '✏️', title: 'Renombrar' });
  ren.onclick = async () => {
    const n = prompt('Nuevo nombre:', f.name);
    if (n && n !== f.name && (await post('/api/rename', { from: join(f.name), to: join(n) }))) list();
  };
  const del = el('button', { textContent: '🗑️', title: 'Eliminar' });
  del.onclick = async () => { if (confirm('¿Eliminar ' + f.name + '?') && (await post('/api/delete', { path: join(f.name) }))) list(); };
  const kids = [name, ren, del];
  if (f.type === 'file') kids.splice(1, 0, el('a', { className: 'btn', textContent: '⬇️', title: 'Descargar', href: '/api/download?path=' + encodeURIComponent(join(f.name)) }));
  return el('li', {}, ...kids);
}

async function openFile(p) {
  try {
    const { content } = await api('/api/file?path=' + encodeURIComponent(p));
    cur = p; $('#fname').textContent = p; $('#content').value = content;
    $('#editor').hidden = false; $('#browser').hidden = true;
  } catch (e) { if (e) toast(e.message, true); }
}
const closeEditor = () => { cur = null; $('#editor').hidden = true; $('#browser').hidden = false; };
const saveFile = () => cur && post('/api/file', { path: cur, content: $('#content').value });
$('#bSave').onclick = saveFile;
$('#bClose').onclick = closeEditor;
document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's' && cur) { e.preventDefault(); saveFile(); } });

$('#bBack').onclick = () => { dir = dir.split('/').slice(0, -1).join('/'); list(); };
$('#bNewFile').onclick = async () => { const n = prompt('Nombre del archivo:'); if (n && (await post('/api/create', { path: join(n), type: 'file' }))) list(); };
$('#bNewDir').onclick = async () => { const n = prompt('Nombre de la carpeta:'); if (n && (await post('/api/create', { path: join(n), type: 'folder' }))) list(); };

async function upload(files) {
  const fd = new FormData();
  [...files].forEach((f) => fd.append('files', f));
  try { toast((await api('/api/upload?dir=' + encodeURIComponent(dir), { method: 'POST', body: fd })).msg); list(); }
  catch (e) { if (e) toast(e.message, true); }
}
$('#bUp').onclick = () => $('#fileInput').click();
$('#fileInput').onchange = (e) => { upload(e.target.files); e.target.value = ''; };
$('#files').ondragover = (e) => e.preventDefault();
$('#files').ondrop = (e) => { e.preventDefault(); if (!cur) upload(e.dataTransfer.files); };

// ---------- Backups y actividad ----------
async function loadBackups() {
  const b = await api('/api/backups');
  $('#blist').replaceChildren(...(b.length ? b.map((x) => el('li', {},
    el('span', { className: 'name', textContent: `${x.name} (${x.mb} MB)` }),
    Object.assign(el('button', { textContent: '♻️', title: 'Restaurar', className: 'orange' }), { onclick: async () => {
      if (confirm(`¿Restaurar ${x.name}? Reemplaza el mundo actual (se guarda una copia). El servidor debe estar apagado.`)) await post('/api/backups/restore', { name: x.name });
    } }),
    el('a', { className: 'btn', textContent: '⬇️', href: '/api/backups/' + encodeURIComponent(x.name) })))
    : [el('li', { className: 'muted', textContent: 'Todavía no hay backups. Crea el primero.' })]));
}
$('#bBackup').onclick = async () => { if (await post('/api/backups')) setTimeout(loadBackups, 8000); };

async function loadAudit() {
  const a = await api('/api/audit');
  $('#aud').replaceChildren(...a.reverse().map((x) => el('tr', {},
    el('td', { textContent: new Date(x.time).toLocaleString() }), el('td', { textContent: x.type + (x.user ? ' · ' + x.user : '') }), el('td', { textContent: x.detail }))));
}

// ---------- Control rápido ----------
let mcPort = 25565;
const quick = (c) => post('/api/cmd', { cmd: c });
function buildQuick() {
  $('#quick').replaceChildren();
[['☀️ Día', 'time set day'], ['🌙 Noche', 'time set night'], ['☁️ Clima limpio', 'weather clear'], ['🌧️ Lluvia', 'weather rain'], ['💾 Guardar mundo', 'save-all']]
  .forEach(([l, c]) => $('#quick').append(Object.assign(el('button', { textContent: l }), { onclick: () => quick(c) })));
[['Dificultad', 'difficulty', ['peaceful', 'easy', 'normal', 'hard']], ['Modo por defecto', 'defaultgamemode', ['survival', 'creative', 'adventure', 'spectator']]].forEach(([l, c, opts]) => {
  const s = el('select', {}, ...opts.map((o) => el('option', { value: o, textContent: o })));
  $('#quick').append(el('span', { className: 'row' }, el('span', { className: 'muted', textContent: l }), s,
    Object.assign(el('button', { textContent: 'Aplicar' }), { onclick: () => quick(`${c} ${s.value}`) })));
});
}
buildQuick();
async function say() { const i = $('#sayMsg'), m = i.value.trim(); if (m) { i.value = ''; await quick('say ' + m); } }
$('#bSay').onclick = say;
$('#sayMsg').onkeydown = (e) => { if (e.key === 'Enter') say(); };

const LABELS = {
  motd: 'Mensaje (MOTD)', 'server-port': 'Puerto del servidor', 'max-players': 'Máx. jugadores', gamemode: 'Modo de juego', difficulty: 'Dificultad',
  'force-gamemode': 'Forzar modo de juego al entrar', pvp: 'PvP (daño entre jugadores)',
  'allow-nether': 'Permitir el Nether', 'generate-structures': 'Generar estructuras', 'spawn-monsters': 'Aparecen monstruos',
  'spawn-animals': 'Aparecen animales', 'spawn-npcs': 'Aparecen aldeanos', 'spawn-protection': 'Protección del spawn (bloques)',
  'enable-command-block': 'Bloques de comandos', 'allow-flight': 'Permitir volar',
  'white-list': 'Whitelist', 'enforce-whitelist': 'Expulsar a quien no esté en la whitelist', 'online-mode': 'Solo cuentas premium (online-mode)',
  'enforce-secure-profile': 'Chat firmado (secure profile)', 'player-idle-timeout': 'Expulsar por inactividad (min, 0 = nunca)',
  'view-distance': 'Distancia de render', 'simulation-distance': 'Distancia de simulación',
  'entity-broadcast-range-percentage': 'Rango de entidades (%)', 'max-world-size': 'Tamaño máximo del mundo' };
const GROUPS = [
  ['General', ['server-port', 'max-players', 'gamemode', 'difficulty', 'force-gamemode', 'pvp']],
  ['Mundo', ['allow-nether', 'generate-structures', 'spawn-monsters', 'spawn-animals', 'spawn-npcs', 'spawn-protection', 'enable-command-block', 'allow-flight']],
  ['Acceso', ['white-list', 'enforce-whitelist', 'online-mode', 'enforce-secure-profile', 'player-idle-timeout']],
  ['Rendimiento', ['view-distance', 'simulation-distance', 'entity-broadcast-range-percentage', 'max-world-size']]];
const ORDER = GROUPS.flatMap(([, ks]) => ks);
let cfgInputs = {};
async function loadCfg() {
  try {
    const { spec, values } = await api('/api/properties');
    $('#motdIn').value = mcToAmp(values.motd || ''); motdPreview();
    if (seeAll()) loadRam();
    cfgInputs = {}; let lastGroup = null;
    $('#cfgForm').replaceChildren(...ORDER.filter((k) => spec[k] && values[k] !== '' && (k !== 'server-port' || seeAll())).map((k) => {
      const t = spec[k]; let i;
      if (t === 'bool') i = el('input', { type: 'checkbox', checked: values[k] === 'true' });
      else if (t === 'text') i = el('input', { type: 'text', value: values[k], maxLength: 100 });
      else if (typeof t[0] === 'string') i = el('select', {}, ...t.map((o) => el('option', { value: o, textContent: o, selected: o === values[k] })));
      else i = el('input', { type: 'number', min: t[0], max: t[1], value: values[k] });
      cfgInputs[k] = i;
      const lab = el('label', { className: t === 'bool' ? 'chk' : '' }, ...(t === 'bool' ? [i, LABELS[k] || k] : [LABELS[k] || k, i]));
      const g = GROUPS.find(([, ks]) => ks.includes(k))[0];
      if (g === lastGroup) return lab;
      lastGroup = g;
      const f = document.createDocumentFragment(); f.append(el('h4', { className: 'grp', textContent: g }), lab); return f;
    }));
  } catch {}
}
$('#bCfgSave').onclick = () => (cfgInputs['online-mode'] && !cfgInputs['online-mode'].checked && !confirm('Con online-mode desactivado cualquiera puede entrar con el nombre de otro jugador (incluso un admin). ¿Continuar?')) ? null : post('/api/properties', { values: Object.fromEntries(Object.entries(cfgInputs)
  .filter(([, i]) => i.value !== '').map(([k, i]) => [k, i.type === 'checkbox' ? String(i.checked) : i.value])) });


// ---------- Automatización ----------
async function loadAuto() {
  try {
    const a = await api('/api/automation');
    $('#asOn').checked = a.autoStop.enabled; $('#asMin').value = a.autoStop.minutes;
    $('#rsOn').checked = a.restart.enabled; $('#rsTime').value = a.restart.time; $('#vpsNow').textContent = a.now;
  } catch {}
}
$('#bAutoSave').onclick = () => post('/api/automation', {
  autoStop: { enabled: $('#asOn').checked, minutes: $('#asMin').value },
  restart: { enabled: $('#rsOn').checked, time: $('#rsTime').value } });

// ---------- Plugins y mods ----------
async function loadMods() {
  try {
    const m = await api('/api/mods');
    $('#modlist').replaceChildren(...(m.length ? m.map((x) => el('li', {},
      el('span', { className: 'name' + (x.enabled ? '' : ' dim'), textContent: `${x.file.replace(/\.disabled$/, '')} (${x.mb} MB) · ${x.dir}` }),
      Object.assign(el('button', { textContent: x.enabled ? 'Desactivar' : 'Activar', className: x.enabled ? 'orange' : 'green' }),
        { onclick: async () => { if (await post('/api/mods/toggle', { dir: x.dir, file: x.file })) loadMods(); } })))
      : [el('li', { className: 'muted', textContent: 'No hay .jar en las carpetas plugins ni mods.' })]));
  } catch {}
}
$('#bMods').onclick = loadMods;

// ---------- Tema ----------
addEventListener('langchange', () => { // reconstruye lo dinámico en el nuevo idioma
  buildQuick(); refresh();
  if (me.name) $('#meRole').textContent = ROLE_TXT[me.role];
  loaders[tab]().catch(() => {});
});
if (localStorage.getItem('theme') === 'mc') document.body.classList.add('mc');
$('#bTheme').onclick = () => localStorage.setItem('theme', document.body.classList.toggle('mc') ? 'mc' : '');

// ---------- Selector de items (estilo inventario creativo) ----------
const ES = { diamante: 'diamond', hierro: 'iron', oro: 'gold', cobre: 'copper', esmeralda: 'emerald', carbon: 'coal', netherita: 'netherite',
  piedra: 'stone', tierra: 'dirt', arena: 'sand', grava: 'gravel', madera: 'planks', tronco: 'log', cristal: 'glass', vidrio: 'glass', lana: 'wool',
  espada: 'sword', pico: 'pickaxe', hacha: 'axe', pala: 'shovel', azada: 'hoe', arco: 'bow', flecha: 'arrow', escudo: 'shield', casco: 'helmet',
  pechera: 'chestplate', pantalones: 'leggings', botas: 'boots', manzana: 'apple', pan: 'bread', carne: 'beef', pollo: 'chicken', cerdo: 'porkchop',
  zanahoria: 'carrot', patata: 'potato', papa: 'potato', trigo: 'wheat', pastel: 'cake', galleta: 'cookie', calabaza: 'pumpkin', antorcha: 'torch',
  cofre: 'chest', mesa: 'table', cama: 'bed', puerta: 'door', escalera: 'stairs', cubo: 'bucket', agua: 'water', perla: 'pearl', ojo: 'eye',
  libro: 'book', pocion: 'potion', huevo: 'egg', palo: 'stick', lingote: 'ingot', polvora: 'gunpowder', hueso: 'bone', cuero: 'leather',
  obsidiana: 'obsidian', riel: 'rail', tridente: 'trident', rojo: 'red', azul: 'blue', verde: 'green', amarillo: 'yellow', negro: 'black',
  blanco: 'white', adoquin: 'cobblestone', ladrillo: 'brick', dorado: 'golden', mapa: 'map', brujula: 'compass', reloj: 'clock', cohete: 'firework', dinamita: 'tnt' };
const FALLBACK = ('diamond emerald gold_ingot iron_ingot netherite_ingot copper_ingot coal redstone lapis_lazuli quartz stick string leather bone gunpowder ender_pearl blaze_rod ' +
  'diamond_sword diamond_pickaxe diamond_axe diamond_shovel diamond_hoe diamond_helmet diamond_chestplate diamond_leggings diamond_boots netherite_sword netherite_pickaxe ' +
  'iron_sword iron_pickaxe iron_axe stone_sword bow arrow shield trident elytra totem_of_undying golden_apple enchanted_golden_apple apple bread cooked_beef cooked_porkchop ' +
  'carrot potato cake cookie torch chest crafting_table furnace anvil enchanting_table bed ender_chest shulker_box oak_planks oak_log stone cobblestone dirt grass_block sand gravel ' +
  'glass obsidian tnt bucket water_bucket lava_bucket book experience_bottle name_tag saddle fishing_rod flint_and_steel compass clock map firework_rocket minecart rail ' +
  'oak_door oak_stairs white_wool bedrock command_block barrier').split(' ');
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
let ITEMS = null, pkTarget = '', pkPick = null, pkShown = 0, pkList = [];

async function loadItems() {
  if (ITEMS) return;
  const info = $('#pkInfo');
  try {
    const d = await api('/api/items');
    ITEMS = d.items.map(([id, label]) => ({ id, label }));
    info.textContent = `Minecraft ${d.version} · ${ITEMS.length} items`;
  } catch (e) { // el servidor no pudo descargar la lista: se usa una corta
    ITEMS = FALLBACK.map((id) => ({ id, label: id.replace(/_/g, ' ') }));
    info.replaceChildren(el('span', { textContent: (e && e.message) || 'Error' }), ' · ', el('span', { textContent: 'Usando una lista corta de items' }));
  }
  ITEMS.forEach((i) => (i.key = norm(i.id.replace(/_/g, ' ') + ' ' + i.label)));
}
function icon(id, cls = 'ic') {
  const img = el('img', { className: cls, alt: '', loading: 'lazy', src: '/api/icon/' + encodeURIComponent(id) });
  img.onerror = () => img.replaceWith(el('span', { className: cls + ' ph', textContent: id.slice(0, 2).toUpperCase() }));
  return img;
}
function pkRender(reset) {
  const g = $('#pkGrid');
  if (reset) { g.replaceChildren(); pkShown = 0; g.scrollTop = 0; }
  pkList.slice(pkShown, pkShown + 120).forEach((it) => {
    const b = el('button', { className: 'pk-cell' + (it.id === pkPick ? ' sel' : ''), title: `${it.label} (${it.id})` }, icon(it.id));
    b.onclick = () => pkSelect(it, b);
    g.append(b);
  });
  pkShown += 120;
  // si no hay scroll todavía (pantalla grande) y faltan items, sigue cargando
  if (pkShown < pkList.length && g.scrollHeight <= g.clientHeight + 50) pkRender();
}
function pkSelect(it, b) {
  pkPick = it.id;
  $('#pkGrid').querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); if (b) b.classList.add('sel');
  $('#pkBar').hidden = false;
  $('#pkSelBox').replaceChildren(icon(it.id, 'ic big'));
  $('#pkName').textContent = it.label;
  $('#pkQty').focus();
}
function pkFilter() {
  const q = norm($('#pkSearch').value).trim();
  const toks = q.split(/\s+/).filter(Boolean).map((w) => ES[w] || ES[w.replace(/s$/, '')] || w); // acepta español
  pkList = ITEMS.filter((i) => toks.every((w) => i.key.includes(w)));
  pkRender(true);
  const raw = q.replace(/\s+/g, '_');
  $('#pkNone').hidden = pkList.length > 0;
  $('#pkCustom').hidden = !/^[a-z0-9_.:\/-]{2,64}$/.test(raw); // ID que no está en la lista (items muy nuevos)
  $('#pkCustom').textContent = `Usar «${raw}» como ID`;
  $('#pkCustom').onclick = () => pkSelect({ id: raw, label: raw });
}
async function openPicker(name) {
  pkTarget = name; pkPick = null;
  $('#pkTitle').textContent = '🎁 ' + name;
  $('#pkBar').hidden = true; $('#pkSearch').value = ''; $('#picker').hidden = false;
  $('#pkGrid').replaceChildren(el('span', { className: 'muted', textContent: 'Cargando items…' }));
  await loadItems(); pkFilter(); $('#pkSearch').focus();
}
$('#pkSearch').oninput = pkFilter;
$('#pkGrid').onscroll = (e) => { const g = e.target; if (g.scrollTop + g.clientHeight > g.scrollHeight - 200 && pkShown < pkList.length) pkRender(); };
$('#pkClose').onclick = () => ($('#picker').hidden = true);
$('#picker').onclick = (e) => { if (e.target.id === 'picker') $('#picker').hidden = true; };
[1, 16, 32, 64].forEach((n) => $('#pkQ').append(Object.assign(el('button', { textContent: n }), { onclick: () => ($('#pkQty').value = n) })));
$('#pkGive').onclick = () => {
  if (!pkPick) return toast('Elige un item primero', true);
  post('/api/player', { action: 'give', name: pkTarget, item: pkPick, count: $('#pkQty').value.trim() });
};

// ---------- Editor de MOTD ----------
const MC_COL = { 0: '#000', 1: '#00a', 2: '#0a0', 3: '#0aa', 4: '#a00', 5: '#a0a', 6: '#fa0', 7: '#aaa', 8: '#555', 9: '#55f', a: '#5f5', b: '#5ff', c: '#f55', d: '#f5f', e: '#ff5', f: '#fff' };
const mcToAmp = (s) => s.replace(/\\u00[aA]7|§/g, '&').replace(/\\n/g, '\n');
const ampToMc = (s) => s.replace(/&([0-9a-fk-or])/gi, '\\u00A7$1').replace(/\r?\n/g, '\\n');
function motdPreview() {
  const box = $('#motdPrev'); box.replaceChildren();
  const fresh = () => ({ c: '#aaa', b: 0, i: 0, u: 0, s: 0 });
  let st = fresh();
  $('#motdIn').value.split(/(&[0-9a-fk-or]|\n)/i).forEach((p) => {
    if (p === '\n') return box.append(document.createElement('br'));
    const m = p.match(/^&([0-9a-fk-or])$/i);
    if (m) {
      const k = m[1].toLowerCase(), f = { l: 'b', o: 'i', n: 'u', m: 's' }[k];
      if (MC_COL[k]) st = { ...fresh(), c: MC_COL[k] }; else if (k === 'r') st = fresh(); else if (f) st[f] = 1;
      return;
    }
    if (!p) return;
    const sp = document.createElement('span'); sp.append(p);
    sp.style.cssText = `color:${st.c};font-weight:${st.b ? 'bold' : 'normal'};font-style:${st.i ? 'italic' : 'normal'};text-decoration:${[st.u && 'underline', st.s && 'line-through'].filter(Boolean).join(' ') || 'none'}`;
    box.append(sp);
  });
}
function insCode(code) { const ta = $('#motdIn'); ta.setRangeText(code, ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); motdPreview(); }
$('#motdPal').append(...Object.entries(MC_COL).map(([k, c]) => Object.assign(el('button', { className: 'sw', title: '&' + k }), { style: `background:${c}`, onclick: () => insCode('&' + k) })),
  ...[['B', '&l'], ['I', '&o'], ['U', '&n'], ['S', '&m'], ['↺', '&r']].map(([l, code]) => Object.assign(el('button', { textContent: l, title: code }), { onclick: () => insCode(code) })));
$('#motdIn').oninput = motdPreview;
$('#bMotd').onclick = () => post('/api/properties', { values: { motd: ampToMc($('#motdIn').value) } });

// ---------- RAM (solo Owner) ----------
async function loadRam() {
  try { const r = await api('/api/ram'); $('#ramMax').value = r.xmx; $('#ramMin').value = r.xms; $('#ramInfo').textContent = `RAM VPS: ${r.total} GB.`; } catch {}
}
$('#bRam').onclick = async () => { if (await post('/api/ram', { xmx: $('#ramMax').value.trim(), xms: $('#ramMin').value.trim() })) loadRam(); };

// ---------- OPs ----------
async function loadOps() {
  if (LEVEL < 2) return;
  try {
    const o = await api('/api/ops');
    fillList('#oplist', o, 'No hay operadores.', 'Quitar OP', 'red', (n) => { if (confirm(`¿Quitar OP a ${n}?`)) opAct('remove', n); });
  } catch {}
}
async function opAct(action, name) { if (await post('/api/ops', { action, name })) loadOps(); }
$('#bOpAdd').onclick = () => {
  const n = $('#opname').value.trim();
  if (n && confirm(`¿Dar OP a ${n}? Tendrá control total dentro del juego.`)) { $('#opname').value = ''; opAct('add', n); }
};

// ---------- Cuenta y usuarios ----------
const ROLE_TXT = { user: 'Usuario', mod: 'Mod', admin: 'Admin', owner: 'Owner', guest: 'Invitado' };
const roleOpts = () => (seeAll() ? ['user', 'mod', 'admin', 'owner', 'guest'] : ['user', 'mod', 'guest']);
api('/api/me').then((m) => {
  me = m; LEVEL = { user: 1, mod: 2, admin: 3, owner: 3, guest: 3 }[m.role] || 1; // admin y owner ven todo el panel
  document.body.classList.toggle('own', seeAll()); // solo el Owner ve la RAM
  document.body.classList.remove('lv1'); document.body.classList.add('lv' + LEVEL);
  $('#meName').textContent = m.name; $('#meRole').textContent = ROLE_TXT[m.role];
  $('#guestBar').hidden = m.role !== 'guest';
  $('#uRole').replaceChildren(...roleOpts().map((r) => el('option', { value: r, textContent: ROLE_TXT[r] })));
}).catch(() => {});

$('#bPw').onclick = async () => {
  if (await post('/api/me/password', { current: $('#pwCur').value, password: $('#pwNew').value })) $('#pwCur').value = $('#pwNew').value = '';
};
$('#bUAdd').onclick = async () => {
  if (await post('/api/users', { name: $('#uName').value.trim(), password: $('#uPass').value, role: $('#uRole').value })) {
    $('#uName').value = $('#uPass').value = ''; loadUsers();
  }
};
async function loadUsers() {
  if (LEVEL < 3) return;
  try {
    const us = await api('/api/users');
    $('#ulist').replaceChildren(...us.map((u) => {
      if (!seeAll() && !['user', 'mod', 'guest'].includes(u.role)) return el('li', {}, el('span', { className: 'name', textContent: u.name + (u.name === me.name ? ' (tú)' : '') }), el('span', { className: 'muted', textContent: ROLE_TXT[u.role] }));
      const sel = el('select', {}, ...roleOpts().map((r) => el('option', { value: r, textContent: ROLE_TXT[r], selected: r === u.role })));
      sel.onchange = async () => { await post('/api/users/update', { name: u.name, role: sel.value }); loadUsers(); };
      const pw = Object.assign(el('button', { textContent: '🔑', title: 'Nueva contraseña' }), { onclick: () => {
        const p = prompt(`Nueva contraseña para ${u.name} (mín. 6):`); if (p) post('/api/users/update', { name: u.name, password: p });
      } });
      const del = Object.assign(el('button', { textContent: '🗑️', title: 'Eliminar', className: 'red' }), { onclick: async () => {
        if (confirm(`¿Eliminar a ${u.name}?`) && (await post('/api/users/delete', { name: u.name }))) loadUsers();
      } });
      return el('li', {}, el('span', { className: 'name', textContent: u.name + (u.name === me.name ? ' (tú)' : '') }), sel, pw, del);
    }));
  } catch {}
}

// ---------- Pestañas ----------
const loaders = { console: logs, players: () => { loadPlayers(); return loadLists(); }, files: list, account: loadUsers, control: loadCfg, mods: loadMods, auto: loadAuto, backups: loadBackups, audit: loadAudit };
document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab').forEach((s) => (s.hidden = s.id !== tab));
  loaders[tab]().catch(() => {});
}));

refresh(); logs();
setInterval(refresh, 2000);
setInterval(logs, 2000);
