const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cfg = require('../config');
const { run, audit } = require('../utils');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sessionRe = new RegExp(`\\d+\\.${cfg.SCREEN_NAME}\\s`);
const isRunning = async () => sessionRe.test((await run('screen', ['-ls'])).stdout || '');
const send = (text) => run('screen', ['-S', cfg.SCREEN_NAME, '-X', 'stuff', text + '\n']);

function start() {
  spawn('screen', ['-dmS', cfg.SCREEN_NAME, 'bash', './start.sh'], { cwd: cfg.SERVER_PATH, detached: true, stdio: 'ignore' }).unref();
}

router.get('/status', async (req, res) => {
  const running = await isRunning();
  let cpu = 0, ram = 0, up = 0;
  if (running) {
    const { stdout } = await run('ps', ['-C', 'java', '-o', '%cpu=,rss=,etimes=']);
    (stdout || '').trim().split('\n').filter(Boolean).forEach((l) => {
      const [c, r, e] = l.trim().split(/\s+/);
      cpu += +c; ram += +r; up = Math.max(up, +e || 0);
    });
  }
  let disk = null;
  try { const s = fs.statfsSync(cfg.SERVER_PATH); disk = { free: +(s.bavail * s.bsize / 1073741824).toFixed(1), total: +(s.blocks * s.bsize / 1073741824).toFixed(1) }; } catch {}
  res.json({ running, cpu: +cpu.toFixed(1), ram: Math.round(ram / 1024), up, disk, mcPort: cfg.MC_PORT });
});

router.post('/start', async (req, res) => {
  if (await isRunning()) return res.status(409).json({ msg: 'El servidor ya está encendido' });
  start();
  audit('start', '', req);
  res.json({ msg: 'Iniciando el servidor...' });
});

router.post('/stop', async (req, res) => {
  if (!(await isRunning())) return res.status(409).json({ msg: 'El servidor ya está apagado' });
  await send('stop');
  audit('stop', '', req);
  res.json({ msg: 'Apagando el servidor...' });
});

router.post('/restart', async (req, res) => {
  if (!(await isRunning())) return res.status(409).json({ msg: 'El servidor está apagado' });
  audit('restart', '', req);
  res.json({ msg: 'Reiniciando...' });
  await send('stop');
  for (let i = 0; i < 90 && (await isRunning()); i++) await sleep(1000);
  start();
});

router.get('/logs', (req, res) => {
  const file = path.join(cfg.SERVER_PATH, 'logs', 'latest.log');
  fs.stat(file, (err, st) => {
    if (err) return res.json({ log: '' });
    const chunks = [];
    fs.createReadStream(file, { start: Math.max(0, st.size - 65536) })
      .on('data', (c) => chunks.push(c))
      .on('error', () => res.json({ log: '' }))
      .on('end', () => {
        let log = Buffer.concat(chunks).toString('utf8').split('\n').slice(-200).join('\n');
        if (req.user.role === 'guest') log = log.replace(/\b\d{1,3}(\.\d{1,3}){3}(:\d+)?\b/g, 'x.x.x.x'); // oculta IPs
        res.json({ log });
      });
  });
});

