require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
} = require("discord.js");

// Constantes de configuración
const LOCATIONS = ["Calpe", "Granada", "Malaga", "Sevilla"];
const VIDEO_CHANNEL_ID = "1354734580589924416";
const STARTER_CHANNELS = [
  "1354754019737862307", // Calpe
  "1354757348199239704", // Granada
  "1354757370676248596", // Malaga
  "1355112644952199229" // Sevilla
];

const CATEGORY_ROLES = {
  calpe: {
    categoryId: "1354752551136006175",
    roleId: "1354813657544134839"
  },
  granada: {
    categoryId: "1354752582421057630",
    roleId: "1354813856861655230"
  },
  malaga: {
    categoryId: "1354752621088604292",
    roleId: "1354813912335388865"
  },
  sevilla: {
    categoryId: "1355112568850743427",
    roleId: "1355112904076300389"
  }
};

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
    for (let i = 0; i < LOCATIONS.length; i++) {
      if (member.roles.cache.has(CATEGORY_ROLES[LOCATIONS[i].toLowerCase()].roleId)) {
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
    
    // Verificar si el usuario tiene algún rol de categoría
    const hasAnyCategoryRole = LOCATIONS.some(location => member.roles.cache.has(CATEGORY_ROLES[location.toLowerCase()].roleId));
    
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
          const hasRole = member.roles.cache.has(CATEGORY_ROLES[categoryName.toLowerCase()].roleId);

          // Si el usuario no tiene ningún rol de categoría, no debería ver ningún canal
          // Si tiene roles, solo verá los canales donde tiene el rol específico y no tiene canal propio
          await channel.permissionOverwrites.edit(userId, {
            ViewChannel: hasAnyCategoryRole && !hasChannel && hasRole,
          });
        }
      } catch (error) {
        console.error(`Error al actualizar el canal ${STARTER_CHANNELS[i]}:`, error);
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
    console.log("Iniciando configuración del canal de asignación...");
    const messages = await channel.messages.fetch();
    console.log(`Encontrados ${messages.size} mensajes en el canal`);

    // Buscar si ya existe un mensaje con el menú
    const existingMessage = messages.find(
      (msg) =>
        msg.author.id === client.user.id &&
        msg.components.length > 0 &&
        msg.components[0].components[0]?.data?.custom_id === "select_user_task"
    );

    console.log("¿Existe mensaje con menú?", existingMessage ? "Sí" : "No");

    // Usar updateAssignmentMessage para manejar la actualización o creación del mensaje
    await updateAssignmentMessage(channel);
  } catch (error) {
    console.error(`Error al configurar el canal de asignación ${channel.name}:`, error);
  }
}

// Función para actualizar el mensaje de asignación existente
async function updateAssignmentMessage(channel) {
  try {
    // Buscar el mensaje existente
    const messages = await channel.messages.fetch();
    const existingMessage = messages.find(
      (msg) =>
        msg.author.id === client.user.id &&
        msg.components.length > 0 &&
        msg.components[0].components[0]?.data?.custom_id === "select_user_task"
    );

    // Obtener el rol correspondiente a esta categoría
    const categoryId = channel.parent.id;
    const categoryRole = Object.entries(CATEGORY_ROLES).find(([location, data]) => 
      data.categoryId === categoryId
    );
    const roleId = categoryRole?.[1]?.roleId;

    // Obtener miembros con el rol de la categoría
    const members = await channel.guild.members.fetch();
    const filteredMembers = members.filter(member => !member.user.bot && member.roles.cache.has(roleId));
    console.log(`Obtenidos ${filteredMembers.size} miembros con el rol ${roleId}`);

    // Crear el select menu
    const userSelect = new StringSelectMenuBuilder()
      .setCustomId("select_user_task")
      .setPlaceholder("Selecciona un usuario")
      .setMaxValues(1);

    // Si hay usuarios, añadirlos como opciones
    if (filteredMembers.size > 0) {
      userSelect.addOptions(
        filteredMembers.map((member) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(member.user.username)
            .setDescription(`ID: ${member.user.id}`)
            .setValue(member.user.id)
        )
      );
    } else {
      // Si no hay usuarios, añadir una opción deshabilitada
      userSelect.addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel("No hay usuarios disponibles")
          .setDescription("No hay usuarios con el rol necesario en esta categoría")
          .setValue("no_users")
          .setDefault(true)
      ]);
    }

    const row1 = new ActionRowBuilder().addComponents(userSelect);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("assign_task")
        .setLabel("Asignar Tareas")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(filteredMembers.size === 0)
    );

    const messageContent = {
      content: "Selecciona un usuario para asignarle tareas:",
      components: [row1, row2]
    };

    // Si existe un mensaje, actualizarlo
    if (existingMessage) {
      console.log("Actualizando mensaje existente");
      await existingMessage.edit(messageContent);
    } else {
      console.log("Creando nuevo mensaje");
      await channel.send(messageContent);
    }
  } catch (error) {
    console.error(`Error al actualizar mensaje de asignación:`, error);
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
      
      // Separar título y descripción
      const { title, description } = parseTaskContent(cleanTask);
      
      console.log(`Título: ${title}`);
      console.log(`Descripción: ${description}`);

      const taskEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Tarea asignada")
        .setDescription(
          `**Título:**\n\`\`\`${title}\`\`\`\n` +
          `**Descripción:**\n\`\`\`${description}\`\`\``
        )
        .setFooter({ text: "Sube tu video para completar la tarea." });

      await channel.send({
        embeds: [taskEmbed],
        components: [row],
      });
      console.log(`Mensaje de tarea enviado a ${user.username}: ${title}`);
    }
  } catch (error) {
    console.error(`No se pudo enviar mensaje a ${user.tag}:`, error);
    throw error; // Re-lanzar el error para que se maneje en el nivel superior
  }
}

