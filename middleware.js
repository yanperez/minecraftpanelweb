const users = require('./users');

const LV = { user: 1, mod: 2, admin: 3, owner: 4 };
// [método, ruta, nivel mínimo]. Todo lo que no esté aquí exige Owner (3).
const RULES = [
  ['GET', /^\/(status|logs|players|whitelist|bans|me)$/, 1],
  ['POST', /^\/me\/password$/, 1],
  ['GET', /^\/(ops|backups|player-info|items|icon\/\w+)$/, 2],
  ['GET', /^\/ram$/, 4], // solo Owner
  ['POST', /^\/ram$/, 4],
  ['POST', /^\/(cmd|player|unban|whitelist|start|stop|restart|backups)$/, 2],
];

exports.auth = (req, res, next) => {
  const u = req.session.user && users.get(req.session.user); // rol siempre actualizado
  if (u) { req.user = u; return next(); }
  if (req.originalUrl.startsWith('/api')) return res.status(401).json({ error: 'No autorizado' });
  res.redirect('/login');
};

exports.perm = (req, res, next) => {
  if (req.user.role === 'guest') {
    if (req.method === 'GET' && !/^\/(download|backups\/.+)$/.test(req.path)) return next();
    return res.status(403).json({ msg: req.method === 'GET' ? 'No disponible en modo invitado' : 'Modo invitado: solo lectura' });
  }
  const r = RULES.find(([m, re]) => m === req.method && re.test(req.path));
  if (LV[req.user.role] >= (r ? r[2] : 3)) return next();
  res.status(403).json({ msg: 'No tienes permiso para hacer esto' });
};

// Defensa CSRF: toda acción que cambia algo exige este header
exports.csrf = (req, res, next) => {
  if (req.method !== 'GET' && req.get('x-panel') !== '1') return res.status(403).json({ msg: 'Solicitud no permitida' });
  next();
};