router.post('/cmd', async (req, res) => {
  const raw = String(req.body.cmd || '').trim();
  if (!raw) return res.status(400).json({ msg: 'Escribe un comando' });
  if (/[\r\n\0]/.test(raw) || raw.length > 256) return res.status(400).json({ msg: 'Comando inválido' });
  if (!(await isRunning())) return res.status(409).json({ msg: 'El servidor está apagado' });

  // normaliza: "/OP", "minecraft:op", " op" => "op"
  const base = raw.replace(/^\//, '').trim().split(/\s+/)[0].toLowerCase().replace(/^[^:\s]+:/, '');
  if (cfg.BLOCKED_COMMANDS.includes(base) || /(^|\s)\/?(minecraft:)?(op|deop)(\s|$)/i.test(raw)) { // también bloquea 'execute ... run op'
    audit('cmd_blocked', raw, req);
    return res.status(403).json({ msg: `⛔ Comando bloqueado: ${base}` });
  }
  await send(raw);
  audit('cmd', raw, req);
  res.json({ msg: 'Ejecutado: ' + raw });
});

// ---------- Jugadores ----------
const fsp = fs.promises;
const LOGF = path.join(cfg.SERVER_PATH, 'logs', 'latest.log');
const NAME = /^[\w.\-]{1,32}$/;
const LIST_RE = /There are (\d+) of a max of (\d+) players online:(.*)/g;

async function readFrom(from) {
  const fh = await fsp.open(LOGF, 'r');
  try {
    const { size } = await fh.stat();
    const len = Math.min(size - from, 65536);
    if (len <= 0) return '';
    const b = Buffer.alloc(len);
    await fh.read(b, 0, len, from);
    return b.toString('utf8');
  } finally { await fh.close(); }
}

async function playersInfo(res) { // res puede ser un objeto con json(); también lo usa el apagado automático
  const empty = { running: false, online: 0, max: 0, players: [] };
  if (!(await isRunning())) return res.json(empty);
  const before = await fsp.stat(LOGF).then((s) => s.size, () => 0);
  await send('list');
  for (let i = 0; i < 6; i++) { // espera la respuesta del servidor en el log
    await sleep(400);
    const size = await fsp.stat(LOGF).then((s) => s.size, () => 0);
    const m = [...(await readFrom(size < before ? 0 : before).catch(() => '')).matchAll(LIST_RE)].pop();
    if (m) return res.json({ running: true, online: +m[1], max: +m[2], players: m[3].split(',').map((s) => s.trim()).filter(Boolean) });
  }
  res.json({ ...empty, running: true, pending: true });
}
router.get('/players', (req, res) => playersInfo(res));

const MODES = ['survival', 'creative', 'adventure', 'spectator'];
const PLAYER_ACTIONS = { // cada acción valida sus argumentos y devuelve el comando (o false)
  kick: (n, a) => `kick ${n}${a.reason ? ' ' + a.reason : ''}`,
  ban: (n, a) => `ban ${n}${a.reason ? ' ' + a.reason : ''}`,
  tpto: (n, a) => NAME.test(String(a.target)) && `tp ${n} ${a.target}`,
  tpxyz: (n, a) => /^(~?-?\d+(\.\d+)?\s+){2}~?-?\d+(\.\d+)?$/.test(String(a.coords)) && `tp ${n} ${a.coords}`,
  gamemode: (n, a) => MODES.includes(a.mode) && `gamemode ${a.mode} ${n}`,
  give: (n, a) => /^[a-z0-9_.:\/-]{1,64}$/.test(String(a.item)) && /^\d{1,4}$/.test(String(a.count)) && +a.count >= 1 && +a.count <= 2304 && `give ${n} ${a.item} ${a.count}`,
  clear: (n) => `clear ${n}`,
  heal: (n) => `effect give ${n} minecraft:instant_health 1 10 true`,
  kill: (n) => `kill ${n}`,
};
router.post('/player', async (req, res) => {
  const { action, name } = req.body;
  const reason = String(req.body.reason || '').replace(/[\r\n\0]/g, ' ').trim().slice(0, 100);
  const build = PLAYER_ACTIONS[action], cmd = build && NAME.test(String(name)) && build(name, { ...req.body, reason });
  if (!cmd) return res.status(400).json({ msg: 'Datos inválidos' });
  if (!(await isRunning())) return res.status(409).json({ msg: 'El servidor está apagado' });
  await send(cmd);
  audit(action, cmd, req);
  res.json({ msg: 'Ejecutado: ' + cmd });
});

// ---------- Whitelist y baneados ----------
const readJson = (f) => fsp.readFile(path.join(cfg.SERVER_PATH, f), 'utf8').then(JSON.parse).catch(() => []);

router.get('/whitelist', async (req, res) => {
  const props = await fsp.readFile(path.join(cfg.SERVER_PATH, 'server.properties'), 'utf8').catch(() => '');
  res.json({ enabled: /^white-list=true/m.test(props), players: (await readJson('whitelist.json')).map((p) => p.name) });
});

router.post('/whitelist', async (req, res) => {
  const { action, name } = req.body;
  const toggle = ['on', 'off'].includes(action);
  if (!toggle && (!['add', 'remove'].includes(action) || !NAME.test(String(name)))) return res.status(400).json({ msg: 'Datos inválidos' });
  if (!(await isRunning())) return res.status(409).json({ msg: 'Enciende el servidor para cambiar la whitelist' });
  await send(toggle ? `whitelist ${action}` : `whitelist ${action} ${name}`);
  audit('whitelist', toggle ? action : `${action} ${name}`, req);
  await sleep(800);
  res.json({ msg: toggle ? `Whitelist ${action === 'on' ? 'activada' : 'desactivada'}` : action === 'add' ? `Agregado: ${name}` : `Quitado: ${name}` });
});

router.get('/bans', async (req, res) => {
  res.json((await readJson('banned-players.json')).map((b) => ({ name: b.name, note: b.reason || '' })));
});

router.post('/unban', async (req, res) => {
  const name = String(req.body.name || '');
  if (!NAME.test(name)) return res.status(400).json({ msg: 'Datos inválidos' });
  if (!(await isRunning())) return res.status(409).json({ msg: 'Enciende el servidor para desbanear' });
  await send(`pardon ${name}`);
  audit('unban', name, req);
  await sleep(800);
  res.json({ msg: 'Desbaneado: ' + name });
});

// ---------- Backups ----------
const BK = /^[\w.-]+\.tar\.gz$/;
const listBackups = () => (fs.existsSync(cfg.BACKUP_DIR) ? fs.readdirSync(cfg.BACKUP_DIR).filter((f) => BK.test(f)).sort().reverse() : []);

router.get('/backups', (req, res) => {
  res.json(listBackups().map((name) => ({ name, mb: +(fs.statSync(path.join(cfg.BACKUP_DIR, name)).size / 1048576).toFixed(1) })));
});

router.get('/backups/:name', (req, res) => {
  if (!BK.test(req.params.name)) return res.status(400).json({ msg: 'Nombre inválido' });
  res.download(path.join(cfg.BACKUP_DIR, req.params.name));
});

router.post('/backups', async (req, res) => {
  fs.mkdirSync(cfg.BACKUP_DIR, { recursive: true });
  const name = `${cfg.WORLD_DIR}-${new Date().toISOString().replace(/[:.]/g, '-')}.tar.gz`;
  audit('backup', name, req);
  res.json({ msg: 'Creando backup, tarda unos segundos...' });
  if (await isRunning()) { await send('save-all flush'); await sleep(4000); }
  await run('tar', ['czf', path.join(cfg.BACKUP_DIR, name), '-C', cfg.SERVER_PATH, cfg.WORLD_DIR]);
  listBackups().slice(cfg.MAX_BACKUPS).forEach((f) => fs.unlinkSync(path.join(cfg.BACKUP_DIR, f)));
});

// ---------- Operadores (OP) ----------
router.get('/ops', async (req, res) => res.json((await readJson('ops.json')).map((o) => ({ name: o.name, note: 'nivel ' + o.level }))));

router.post('/ops', async (req, res) => { // solo Owner; usa op/deop directo (el filtro de /cmd no aplica aquí)
  const { action, name } = req.body;
  if (!['add', 'remove'].includes(action) || !NAME.test(String(name))) return res.status(400).json({ msg: 'Datos inválidos' });
  if (!(await isRunning())) return res.status(409).json({ msg: 'Enciende el servidor para cambiar operadores' });
  await send(action === 'add' ? `op ${name}` : `deop ${name}`);
  audit('op_' + action, name, req);
  await sleep(800);
  res.json({ msg: action === 'add' ? 'OP dado a ' + name : 'OP quitado a ' + name });
});

// ---------- Restaurar backup ----------
router.post('/backups/restore', async (req, res) => {
  const name = String(req.body.name || '');
  if (!BK.test(name) || !fs.existsSync(path.join(cfg.BACKUP_DIR, name))) return res.status(400).json({ msg: 'Backup inválido' });
  if (await isRunning()) return res.status(409).json({ msg: 'Apaga el servidor antes de restaurar' });
  const world = path.join(cfg.SERVER_PATH, cfg.WORLD_DIR), old = world + '.antes-de-restaurar';
  fs.rmSync(old, { recursive: true, force: true });
  if (fs.existsSync(world)) fs.renameSync(world, old);
  const { err } = await run('tar', ['xzf', path.join(cfg.BACKUP_DIR, name), '-C', cfg.SERVER_PATH]);
  if (err) {
    fs.rmSync(world, { recursive: true, force: true });
    if (fs.existsSync(old)) fs.renameSync(old, world);
    return res.status(500).json({ msg: 'Falló la restauración; tu mundo actual quedó intacto' });
  }
  audit('restore', name, req);
  res.json({ msg: `Mundo restaurado. El anterior quedó en ${cfg.WORLD_DIR}.antes-de-restaurar` });
});

// ---------- Configuración (server.properties) ----------
const PROPS = {
  motd: 'text', 'server-port': [1, 65535], 'max-players': [1, 200],
  gamemode: ['survival', 'creative', 'adventure', 'spectator'], difficulty: ['peaceful', 'easy', 'normal', 'hard'],
  'force-gamemode': 'bool', pvp: 'bool',
  'allow-nether': 'bool', 'generate-structures': 'bool', 'spawn-monsters': 'bool', 'spawn-animals': 'bool', 'spawn-npcs': 'bool',
  'spawn-protection': [0, 100], 'enable-command-block': 'bool', 'allow-flight': 'bool',
  'white-list': 'bool', 'enforce-whitelist': 'bool', 'online-mode': 'bool', 'enforce-secure-profile': 'bool', 'player-idle-timeout': [0, 1440],
  'view-distance': [2, 32], 'simulation-distance': [3, 32], 'entity-broadcast-range-percentage': [10, 1000], 'max-world-size': [1, 29999984],
};
const PF = path.join(cfg.SERVER_PATH, 'server.properties');

router.get('/properties', async (req, res) => {
  const o = {};
  (await fsp.readFile(PF, 'utf8').catch(() => '')).split('\n').forEach((l) => {
    const m = l.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) o[m[1]] = m[2].replace(/\r$/, '');
  });
  res.json({ spec: PROPS, values: Object.fromEntries(Object.keys(PROPS).map((k) => [k, o[k] ?? ''])) });
});