// Función auxiliar para separar título y descripción
function parseTaskContent(content) {
  let title = content;
  let description = "Sin descripción";
  
  if (content.includes("Descripción:")) {
    const parts = content.split("Descripción:");
    title = parts[0].trim();
    description = parts[1].trim();
  }
  
  return { title, description };
}

// Función para deshabilitar/habilitar botones de subida de video en un canal
async function toggleUploadButtons(channel, userId, disable = true) {
  try {
    // Buscar los últimos 100 mensajes en el canal
    const messages = await channel.messages.fetch({ limit: 100 });
    
    // Filtrar mensajes que tienen botones de subir video y son del usuario
    for (const [_, message] of messages) {
      if (message.components?.length > 0) {
        const row = message.components[0];
        const uploadButton = row.components.find(component => 
          component.customId?.startsWith('upload_video_')
        );
        
        if (uploadButton) {
          const newRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(uploadButton)
              .setDisabled(disable)
          );
          
          await message.edit({ components: [newRow] });
        }
      }
    }
  } catch (error) {
    console.error('Error al toggle botones de subida:', error);
  }
}

client.once("ready", async () => {
  console.log(`Bot conectado como ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if (!guild) return;

  console.log("Actualizando visibilidad de canales para todos los miembros...");
  
  try {
    // Obtener todos los miembros del servidor
    const members = await guild.members.fetch();
    
    // Actualizar la visibilidad de los canales para cada miembro
    for (const [memberId, member] of members) {
      if (!member.user.bot) {
        await updateStarterChannelVisibility(guild, memberId);
      }
    }
    
    console.log("Visibilidad de canales actualizada correctamente");
  } catch (error) {
    console.error("Error al actualizar la visibilidad de los canales:", error);
  }

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
      STARTER_CHANNELS.map(id => client.channels.fetch(id))
    );
    const categoryIds = [...new Set(starterChannels.map(ch => ch.parent.id))];
    
    console.log("Categorías con starter channels:", categoryIds);

    // Buscar el canal "asignacion-tareas" en cada categoría
    for (const categoryId of categoryIds) {
      const category = await client.channels.fetch(categoryId);
      console.log(`Buscando en categoría: ${category.name}`);
      
      const assignmentChannel = category.children.cache.find(
        channel => channel.name === "asignacion-tareas"
      );

      if (assignmentChannel) {
        console.log(`Canal de asignación encontrado en categoría ${category.name}, configurando...`);
        await setupAssignmentChannel(assignmentChannel);
      } else {
        console.log(`No se encontró canal de asignación en categoría ${category.name}`);
      }
    }
  } catch (error) {
    console.error("Error al configurar los canales de asignación:", error);
  }
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

  // Manejar el botón de subir video
  if (
    interaction.isButton() &&
    interaction.customId.startsWith("upload_video_")
  ) {
    const [, task, channelId] = interaction.customId.split("_");
    
    // Deshabilitar todos los botones de subida
    await toggleUploadButtons(interaction.channel, interaction.user.id, true);
    
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
        // Reactivar los botones si el archivo no es válido
        await toggleUploadButtons(interaction.channel, interaction.user.id, false);
        return;
      }

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

      // Actualizar el mensaje original para mostrar que la tarea está completada
      const cleanTask = task.replace(/<[^>]+>/g, "").trim();
      
      // Separar título y descripción del cleanTask
      const { title: initialTitle, description: initialDescription } = parseTaskContent(cleanTask);
      
      // Obtener el título y descripción del embed original
      const originalEmbed = interaction.message.embeds[0];
      
      // Extraer el título y descripción
      let taskTitle = initialTitle;
      let taskDescription = initialDescription;
      
      if (originalEmbed) {
        // Si hay una descripción, buscar título y descripción en bloques de código separados
        const blocks = originalEmbed.description?.match(/```(.*?)```/gs) || [];
        if (blocks.length >= 2) {
          // Si hay dos o más bloques, el primero es título y el segundo descripción
          taskTitle = blocks[0].replace(/```/g, '').trim();
          taskDescription = blocks[1].replace(/```/g, '').trim();
        } else if (blocks.length === 1) {
          // Si hay solo un bloque, es el título
          taskTitle = blocks[0].replace(/```/g, '').trim();
        } else {
          // Si no hay bloques, usar el título del embed
          taskTitle = originalEmbed.title || initialTitle;
          taskDescription = originalEmbed.description?.replace(/\*\*/g, '').replace(/Tarea:/g, '').trim() || initialDescription;
        }
      }
      
      const completedEmbed = new EmbedBuilder()
        .setColor(0x28a745) // Color verde
        .setTitle("Tarea Completada")
        .setDescription(
          `**Título:**\n\`\`\`${taskTitle}\`\`\`\n` +
          `**Descripción:**\n\`\`\`${taskDescription}\`\`\``
        )
        .setFooter({
          text: `Completada el ${formattedDate}`,
        });

      // Si el embed original tenía campos adicionales, los mantenemos
      if (originalEmbed?.fields?.length > 0) {
        completedEmbed.addFields(originalEmbed.fields);
      }

      // Actualizar el mensaje original sin botones
      await interaction.message.edit({
        embeds: [completedEmbed],
        components: [] // Eliminar todos los botones
      });

      // Enviar el video al canal de confirmación y luego eliminarlo del canal original
      await client.channels.fetch(VIDEO_CHANNEL_ID).then(videoChannel => {
        const videoEmbed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle("Tarea Completada")
          .setDescription(
            `**Usuario:** ${interaction.user}\n\n` +
            `**Título:**\n\`\`\`${taskTitle}\`\`\`\n` +
            `**Descripción:**\n\`\`\`${taskDescription}\`\`\`\n\n` +
            `**Fecha de entrega:** ${formattedDate}\n` +
            `**Canal:** ${interaction.channel.name}\n` +
            `**Link al mensaje:** ${interaction.message.url}`
          )
          .setFooter({ text: "Video subido y tarea completada" });

        // Crear un nuevo AttachmentBuilder con el video
        const videoAttachment = new AttachmentBuilder(attachment.url, {
          name: attachment.name,
          description: `Video de tarea "${taskTitle}" de ${interaction.user.username}`,
          contentType: attachment.contentType
        });

        videoChannel.send({
          embeds: [videoEmbed],
          files: [videoAttachment]
        }).then(() => {
          // Eliminar el mensaje con el video del canal del usuario
          interaction.channel.messages.fetch({ limit: 10 }).then(messages => {
            const videoMessage = messages.find(msg => 
              msg.attachments.size > 0 && 
              msg.author.id === interaction.user.id &&
              msg.attachments.first().url === attachment.url
            );

            if (videoMessage) {
              videoMessage.delete().then(() => {
                console.log("Mensaje con video eliminado del canal del usuario");
              }).catch(error => {
                console.error("Error al intentar eliminar el mensaje con el video:", error);
              });
            }
          }).catch(error => {
            console.error("Error al intentar eliminar el mensaje con el video:", error);
          });

          interaction.followUp({
            content: "¡Video subido y tarea completada correctamente! El video ha sido enviado al canal de confirmación.",
            flags: [1 << 6],
          }).then(() => {
            // Reactivar los botones de otras tareas
            toggleUploadButtons(interaction.channel, interaction.user.id, false);
          });
        });
      });
    } catch (error) {
      if (error.name === "CollectorError") {
        await interaction.followUp({
          content: "Se acabó el tiempo para subir el video.",
          flags: [1 << 6],
        });
      } else {
        console.error("Error al procesar el video:", error);
        await interaction.followUp({
          content: "Hubo un error al procesar el video.",
          flags: [1 << 6],
        });
      }
      
      // Reactivar los botones en caso de error
      await toggleUploadButtons(interaction.channel, interaction.user.id, false);
    }
    return;
  }

  // Manejar la selección de usuario para tareas
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "select_user_task"
  ) {
    const selectedUserId = interaction.values[0];

    // Obtener el rol correspondiente a esta categoría
    const categoryId = interaction.channel.parent.id;
    const roleId = Object.entries(CATEGORY_ROLES).find(([location, data]) => 
      data.categoryId === categoryId
    )?.[1]?.roleId;

    // Recrear el menú con el usuario seleccionado
    const members = await interaction.guild.members.fetch();
    const filteredMembers = members.filter(member => !member.user.bot && member.roles.cache.has(roleId));
    const userSelect = new StringSelectMenuBuilder()
      .setCustomId("select_user_task")
      .setPlaceholder("Selecciona un usuario")
      .setMaxValues(1)
      .addOptions(
        filteredMembers.map((member) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(member.user.username)
            .setDescription(`ID: ${member.user.id}`)
            .setValue(member.user.id)
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

    // Verificar si hay un usuario seleccionado y es válido
    const selectedUserId = interaction.message.components[0].components[0].options.find(opt => opt.default)?.value;
    
    if (!selectedUserId || selectedUserId === "no_users") {
      await interaction.reply({
        content: "No hay usuarios disponibles para asignar tareas en esta categoría.",
        ephemeral: true
      });
      return;
    }

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
      console.log("Buscando canal:", {
        username: user.username,
        userId: userId,
        categoryName: categoryName,
        channelNameBuscado: channelName,
      });

      // Listar todos los canales disponibles para debug
      console.log("Canales disponibles en la categoría:");
      interaction.guild.channels.cache
        .filter((ch) => ch.parentId === interaction.channel.parentId)
        .forEach((ch) => console.log(`- ${ch.name}`));

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
  
  // Actualizar visibilidad de canales si hay cambios en roles de categoría
  const hadAnyCategoryRole = LOCATIONS.some(location => 
    oldRoles.has(CATEGORY_ROLES[location.toLowerCase()].roleId)
  );
  const hasAnyCategoryRole = LOCATIONS.some(location => 
    newRoles.has(CATEGORY_ROLES[location.toLowerCase()].roleId)
  );
  
  if (hadAnyCategoryRole !== hasAnyCategoryRole) {
    await updateStarterChannelVisibility(newMember.guild, newMember.id);
  }

  // Revisar cambios en roles por categoría y actualizar los mensajes correspondientes 
  for (const location of LOCATIONS) {
    const roleId = CATEGORY_ROLES[location.toLowerCase()].roleId;
    const hadRole = oldRoles.has(roleId);
    const hasRole = newRoles.has(roleId);

    // Si hubo cambio en este rol específico
    if (hadRole !== hasRole) {
      console.log(`Cambio en rol de ${location}: ${hadRole} -> ${hasRole}`);
      try {
        const categoryId = CATEGORY_ROLES[location.toLowerCase()].categoryId;
        const category = await newMember.guild.channels.fetch(categoryId);
        if (category) {
          const assignmentChannel = category.children.cache.find(
            (channel) => channel.name === "asignacion-tareas"
          );
          if (assignmentChannel) {
            console.log(`Actualizando mensaje de asignación en ${location}...`);
            await updateAssignmentMessage(assignmentChannel);
          }
        }
      } catch (error) {
        console.error(`Error al actualizar mensaje de asignación para ${location}:`, error);
      }
    }
  }
}); 

client.login(process.env.DISCORD_BOT_TOKEN);
