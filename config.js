require('dotenv').config();
const path = require('path');

for (const k of ['KEY', 'SESSION_SECRET']) {
  if (!process.env[k]) { console.error(`❌ Falta ${k} en .env`); process.exit(1); }
}

module.exports = {
  KEY: process.env.KEY,
  SESSION_SECRET: process.env.SESSION_SECRET,
  PORT: +process.env.PORT || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  SERVER_PATH: path.resolve(process.env.SERVER_PATH || '/root/minecraft/26.1'),
  SCREEN_NAME: process.env.SCREEN_NAME || 'minecraft',
  MC_PORT: +process.env.MC_PORT || 25589,
  WORLD_DIR: process.env.WORLD_DIR || 'world',
  MAX_BACKUPS: +process.env.MAX_BACKUPS || 5,
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true',
  BACKUP_DIR: path.resolve(process.env.BACKUP_DIR || path.join(__dirname, 'backups')),
  AUDIT_FILE: path.join(__dirname, 'audit.jsonl'),
  BLOCKED_FILES: ['start.sh', 'yan.yml', 'run.sh'],
  BLOCKED_COMMANDS: ['op', 'help'],
};
