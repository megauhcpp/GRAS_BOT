require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
} = require("discord.js");
const fetch = require("node-fetch");

// Constantes de configuración
const LOCATIONS = ["Calpe", "Granada", "Malaga"];
const VIDEO_CHANNEL_ID = "1354734580589924416";
const STARTER_CHANNELS = [
  "1354754019737862307", // Calpe
  "1354757348199239704", // Granada
  "1354757370676248596", // Malaga
];

const CATEGORY_ROLES = [
  "1354813657544134839", // Calpe
  "1354813856861655230", // Granada
  "1354813912335388865", // Malaga
];

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

// Función para configurar un canal inicial
async function setupStarterChannel(channel) {
  try {
    // Obtener los últimos 100 mensajes del canal
    const messages = await channel.messages.fetch({ limit: 100 });

    // Buscar si ya existe un mensaje con el botón
    const existingMessage = messages.find(
      (msg) =>
        msg.author.id === client.user.id &&
        msg.components.length > 0 &&
        msg.components[0].components[0]?.data?.custom_id === "create_channel"
    );

    if (existingMessage) {
      // Si ya existe el mensaje, no hacer nada
      // Eliminar otros mensajes del bot si existen
      const otherBotMessages = messages.filter(
        (msg) =>
          msg.author.id === client.user.id && msg.id !== existingMessage.id
      );
      if (otherBotMessages.size > 0) {
        await channel.bulkDelete(otherBotMessages);
      }
      return;
    }

    // Si no existe el mensaje, eliminar todos los mensajes antiguos y crear uno nuevo
    if (messages.size > 0) {
      await channel.bulkDelete(messages);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_channel")
        .setLabel("Crear Canal")
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({
      content: "Haz clic para crear un canal de asignación de tareas",
      components: [row],
    });
  } catch (error) {
    console.error(`Error al configurar el canal ${channel.name}:`, error);
  }
}

// Función para asignar un starter channel a un usuario según su rol
async function assignRandomStarterChannel(userId, guild) {
  try {
    const member = await guild.members.fetch(userId);
    const userCategories = [];

    // Buscar todos los roles que tiene el usuario
    for (let i = 0; i < CATEGORY_ROLES.length; i++) {
      if (member.roles.cache.has(CATEGORY_ROLES[i])) {
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
        const channel = await client.channels.fetch(STARTER_CHANNELS[i]);
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
    const categoryNames = userCategories.map(
      (index) => LOCATIONS[index]
    );
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

    for (let i = 0; i < STARTER_CHANNELS.length; i++) {
      try {
        const channel = await client.channels.fetch(STARTER_CHANNELS[i]);
        if (channel) {
          const categoryName = LOCATIONS[i];
          const hasChannel = hasChannelInCategory(
            guild,
            member.user.username,
            userId,
            categoryName
          );
          const hasRole = member.roles.cache.has(CATEGORY_ROLES[i]);

          // Solo ocultar el starter channel si el usuario tiene un canal en esa categoría
          await channel.permissionOverwrites.edit(userId, {
            ViewChannel: !hasChannel && hasRole,
          });
        }
      } catch (error) {
        console.error(`Error al actualizar el canal ${channelId}:`, error);
      }
    }
  } catch (error) {
    console.error(
      `Error al actualizar visibilidad de starter channels para usuario ${userId}:`,
      error
    );
  }
}

// Función para configurar el canal de asignación de tareas
async function setupAssignmentChannel(channel) {
  try {
    // Obtener los últimos 100 mensajes del canal
    const messages = await channel.messages.fetch({ limit: 100 });

    // Buscar si ya existe un mensaje con el menú
    const existingMessage = messages.find(
      (msg) =>
        msg.author.id === client.user.id &&
        msg.components.length > 0 &&
        msg.components[0].components[0]?.data?.custom_id === "select_user_task"
    );

    if (existingMessage) {
      // Si existe, actualizar el menú con la lista actual de usuarios
      const members = await channel.guild.members.fetch();
      const userSelect = new StringSelectMenuBuilder()
        .setCustomId("select_user_task")
        .setPlaceholder("Selecciona un usuario")
        .setMaxValues(1)
        .addOptions(
          members
            .filter((member) => !member.user.bot)
            .map((member) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(member.user.username)
                .setDescription(`ID: ${member.user.id}`)
                .setValue(member.user.id)
            )
        );

      const row1 = new ActionRowBuilder().addComponents(userSelect);
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("assign_task")
          .setLabel("Asignar Tareas")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
      );

      await existingMessage.edit({
        content: "Selecciona un usuario para asignarle tareas:",
        components: [row1, row2],
      });

      // Eliminar otros mensajes del bot
      const otherBotMessages = messages.filter(
        (msg) =>
          msg.author.id === client.user.id && msg.id !== existingMessage.id
      );
      if (otherBotMessages.size > 0) {
        await channel.bulkDelete(otherBotMessages);
      }
      return;
    }

    // Si no existe, crear nuevo mensaje
    if (messages.size > 0) {
      await channel.bulkDelete(messages);
    }

    const members = await channel.guild.members.fetch();
    const userSelect = new StringSelectMenuBuilder()
      .setCustomId("select_user_task")
      .setPlaceholder("Selecciona un usuario")
      .setMaxValues(1)
      .addOptions(
        members
          .filter((member) => !member.user.bot)
          .map((member) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(member.user.username)
              .setDescription(`ID: ${member.user.id}`)
              .setValue(member.user.id)
          )
      );

    const row1 = new ActionRowBuilder().addComponents(userSelect);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("assign_task")
        .setLabel("Asignar Tareas")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    await channel.send({
      content: "Selecciona un usuario para asignarle tareas:",
      components: [row1, row2],
    });
  } catch (error) {
    console.error(
      `Error al configurar el canal de asignación ${channel.name}:`,
      error
    );
  }
}

// Función para enviar mensajes de tarea a un canal
async function sendTaskMessages(user, tasks, channel) {
  try {
    console.log(`Enviando tareas a ${user.username}`);

    for (const task of tasks) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`upload_video_${task}_${channel.id}`)
          .setLabel("📤 Subir video")
          .setStyle(ButtonStyle.Primary)
      );

      const cleanTask = task.replace(/<[^>]+>/g, "").trim();

      const taskEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Tarea asignada")
        .setDescription(`**Tarea:**\n\`\`\`${cleanTask}\`\`\``)
        .setFooter({ text: "Sube tu video para completar la tarea." });

      await channel.send({
        embeds: [taskEmbed],
        components: [row],
      });
      console.log(`Mensaje de tarea enviado a ${user.username}: ${cleanTask}`);
    }
  } catch (error) {
    console.error(`No se pudo enviar mensaje a ${user.tag}:`, error);
    throw error; // Re-lanzar el error para que se maneje en el nivel superior
  }
}

