#!/usr/bin/env bash
# Empaqueta lo necesario para mudarte de VPS.
#   bash export.sh                  -> solo datos del panel (cuentas, automatización, backups)
#   bash export.sh --con-servidor   -> además la carpeta completa del servidor de Minecraft
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
[ -f .env ] || { echo "No encuentro .env. Ejecútalo desde la carpeta del panel."; exit 1; }

SP=$(grep -E '^SERVER_PATH=' .env | cut -d= -f2-)
OUT="$HOME/mc-panel-migracion-$(date +%Y%m%d-%H%M).tar.gz"
TMP=$(mktemp -d)
mkdir "$TMP/panel"
for f in .env users.json automation.json audit.jsonl; do
  if [ -e "$f" ]; then cp -a "$f" "$TMP/panel/"; fi
done
if [ -d backups ]; then cp -a backups "$TMP/panel/"; fi

if [ "${1:-}" = "--con-servidor" ]; then
  echo "⚠ Apaga el servidor de Minecraft antes (botón 🔴 del panel) para no corromper el mundo."
  ln -s "$SP" "$TMP/servidor"
  tar czhf "$OUT" -C "$TMP" panel servidor   # h: sigue el enlace y guarda el contenido
else
  tar czf "$OUT" -C "$TMP" panel
fi
rm -rf "$TMP"
chmod 600 "$OUT"
echo "✅ Listo: $OUT"
echo "⚠ Contiene tu .env (contraseñas). Bórralo del VPS viejo cuando termines la mudanza."
