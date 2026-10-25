const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const cfg = require('./config');

let ROOT = cfg.SERVER_PATH;
try { ROOT = fs.realpathSync(cfg.SERVER_PATH); } catch {}

const inside = (p, root) => {
  const r = path.relative(root, p);
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
};

// Ruta relativa al servidor -> ruta absoluta segura (o null). Resuelve symlinks.
function safePath(rel = '') {
  const full = path.resolve(cfg.SERVER_PATH, '.' + path.sep + String(rel));
  if (!inside(full, cfg.SERVER_PATH)) return null;
  try {
    if (!inside(fs.realpathSync(full), ROOT)) return null;
  } catch {
    try { if (!inside(fs.realpathSync(path.dirname(full)), ROOT)) return null; }
    catch { return null; }
  }
  return full;
}

const isBlocked = (p) => cfg.BLOCKED_FILES.includes(path.basename(p).toLowerCase());

function audit(type, detail, req) {
  const line = JSON.stringify({ time: new Date().toISOString(), type, detail: String(detail || ''), ip: req?.ip, user: req?.user?.name }) + '\n';
  fs.appendFile(cfg.AUDIT_FILE, line, () => {});
}

const run = (cmd, args, opts) =>
  new Promise((resolve) => execFile(cmd, args, opts, (err, stdout) => resolve({ err, stdout })));

module.exports = { safePath, isBlocked, audit, run, ROOT };
