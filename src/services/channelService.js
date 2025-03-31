const { ChannelType, PermissionsBitField } = require("discord.js");
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

    // Para cada starter channel
    for (let i = 0; i < STARTER_CHANNELS.length; i++) {
      try {
        const channel = await guild.client.channels.fetch(STARTER_CHANNELS[i]);
        if (channel) {
          const categoryName = LOCATIONS[i];
          const roleId = CATEGORY_ROLES[categoryName.toLowerCase()].roleId;

          // Verificar si el usuario tiene el rol de esta categoría
          const hasRole = member.roles.cache.has(roleId);

          if (!hasRole) {
            // Si no tiene el rol, no debería ver ningún canal
            await channel.permissionOverwrites.edit(userId, {
              ViewChannel: false,
            });
            continue;
          }

          // Verificar si tiene un canal específico en esta categoría
          const hasSpecificChannel = hasChannelInCategory(
            guild,
            member.user.username,
            userId,
            categoryName
          );

          // Si tiene el rol:
          // - Si NO tiene canal específico -> mostrar el canal de tareas
          // - Si tiene canal específico -> ocultar el canal de tareas
          await channel.permissionOverwrites.edit(userId, {
            ViewChannel: !hasSpecificChannel,
          });

          console.log(`Visibilidad actualizada para ${
            member.user.username
          } en ${categoryName}:
            - Tiene rol: ${hasRole}
            - Tiene canal específico: ${hasSpecificChannel}
            - Puede ver canal de tareas: ${!hasSpecificChannel}`);
        }
      } catch (error) {
        console.error(
          `Error al configurar el canal ${STARTER_CHANNELS[i]}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error(
      `Error al actualizar visibilidad de canales para usuario ${userId}:`,
      error
    );
  }
}

module.exports = {
  getChannelName,
  hasChannelInCategory,
  assignRandomStarterChannel,
  updateStarterChannelVisibility,
};
