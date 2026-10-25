require('express-async-errors');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const cfg = require('./config');
const { auth, perm, csrf } = require('./middleware');
const users = require('./users');
const { audit } = require('./utils');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback'); // para Caddy/Nginx en el mismo servidor

app.use(helmet({
  hsts: false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: { 'img-src': ["'self'", 'data:', 'https://yanperez.com', 'https://mc-heads.net', 'https://cdn.jsdelivr.net'], 'connect-src': ["'self'", 'https://cdn.jsdelivr.net'], 'upgrade-insecure-requests': null },
  },
}));
app.use(session({
  secret: cfg.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 2 * 60 * 60 * 1000, httpOnly: true, sameSite: 'strict', secure: cfg.COOKIE_SECURE },
}));
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/static', express.static(path.join(__dirname, 'public')));

// ---------- Login ----------
const digest = (s) => crypto.createHash('sha256').update(String(s ?? '')).digest();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: 'Demasiados intentos. Espera 15 minutos.' });

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views/login.html')));
app.post('/login', loginLimiter, (req, res) => {
  const u = users.verify(req.body.username, req.body.password);
  if (!u) {
    audit('login_fail', String(req.body.username).slice(0, 30), req);
    return res.redirect('/login?error=1');
  }
  req.session.regenerate(() => {
    req.session.user = u.name;
    audit('login', u.name, req);
    res.redirect('/');
  });
});
app.post('/logout', csrf, (req, res) => req.session.destroy(() => res.json({ msg: 'Sesión cerrada' })));

// ---------- Panel y API ----------
app.get('/', auth, (req, res) => res.sendFile(path.join(__dirname, 'views/index.html')));
app.use('/api', auth, perm, csrf, require('./routes/account'), require('./routes/server'), require('./routes/files'), require('./routes/items'));

app.use((err, req, res, next) => {
  const known = err.name === 'MulterError' || err.message === 'Ruta inválida';
  if (!known) console.error(err);
  res.status(known ? 400 : 500).json({ msg: known ? err.message : 'Error interno' });
});

app.listen(cfg.PORT, cfg.HOST, () => console.log(`✅ Panel en http://${cfg.HOST}:${cfg.PORT}`));
