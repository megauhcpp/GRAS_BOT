const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionsBitField,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const {
  getChannelName,
  hasChannelInCategory,
  updateStarterChannelVisibility,
  updateUserChannelPermissions,
} = require("../services/channelService");
const {
  sendTaskMessages,
  toggleUploadButtons,
  sendVideoConfirmation,
} = require("../services/taskService");

async function handleCreateChannelButton(interaction) {
  const user = interaction.user;
  const categoryName = interaction.channel.parent.name;
  const channelName = getChannelName(user.username, user.id, categoryName);
  const category = interaction.channel.parent;

  if (!category) {
    await interaction.reply({
      content: "Error: No se pudo encontrar la categoría del canal.",
      flags: [1 << 6],
    });
    return;
  }

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
    // Crear el canal personal
    const channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        },
      ],
    });

    // Actualizar permisos para el usuario
    await updateUserChannelPermissions(interaction.guild, user.id, category.id);

    // Enviar mensaje de confirmación
    await interaction.reply({
      content: `¡Canal creado! Ve a <#${channel.id}> para ver tus tareas.`,
      flags: [1 << 6],
    });

    // Enviar mensajes iniciales al canal
    await sendTaskMessages(channel);
  } catch (error) {
    console.error("Error al crear el canal:", error);
    await interaction.reply({
      content: "Hubo un error al crear el canal. Por favor, inténtalo de nuevo.",
      flags: [1 << 6],
    });
  }
}

async function handleStartTaskButton(interaction) {
  try {
    const messageId = interaction.customId.split("_")[2];
    const message = interaction.message;
    const taskEmbed = message.embeds[0];
    const taskTitle = taskEmbed.fields?.find(f => f.name === "Tarea")?.value || "Sin título";
    const taskDescription = taskEmbed.fields?.find(f => f.name === "Descripción")?.value || "Sin descripción";
    const startTime = Date.now();

    // Actualizar los botones
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`started_task_${messageId}`)
        .setLabel("Tarea iniciada")
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`upload_video_${messageId}_${interaction.user.id}`)
        .setLabel("Subir Video")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(false)
    );

    await message.edit({ components: [row] });

    const registroChannel = interaction.channel.parent.children.cache.find(
      (ch) => ch.name === "registro-tareas"
    );

    if (registroChannel) {
      const registroEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(" Inicio de Tarea")
        .setDescription(`El usuario ${interaction.user} ha iniciado la tarea:`)
        .addFields([
          { name: "Tarea", value: taskTitle, inline: false },
          { name: "Descripción", value: taskDescription, inline: false },
          {
            name: "Enlace a la tarea",
            value: `[Ver tarea](${message.url})`,
            inline: true,
          }
        ])
        .setTimestamp();

      await registroChannel.send({ embeds: [registroEmbed] });
    }

    await interaction.reply({
      content: "¡Tarea iniciada! Puedes subir el video cuando la completes.",
      ephemeral: true
    });

    message.startTime = startTime;
  } catch (error) {
    console.error("Error al iniciar tarea:", error);
    await interaction.reply({
      content: "Hubo un error al iniciar la tarea.",
      ephemeral: true
    });
  }
}