router.post('/properties', async (req, res) => {
  const set = {};
  for (const [k, v] of Object.entries(req.body.values || {})) {
    if (k === 'server-port' && req.user.role !== 'owner') return res.status(403).json({ msg: 'Solo el Owner puede cambiar el puerto' });
    const t = PROPS[k], s = String(v);
    if (!t) continue;
    const ok = t === 'bool' ? /^(true|false)$/.test(s)
      : t === 'text' ? s.length <= 400 && !/[\r\n\0]/.test(s)
      : typeof t[0] === 'string' ? t.includes(s)
      : /^\d+$/.test(s) && +s >= t[0] && +s <= t[1];
    if (!ok) return res.status(400).json({ msg: 'Valor inválido: ' + k });
    if (k === 'server-port' && +s === cfg.PORT) return res.status(400).json({ msg: 'Ese puerto ya lo usa el panel' });
    set[k] = s;
  }
  const lines = (await fsp.readFile(PF, 'utf8')).split('\n');
  for (const [k, v] of Object.entries(set)) {
    const i = lines.findIndex((l) => l.startsWith(k + '='));
    if (i >= 0) lines[i] = `${k}=${v}`; else lines.push(`${k}=${v}`);
  }
  await fsp.writeFile(PF, lines.join('\n'));
  audit('properties', Object.keys(set).join(', '), req);
  res.json({ msg: 'Guardado. Reinicia el servidor para aplicar los cambios.' });
});

