// Lista de items e iconos: los descarga el servidor (no el navegador) y los guarda en caché/
const router = require('express').Router();
const fsp = require('fs').promises;
const path = require('path');

const CACHE = path.join(__dirname, '..', 'cache');
const RAW = 'https://raw.githubusercontent.com/PrismarineJS/';
const JSD = 'https://cdn.jsdelivr.net/gh/PrismarineJS/';
const ICON_VERSION = process.env.ICON_VERSION || '1.20.2'; // carpeta de minecraft-assets con las texturas
const MISS_TTL = 24 * 3600 * 1000; // un "no existe" se reintenta pasado 1 día

// Prueba cada fuente hasta que una responde.
// failed = true si hubo errores de red/429/5xx (NO es lo mismo que "no existe": un 404)
async function get(urls) {
  let failed = false;
  for (const u of urls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      if (r.ok) return { buf: Buffer.from(await r.arrayBuffer()), failed };
      if (r.status !== 404) failed = true;
    } catch { failed = true; }
  }
  return { buf: null, failed };
}

// Máximo 6 descargas a la vez (si se piden 120 iconos juntos, GitHub responde 429 y se perdían)
let running = 0; const waiting = [];
async function limited(fn) {
  if (running >= 6) await new Promise((r) => waiting.push(r));
  running++;
  try { return await fn(); } finally { running--; waiting.shift()?.(); }
}
const inflight = new Map(); // evita descargar el mismo icono dos veces a la vez

// Nombres de textura posibles para un item (muchos bloques no tienen textura con su propio nombre)
function candidates(id) {
  const c = ['items/' + id, 'blocks/' + id];
  for (const s of ['_top', '_side', '_front', '_front_on', '_on', '_stage0', '_0']) c.push(`blocks/${id}${s}`);
  const base = id.replace(/_(stairs|slab|fence_gate|fence|wall|door|trapdoor|button|pressure_plate|sign|hanging_sign|planks)$/, '');
  if (base !== id) {
    for (const b of [base, base + '_planks', base + 's', base + '_block']) c.push('blocks/' + b);
  }
  return [...new Set(c)].map((p) => `minecraft-assets/master/data/${ICON_VERSION}/${p}.png`);
}

router.get('/items', async (req, res) => {
  const file = path.join(CACHE, 'items.json');
  let txt = await fsp.readFile(file, 'utf8').catch(() => null);
  if (!txt) {
    const dp = (await get([RAW + 'minecraft-data/master/data/dataPaths.json', JSD + 'minecraft-data@master/data/dataPaths.json'])).buf;
    const v = dp && Object.entries(JSON.parse(dp).pc)
      .filter(([k, o]) => /^\d+\.\d+(\.\d+)?$/.test(k) && o.items)
      .sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }))[0];
    const it = v && (await get([RAW + `minecraft-data/master/data/${v[1].items}/items.json`, JSD + `minecraft-data@master/data/${v[1].items}/items.json`])).buf;
    if (!it) return res.status(502).json({ msg: 'No se pudo descargar la lista de items (¿el VPS tiene internet?)' });
    txt = JSON.stringify({ version: v[0], items: JSON.parse(it).map((i) => [i.name, i.displayName]) });
    await fsp.mkdir(CACHE, { recursive: true });
    await fsp.writeFile(file, txt);
  }
  res.type('json').send(txt);
});

router.get('/icon/:id', async (req, res) => {
  const id = req.params.id;
  if (!/^[a-z0-9_]{1,64}$/.test(id)) return res.sendStatus(400);
  const file = path.join(CACHE, 'icons', id + '.png');
  let png = await fsp.readFile(file).catch(() => null);
  if (!png) {
    const st = await fsp.stat(file + '.miss').catch(() => null);
    if (st && Date.now() - st.mtimeMs < MISS_TTL) return res.sendStatus(404); // ya se buscó y no existe
    if (!inflight.has(id)) {
      inflight.set(id, limited(() => get(candidates(id).map((p) => RAW + p))).finally(() => inflight.delete(id)));
    }
    const { buf, failed } = await inflight.get(id);
    png = buf;
    await fsp.mkdir(path.dirname(file), { recursive: true });
    if (png) await fsp.writeFile(file, png);
    else if (failed) return res.set('Cache-Control', 'no-store').sendStatus(502); // fallo temporal: NO se marca como inexistente
    else { await fsp.writeFile(file + '.miss', ''); return res.sendStatus(404); }
  }
  res.set('Cache-Control', 'private, max-age=604800').type('png').send(png);
});

module.exports = router;