async function handleUploadVideoButton(interaction) {
  // Extraer messageId y userId del customId
  const [, , messageId, userId] = interaction.customId.split("_");
  
  // Verificar que el usuario que hace clic es el mismo al que se le asignó la tarea
  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: "Solo el usuario asignado puede subir el video de esta tarea.",
      ephemeral: true
    });
    return;
  }

  const message = interaction.message;
  const startTime = Date.now();

  // Deshabilitar el botón inmediatamente
  try {
    const row = new ActionRowBuilder().addComponents(
      message.components[0].components.map(button => {
        const newButton = ButtonBuilder.from(button);
        if (button.data.custom_id?.startsWith('upload_video_')) {
          newButton.setDisabled(true);
        }
        return newButton;
      })
    );
    await message.edit({ components: [row] });
  } catch (editError) {
    console.error("Error al deshabilitar botón:", editError);
    // Si no podemos deshabilitar el botón, no continuamos
    await interaction.reply({
      content: "Hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo.",
      ephemeral: true
    });
    return;
  }

  try {
    await interaction.reply({
      content:
        "Por favor, sube el video de tu tarea. Tienes 5 minutos para subirlo.",
      ephemeral: true,
    });

    // Esperar por el video
    const filter = (m) =>
      m.author.id === interaction.user.id && m.attachments.size > 0;
    const collected = await message.channel.awaitMessages({
      filter,
      max: 1,
      time: 5 * 60 * 1000,
      errors: ["time"],
    });

    const videoMessage = collected.first();
    const attachment = videoMessage.attachments.first();

    // Calcular la duración
    const duration = {
      hours: Math.floor((Date.now() - startTime) / (1000 * 60 * 60)),
      minutes: Math.floor(
        ((Date.now() - startTime) % (1000 * 60 * 60)) / (1000 * 60)
      ),
      seconds: Math.floor(((Date.now() - startTime) % (1000 * 60)) / 1000),
    };

    // Actualizar el mensaje original para mostrar que está completada
    const originalEmbed = message.embeds[0];
    const taskTitle = originalEmbed.fields?.find(f => f.name === "Tarea")?.value || "Sin título";
    const taskDescription = originalEmbed.fields?.find(f => f.name === "Descripción")?.value || "Sin descripción";

    const completedEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(" Tarea Completada")
      .addFields([
        { name: "Tarea", value: taskTitle, inline: false },
        { name: "Descripción", value: taskDescription, inline: false },
        {
          name: "Duración",
          value: `${duration.hours}h ${duration.minutes}m ${duration.seconds}s`,
          inline: true,
        },
        {
          name: "Completada por",
          value: `${interaction.user}`,
          inline: true,
        }
      ])
      .setFooter({ text: "Video enviado al canal de revisión" })
      .setTimestamp();

    // Actualizar el mensaje original sin botones
    await message.edit({
      embeds: [completedEmbed],
      components: [],
    });

    try {
      // Enviar el video al canal de videos
      await sendVideoConfirmation(attachment, videoMessage, duration, taskTitle, taskDescription);
      
      // Notificar éxito al usuario
      await interaction.followUp({
        content: "Video recibido correctamente. Un administrador lo revisará pronto.",
        ephemeral: true,
      });

      // Buscar el canal de registro-tareas
      const registroChannel = message.channel.parent.children.cache.find(
        (ch) => ch.name === "registro-tareas"
      );

      if (registroChannel) {
        const registroEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle(" Tarea Completada")
          .setDescription(`${interaction.user} ha completado una tarea`)
          .addFields([
            {
              name: "Tarea",
              value: taskTitle,
              inline: false,
            },
            {
              name: "Descripción",
              value: taskDescription,
              inline: false,
            },
            {
              name: "Duración",
              value: `${duration.hours}h ${duration.minutes}m ${duration.seconds}s`,
              inline: true,
            },
            {
              name: "Canal",
              value: `${message.channel}`,
              inline: true,
            },
          ])
          .setTimestamp();

        await registroChannel.send({ embeds: [registroEmbed] });
      }

      // Intentar eliminar el mensaje con el video
      try {
        await videoMessage.delete();
      } catch (deleteError) {
        console.error("Error al eliminar mensaje de video:", deleteError);
        // No lanzar error si falla el borrado
      }

      // Mostrar mensaje de éxito con la duración
      await interaction.followUp({
        content: `¡Video subido correctamente! Has completado la tarea en ${duration.hours}h ${duration.minutes}m ${duration.seconds}s.`,
        ephemeral: true,
      });
    } catch (videoError) {
      console.error("Error al procesar el video:", videoError);
      
      // Reactivar el botón de subir video
      try {
        const row = new ActionRowBuilder().addComponents(
          message.components[0].components.map(button => {
            const newButton = ButtonBuilder.from(button);
            if (button.data.custom_id?.startsWith('upload_video_')) {
              newButton.setDisabled(false);
            }
            return newButton;
          })
        );
        await message.edit({ components: [row] });
      } catch (editError) {
        console.error("Error al reactivar botón:", editError);
      }

      await interaction.followUp({
        content: "Hubo un error al procesar el video. Por favor, inténtalo de nuevo.",
        ephemeral: true,
      });
      return;
    }
  } catch (error) {
    console.error("Error al manejar interacción:", error);

    // Reactivar el botón de subir video solo si el mensaje original existe
    try {
      if (message?.components?.[0]) {
        const row = new ActionRowBuilder().addComponents(
          message.components[0].components.map(button => {
            const newButton = ButtonBuilder.from(button);
            if (button.data.custom_id?.startsWith('upload_video_')) {
              newButton.setDisabled(false);
            }
            return newButton;
          })
        );
        await message.edit({ components: [row] });
      }
    } catch (editError) {
      console.error("Error al reactivar botón:", editError);
    }

    // Verificar si es una colección vacía (timeout)
    if (error.name === "Collection" && error.size === 0) {
      await interaction.followUp({
        content:
          'Se acabó el tiempo para subir el video. Puedes intentarlo nuevamente volviendo a pulsar en "Subir video".',
        ephemeral: true,
      });
    } else {
      await interaction.followUp({
        content:
          "Hubo un error al procesar el video. Por favor, intenta nuevamente.",
        ephemeral: true,
      });
    }
  }
}

async function handleAssignTaskButton(interaction) {
  try {
    const userId = interaction.customId.split("_")[2];
    console.log("Abriendo modal de tarea para usuario:", userId);

    const modal = new ModalBuilder()
      .setCustomId(`task_modal_${userId}`)
      .setTitle("Asignar Tarea");

    const titleInput = new TextInputBuilder()
      .setCustomId("taskTitle")
      .setLabel("Título de la tarea")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Escribe el título de la tarea")
      .setRequired(true);

    const descriptionInput = new TextInputBuilder()
      .setCustomId("taskDescription")
      .setLabel("Descripción (opcional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Añade más detalles sobre la tarea (opcional)")
      .setRequired(false);

    const firstRow = new ActionRowBuilder().addComponents(titleInput);
    const secondRow = new ActionRowBuilder().addComponents(descriptionInput);

    modal.addComponents(firstRow, secondRow);

    await interaction.showModal(modal);
  } catch (error) {
    console.error("Error al abrir el modal de tarea:", error);
    await interaction.reply({
      content: "Hubo un error al abrir el formulario de tarea.",
      flags: [1 << 6],
    });
  }
}

module.exports = {
  handleCreateChannelButton,
  handleStartTaskButton,
  handleUploadVideoButton,
  handleAssignTaskButton,
};
