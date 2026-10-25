const router = require('express').Router();
const fsp = require('fs').promises;
const path = require('path');
const multer = require('multer');
const cfg = require('../config');
const { safePath, isBlocked, audit } = require('../utils');

const BINARY = ['.jar', '.png', '.jpg', '.jpeg', '.gif', '.zip', '.gz', '.db', '.dat'];
const UPLOAD_OK = ['.jar', '.yml', '.yaml', '.json', '.txt', '.png', '.jpg'];
const fail = (res, msg, code = 400) => res.status(code).json({ msg });
const rel = (p) => path.relative(cfg.SERVER_PATH, p);
const exists = (p) => fsp.access(p).then(() => true, () => false);
const locked = (req, p) => req.user.role !== 'owner' && path.basename(p) === 'server.properties';

router.get('/files', async (req, res) => {
  const dir = safePath(req.query.dir);
  if (!dir) return fail(res, 'Ruta inválida');
  const items = (await fsp.readdir(dir, { withFileTypes: true }))
    .filter((f) => !cfg.BLOCKED_FILES.includes(f.name.toLowerCase()))
    .map((f) => ({ name: f.name, type: f.isDirectory() ? 'folder' : 'file' }))
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'folder' ? -1 : 1) || a.name.localeCompare(b.name));
  res.json(items);
});

router.get('/file', async (req, res) => {
  const p = safePath(req.query.path);
  if (!p || isBlocked(p)) return fail(res, 'Acceso denegado', 403);
  if (BINARY.includes(path.extname(p).toLowerCase())) return fail(res, 'Este archivo no se puede editar');
  const st = await fsp.stat(p);
  if (!st.isFile() || st.size > 2e6) return fail(res, 'Archivo no editable o demasiado grande');
  let content = await fsp.readFile(p, 'utf8');
  if (req.user.role === 'guest') content = content.replace(/^(\s*[\w.-]*(?:password|passwd|secret|token|api[-_]?key)[\w.-]*\s*[:=]\s*).*$/gim, '$1********');
  res.json({ content });
});

router.post('/file', async (req, res) => {
  const p = safePath(req.body.path);
  if (!p || isBlocked(p)) return fail(res, 'No permitido', 403);
  if (BINARY.includes(path.extname(p).toLowerCase())) return fail(res, 'Este archivo no se puede editar');
  if (typeof req.body.content !== 'string') return fail(res, 'Contenido inválido');
  if (locked(req, p)) { // un Admin puede editar el archivo, pero no la línea server-port
    const port = (t) => (t.match(/^server-port=(.*)$/m) || [])[1]?.trim();
    if (port(await fsp.readFile(p, 'utf8').catch(() => '')) !== port(req.body.content)) return fail(res, 'Solo el Owner puede cambiar el puerto', 403);
  }
  let content = req.body.content;
  await fsp.writeFile(p, content);
  audit('save', rel(p), req);
  res.json({ msg: 'Guardado correctamente' });
});

router.post('/delete', async (req, res) => {
  const p = safePath(req.body.path);
  if (!p || isBlocked(p) || rel(p) === '' || locked(req, p)) return fail(res, 'No permitido', 403);
  await fsp.rm(p, { recursive: true, force: true });
  audit('delete', rel(p), req);
  res.json({ msg: 'Eliminado' });
});

router.post('/rename', async (req, res) => {
  const from = safePath(req.body.from), to = safePath(req.body.to);
  if (!from || !to || isBlocked(from) || isBlocked(to) || rel(from) === '' || locked(req, from) || locked(req, to)) return fail(res, 'No permitido', 403);
  if (await exists(to)) return fail(res, 'Ya existe ese nombre', 409);
  await fsp.rename(from, to);
  audit('rename', `${rel(from)} -> ${rel(to)}`, req);
  res.json({ msg: 'Renombrado' });
});

router.post('/create', async (req, res) => {
  const p = safePath(req.body.path);
  if (!p || isBlocked(p)) return fail(res, 'No permitido', 403);
  if (locked(req, p)) return fail(res, 'No permitido', 403);
  if (await exists(p)) return fail(res, 'Ya existe ese nombre', 409);
  if (req.body.type === 'folder') await fsp.mkdir(p, { recursive: true });
  else await fsp.writeFile(p, '', { flag: 'wx' });
  audit('create', rel(p), req);
  res.json({ msg: req.body.type === 'folder' ? 'Carpeta creada' : 'Archivo creado' });
});

router.get('/download', async (req, res) => {
  const p = safePath(req.query.path);
  if (!p || isBlocked(p)) return fail(res, 'Acceso denegado', 403);
  if (!(await fsp.stat(p)).isFile()) return fail(res, 'No se puede descargar una carpeta');
  res.download(p);
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, f, cb) => { const d = safePath(req.query.dir); d ? cb(null, d) : cb(new Error('Ruta inválida')); },
    filename: (req, f, cb) => cb(null, path.basename(f.originalname)),
  }),
  limits: { fileSize: 200 * 1024 * 1024, files: 50 },
  fileFilter: (req, f, cb) => {
    const name = path.basename(f.originalname);
    cb(null, UPLOAD_OK.includes(path.extname(name).toLowerCase()) && !isBlocked(name));
  },
});

router.post('/upload', upload.array('files', 50), (req, res) => {
  const n = req.files?.length || 0;
  if (!n) return fail(res, 'Ningún archivo permitido (' + UPLOAD_OK.join(' ') + ')');
  audit('upload', req.files.map((f) => f.filename).join(', '), req);
  res.json({ msg: `✔ Archivos subidos: ${n}` });
});

module.exports = router;
