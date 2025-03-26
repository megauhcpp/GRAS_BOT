```markdown
# GRAS BOT

Este bot de Discord está diseñado para ayudar a gestionar y asignar tareas dentro de un servidor. Permite a los administradores o usuarios asignar tareas a otros miembros del servidor, enviándolas por mensaje directo (DM). Los usuarios pueden marcar las tareas como completadas o pendientes utilizando botones interactivos.

## Funcionalidades principales

- **Asignación de tareas**: Los administradores o cualquier usuario autorizado pueden enviar tareas a otros miembros del servidor.
- **Interacción con botones**: Los usuarios pueden marcar las tareas como completadas o pendientes a través de botones, lo que facilita su gestión.
- **Confirmaciones y registros**: Cuando una tarea se marca como completada o pendiente, se registra en un canal privado del servidor junto con la fecha y hora de la actualización.
- **Mensajes visualmente atractivos**: El bot envía los mensajes de tareas con un formato limpio y elegante utilizando embeds y botones interactivos.

## Requisitos

Para ejecutar este proyecto, necesitarás:

- **Node.js** (versión 16.0.0 o superior)
- **Discord.js** (versión 14 o superior)
- **dotenv** (para manejar variables de entorno)
- **Una cuenta de Discord** y un **bot de Discord**.

## Instalación

1. **Clona el repositorio**:

   ```bash
   git clone https://github.com/tu-usuario/discord-task-manager-bot.git
   cd discord-task-manager-bot
   ```

2. **Instala las dependencias**:

   Asegúrate de tener Node.js instalado y luego ejecuta:

   ```bash
   npm install
   ```

3. **Configura las variables de entorno**:

   Crea un archivo `.env` en la raíz del proyecto y agrega tu token de bot de Discord:

   ```env
   DISCORD_BOT_TOKEN=tu-token-de-bot-aqui
   ```

4. **Ejecuta el bot**:

   Inicia el bot con el siguiente comando:

   ```bash
   node index.js
   ```

   El bot se conectará a Discord y estará listo para recibir tareas.

## Cómo usar el bot

### Asignar tareas

1. **Envío de tareas**: Los administradores o usuarios autorizados pueden enviar tareas a otros usuarios. Las tareas deben estar separadas por saltos de línea en el mensaje.

   Ejemplo de mensaje:
   ```
   @usuario1
   Limpiar las habitaciones 450 y 570.
   Hacer pedido de 200 toallas con la nueva imagen de la empresa.
   Recoger el material de la tienda.
   ```

2. **Botones interactivos**: Una vez que el usuario reciba el mensaje con las tareas, podrá marcar cada tarea como "completada" o "pendiente" usando los botones interactivos.

### Confirmaciones y registros

Cuando el usuario marca una tarea como completada o pendiente, el bot actualizará el canal privado con un mensaje de confirmación que incluye:

- El nombre del usuario.
- La tarea que se marcó.
- El estado de la tarea (completada o pendiente).
- La fecha y hora en la que se actualizó el estado.

### Canal privado de tareas

El bot enviará las confirmaciones de las tareas al canal privado del servidor, donde se llevará un registro de todas las actualizaciones de tareas.

### Eliminación de menciones

El bot eliminará las menciones a los usuarios dentro de las tareas para garantizar que los mensajes sean más limpios y profesionales cuando se envíen al canal privado.

## Estructura del Proyecto

```
discord-task-manager-bot/
├── .env             # Variables de entorno (para el token del bot)
├── index.js         # Archivo principal del bot
├── package.json     # Dependencias y scripts del proyecto
└── README.md        # Documentación del proyecto
```

## Dependencias

- **discord.js**: Librería principal de Discord para interactuar con la API de Discord.
- **dotenv**: Para gestionar las variables de entorno de manera segura.

## Contribuciones

Si deseas contribuir a este proyecto, ¡serás bienvenido! Por favor, abre un "issue" o un "pull request" con tus sugerencias o mejoras.

## Licencia

Este proyecto está bajo la Licencia MIT. Para más detalles, consulta el archivo [LICENSE](LICENSE).

---

¡Gracias por usar el **Bot GRAS**!
```
