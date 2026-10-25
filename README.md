# Panel web para tu servidor de Minecraft

Panel para encender/apagar el servidor, ver la consola, administrar jugadores, archivos, plugins, backups y más, con cuentas por roles.

**Requisitos:** Ubuntu o Debian, Node.js 18+, `screen`, `tar` y Java (el que pida tu versión de Minecraft). El instalador se encarga de casi todo.

## Instalación rápida (VPS nuevo)

```bash
unzip mc-panel.zip && cd mc-panel
sudo bash install.sh --java 21
```

Te pregunta la carpeta del servidor, el puerto del panel y la contraseña inicial. Al terminar te da la dirección para entrar. Usuario: **admin**, contraseña: la que elegiste (cámbiala en la pestaña **🔑 Cuenta**).

El panel queda instalado en `/opt/mc-panel`, corre con un usuario sin privilegios (`mcpanel`) y arranca solo al reiniciar el VPS.

## Cambiar de VPS

En el VPS **viejo** (apaga antes el servidor de Minecraft desde el panel):

```bash
cd ~/ruta/del/panel
bash export.sh --con-servidor      # sin --con-servidor solo lleva cuentas, ajustes y backups
```

Pasa el archivo `~/mc-panel-migracion-*.tar.gz` al nuevo (por ejemplo `scp archivo usuario@IP-NUEVA:~`) y allí:

```bash
unzip mc-panel.zip && cd mc-panel
sudo bash install.sh --java 21 --restore ~/mc-panel-migracion-XXXX.tar.gz
```

Se restauran tus cuentas, la automatización, los backups y el servidor con su mundo. Después abre los puertos en el firewall del proveedor y borra el archivo de migración (lleva tu `.env`).

## Roles

| Rol | Puede |
|---|---|
| **Usuario** | Ver estado, consola y jugadores |
| **Mod** | + comandos, kick/ban, whitelist, encender/apagar, crear backups |
| **Admin** | + archivos, configuración, plugins, automatización, OPs, cuentas Usuario/Mod/Invitado |
| **Owner** | Todo, incluida la memoria RAM y el puerto del servidor |
| **Invitado** | Ve todo (sin IPs ni contraseñas) pero no modifica nada: sirve para mostrar el panel |

## Uso diario

```bash
systemctl status mc-panel        # estado del panel
sudo systemctl restart mc-panel  # reiniciarlo (NO apaga el servidor de Minecraft)
journalctl -u mc-panel -f        # ver sus mensajes
```

**Actualizar el panel** con una versión nueva del zip:

```bash
unzip -o mc-panel.zip -d /tmp/mc-new
sudo rsync -a --exclude .env --exclude node_modules --exclude users.json --exclude automation.json \
  --exclude audit.jsonl --exclude backups --exclude cache /tmp/mc-new/mc-panel/ /opt/mc-panel/
sudo chown -R mcpanel:mcpanel /opt/mc-panel && sudo systemctl restart mc-panel
```
Si el `package.json` cambió, añade `cd /opt/mc-panel && sudo -u mcpanel npm install --omit=dev` antes de reiniciar.

## Puertos y firewall

- **Panel:** `PORT` del `.env` (por defecto 3000).
- **Minecraft:** `server-port` de `server.properties` (el Owner lo cambia desde el panel).

Ábrelos en el firewall del sistema (`sudo ufw allow 3000/tcp`) **y** en el del proveedor del VPS.

## Seguridad

- Usa una contraseña distinta a las de otros sitios.
- Sin HTTPS, las contraseñas viajan sin cifrar. Si lo dejas abierto, ponlo detrás de Caddy: instala Caddy y en `/etc/caddy/Caddyfile` escribe `tu-dominio.com { reverse_proxy localhost:3000 }`; luego pon `COOKIE_SECURE=true` en el `.env`.
- Los backups se guardan en `/opt/mc-panel/backups`: descarga alguno de vez en cuando a tu equipo.

## Problemas comunes

| Síntoma | Qué hacer |
|---|---|
| No abre la página | Revisa `systemctl status mc-panel` y los puertos del firewall |
| Perdí el acceso | Borra `/opt/mc-panel/users.json` y reinicia: vuelve `admin` con la `KEY` del `.env` |
| El servidor no arranca | Revisa que `start.sh` exista, que Java esté instalado y que `eula.txt` diga `eula=true` |
| No salen los iconos de items | El VPS necesita internet hacia `raw.githubusercontent.com`; se guardan en `cache/` |

## Archivos

```
index.js  config.js  users.js  utils.js  middleware.js   núcleo del panel
routes/        server.js (servidor, jugadores, backups…)  files.js  account.js  items.js
views/ public/ interfaz (HTML, CSS, JS, traducciones en i18n.js)
install.sh export.sh   instalación y mudanza
.env  users.json  automation.json  backups/  cache/        datos (no se sobrescriben al actualizar)
```
