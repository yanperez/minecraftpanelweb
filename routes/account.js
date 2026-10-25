const router = require('express').Router();
const users = require('../users');
const { audit } = require('../utils');

const fail = (res, r) => res.status(400).json({ msg: r.error });
// Un Admin solo gestiona cuentas Usuario/Mod; el Owner gestiona todas
const allowed = (req, role) => req.user.role === 'owner' || ['user', 'mod', 'guest'].includes(role);
const deny = (res) => res.status(403).json({ msg: 'No puedes gestionar a ese usuario' });

router.get('/me', (req, res) => res.json(req.user));

router.post('/me/password', (req, res) => {
  if (!users.verify(req.user.name, req.body.current)) return res.status(403).json({ msg: 'La contraseña actual no es correcta' });
  const r = users.update(req.user.name, { password: req.body.password });
  if (r.error) return fail(res, r);
  audit('password', '', req);
  res.json({ msg: 'Contraseña cambiada' });
});

// Solo Owner (por defecto en middleware.js)
router.get('/users', (req, res) => res.json(users.list()));

router.post('/users', (req, res) => {
  if (!allowed(req, req.body.role)) return deny(res);
  const r = users.add(req.body.name, req.body.password, req.body.role);
  if (r.error) return fail(res, r);
  audit('user_add', `${req.body.name} (${req.body.role})`, req);
  res.json({ msg: 'Usuario creado' });
});

router.post('/users/update', (req, res) => {
  const { name, role, password } = req.body;
  const tg = users.get(name);
  if (!tg || !allowed(req, tg.role) || (role !== undefined && !allowed(req, role))) return deny(res);
  const r = users.update(name, { role, password });
  if (r.error) return fail(res, r);
  audit('user_update', name + (role ? ` -> ${role}` : '') + (password ? ' (contraseña)' : ''), req);
  res.json({ msg: 'Usuario actualizado' });
});

router.post('/users/delete', (req, res) => {
  const name = String(req.body.name || '');
  if (name.toLowerCase() === req.user.name.toLowerCase()) return res.status(400).json({ msg: 'No puedes eliminarte a ti mismo' });
  const tg = users.get(name);
  if (tg && !allowed(req, tg.role)) return deny(res);
  const r = users.remove(name);
  if (r.error) return fail(res, r);
  audit('user_delete', name, req);
  res.json({ msg: 'Usuario eliminado' });
});

module.exports = router;
