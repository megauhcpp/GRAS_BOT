require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const {
  LOCATIONS,
  STARTER_CHANNELS,
  CATEGORY_ROLES,
} = require("./src/config/constants");
const {
  verifyAndFixUserPermissions,
  verifyAndFixAllUsersPermissions,
  createUserChannel,
  updateStarterChannelVisibility,
  assignRandomStarterChannel,
  updateUserSelectMenu,
  restoreUserPermissions,
} = require("./src/services/channelService");
const {
  handleCreateChannelButton,
  handleStartTaskButton,
  handleUploadVideoButton,
  handleAssignTaskButton,
} = require("./src/handlers/buttonHandler");
const { handleTaskModal } = require("./src/handlers/modalHandler");
const { handleUserSelect } = require("./src/handlers/selectHandler");
const {
  setupStarterChannel,
  setupAssignmentChannel,
  updateAssignmentMessage,
} = require("./src/services/setupService");
const { initializeRequiredChannels } = require("./src/services/initializationService");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions,
  ],
});

client.once("ready", async () => {
  console.log(`Bot está listo! Conectado como ${client.user.tag}`);
  
  // Inicializar canales en todos los servidores donde está el bot
  for (const guild of client.guilds.cache.values()) {
    try {
      await initializeRequiredChannels(guild);
      console.log(`Canales inicializados correctamente en el servidor: ${guild.name}`);
      
      // Verificar y corregir permisos de todos los usuarios
      await verifyAndFixAllUsersPermissions(guild);
      console.log(`Permisos de usuarios verificados y corregidos en el servidor: ${guild.name}`);

      console.log("Actualizando visibilidad de canales para todos los miembros...");

      // Obtener todos los miembros del servidor
      const members = await guild.members.fetch();

      // Actualizar la visibilidad de los canales para cada miembro
      for (const [memberId, member] of members) {
        if (!member.user.bot) {
          await updateStarterChannelVisibility(guild, memberId);
        }
      }

      console.log("Visibilidad de canales actualizada correctamente");

      // Configurar los canales iniciales
      for (const channelId of STARTER_CHANNELS) {
        try {
          const channel = await client.channels.fetch(channelId);
          if (channel) {
            await setupStarterChannel(channel);
          }
        } catch (error) {
          console.error(`Error al configurar el canal ${channelId}:`, error);
        }
      }

      // Configurar los canales de asignación de tareas en todas las categorías con starter channels
      try {
        console.log("Buscando canales de asignación de tareas...");

        // Obtener las categorías que tienen starter channels
        const starterChannels = await Promise.all(
          STARTER_CHANNELS.map((id) => client.channels.fetch(id))
        );
        const categoryIds = [...new Set(starterChannels.map((ch) => ch.parent.id))];

        console.log("Categorías con starter channels:", categoryIds);

        // Buscar el canal "asignacion-tareas" y "videos-tareas" en cada categoría
        for (const categoryId of categoryIds) {
          const category = await client.channels.fetch(categoryId);
          console.log(`Buscando en categoría: ${category.name}`);

          // Verificar canal de asignación
          const assignmentChannel = category.children.cache.find(
            (channel) => channel.name === "asignacion-tareas"
          );

          if (assignmentChannel) {
            console.log(
              `Canal de asignación encontrado en categoría ${category.name}, configurando...`
            );
            await setupAssignmentChannel(assignmentChannel);
          } else {
            console.log(
              `No se encontró canal de asignación en categoría ${category.name}`
            );
          }

          // Verificar canal de videos
          const videosChannel = category.children.cache.find(
            (channel) => channel.name === "videos-tareas"
          );

          if (!videosChannel) {
            console.log(`Creando canal de videos en categoría ${category.name}...`);
            try {
              await category.children.create({
                name: "videos-tareas",
                type: ChannelType.GuildText,
                permissionOverwrites: [
                  {
                    id: category.guild.roles.everyone.id,
                    allow: [PermissionsBitField.Flags.ViewChannel],
                    deny: [PermissionsBitField.Flags.SendMessages],
                  },
                ],
              });
              console.log(`Canal de videos creado en categoría ${category.name}`);
            } catch (error) {
              console.error(
                `Error al crear canal de videos en categoría ${category.name}:`,
                error
              );
            }
          } else {
            console.log(`Canal de videos ya existe en categoría ${category.name}`);
          }
        }
      } catch (error) {
        console.error("Error al configurar los canales de asignación:", error);
      }
    } catch (error) {
      console.error(`Error al inicializar servidor ${guild.name}:`, error);
    }
  }
});