// ---------- Plugins y mods ----------
const MODDIRS = ['plugins', 'mods'];
router.get('/mods', async (req, res) => {
  const out = [];
  for (const d of MODDIRS) {
    const dir = path.join(cfg.SERVER_PATH, d);
    for (const f of (await fsp.readdir(dir).catch(() => [])).sort()) {
      if (!/\.jar(\.disabled)?$/.test(f)) continue;
      const st = await fsp.stat(path.join(dir, f));
      out.push({ dir: d, file: f, enabled: f.endsWith('.jar'), mb: +(st.size / 1048576).toFixed(1) });
    }
  }
  res.json(out);
});

router.post('/mods/toggle', async (req, res) => {
  const { dir, file } = req.body;
  if (!MODDIRS.includes(dir) || !/^[\w.\- +()\[\]]+\.jar(\.disabled)?$/.test(String(file)) || file.includes('..')) return res.status(400).json({ msg: 'Datos inválidos' });
  const p = path.join(cfg.SERVER_PATH, dir, file);
  if (!fs.existsSync(p)) return res.status(404).json({ msg: 'No existe' });
  const to = file.endsWith('.disabled') ? file.slice(0, -9) : file + '.disabled';
  fs.renameSync(p, path.join(cfg.SERVER_PATH, dir, to));
  audit('mod', `${dir}/${file} -> ${to}`, req);
  res.json({ msg: (to.endsWith('.disabled') ? 'Desactivado: ' : 'Activado: ') + file.replace(/\.disabled$/, '') + ' (reinicia para aplicar)' });
});

