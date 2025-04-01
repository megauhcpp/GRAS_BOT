const { ChannelType, PermissionFlagsBits } = require("discord.js");
const { LOCATIONS, CATEGORY_ROLES, REQUIRED_CHANNELS } = require("../config/constants");
const { 
  setupAssignmentChannel, 
  setupRegistryChannel, 
  setupVideosChannel 
} = require("./setupService");

async function initializeRequiredChannels(guild) {
  try {
    for (const location of LOCATIONS) {
      const { categoryId, roleId, adminRoleId } = CATEGORY_ROLES[location.toLowerCase()];
      const category = guild.channels.cache.get(categoryId);

      if (!category) {
        console.error(`No se encontró la categoría ${location}`);
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
          id: adminRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageMessages,
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

      // Configuración de permisos para los otros canales (inicialmente ocultos para todos excepto el bot y admins)
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
          id: adminRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageMessages,
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

      // Verificar y crear canales requeridos
      for (const channelName of Object.values(REQUIRED_CHANNELS)) {
        const existingChannel = category.children.cache.find(
          (ch) => ch.name === channelName
        );

        if (!existingChannel) {
          console.log(`Creando canal ${channelName} en ${location}`);
          const newChannel = await category.children.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites:
              channelName === REQUIRED_CHANNELS.STARTER
                ? starterPermissions
                : restrictedPermissions,
          });

          if (channelName === REQUIRED_CHANNELS.TASK_ASSIGNMENT) {
            await setupAssignmentChannel(newChannel);
          } else if (channelName === REQUIRED_CHANNELS.TASK_REGISTRY) {
            await setupRegistryChannel(newChannel);
          } else if (channelName === REQUIRED_CHANNELS.TASK_VIDEOS) {
            await setupVideosChannel(newChannel);
          }
        } else {
          console.log(`Actualizando permisos de ${channelName} en ${location}`);
          await existingChannel.permissionOverwrites.set(
            channelName === REQUIRED_CHANNELS.STARTER
              ? starterPermissions
              : restrictedPermissions
          );

          if (channelName === REQUIRED_CHANNELS.TASK_ASSIGNMENT) {
            await setupAssignmentChannel(existingChannel);
          } else if (channelName === REQUIRED_CHANNELS.TASK_REGISTRY) {
            await setupRegistryChannel(existingChannel);
          } else if (channelName === REQUIRED_CHANNELS.TASK_VIDEOS) {
            await setupVideosChannel(existingChannel);
          }
        }
      }

      // Verificar y actualizar permisos de canales de usuario existentes
      const userChannels = category.children.cache.filter(
        (ch) =>
          !Object.values(REQUIRED_CHANNELS).includes(ch.name) &&
          ch.type === ChannelType.GuildText
      );

      for (const [, channel] of userChannels) {
        console.log(`Actualizando permisos de canal de usuario ${channel.name} en ${location}`);
        const member = guild.members.cache.find(m => channel.name.includes(m.user.username.toLowerCase()));
        
        if (member) {
          const userPermissions = [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AttachFiles,
              ],
            },
            {
              id: adminRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageMessages,
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

          await channel.permissionOverwrites.set(userPermissions);
        }
      }
    }
  } catch (error) {
    console.error("Error al inicializar canales:", error);
  }
}

module.exports = {
  initializeRequiredChannels,
};