// Manejar cambios en roles de miembros
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    // Verificar si hubo cambios en roles de categoría
    const categoryRoleIds = Object.values(CATEGORY_ROLES).map(data => data.roleId);
    const hadCategoryRole = oldMember.roles.cache.some(role => categoryRoleIds.includes(role.id));
    const hasCategoryRole = newMember.roles.cache.some(role => categoryRoleIds.includes(role.id));

    if (hadCategoryRole || hasCategoryRole) {
      // Verificar y corregir permisos en todas las categorías
      for (const [location, data] of Object.entries(CATEGORY_ROLES)) {
        const category = newMember.guild.channels.cache.get(data.categoryId);
        if (category) {
          await verifyAndFixUserPermissions(newMember, category);
        }
      }
    }

    // Verificar si hubo cambios en roles de categoría
    let roleChanged = false;
    const categoryRoleIdsSet = new Set(categoryRoleIds);

    // Verificar roles removidos
    for (const role of oldMember.roles.cache.values()) {
      if (categoryRoleIdsSet.has(role.id) && !newMember.roles.cache.has(role.id)) {
        roleChanged = true;
        break;
      }
    }

    // Verificar roles añadidos
    if (!roleChanged) {
      for (const role of newMember.roles.cache.values()) {
        if (categoryRoleIdsSet.has(role.id) && !oldMember.roles.cache.has(role.id)) {
          roleChanged = true;
          break;
        }
      }
    }

    // Si hubo cambios en roles de categoría
    if (roleChanged) {
      console.log(`Roles de categoría cambiados para ${newMember.user.tag}`);

      // Actualizar select menus en todos los canales de asignación
      for (const [locationName, data] of Object.entries(CATEGORY_ROLES)) {
        const category = newMember.guild.channels.cache.get(data.categoryId);
        if (category) {
          const assignmentChannel = category.children.cache.find(
            channel => channel.name === "asignacion-tareas"
          );
          if (assignmentChannel) {
            await updateUserSelectMenu(assignmentChannel);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error manejando actualización de miembro:', error);
  }
});

// Manejar creación de nuevos canales de usuario
client.on("channelCreate", async (channel) => {
  if (channel.type === ChannelType.GuildText && channel.parent) {
    const categoryData = Object.entries(CATEGORY_ROLES).find(
      ([, data]) => data.categoryId === channel.parent.id
    );
    
    if (categoryData) {
      const userId = channel.name.split("-").pop();
      const member = await channel.guild.members.fetch(userId).catch(() => null);
      
      if (member) {
        await verifyAndFixUserPermissions(member, channel.parent);
      }
    }
  }
});

// Manejar cambios en roles de miembros
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    // Verificar si hubo cambios en roles de categoría
    let roleChanged = false;

    // Comprobar cada categoría
    for (const location of LOCATIONS) {
      const roleId = CATEGORY_ROLES[location.toLowerCase()].roleId;
      const hadRole = oldMember.roles.cache.has(roleId);
      const hasRole = newMember.roles.cache.has(roleId);

      // Si hubo cambio en este rol específico
      if (hadRole !== hasRole) {
        roleChanged = true;
        console.log(`Cambio en rol de ${location}: ${hadRole} -> ${hasRole}`);

        // Actualizar visibilidad de canales
        await updateStarterChannelVisibility(newMember.guild, newMember.id);

        // Actualizar mensaje de asignación
        try {
          const categoryId = CATEGORY_ROLES[location.toLowerCase()].categoryId;
          const category = await newMember.guild.channels.fetch(categoryId);
          if (category) {
            const assignmentChannel = category.children.cache.find(
              (channel) => channel.name === "asignacion-tareas"
            );
            if (assignmentChannel) {
              console.log(
                `Actualizando mensaje de asignación en ${location}...`
              );
              await updateAssignmentMessage(assignmentChannel);
            }
          }
        } catch (error) {
          console.error(
            `Error al actualizar mensaje de asignación para ${location}:`,
            error
          );
        }
      }
    }

    if (roleChanged) {
      console.log(`Roles actualizados para ${newMember.user.username}:
        Roles anteriores: ${Array.from(oldMember.roles.cache.values())
          .map((r) => r.name)
          .join(", ")}
        Roles nuevos: ${Array.from(newMember.roles.cache.values())
          .map((r) => r.name)
          .join(", ")}`);
    }
  } catch (error) {
    console.error("Error al manejar actualización de roles:", error);
  }
});

// Evento cuando un nuevo miembro se une al servidor
client.on("guildMemberAdd", async (member) => {
  if (!member.user.bot) {
    await assignRandomStarterChannel(member.id, member.guild);
  }
});

// Evento para detectar cuando se elimina un canal
client.on("channelDelete", async (channel) => {
  try {
    // Solo nos interesa si el canal está en una categoría
    if (!channel.parent) return;

    // Extraer el ID del usuario del nombre del canal
    const match = channel.name.match(/tareas-.*-(\d+)$/);
    if (!match) return;

    const userId = match[1];
    console.log(`Canal eliminado para usuario ${userId} en categoría ${channel.parent.name}`);

    // Restaurar permisos del usuario
    await restoreUserPermissions(channel.guild, userId, channel.parent.id);
  } catch (error) {
    console.error('Error manejando eliminación de canal:', error);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    // Manejar botones
    if (interaction.isButton()) {
      if (interaction.customId === "create_channel") {
        await handleCreateChannelButton(interaction);
      } else if (interaction.customId.startsWith("start_task_")) {
        await handleStartTaskButton(interaction);
      } else if (interaction.customId.startsWith("upload_video_")) {
        await handleUploadVideoButton(interaction);
      } else if (interaction.customId.startsWith("assign_task_")) {
        await handleAssignTaskButton(interaction);
      }
    }

    // Manejar modales
    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("task_modal_")
    ) {
      await handleTaskModal(interaction);
    }

    // Manejar selección de usuario
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "select_user_task"
    ) {
      await handleUserSelect(interaction);
    }
  } catch (error) {
    console.error("Error al manejar interacción:", error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Hubo un error al procesar tu interacción.",
          ephemeral: true
        });
      }
    } catch (replyError) {
      console.error("Error al enviar mensaje de error:", replyError);
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