// ---------- Automatización ----------
const AUTO_F = path.join(__dirname, '..', 'automation.json');
const AUTO_DEF = { autoStop: { enabled: false, minutes: 10 }, restart: { enabled: false, time: '04:00' } };
const loadAuto = () => { try { return { ...AUTO_DEF, ...JSON.parse(fs.readFileSync(AUTO_F, 'utf8')) }; } catch { return AUTO_DEF; } };

router.get('/automation', (req, res) => res.json({ ...loadAuto(), now: new Date().toTimeString().slice(0, 5) }));
router.post('/automation', (req, res) => {
  const a = req.body.autoStop || {}, r = req.body.restart || {}, mins = +a.minutes, time = String(r.time);
  if (!(mins >= 1 && mins <= 240) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return res.status(400).json({ msg: 'Datos inválidos' });
  const v = { autoStop: { enabled: !!a.enabled, minutes: Math.floor(mins) }, restart: { enabled: !!r.enabled, time } };
  fs.writeFileSync(AUTO_F, JSON.stringify(v));
  audit('automation', JSON.stringify(v), req);
  res.json({ msg: 'Automatización guardada' });
});

let busy = false, emptyMin = 0, lastRestartDay = '';
setInterval(async () => { // se ejecuta cada minuto
  if (busy) return;
  try {
    if (!(await isRunning())) { emptyMin = 0; return; }
    const a = loadAuto(), now = new Date();
    if (a.restart.enabled && now.toTimeString().slice(0, 5) === a.restart.time && lastRestartDay !== now.toDateString()) {
      busy = true; lastRestartDay = now.toDateString();
      audit('auto_restart', '');
      await send('say Reinicio programado en 60 segundos');
      await sleep(60000);
      await send('stop');
      for (let i = 0; i < 90 && (await isRunning()); i++) await sleep(1000);
      start();
      return;
    }
    if (!a.autoStop.enabled) { emptyMin = 0; return; }
    const info = await new Promise((r) => playersInfo({ json: r }));
    if (info.pending) return;
    emptyMin = info.online === 0 ? emptyMin + 1 : 0;
    if (emptyMin >= a.autoStop.minutes) { emptyMin = 0; audit('auto_stop', 'Sin jugadores'); await send('stop'); }
  } catch (e) { console.error(e); } finally { busy = false; }
}, 60000);

// ---------- Ficha del jugador (coordenadas, vida, dimensión, tiempo conectado) ----------
router.get('/player-info', async (req, res) => {
  const name = String(req.query.name || '');
  if (!NAME.test(name)) return res.status(400).json({ msg: 'Datos inválidos' });
  if (!(await isRunning())) return res.status(409).json({ msg: 'El servidor está apagado' });
  const before = await fsp.stat(LOGF).then((s) => s.size, () => 0);
  for (const p of ['Pos', 'Health', 'Dimension', 'playerGameType']) await send(`data get entity ${name} ${p}`);
  await sleep(1200);
  const v = [...(await readFrom(before).catch(() => '')).matchAll(/following entity data: (.+)/g)].map((m) => m[1].trim());
  if (v.length < 4) return res.status(404).json({ msg: 'No se pudo leer al jugador (¿está conectado?)' });
  const size = await fsp.stat(LOGF).then((s) => s.size, () => 0);
  const tail = await readFrom(Math.max(0, size - 60000)).catch(() => '');
  const j = [...tail.matchAll(new RegExp('\\[(\\d\\d):(\\d\\d):(\\d\\d)\\][^\\n]*?: ' + name.replace(/[.\-]/g, '\\$&') + ' joined the game', 'g'))].pop();
  const n = new Date();
  let online = null;
  if (j) { online = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds() - (+j[1] * 3600 + +j[2] * 60 + +j[3]); if (online < 0) online += 86400; }
  res.json({ pos: (v[0].match(/-?\d+(\.\d+)?/g) || []).map((x) => Math.round(+x)), health: parseFloat(v[1]),
    dim: v[2].replace(/"|minecraft:/g, ''), mode: MODES[parseInt(v[3])] || '?', online });
});

// ---------- Memoria RAM (solo Owner): edita -Xmx/-Xms de start.sh ----------
const os = require('os');
router.get('/ram', (req, res) => {
  let t = '';
  try { t = fs.readFileSync(path.join(cfg.SERVER_PATH, 'start.sh'), 'utf8'); } catch {}
  const g = (k) => (t.match(new RegExp('-' + k + '(\\d+[MG])', 'i')) || [])[1] || '';
  res.json({ xmx: g('Xmx'), xms: g('Xms'), total: +(os.totalmem() / 1073741824).toFixed(1) });
});
router.post('/ram', (req, res) => {
  const f = path.join(cfg.SERVER_PATH, 'start.sh');
  const toMB = (v) => (/^\d{1,5}[MG]$/.test(v) ? parseInt(v) * (v.endsWith('G') ? 1024 : 1) : 0);
  const xmx = String(req.body.xmx || '').toUpperCase(), xms = String(req.body.xms || '').toUpperCase();
  const mx = toMB(xmx), mn = toMB(xms);
  if (!mx || !mn || mn > mx) return res.status(400).json({ msg: 'Memoria inválida (ej: 4G o 2048M; la inicial no puede superar la máxima)' });
  if (mx < 512 || mx > (os.totalmem() / 1048576) * 0.9) return res.status(400).json({ msg: 'La RAM máxima debe estar entre 512M y el 90% de la RAM del VPS' });
  let t;
  try { t = fs.readFileSync(f, 'utf8'); } catch { return res.status(404).json({ msg: 'No se encontró start.sh' }); }
  if (!/-Xmx\d+[MG]/i.test(t) || !/-Xms\d+[MG]/i.test(t)) return res.status(400).json({ msg: 'No encontré -Xmx y -Xms en start.sh; edítalo a mano' });
  fs.copyFileSync(f, f + '.bak');
  fs.writeFileSync(f, t.replace(/-Xmx\d+[MG]/i, '-Xmx' + xmx).replace(/-Xms\d+[MG]/i, '-Xms' + xms));
  audit('ram', `Xmx=${xmx} Xms=${xms}`, req);
  res.json({ msg: 'RAM guardada. Reinicia el servidor para aplicar.' });
});

router.get('/audit', (req, res) => {
  if (!fs.existsSync(cfg.AUDIT_FILE)) return res.json([]);
  const lines = fs.readFileSync(cfg.AUDIT_FILE, 'utf8').trim().split('\n').slice(-100);
  res.json(lines.map((l) => { try { const o = JSON.parse(l); if (req.user.role === 'guest') delete o.ip; return o; } catch { return null; } }).filter(Boolean));
});

module.exports = router;
