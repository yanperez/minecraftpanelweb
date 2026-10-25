#!/usr/bin/env bash
# Instalador del panel del servidor de Minecraft (Ubuntu / Debian).
#   sudo bash install.sh                    -> instalación nueva
#   sudo bash install.sh --restore ARCHIVO  -> instala y restaura lo exportado con export.sh
#   sudo bash install.sh --java 21          -> además instala Java (openjdk-21-jre-headless)
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Ejecútalo como root: sudo bash install.sh"; exit 1; }
command -v apt-get >/dev/null || { echo "Este instalador es para Ubuntu/Debian."; exit 1; }

RESTORE=""; JAVA=""
while [ $# -gt 0 ]; do
  case "$1" in
    --restore) RESTORE="${2:?Falta el archivo}"; shift 2 ;;
    --java) JAVA="${2:?Falta la versión de Java}"; shift 2 ;;
    *) echo "Opción desconocida: $1"; exit 1 ;;
  esac
done
if [ -n "$RESTORE" ]; then
  [ -f "$RESTORE" ] || { echo "No existe el archivo: $RESTORE"; exit 1; }
  RESTORE=$(realpath "$RESTORE")
fi

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP=/opt/mc-panel
USER_NAME=mcpanel
ask() { local v=""; if [ -r /dev/tty ]; then read -rp "$1 [$2]: " v </dev/tty || true; fi; echo "${v:-$2}"; }

echo "==> 1/6 Instalando paquetes del sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates screen tar unzip rsync openssl
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  echo "==> Instalando Node.js 20 (repositorio oficial NodeSource)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
if [ -n "$JAVA" ]; then apt-get install -y "openjdk-${JAVA}-jre-headless"; fi

echo "==> 2/6 Preparando el usuario y los archivos del panel..."
id "$USER_NAME" >/dev/null 2>&1 || useradd -m -s /bin/bash "$USER_NAME"
mkdir -p "$APP"
if [ "$SRC" != "$APP" ]; then
  rsync -a --exclude node_modules --exclude .env --exclude users.json --exclude automation.json \
    --exclude audit.jsonl --exclude backups --exclude cache "$SRC"/ "$APP"/
fi

T=""
if [ -n "$RESTORE" ]; then
  echo "==> Restaurando datos de $RESTORE ..."
  T=$(mktemp -d)
  tar xzf "$RESTORE" -C "$T"
  [ -d "$T/panel" ] && cp -a "$T/panel/." "$APP/"
fi

echo "==> 3/6 Configuración..."
DEF="/home/$USER_NAME/server"
if [ -f "$APP/.env" ]; then
  OLD=$(grep -E '^SERVER_PATH=' "$APP/.env" | cut -d= -f2- || true)
  case "$OLD" in ""|/root/*) ;; *) DEF="$OLD" ;; esac
fi
SP=$(ask "Carpeta del servidor de Minecraft" "$DEF")
NEWKEY=""
if [ -f "$APP/.env" ]; then
  sed -i "s|^SERVER_PATH=.*|SERVER_PATH=$SP|" "$APP/.env"
else
  PORT=$(ask "Puerto del panel web" "3000")
  NEWKEY=$(ask "Contraseña inicial del panel (usuario: admin)" "$(openssl rand -base64 12 | tr -d '/+=')")
  cat > "$APP/.env" <<EOF
KEY=$NEWKEY
SESSION_SECRET=$(openssl rand -hex 32)
PORT=$PORT
HOST=0.0.0.0
SERVER_PATH=$SP
SCREEN_NAME=minecraft
WORLD_DIR=world
MAX_BACKUPS=5
COOKIE_SECURE=false
EOF
fi
chmod 600 "$APP/.env"
PORT=$(grep -E '^PORT=' "$APP/.env" | cut -d= -f2 || true); PORT=${PORT:-3000}

mkdir -p "$SP"
if [ -n "$T" ] && [ -d "$T/servidor" ]; then
  echo "==> Copiando el servidor de Minecraft a $SP ..."
  cp -a "$T/servidor/." "$SP/"
fi
[ -z "$T" ] || rm -rf "$T"
if [ ! -f "$SP/start.sh" ]; then # plantilla; la RAM se cambia luego desde el panel (solo Owner)
  printf '#!/usr/bin/env bash\njava -Xms2G -Xmx2G -jar server.jar nogui\n' > "$SP/start.sh"
  chmod +x "$SP/start.sh"
fi

echo "==> 4/6 Instalando dependencias de Node..."
chown -R "$USER_NAME:$USER_NAME" "$APP" "$SP"
su - "$USER_NAME" -c "cd '$APP' && npm install --omit=dev --no-audit --no-fund"

echo "==> 5/6 Creando el servicio (arranca solo al reiniciar el VPS)..."
cat > /etc/systemd/system/mc-panel.service <<EOF
[Unit]
Description=Panel web del servidor de Minecraft
After=network.target

[Service]
User=$USER_NAME
WorkingDirectory=$APP
ExecStart=$(command -v node) index.js
Restart=always
RestartSec=5
# Importante: al reiniciar el panel NO se apaga el servidor de Minecraft (corre dentro de screen)
KillMode=process

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable mc-panel >/dev/null
systemctl restart mc-panel

echo "==> 6/6 Firewall..."
MCP=$(grep -hE '^server-port=' "$SP/server.properties" 2>/dev/null | cut -d= -f2 || true); MCP=${MCP:-25565}
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow "$PORT"/tcp; ufw allow "$MCP"/tcp
  echo "ufw: abiertos los puertos $PORT (panel) y $MCP (Minecraft)."
fi

IP=$(hostname -I | awk '{print $1}')
echo
echo "✅ Listo. Abre:  http://$IP:$PORT"
if [ -n "$NEWKEY" ]; then echo "   Usuario: admin   Contraseña: $NEWKEY   (cámbiala en la pestaña Cuenta)"
else echo "   Entra con tus cuentas de siempre (si es instalación nueva: usuario admin y la KEY del .env)."; fi
echo
echo "Pendiente de tu lado:"
echo "  • Abre los puertos $PORT y $MCP también en el firewall de tu proveedor del VPS."
echo "  • Si no restauraste un servidor: pon server.jar en $SP, acepta el EULA (eula.txt) y revisa start.sh."
echo "  • Si falta Java:  sudo apt install openjdk-21-jre-headless   (o la versión que pida tu Minecraft)."
echo "  • Logs del panel: journalctl -u mc-panel -f"
