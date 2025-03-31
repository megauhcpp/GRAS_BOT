const { ChannelType, PermissionFlagsBits } = require("discord.js");
const { REQUIRED_CHANNELS, CATEGORY_ROLES } = require("../config/constants");
const { setupAssignmentChannel } = require("./setupService");

async function initializeRequiredChannels(guild) {
  console.log(`Iniciando verificación de canales requeridos en el servidor ${guild.name}`);

  try {
    // Obtener todas las categorías del servidor
    const categories = Object.entries(CATEGORY_ROLES).map(([location, data]) => ({
      location,
      category: guild.channels.cache.get(data.categoryId),
      roleId: data.roleId
    }));

    for (const { location, category, roleId } of categories) {
      if (!category) {
        console.log(`No se encontró la categoría ${location}`);
        continue;
      }

      console.log(`Verificando canales en categoría ${location}`);

      // Configuración base de permisos para todos los canales
      const basePermissions = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel], // Denegar vista a todos por defecto
        },
        {
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
          ],
        },
        {
          id: guild.client.user.id, // Dar permisos al bot
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
          ],
        },
      ];

      // Verificar y crear canal de asignación de tareas
      let assignmentChannel = category.children.cache.find(
        channel => channel.name === REQUIRED_CHANNELS.TASK_ASSIGNMENT
      );

      if (!assignmentChannel) {
        console.log(`Creando canal de asignación de tareas en ${location}...`);
        assignmentChannel = await guild.channels.create({
          name: REQUIRED_CHANNELS.TASK_ASSIGNMENT,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: basePermissions,
        });
        await setupAssignmentChannel(assignmentChannel);
      } else {
        // Actualizar permisos de canal existente
        await assignmentChannel.permissionOverwrites.set(basePermissions);
      }

      // Verificar y crear canal de registro de tareas
      let registryChannel = category.children.cache.find(
        channel => channel.name === REQUIRED_CHANNELS.TASK_REGISTRY
      );

      if (!registryChannel) {
        console.log(`Creando canal de registro de tareas en ${location}...`);
        registryChannel = await guild.channels.create({
          name: REQUIRED_CHANNELS.TASK_REGISTRY,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: basePermissions,
        });
      } else {
        await registryChannel.permissionOverwrites.set(basePermissions);
      }

      // Verificar y crear canal de videos de tareas
      let videosChannel = category.children.cache.find(
        channel => channel.name === REQUIRED_CHANNELS.TASK_VIDEOS
      );

      if (!videosChannel) {
        console.log(`Creando canal de videos de tareas en ${location}...`);
        videosChannel = await guild.channels.create({
          name: REQUIRED_CHANNELS.TASK_VIDEOS,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: basePermissions,
        });
      } else {
        await videosChannel.permissionOverwrites.set(basePermissions);
      }
    }

    console.log("Verificación de canales completada con éxito");
  } catch (error) {
    console.error("Error durante la inicialización de canales:", error);
    throw error;
  }
}

module.exports = {
  initializeRequiredChannels,
};
