# ⛏️ MC Panel

Panel web ligero para administrar tu servidor de Minecraft desde el navegador, sin entrar por SSH.

## ✨ Qué puedes hacer

- ▶️ Encender, apagar y reiniciar el servidor
- 💻 Ver la consola en vivo y enviar comandos
- 👥 Administrar jugadores: kick, ban, whitelist y OPs
- 🎁 Dar items con un selector visual de inventario (con iconos y búsqueda en español)
- 📁 Explorar, editar, subir y descargar archivos del servidor
- 💾 Crear y descargar backups del mundo
- ⚙️ Automatización y edición de `server.properties` y del MOTD
- 🔑 Cuentas con roles: Usuario, Mod, Admin, Owner e Invitado
- 📜 Registro de auditoría de las acciones
- 🚚 Migración a otro VPS con un solo comando

**Requisitos:** Ubuntu o Debian, Node.js 18+, `screen`, `tar` y Java (el que pida tu versión de Minecraft). El instalador se encarga de casi todo.

> ⚠️ El panel puede ejecutar comandos y editar archivos de tu servidor. Úsalo detrás de HTTPS (ver [Seguridad](#seguridad)) y con contraseñas fuertes.

## Instalación rápida (VPS nuevo)

Cambia `TU-USUARIO` por tu usuario de GitHub. El nombre de la carpeta que se crea depende de cómo lo descargues, por eso el instalador funciona **desde cualquier carpeta**.

**Opción A: con git** (la carpeta se llama `minecraftpanelweb`)

```bash
sudo apt install -y git
git clone https://github.com/TU-USUARIO/minecraftpanelweb.git
cd minecraftpanelweb
sudo bash install.sh --java 21
```

**Opción B: descargando el ZIP** (la carpeta se llama `minecraftpanelweb-main`)

```bash
sudo apt install -y unzip curl
curl -L -o minecraftpanelweb.zip https://github.com/TU-USUARIO/minecraftpanelweb/archive/refs/heads/main.zip
unzip minecraftpanelweb.zip
cd minecraftpanelweb-main
sudo bash install.sh --java 21
```

Si descargaste el ZIP desde el botón verde **Code → Download ZIP** del navegador, es lo mismo: descomprime y entra a la carpeta (`minecraftpanelweb-main`) antes de ejecutar `install.sh`.

El instalador te pregunta la carpeta del servidor, el puerto del panel y la contraseña inicial. Al terminar te da la dirección para entrar. Usuario: **admin**, contraseña: la que elegiste (cámbiala en la pestaña **🔑 Cuenta**).

El panel queda instalado en `/opt/mc-panel`, corre con un usuario sin privilegios (`mcpanel`) y arranca solo al reiniciar el VPS. Después de instalar puedes borrar la carpeta descargada.

## Uso

1. Abre `http://IP-DEL-VPS:3000` en el navegador (o el puerto que elegiste).
2. Entra con el usuario **admin** y tu contraseña.
3. Si no tenías un servidor, pon `server.jar` en la carpeta del servidor, acepta el EULA (`eula.txt` con `eula=true`) y revisa `start.sh`.
4. Enciende el servidor desde el panel.
5. En la lista de jugadores usa **🎁** para dar items: busca por nombre (en español o inglés), elige el item, la cantidad y pulsa **Dar**.

## Cambiar de VPS

En el VPS **viejo** (apaga antes el servidor de Minecraft desde el panel):

```bash
cd /opt/mc-panel
bash export.sh --con-servidor      # sin --con-servidor solo lleva cuentas, ajustes y backups
```

Pasa el archivo `~/mc-panel-migracion-*.tar.gz` al nuevo (por ejemplo `scp archivo usuario@IP-NUEVA:~`) y allí, desde la carpeta descargada del panel (como en la instalación rápida):

```bash
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

## Actualizar el panel

Con la carpeta que descargaste (si usaste git: `git pull` dentro de ella; si usaste ZIP: descarga y descomprime de nuevo). Ejemplo con git:

```bash
cd ~/minecraftpanelweb && git pull
sudo rsync -a --exclude .git --exclude .env --exclude node_modules --exclude users.json --exclude automation.json \
  --exclude audit.jsonl --exclude backups --exclude cache ./ /opt/mc-panel/
sudo chown -R mcpanel:mcpanel /opt/mc-panel && sudo systemctl restart mc-panel
```

Con ZIP, cambia `./` por la ruta de la carpeta nueva (por ejemplo `~/minecraftpanelweb-main/`). Si el `package.json` cambió, añade `cd /opt/mc-panel && sudo -u mcpanel npm install --omit=dev` antes de reiniciar.

## Puertos y firewall

- **Panel:** `PORT` del `.env` (por defecto 3000).
- **Minecraft:** `server-port` de `server.properties` (el Owner lo cambia desde el panel).

Ábrelos en el firewall del sistema (`sudo ufw allow 3000/tcp`) **y** en el del proveedor del VPS.

## Seguridad

- Usa una contraseña distinta a las de otros sitios.
- Sin HTTPS, las contraseñas viajan sin cifrar. Si lo dejas abierto, ponlo detrás de Caddy: instala Caddy y en `/etc/caddy/Caddyfile` escribe `tu-dominio.com { reverse_proxy localhost:3000 }`; luego pon `COOKIE_SECURE=true` en el `.env`.
- Los backups se guardan en `/opt/mc-panel/backups`: descarga alguno de vez en cuando a tu equipo.
- Nunca subas tu `.env` ni `users.json` a GitHub (el `.gitignore` ya los excluye).

## Problemas comunes

| Síntoma | Qué hacer |
|---|---|
| `install.sh: No such file or directory` | Estás fuera de la carpeta del panel. Entra con `cd minecraftpanelweb` (git) o `cd minecraftpanelweb-main` (ZIP) y comprueba con `ls` que está `install.sh` |
| No abre la página | Revisa `systemctl status mc-panel` y los puertos del firewall |
| Perdí el acceso | Borra `/opt/mc-panel/users.json` y reinicia: vuelve `admin` con la `KEY` del `.env` |
| El servidor no arranca | Revisa que `start.sh` exista, que Java esté instalado y que `eula.txt` diga `eula=true` |
| No salen los iconos de items | El VPS necesita internet hacia `raw.githubusercontent.com`; se guardan en `cache/`. Si cambiaste el código, borra `cache/icons/*.miss` y reinicia |
| Faltan iconos de items nuevos | Las texturas son de Minecraft 1.20.2. Puedes probar otra versión con `ICON_VERSION=1.21.1` en el `.env` (debe existir en [minecraft-assets](https://github.com/PrismarineJS/minecraft-assets)) |

## Archivos

```
index.js  config.js  users.js  utils.js  middleware.js   núcleo del panel
routes/        server.js (servidor, jugadores, backups…)  files.js  account.js  items.js
views/ public/ interfaz (HTML, CSS, JS, traducciones en i18n.js)
install.sh export.sh   instalación y mudanza
.env  users.json  automation.json  backups/  cache/        datos (no se sobrescriben al actualizar)
```

## Licencia y créditos

MIT (ver `LICENSE`). Minecraft es propiedad de Mojang Studios / Microsoft y este proyecto no está afiliado a ellos. Los iconos de items se descargan de [PrismarineJS/minecraft-assets](https://github.com/PrismarineJS/minecraft-assets) y no se incluyen en este repositorio.
