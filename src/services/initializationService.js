const { ChannelType, PermissionFlagsBits } = require("discord.js");
const { REQUIRED_CHANNELS, CATEGORY_ROLES } = require("../config/constants");
const { 
  setupAssignmentChannel, 
  setupRegistryChannel, 
  setupVideosChannel 
} = require("./setupService");

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

      // Configuración base de permisos para el starter channel
      const starterPermissions = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: guild.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
          ],
        },
      ];

      // Configuración de permisos para los otros canales (inicialmente ocultos para todos excepto el bot)
      const restrictedPermissions = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: roleId,
          deny: [PermissionFlagsBits.ViewChannel], // Denegar vista al rol de la categoría
        },
        {
          id: guild.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
          ],
        },
      ];

      // Verificar y crear canal starter
      let starterChannel = category.children.cache.find(
        channel => channel.name === REQUIRED_CHANNELS.STARTER
      );

      if (!starterChannel) {
        console.log(`Creando canal starter en ${location}...`);
        starterChannel = await guild.channels.create({
          name: REQUIRED_CHANNELS.STARTER,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: starterPermissions,
        });
        await setupStarterChannel(starterChannel);
      } else {
        await starterChannel.permissionOverwrites.set(starterPermissions);
      }

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
          permissionOverwrites: restrictedPermissions,
        });
        await setupAssignmentChannel(assignmentChannel);
      } else {
        await assignmentChannel.permissionOverwrites.set(restrictedPermissions);
        await setupAssignmentChannel(assignmentChannel);
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
          permissionOverwrites: restrictedPermissions,
        });
        await setupRegistryChannel(registryChannel);
      } else {
        await registryChannel.permissionOverwrites.set(restrictedPermissions);
        await setupRegistryChannel(registryChannel);
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
          permissionOverwrites: restrictedPermissions,
        });
        await setupVideosChannel(videosChannel);
      } else {
        await videosChannel.permissionOverwrites.set(restrictedPermissions);
        await setupVideosChannel(videosChannel);
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
