const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

const FILE = path.join(__dirname, 'users.json');
const ROLES = ['user', 'mod', 'admin', 'owner', 'guest'];
const hash = (pw, salt) => crypto.scryptSync(String(pw), salt, 32).toString('hex');
const save = (u) => fs.writeFileSync(FILE, JSON.stringify(u, null, 1), { mode: 0o600 });

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {
    // primer arranque: usuario "admin" (Owner) con la KEY del .env como contraseña
    const salt = crypto.randomBytes(16).toString('hex');
    const u = [{ name: 'admin', salt, hash: hash(cfg.KEY, salt), role: 'owner' }];
    save(u);
    return u;
  }
}
const find = (list, name) => list.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
const owners = (list) => list.filter((x) => x.role === 'owner').length;

exports.verify = (name, pw) => {
  const u = find(load(), name);
  const h = hash(pw ?? '', u ? u.salt : 'sin-usuario'); // mismo costo exista o no el usuario
  return u && crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(u.hash, 'hex')) ? { name: u.name, role: u.role } : null;
};
exports.get = (name) => { const u = find(load(), name); return u ? { name: u.name, role: u.role } : null; };
exports.list = () => load().map(({ name, role }) => ({ name, role }));

exports.add = (name, pw, role) => {
  const l = load();
  if (!/^[\w.-]{3,20}$/.test(String(name))) return { error: 'Usuario: 3-20 caracteres (letras, números, . _ -)' };
  if (String(pw || '').length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres' };
  if (!ROLES.includes(role)) return { error: 'Rol inválido' };
  if (find(l, name)) return { error: 'Ese usuario ya existe' };
  const salt = crypto.randomBytes(16).toString('hex');
  l.push({ name, salt, hash: hash(pw, salt), role });
  save(l);
  return {};
};
exports.update = (name, { role, password }) => {
  const l = load(), u = find(l, name);
  if (!u) return { error: 'No existe ese usuario' };
  if (role !== undefined) {
    if (!ROLES.includes(role)) return { error: 'Rol inválido' };
    if (u.role === 'owner' && role !== 'owner' && owners(l) < 2) return { error: 'Debe quedar al menos un Owner' };
    u.role = role;
  }
  if (password !== undefined) {
    if (String(password).length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres' };
    u.salt = crypto.randomBytes(16).toString('hex'); u.hash = hash(password, u.salt);
  }
  save(l);
  return {};
};
exports.remove = (name) => {
  const l = load(), u = find(l, name);
  if (!u) return { error: 'No existe ese usuario' };
  if (u.role === 'owner' && owners(l) < 2) return { error: 'Debe quedar al menos un Owner' };
  save(l.filter((x) => x !== u));
  return {};
};
