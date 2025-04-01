const {
  ChannelType,
  PermissionsBitField,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
} = require("discord.js");
const {
  LOCATIONS,
  STARTER_CHANNELS,
  CATEGORY_ROLES,
  REQUIRED_CHANNELS,
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
        (channel) => channel.name.toLowerCase() === location.toLowerCase()
      );

      if (starterChannel) {
        try {
          // Actualizar los permisos del canal
          await starterChannel.permissionOverwrites.edit(userId, {
            ViewChannel: !hasRole, // Ocultar si tiene el rol, mostrar si no lo tiene
          });
        } catch (error) {
          console.error(
            `Error al configurar el canal ${starterChannel.name}:`,
            error
          );
        }
      }
    }
  } catch (error) {
    console.error("Error al actualizar visibilidad de canales:", error);
  }
}

// Función para actualizar los permisos cuando se crea un canal específico
async function updateUserChannelPermissions(guild, userId, categoryId) {
  try {
    const member = await guild.members.fetch(userId);
    const category = guild.channels.cache.get(categoryId);

    if (!category) {
      console.error(`No se encontró la categoría ${categoryId}`);
      return;
    }

    // 1. Ocultar el canal starter
    const starterChannel = category.children.cache.find(
      (channel) => channel.name === REQUIRED_CHANNELS.STARTER
    );

    if (starterChannel) {
      await starterChannel.permissionOverwrites.edit(member, {
        ViewChannel: false,
      });
    }

    // 2. Ocultar los canales de tareas por defecto
    const channelsToHide = [
      REQUIRED_CHANNELS.TASK_ASSIGNMENT,
      REQUIRED_CHANNELS.TASK_REGISTRY,
      REQUIRED_CHANNELS.TASK_VIDEOS,
    ];

    for (const channelName of channelsToHide) {
      const channel = category.children.cache.find(
        (ch) => ch.name === channelName
      );

      if (channel) {
        await channel.permissionOverwrites.edit(member, {
          ViewChannel: false,
        });
      }
    }
  } catch (error) {
    console.error("Error actualizando permisos de usuario:", error);
  }
}

// Función para restaurar permisos cuando se elimina un canal específico
async function restoreUserPermissions(guild, userId, categoryId) {
  try {
    const member = await guild.members.fetch(userId);
    const category = guild.channels.cache.get(categoryId);

    if (!category) {
      console.error(`No se encontró la categoría ${categoryId}`);
      return;
    }

    // 1. Mostrar el canal starter
    const starterChannel = category.children.cache.find(
      (channel) => channel.name === REQUIRED_CHANNELS.STARTER
    );

    if (starterChannel) {
      await starterChannel.permissionOverwrites.edit(member, {
        ViewChannel: true,
        ReadMessageHistory: true,
      });
    }

    // 2. Ocultar los canales de tareas
    const channelsToHide = [
      REQUIRED_CHANNELS.TASK_ASSIGNMENT,
      REQUIRED_CHANNELS.TASK_REGISTRY,
      REQUIRED_CHANNELS.TASK_VIDEOS,
    ];

    for (const channelName of channelsToHide) {
      const channel = category.children.cache.find(
        (ch) => ch.name === channelName
      );

      if (channel) {
        await channel.permissionOverwrites.edit(member, {
          ViewChannel: false,
        });
      }
    }
  } catch (error) {
    console.error("Error restaurando permisos de usuario:", error);
  }
}

// Función para actualizar el select menu de usuarios en un canal
async function updateUserSelectMenu(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    const selectMessage = messages.find(
      (msg) =>
        msg.author.id === channel.client.user.id &&
        msg.components.length > 0 &&
        msg.components[0].components[0]?.data?.custom_id === "select_user_task"
    );

    if (!selectMessage) {
      console.log("No se encontró mensaje con select menu para actualizar");
      return;
    }

    // Obtener el rol de la categoría
    const categoryId = channel.parent.id;
    const categoryRole = Object.entries(CATEGORY_ROLES).find(
      ([_, data]) => data.categoryId === categoryId
    );

    if (!categoryRole) {
      console.error("No se encontró el rol para la categoría", categoryId);
      return;
    }

    const roleId = categoryRole[1].roleId;

    // Obtener miembros actualizados con el rol
    const members = await channel.guild.members.fetch();
    const filteredMembers = members.filter(
      (member) => !member.user.bot && member.roles.cache.has(roleId)
    );

    // Crear el select menu actualizado
    const row1 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_user_task")
        .setPlaceholder("Selecciona un usuario")
        .setMaxValues(1)
        .addOptions(
          filteredMembers.size > 0
            ? Array.from(filteredMembers.values()).map((member) =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(member.user.username)
                  .setDescription(`ID: ${member.user.id}`)
                  .setValue(member.user.id)
              )
            : [
                new StringSelectMenuOptionBuilder()
                  .setLabel("No hay usuarios disponibles")
                  .setDescription(
                    "No hay usuarios con el rol necesario en esta categoría"
                  )
                  .setValue("no_users")
                  .setDefault(true),
              ]
        )
    );

    const row2 = new ActionRowBuilder().addComponents(
      ButtonBuilder.from(selectMessage.components[1].components[0]).setDisabled(
        filteredMembers.size === 0
      )
    );

    await selectMessage.edit({ components: [row1, row2] });
  } catch (error) {
    console.error("Error actualizando select menu:", error);
  }
}

module.exports = {
  getChannelName,
  hasChannelInCategory,
  assignRandomStarterChannel,
  updateStarterChannelVisibility,
  updateUserChannelPermissions,
  restoreUserPermissions,
  updateUserSelectMenu,
};
