const { ChannelType, PermissionsBitField, PermissionFlagsBits } = require("discord.js");
const {
  LOCATIONS,
  STARTER_CHANNELS,
  CATEGORY_ROLES,
} = require("../config/constants");

// Función para obtener el nombre del canal según la categoría
function getChannelName(username, userId, categoryName) {
  return `tareas-${username.replace(
    /\./g,
    ""
  )}-${categoryName.toLowerCase()}-${userId}`;
}

// Función para verificar si un usuario tiene un canal en una categoría
function hasChannelInCategory(guild, username, userId, categoryName) {
  return guild.channels.cache.some(
    (channel) =>
      channel.name === getChannelName(username, userId, categoryName) &&
      channel.parent?.name === categoryName
  );
}

// Función para asignar un starter channel a un usuario según su rol
async function assignRandomStarterChannel(userId, guild) {
  try {
    const member = await guild.members.fetch(userId);
    const userCategories = [];

    // Buscar todos los roles que tiene el usuario
    for (let i = 0; i < LOCATIONS.length; i++) {
      if (
        member.roles.cache.has(
          CATEGORY_ROLES[LOCATIONS[i].toLowerCase()].roleId
        )
      ) {
        userCategories.push(i);
      }
    }

    // Si no tiene ningún rol de categoría, registrarlo
    if (userCategories.length === 0) {
      console.log(`Usuario ${userId} no tiene rol de categoría asignado`);
      return;
    }

    // Configurar la visibilidad de los starter channels según los roles
    for (let i = 0; i < STARTER_CHANNELS.length; i++) {
      try {
        const channel = await guild.client.channels.fetch(STARTER_CHANNELS[i]);
        if (channel) {
          const hasChannel = hasChannelInCategory(
            guild,
            member.user.username,
            userId,
            LOCATIONS[i]
          );

          // Solo ocultar el starter channel si el usuario tiene un canal en esa categoría
          await channel.permissionOverwrites.edit(userId, {
            ViewChannel: !hasChannel && userCategories.includes(i),
          });
        }
      } catch (error) {
        console.error(
          `Error al configurar el canal ${STARTER_CHANNELS[i]}:`,
          error
        );
      }
    }

    // Mostrar mensaje de asignación con todas las categorías
    const categoryNames = userCategories.map((index) => LOCATIONS[index]);
    console.log(
      `Usuario ${userId} asignado a los starter channels de: ${categoryNames.join(
        ", "
      )}`
    );
  } catch (error) {
    console.error(
      `Error al asignar starter channels para usuario ${userId}:`,
      error
    );
  }
}

// Función para actualizar la visibilidad de los starter channels
async function updateStarterChannelVisibility(guild, userId) {
  try {
    const member = await guild.members.fetch(userId);
    if (!member) {
      console.log(`No se encontró el miembro ${userId}`);
      return;
    }

    // Obtener los roles del usuario
    const userRoles = member.roles.cache;

    // Iterar sobre las categorías y sus roles
    for (const [location, { roleId }] of Object.entries(CATEGORY_ROLES)) {
      const hasRole = userRoles.has(roleId);
      
      // Buscar el canal starter correspondiente
      const starterChannel = guild.channels.cache.find(
        channel => channel.name.toLowerCase() === location.toLowerCase()
      );

      if (starterChannel) {
        try {
          // Actualizar los permisos del canal
          await starterChannel.permissionOverwrites.edit(userId, {
            ViewChannel: !hasRole, // Ocultar si tiene el rol, mostrar si no lo tiene
          });
        } catch (error) {
          console.error(`Error al configurar el canal ${starterChannel.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Error al actualizar visibilidad de canales:", error);
  }
}

module.exports = {
  getChannelName,
  hasChannelInCategory,
  assignRandomStarterChannel,
  updateStarterChannelVisibility,
};
