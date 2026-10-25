// Traducciones ES -> EN. Las claves son el texto en español sin emojis iniciales.
(() => {
const RAW = `
Encendido=Running
Apagado=Stopped
Encender=Start
Reiniciar=Restart
Apagar=Stop
Salir=Log out
Cambiar tema=Change theme
Consola=Console
Jugadores=Players
Automático=Automatic
Archivos=Files
Actividad=Activity
Cuenta=Account
Escribe un comando (↑ ↓ para el historial)=Type a command (↑ ↓ for history)
Enviar=Send
Jugadores en línea=Online players
Actualizar=Refresh
Kick y Ban permiten escribir un motivo (opcional).=Kick and Ban let you add a reason (optional).
Desactivada=Disabled
Activada=Enabled
Activar=Enable
Desactivar=Disable
Nombre del jugador=Player name
Agregar=Add
Baneados=Banned
Operadores (OP)=Operators (OP)
Dar OP=Give OP
Comandos rápidos=Quick commands
Mensaje para todos los jugadores=Message to all players
Configuración del servidor=Server settings
Guardar configuración=Save settings
Los cambios se aplican al reiniciar el servidor.=Changes apply when the server restarts.
Apagar sin jugadores=Stop when empty
Apagar el servidor si está vacío durante=Stop the server if it is empty for
minutos=minutes
Reinicio diario=Daily restart
Reiniciar todos los días a las=Restart every day at
Hora actual del VPS:=Current VPS time:
Se avisa a los jugadores 60 segundos antes.=Players are warned 60 seconds before.
Guardar=Save
Plugins y mods instalados=Installed plugins and mods
Desactivar renombra el archivo a .jar.disabled. Para instalar uno nuevo, súbelo en Archivos (carpeta plugins o mods). Reinicia el servidor para aplicar.=Disable renames the file to .jar.disabled. To install a new one, upload it in Files (plugins or mods folder). Restart the server to apply.
Crear backup del mundo=Back up the world
Mi cuenta:=My account:
Contraseña actual=Current password
Nueva contraseña (mín. 6)=New password (min. 6)
Cambiar contraseña=Change password
Usuarios del panel=Panel users
Usuario (3-20)=Username (3-20)
Contraseña (mín. 6)=Password (min. 6)
Usuario (solo ver)=User (view only)
Crear=Create
Usuario: solo ve consola, jugadores y estado. Mod: además usa comandos, kick/ban, whitelist, enciende/apaga y crea backups. Admin: además archivos, configuración, plugins, automatización, OPs y usuarios (Usuario/Mod). Owner: todo, incluida la RAM.=User: only sees console, players and status. Mod: also uses commands, kick/ban, whitelist, starts/stops and creates backups. Admin: also files, settings, plugins, automation, OPs and users (User/Mod). Owner: everything, including RAM.
Atrás=Back
Subir=Upload
Archivo=File
Carpeta=Folder
Arrastra archivos aquí para subirlos.=Drag files here to upload them.
Cerrar=Close
Hora=Time
Acción=Action
Detalle=Details
Entrar=Log in
Usuario=User
Contraseña=Password
Usuario o contraseña incorrectos=Incorrect username or password
Día=Day
Noche=Night
Clima limpio=Clear weather
Lluvia=Rain
Guardar mundo=Save world
Dificultad=Difficulty
Modo por defecto=Default game mode
Aplicar=Apply
Más acciones…=More actions…
Teletransportar a un jugador=Teleport to a player
Teletransportar a coordenadas=Teleport to coordinates
Modo supervivencia=Survival mode
Modo creativo=Creative mode
Modo aventura=Adventure mode
Modo espectador=Spectator mode
Dar un item=Give an item
Curar=Heal
Vaciar inventario=Clear inventory
Matar=Kill
Quitar=Remove
Desbanear=Unban
Quitar OP=Remove OP
Renombrar=Rename
Eliminar=Delete
Descargar=Download
Restaurar=Restore
Nueva contraseña=New password
Mensaje (MOTD)=Message (MOTD)
Máx. jugadores=Max players
Modo de juego=Game mode
Forzar modo de juego al entrar=Force game mode on join
PvP (daño entre jugadores)=PvP (player damage)
Permitir el Nether=Allow the Nether
Generar estructuras=Generate structures
Aparecen monstruos=Monsters spawn
Aparecen animales=Animals spawn
Aparecen aldeanos=Villagers spawn
Protección del spawn (bloques)=Spawn protection (blocks)
Bloques de comandos=Command blocks
Permitir volar=Allow flying
Expulsar a quien no esté en la whitelist=Kick anyone not on the whitelist
Solo cuentas premium (online-mode)=Premium accounts only (online-mode)
Chat firmado (secure profile)=Signed chat (secure profile)
Expulsar por inactividad (min, 0 = nunca)=Kick when idle (min, 0 = never)
Distancia de render=View distance
Distancia de simulación=Simulation distance
Rango de entidades (%)=Entity range (%)
Tamaño máximo del mundo=Max world size
Mundo=World
Acceso=Access
Rendimiento=Performance
¿Apagar el servidor?=Stop the server?
¿Reiniciar el servidor?=Restart the server?
Nuevo nombre:=New name:
Nombre del archivo:=File name:
Nombre de la carpeta:=Folder name:
¿A qué jugador?=Which player?
Coordenadas x y z (ej: 100 64 -50)=Coordinates x y z (e.g. 100 64 -50)
Item (ej: diamond, golden_apple)=Item (e.g. diamond, golden_apple)
Cantidad=Amount
Servidor apagado=Server stopped
Sin respuesta del servidor=No response from the server
No hay jugadores conectados.=No players online.
Enciende el servidor para ver los jugadores.=Start the server to see players.
La whitelist está vacía.=The whitelist is empty.
No hay jugadores baneados.=No banned players.
No hay operadores.=No operators.
Carpeta vacía. Sube o crea un archivo.=Empty folder. Upload or create a file.
Todavía no hay backups. Crea el primero.=No backups yet. Create the first one.
No hay .jar en las carpetas plugins ni mods.=No .jar files in the plugins or mods folders.
Listo=Done
Sesión cerrada=Logged out
Guardado correctamente=Saved successfully
Eliminado=Deleted
Renombrado=Renamed
Archivo creado=File created
Carpeta creada=Folder created
Ya existe ese nombre=That name already exists
Ruta inválida=Invalid path
Acceso denegado=Access denied
No permitido=Not allowed
Este archivo no se puede editar=This file can't be edited
Archivo no editable o demasiado grande=File not editable or too large
Contenido inválido=Invalid content
No se puede descargar una carpeta=Can't download a folder
El servidor ya está encendido=The server is already running
Iniciando el servidor...=Starting the server...
El servidor ya está apagado=The server is already stopped
Apagando el servidor...=Stopping the server...
El servidor está apagado=The server is stopped
Reiniciando...=Restarting...
Escribe un comando=Type a command
Comando inválido=Invalid command
Creando backup, tarda unos segundos...=Creating backup, this takes a few seconds...
Backup inválido=Invalid backup
Apaga el servidor antes de restaurar=Stop the server before restoring
Falló la restauración; tu mundo actual quedó intacto=Restore failed; your current world is untouched
Datos inválidos=Invalid data
Enciende el servidor para cambiar la whitelist=Start the server to change the whitelist
Enciende el servidor para desbanear=Start the server to unban
Enciende el servidor para cambiar operadores=Start the server to change operators
Nombre inválido=Invalid name
No existe=Does not exist
Guardado. Reinicia el servidor para aplicar los cambios.=Saved. Restart the server to apply the changes.
Automatización guardada=Automation saved
Puerto del servidor=Server port
Ese puerto ya lo usa el panel=That port is already used by the panel
La contraseña actual no es correcta=The current password is incorrect
La contraseña debe tener al menos 6 caracteres=The password must be at least 6 characters
Contraseña cambiada=Password changed
Usuario creado=User created
Usuario actualizado=User updated
Usuario eliminado=User deleted
No puedes eliminarte a ti mismo=You can't delete yourself
Usuario: 3-20 caracteres (letras, números, . _ -)=Username: 3-20 characters (letters, numbers, . _ -)
Rol inválido=Invalid role
Ese usuario ya existe=That user already exists
No existe ese usuario=That user does not exist
Debe quedar al menos un Owner=At least one Owner must remain
No tienes permiso para hacer esto=You don't have permission to do this
Solicitud no permitida=Request not allowed
No autorizado=Not authorized
Error interno=Internal error
Invitado=Guest
Modo invitado: puedes ver todo, pero no modificar nada=Guest mode: you can see everything, but you can't change anything
Modo invitado: solo lectura=Guest mode: read-only
No disponible en modo invitado=Not available in guest mode
No se pudo descargar la lista de items (¿el VPS tiene internet?)=Couldn't download the item list (does the VPS have internet access?)
Usando una lista corta de items=Using a short item list
Buscar item (ej: diamante, espada, torch)=Search item (e.g. diamond, sword, torch)
Cargando items…=Loading items…
Sin resultados=No results
Elige un item primero=Pick an item first
Dar=Give
Solo el Owner puede cambiar el puerto=Only the Owner can change the port
Ver ficha=View card
Consultando…=Querying…
Editor de MOTD=MOTD editor
Escribe el mensaje (2 líneas máx). Usa los colores de arriba=Type the message (2 lines max). Use the colors above
Guardar MOTD=Save MOTD
Memoria RAM (solo Owner)=RAM memory (Owner only)
Máxima (-Xmx)=Maximum (-Xmx)
Inicial (-Xms)=Initial (-Xms)
Guardar RAM=Save RAM
Ejemplos: 4G o 2048M. Reinicia el servidor para aplicar.=Examples: 4G or 2048M. Restart the server to apply.
Memoria inválida (ej: 4G o 2048M; la inicial no puede superar la máxima)=Invalid memory (e.g. 4G or 2048M; initial can't exceed maximum)
La RAM máxima debe estar entre 512M y el 90% de la RAM del VPS=Max RAM must be between 512M and 90% of the VPS RAM
No se encontró start.sh=start.sh not found
No encontré -Xmx y -Xms en start.sh; edítalo a mano=Couldn't find -Xmx and -Xms in start.sh; edit it by hand
RAM guardada. Reinicia el servidor para aplicar.=RAM saved. Restart the server to apply.
No puedes gestionar a ese usuario=You can't manage that user
No se pudo leer al jugador (¿está conectado?)=Couldn't read the player (are they online?)
`;
const EN = {};
RAW.trim().split('\n').forEach((l) => { const i = l.indexOf('='); EN[l.slice(0, i)] = l.slice(i + 1); });

const RX = [ // textos con datos variables
  [/^Ejecutado: ([\s\S]+)$/, 'Executed: $1'],
  [/^Comando bloqueado: (.+)$/, 'Blocked command: $1'],
  [/^Valor inválido: (.+)$/, 'Invalid value: $1'],
  [/^Agregado: (.+)$/, 'Added: $1'], [/^Quitado: (.+)$/, 'Removed: $1'], [/^Desbaneado: (.+)$/, 'Unbanned: $1'],
  [/^OP dado a (.+)$/, 'OP given to $1'], [/^OP quitado a (.+)$/, 'OP removed from $1'],
  [/^Activado: (.+) \(reinicia para aplicar\)$/, 'Enabled: $1 (restart to apply)'],
  [/^Desactivado: (.+) \(reinicia para aplicar\)$/, 'Disabled: $1 (restart to apply)'],
  [/^Whitelist (activada|desactivada)$/, (_, a) => 'Whitelist ' + (a === 'activada' ? 'enabled' : 'disabled')],
  [/^Mundo restaurado\. El anterior quedó en (.+)$/, 'World restored. The previous one was saved as $1'],
  [/^Archivos subidos: (\d+)$/, 'Files uploaded: $1'],
  [/^Ningún archivo permitido \((.+)\)$/, 'No allowed files ($1)'],
  [/^En línea: (.+)$/, 'Online: $1'],
  [/^Usar «(.+)» como ID$/, 'Use «$1» as ID'],
  [/^En línea hace (.+)$/, 'Online for $1'],
  [/^¿Eliminar (?:a )?(.+)\?$/, 'Delete $1?'],
  [/^¿Restaurar (.+?)\? Reemplaza[\s\S]*$/, 'Restore $1? This replaces the current world (a copy is kept). The server must be stopped.'],
  [/^¿Quitar OP a (.+)\?$/, 'Remove OP from $1?'],
  [/^¿Dar OP a (.+?)\? Tendrá[\s\S]*$/, 'Give OP to $1? They will have full control in-game.'],
  [/^¿Seguro\? \((.+) a (.+)\)$/, 'Are you sure? ($1 on $2)'],
  [/^(Kick|Ban) a (.+)\. Motivo \(opcional\):$/, '$1 $2. Reason (optional):'],
  [/^Nueva contraseña para (.+) \(mín\. 6\):$/, 'New password for $1 (min. 6):'],
  [/^(.+) \(tú\)$/, '$1 (you)'],
  [/^Con online-mode desactivado[\s\S]*$/, "With online-mode off, anyone can join using another player's name (even an admin). Continue?"],
];

let LANG = localStorage.getItem('lang') === 'en' ? 'en' : 'es';
window.t = (s) => {
  if (LANG === 'es' || typeof s !== 'string' || !s) return s;
  const m = s.match(/^([^\p{L}\p{N}¿¡]*)([\s\S]*?)(\s*)$/u); // prefijo (emojis), texto, espacios finales
  let r = EN[m[2]];
  if (r === undefined) for (const [re, to] of RX) if (re.test(m[2])) { r = m[2].replace(re, to); break; }
  return r === undefined ? s : m[1] + r + m[3];
};

// Todo texto asignado con .textContent se traduce solo
const d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
Object.defineProperty(Node.prototype, 'textContent', { ...d, set(v) { d.set.call(this, typeof v === 'string' ? window.t(v) : v); } });
const _confirm = window.confirm.bind(window), _prompt = window.prompt.bind(window);
window.confirm = (m) => _confirm(window.t(m));
window.prompt = (m, v) => _prompt(window.t(m), v);

// Texto fijo del HTML: se guarda el original en español para poder volver
const reg = [];
const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
for (let n; (n = w.nextNode());) if (n.nodeValue.trim() && n.parentNode.id !== 'bLang') reg.push([n, null, n.nodeValue]);
document.querySelectorAll('[placeholder],[title]').forEach((e) => ['placeholder', 'title'].forEach((a) => e.hasAttribute(a) && reg.push([e, a, e.getAttribute(a)])));
const apply = () => { reg.forEach(([n, a, es]) => (a ? n.setAttribute(a, window.t(es)) : (n.nodeValue = window.t(es)))); document.documentElement.lang = LANG; };

const btn = document.getElementById('bLang');
if (btn) {
  btn.textContent = '🌐 ' + LANG.toUpperCase();
  btn.onclick = () => {
    LANG = LANG === 'es' ? 'en' : 'es';
    localStorage.setItem('lang', LANG);
    btn.textContent = '🌐 ' + LANG.toUpperCase();
    apply();
    dispatchEvent(new Event('langchange'));
  };
}
if (LANG === 'en') apply();
})();