client.once("ready", async () => {
  console.log(`Bot conectado como ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if (!guild) return;

  // Array para almacenar usuarios sin rol
  const usersWithoutRole = [];
  // Objeto para almacenar usuarios y sus roles
  const userRoles = new Map();

  // Configurar los canales iniciales y sus permisos
  for (const channelId of STARTER_CHANNELS) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) {
        // Configurar el mensaje del canal
        await setupStarterChannel(channel);

        // Buscar o crear el canal de asignación en la misma categoría
        const assignmentChannel =
          channel.parent.children.cache.find(
            (ch) => ch.name === "asignacion-tareas"
          ) ||
          (await channel.guild.channels.create({
            name: "asignacion-tareas",
            type: ChannelType.GuildText,
            parent: channel.parent,
          }));

        // Configurar el canal de asignación
        await setupAssignmentChannel(assignmentChannel);
      }
    } catch (error) {
      console.error(`Error al obtener el canal ${channelId}:`, error);
    }
  }

  // Configurar los permisos para cada miembro
  const members = await guild.members.fetch();
  for (const [memberId, member] of members) {
    if (!member.user.bot) {
      // Verificar si el usuario ya tiene un canal
      const hasChannel = guild.channels.cache.some(
        (channel) =>
          channel.name ===
          getChannelName(
            member.user.username,
            memberId,
            LOCATIONS[0]
          )
      );

      if (!hasChannel) {
        await assignRandomStarterChannel(memberId, guild);

        // Verificar los roles del usuario
        const userCategories = [];
        for (let i = 0; i < CATEGORY_ROLES.length; i++) {
          if (member.roles.cache.has(CATEGORY_ROLES[i])) {
            userCategories.push(LOCATIONS[i]);
          }
        }

        if (userCategories.length === 0) {
          usersWithoutRole.push({
            id: memberId,
            tag: member.user.tag,
          });
        } else {
          userRoles.set(member.user.tag, userCategories);
        }
      } else {
        // Si ya tiene canal, ocultar todos los starter channels
        await updateStarterChannelVisibility(guild, memberId);
      }
    }
  }

  // Mostrar resumen de usuarios
  console.log("\nResumen de asignación de roles:");
  console.log("----------------------------------------");

  if (userRoles.size > 0) {
    console.log("Usuarios con roles:");
    for (const [userTag, categories] of userRoles) {
      console.log(`${userTag}: ${categories.join(", ")}`);
    }
    console.log("----------------------------------------");
  }

  if (usersWithoutRole.length > 0) {
    console.log("Usuarios sin rol:");
    for (const user of usersWithoutRole) {
      console.log(`${user.tag} (${user.id})`);
    }
    console.log("----------------------------------------");
  }

  console.log(
    `Total: ${userRoles.size} usuarios con rol, ${usersWithoutRole.length} usuarios sin rol\n`
  );
});

// Evento cuando un nuevo miembro se une al servidor
client.on("guildMemberAdd", async (member) => {
  if (!member.user.bot) {
    await assignRandomStarterChannel(member.id, member.guild);
  }
});

// Evento cuando se elimina un canal
client.on("channelDelete", async (channel) => {
  if (channel.name.startsWith("tareas-")) {
    try {
      // Extraer el ID del usuario del nombre del canal
      const userId = channel.name.split("-").pop();
      if (!userId) return;

      const guild = channel.guild;
      const member = await guild.members.fetch(userId).catch(() => null);

      if (member && !member.user.bot) {
        // Asignar un nuevo starter channel aleatorio al usuario
        await assignRandomStarterChannel(userId, guild);
        console.log(
          `Canal de tareas eliminado para ${member.user.tag}, reasignando starter channel`
        );
      }
    } catch (error) {
      console.error("Error al procesar eliminación de canal:", error);
    }
  }
});

// Manejar las interacciones con el botón
client.on("interactionCreate", async (interaction) => {
  // Manejar el botón de crear canal
  if (interaction.isButton() && interaction.customId === "create_channel") {
    const user = interaction.user;
    const categoryName = interaction.channel.parent.name;
    const channelName = getChannelName(user.username, user.id, categoryName);

    // Obtener la categoría del canal actual
    const currentChannel = interaction.channel;
    const category = currentChannel.parent;

    if (!category) {
      await interaction.reply({
        content: "Error: No se pudo encontrar la categoría del canal.",
        flags: [1 << 6],
      });
      return;
    }

    // Verificar si el usuario ya tiene un canal en esta categoría
    if (
      hasChannelInCategory(
        interaction.guild,
        user.username,
        user.id,
        categoryName
      )
    ) {
      await interaction.reply({
        content: `Ya tienes un canal de tareas en la categoría ${categoryName}.`,
        flags: [1 << 6],
      });
      return;
    }

    try {
      // Crear el nuevo canal en la misma categoría
      const newChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: user.id,
            allow: [PermissionsBitField.Flags.ViewChannel],
          },
        ],
      });

      // Actualizar la visibilidad del starter channel solo para esta categoría
      const starterChannelIndex = LOCATIONS.indexOf(
        categoryName
      );
      if (starterChannelIndex !== -1) {
        const starterChannel = await client.channels.fetch(
          STARTER_CHANNELS[starterChannelIndex]
        );
        if (starterChannel) {
          await starterChannel.permissionOverwrites.edit(user.id, {
            ViewChannel: false,
          });
        }
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setURL(newChannel.url)
          .setLabel("Ir al canal")
          .setStyle(ButtonStyle.Link)
      );

      await interaction.reply({
        content: `Canal creado: ${newChannel}`,
        components: [row],
        flags: [1 << 6],
      });
    } catch (error) {
      console.error("Error al crear el canal:", error);
      await interaction.reply({
        content: "Hubo un error al crear el canal.",
        flags: [1 << 6],
      });
    }
    return;
  }

  // Manejar el comando /crear
  if (interaction.isCommand() && interaction.commandName === "crear") {
    const user = interaction.options.getUser("usuario");
    const channelName = `${user.username.replace(/\./g, "")}-${user.id}`;

    const existingChannel = interaction.guild.channels.cache.find(
      (channel) => channel.name === channelName
    );
    if (existingChannel) {
      await interaction.reply({
        content: `Ya existe un canal para ${user.username}.`,
        flags: [1 << 6],
      });
      return;
    }

    try {
      const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
            ],
          },
        ],
      });

      await interaction.reply({
        content: `Canal creado: ${channel}`,
        flags: [1 << 6],
      });
    } catch (error) {
      console.error("Error al crear el canal:", error);
      await interaction.reply({
        content: "No se pudo crear el canal.",
        flags: [1 << 6],
      });
    }
    return;
  }

  // Manejar botones de tareas (completar/pendiente)
  if (
    interaction.isButton() &&
    interaction.customId.startsWith("task_complete_")
  ) {
    const [, , task, originalChannelId] = interaction.customId.split("_");
    await interaction.reply({
      content: "¿Estás seguro de marcar esta tarea como completada?",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_${interaction.customId}`)
            .setLabel("✔ Confirmar")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`cancel_${interaction.customId}`)
            .setLabel("❌ Cancelar")
            .setStyle(ButtonStyle.Danger)
        ),
      ],
      flags: [1 << 6],
    });
    return;
  }

  // Manejar confirmación de tareas
  if (interaction.isButton() && interaction.customId.startsWith("confirm_")) {
    const originalCustomId = interaction.customId.replace("confirm_", "");
    const [action, status, task, channelId] = originalCustomId.split("_");

    const cleanTask = task.replace(/<[^>]+>/g, "").trim();
    const color = status === "complete" ? 0x28a745 : 0xff0000;
    const statusText = status === "complete" ? "Completada" : "Pendiente";

    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });

    // Si hay un video pendiente y la tarea se marca como completada
    if (
      status === "complete" &&
      client.videoQueue?.has(`${interaction.user.id}_${task}`)
    ) {
      // Primero actualizamos la interacción para que el usuario sepa que estamos procesando
      await interaction.update({
        content: "Enviando video al canal de confirmación...",
        components: [],
        flags: [1 << 6],
      });

      const videoInfo = client.videoQueue.get(`${interaction.user.id}_${task}`);
      const videoChannel = await client.channels.fetch(VIDEO_CHANNEL_ID);

      if (videoChannel) {
        const videoEmbed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle("Video de tarea completada")
          .setDescription(
            `**Usuario:** ${interaction.user}\n**Tarea:** ${cleanTask}\n**Fecha:** ${formattedDate}\n**Link a la tarea:** ${videoInfo.messageLink}`
          )
          .setFooter({ text: "Video subido y tarea completada" });

        try {
          // Crear un nuevo AttachmentBuilder directamente desde la URL
          const attachment = new AttachmentBuilder(videoInfo.attachment.url, {
            name: videoInfo.attachment.name,
            description: `Video de tarea de ${interaction.user.username}`,
            contentType: videoInfo.attachment.contentType,
          });

          await videoChannel.send({
            files: [attachment],
            embeds: [videoEmbed],
          });

          // Enviar un nuevo mensaje ephemeral para confirmar
          await interaction.followUp({
            content: `Tarea ${statusText.toLowerCase()}: ${cleanTask}\nVideo enviado correctamente al canal de confirmación.`,
            flags: [1 << 6],
          });
        } catch (error) {
          console.error("Error al enviar el video:", error);
          await interaction.followUp({
            content:
              "Hubo un error al enviar el video al canal de confirmación.",
            flags: [1 << 6],
          });
        }
      }

      // Eliminar el video de la cola
      client.videoQueue.delete(`${interaction.user.id}_${task}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle("Actualización de tarea")
      .setDescription(
        `**${interaction.user.username}** ha actualizado el estado de la tarea: "${cleanTask}"`
      )
      .addFields(
        {
          name: "Estado",
          value: `${statusText === "Completada" ? "✅" : "❌"} ${statusText}`,
        },
        { name: "Fecha y hora", value: `🕓 ${formattedDate}` }
      )
      .setFooter({ text: "¡Gracias por actualizar las tareas!" });

    try {
      // Obtener el canal de DM del usuario
      const dmChannel = await interaction.user.createDM();
      const messages = await dmChannel.messages.fetch();
      const taskMessage = messages.find(
        (msg) =>
          msg.embeds.length > 0 &&
          msg.embeds[0].data.description &&
          msg.embeds[0].data.description.includes(cleanTask)
      );

      if (taskMessage) {
        // Actualizar el mensaje original sin botones
        const originalEmbed = taskMessage.embeds[0];
        await taskMessage.edit({ embeds: [originalEmbed], components: [] });
      }
    } catch (error) {
      console.error("Error al actualizar el mensaje original:", error);
    }

    const guildId = process.env.GUILD_ID;
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      const channel = guild.channels.cache.find(
        (channel) =>
          channel.name ===
          `${interaction.user.username.replace(/\./g, "")}-${
            interaction.user.id
          }`
      );
      if (channel) {
        await channel.send({ embeds: [embed] });
      } else {
        console.log(
          `Canal no encontrado para el usuario ${interaction.user.username}`
        );
      }
    } else {
      console.log(`Servidor no encontrado con ID ${guildId}`);
    }

    // Actualizar el mensaje de confirmación
    await interaction.update({
      content: `Tarea ${statusText.toLowerCase()}: ${cleanTask}`,
      components: [],
      flags: [1 << 6],
    });
    return;
  }

  // Manejar cancelación de tareas
  if (interaction.isButton() && interaction.customId.startsWith("cancel_")) {
    await interaction.update({
      content: "Operación cancelada",
      components: [],
      flags: [1 << 6],
    });
    return;
  }

  // Manejar el botón de subir video
  if (
    interaction.isButton() &&
    interaction.customId.startsWith("upload_video_")
  ) {
    const [, task, channelId] = interaction.customId.split("_");
    await interaction.reply({
      content: "Por favor, sube tu video. Solo se aceptan archivos de video.",
      flags: [1 << 6],
    });

    try {
      const filter = (m) =>
        m.author.id === interaction.user.id && m.attachments.size > 0;
      const collected = await interaction.channel.awaitMessages({
        filter,
        max: 1,
        time: 300000, // 5 minutos para subir el video
        errors: ["time"],
      });

      const message = collected.first();
      const attachment = message.attachments.first();

      if (!attachment.contentType?.startsWith("video/")) {
        await interaction.followUp({
          content: "Por favor, sube un archivo de video válido.",
          flags: [1 << 6],
        });
        return;
      }

      // Actualizar el mensaje original con el botón de completar
      const originalMessage = await interaction.message;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`task_complete_${task}_${originalMessage.channel.id}`)
          .setLabel("✔ Completado")
          .setStyle(ButtonStyle.Success)
      );

      await originalMessage.edit({
        embeds: [originalMessage.embeds[0]],
        components: [row],
      });

      // Guardar el video y su información para cuando se complete la tarea
      const videoInfo = {
        attachment: {
          name: attachment.name,
          url: attachment.url,
          contentType: attachment.contentType,
        },
        task: task,
        userId: interaction.user.id,
        messageLink: `https://discord.com/channels/${
          interaction.guild?.id || "@me"
        }/${originalMessage.channel.id}/${originalMessage.id}`,
        timestamp: new Date().toISOString(),
      };

      // Almacenar temporalmente la información del video
      if (!client.videoQueue) client.videoQueue = new Map();
      client.videoQueue.set(`${interaction.user.id}_${task}`, videoInfo);

      await interaction.followUp({
        content:
          "Video recibido. Ahora puedes marcar la tarea como completada.",
        flags: [1 << 6],
      });
    } catch (error) {
      if (error.message === "time") {
        await interaction.followUp({
          content:
            "Se agotó el tiempo para subir el video. Inténtalo de nuevo.",
          flags: [1 << 6],
        });
      } else {
        console.error("Error al procesar el video:", error);
        await interaction.followUp({
          content:
            "Hubo un error al procesar el video. Por favor, inténtalo de nuevo.",
          flags: [1 << 6],
        });
      }
    }
    return;
  }

  // Manejar la selección de usuario para tareas
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "select_user_task"
  ) {
    const selectedUserId = interaction.values[0];

    // Recrear el menú con el usuario seleccionado
    const members = await interaction.guild.members.fetch();
    const userSelect = new StringSelectMenuBuilder()
      .setCustomId("select_user_task")
      .setPlaceholder("Selecciona un usuario")
      .setMaxValues(1)
      .addOptions(
        members
          .filter((member) => !member.user.bot)
          .map((member) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(member.user.username)
              .setDescription(`ID: ${member.user.id}`)
              .setValue(member.user.id)
              .setDefault(member.user.id === selectedUserId)
          )
      );

    const row1 = new ActionRowBuilder().addComponents(userSelect);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`assign_task_${selectedUserId}`)
        .setLabel("Asignar Tareas")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(false)
    );

    await interaction.update({
      components: [row1, row2],
    });
    return;
  }

  // Manejar el botón de asignar tareas
  if (
    interaction.isButton() &&
    interaction.customId.startsWith("assign_task_")
  ) {
    // Verificar que estamos en un canal de asignación
    if (interaction.channel.name !== "asignacion-tareas") {
      await interaction.reply({
        content:
          "Las tareas solo pueden ser asignadas desde el canal de asignación.",
        flags: [1 << 6],
      });
      return;
    }

    const userId = interaction.customId.split("_")[2];
    console.log("Abriendo modal de tarea para usuario:", userId);

    const modal = new ModalBuilder()
      .setCustomId(`task_modal_${userId}`) // Formato: task_modal_userId
      .setTitle("Asignar Tarea");

    const taskInput = new TextInputBuilder()
      .setCustomId("task")
      .setLabel("Tarea")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Escribe la tarea")
      .setRequired(true);

    const descriptionInput = new TextInputBuilder()
      .setCustomId("description")
      .setLabel("Descripción (opcional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Añade más detalles sobre la tarea")
      .setRequired(false);

    const firstRow = new ActionRowBuilder().addComponents(taskInput);
    const secondRow = new ActionRowBuilder().addComponents(descriptionInput);
    modal.addComponents(firstRow, secondRow);

    await interaction.showModal(modal);
    return;
  }

  // Manejar el modal de asignar tarea
  if (
    interaction.isModalSubmit() &&
    interaction.customId.startsWith("task_modal_")
  ) {
    console.log("Modal recibido:", interaction.customId);

    const [, , userId] = interaction.customId.split("_");
    console.log("ID de usuario extraído:", userId);

    try {
      const user = await client.users.fetch(userId);
      console.log("Usuario encontrado:", user.tag);

      const task = interaction.fields.getTextInputValue("task");
      const description = interaction.fields.getTextInputValue("description");
      console.log("Tarea y descripción:", { task, description });

      // Buscar el canal del usuario en la categoría actual
      const categoryName = interaction.channel.parent.name;
      const channelName = getChannelName(user.username, userId, categoryName);
      console.log("Buscando canal:", { categoryName, channelName });

      const userChannel = interaction.guild.channels.cache.find((ch) => {
        const matches =
          ch.name === channelName && ch.parentId === interaction.channel.parentId;
        console.log(
          `Comparando canal ${ch.name} con ${channelName} en categoría ${ch.parent?.name}: ${matches}`
        );
        return matches;
      });

      if (!userChannel) {
        await interaction.reply({
          content: `No se encontró el canal de tareas para ${user.username} en la categoría ${categoryName}.\nBuscando canal: ${channelName}`,
          flags: [1 << 6],
        });
        return;
      }

      // Enviar la tarea al canal del usuario
      try {
        const taskWithDescription = description
          ? `${task}\n\nDescripción:\n${description}`
          : task;
        console.log("Enviando tarea:", taskWithDescription);
        await sendTaskMessages(user, [taskWithDescription], userChannel);

        await interaction.reply({
          content: `Tarea asignada a ${user.username} en ${userChannel}`,
          flags: [1 << 6],
        });
      } catch (error) {
        console.error("Error detallado al asignar tarea:", error);
        await interaction.reply({
          content: `Error al asignar la tarea: ${error.message}`,
          flags: [1 << 6],
        });
      }
    } catch (error) {
      console.error("Error al procesar el modal:", error);
      await interaction.reply({
        content: `Error al procesar la tarea: ${error.message}`,
        flags: [1 << 6],
      });
    }
    return;
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || message.channel.type !== ChannelType.GuildText)
    return;

  // Si el mensaje no es de un administrador o no está en el canal de asignación, ignorarlo
  if (
    !message.member?.permissions.has(PermissionsBitField.Flags.Administrator) ||
    message.channel.name !== "asignacion-tareas"
  ) {
    return;
  }

  // Obtener menciones de usuarios y tareas
  const mentions = message.mentions.users;
  const tasks = message.content.split("\n").filter((line) => line.trim());

  if (mentions.size === 0 || tasks.length === 0) {
    return;
  }

  // Procesar cada usuario mencionado
  for (const [userId, user] of mentions) {
    const member = await message.guild.members.fetch(userId);
    if (!member) continue;

    // Buscar el canal del usuario en la categoría actual
    const categoryName = message.channel.parent.name;
    const channelName = getChannelName(user.username, userId, categoryName);

    console.log("Buscando canal:", {
      username: user.username,
      userId: userId,
      categoryName: categoryName,
      channelNameBuscado: channelName,
    });

    // Listar todos los canales disponibles para debug
    console.log("Canales disponibles en la categoría:");
    message.guild.channels.cache
      .filter((ch) => ch.parentId === message.channel.parentId)
      .forEach((ch) => console.log(`- ${ch.name}`));

    const userChannel = message.guild.channels.cache.find((ch) => {
      const matches =
        ch.name === channelName && ch.parentId === message.channel.parentId;
      console.log(
        `Comparando canal ${ch.name} con ${channelName} en categoría ${ch.parent?.name}: ${matches}`
      );
      return matches;
    });

    if (!userChannel) {
      await message.reply(
        `No se encontró el canal de tareas para ${user.username} en la categoría ${categoryName}.\nBuscando canal: ${channelName}`
      );
      continue;
    }

    // Enviar las tareas al canal del usuario
    await sendTaskMessages(user, tasks, userChannel);
  }

  // Eliminar el mensaje original de asignación
  await message.delete();
});

// Evento cuando cambian los roles de un miembro
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  // Verificar si hubo cambios en los roles relevantes
  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;
  let rolesChanged = false;

  for (const roleId of CATEGORY_ROLES) {
    if (oldRoles.has(roleId) !== newRoles.has(roleId)) {
      rolesChanged = true;
      break;
    }
  }

  if (rolesChanged && !newMember.user.bot) {
    console.log(
      `Roles actualizados para ${newMember.user.tag}, reconfigurando canales...`
    );
    await assignRandomStarterChannel(newMember.id, newMember.guild);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
