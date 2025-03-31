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

    // Actualizar la visibilidad de los canales para este usuario
    await updateStarterChannelVisibility(interaction.guild, user.id);

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
}

async function handleStartTaskButton(interaction) {
  try {
    const messageId = interaction.customId.split("_")[2];
    const message = interaction.message;
    const taskEmbed = message.embeds[0];
    const startTime = Date.now();

    // Actualizar los botones
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`started_task_${messageId}`)
        .setLabel("Tarea iniciada")
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("upload_video")
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
        .setColor(0x00ff00)
        .setTitle("Inicio de Tarea")
        .setDescription(
          `El usuario ${interaction.user} ha iniciado la tarea:\n**${taskEmbed.description}**`
        )
        .addFields({
          name: "Enlace a la tarea",
          value: `[Ver tarea](${message.url})`,
        })
        .setTimestamp();

      await registroChannel.send({ embeds: [registroEmbed] });
    }

    await interaction.reply({
      content: "¡Tarea iniciada! Puedes subir el video cuando la completes.",
      flags: [1 << 6],
    });

    message.startTime = startTime;
  } catch (error) {
    console.error("Error al iniciar tarea:", error);
    await interaction.reply({
      content: "Hubo un error al iniciar la tarea.",
      flags: [1 << 6],
    });
  }
}

async function handleUploadVideoButton(interaction) {
  const message = interaction.message;
  const startTime = message.startTime;

  if (!startTime) {
    await interaction.reply({
      content: "Debes iniciar la tarea antes de subir el video.",
      flags: [1 << 6],
    });
    return;
  }

  // Deshabilitar solo el botón de subir video
  const row = ActionRowBuilder.from(message.components[0]);
  const uploadButton = row.components.find(
    (c) => c.data.custom_id === "upload_video"
  );
  uploadButton.setDisabled(true);
  await message.edit({ components: [row] });

  await interaction.reply({
    content:
      "Por favor, sube el video de la tarea completada (tienes 5 minutos).",
    flags: [1 << 6],
  });

  try {
    const filter = (m) => {
      if (m.author.id === interaction.user.id && m.attachments.size > 0) {
        const attachment = m.attachments.first();
        if (!attachment.contentType?.startsWith("video/")) {
          interaction.followUp({
            content:
              "Debes asegurarte que el envío sea un video, inténtalo de nuevo",
            flags: [1 << 6],
          });
          m.delete().catch(console.error);
          return false;
        }
        return true;
      }
      return false;
    };

    const collected = await interaction.channel.awaitMessages({
      filter,
      max: 1,
      time: 300000, // 5 minutos
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
    const completedEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("✅ Tarea Completada")
      .setDescription(originalEmbed.description)
      .addFields([
        {
          name: "Duración",
          value: `${duration.hours}h ${duration.minutes}m ${duration.seconds}s`,
          inline: true,
        },
      ])
      .setTimestamp();

    // Actualizar el mensaje original sin botones
    await message.edit({
      embeds: [completedEmbed],
      components: [],
    });

    // Enviar el video al canal de videos
    await sendVideoConfirmation(attachment, interaction, message, duration);

    // Buscar el canal de registro-tareas
    const registroChannel = message.channel.parent.children.cache.find(
      (ch) => ch.name === "registro-tareas"
    );

    if (registroChannel) {
      const registroEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("Tarea Completada")
        .setDescription(`${interaction.user} ha completado una tarea`)
        .addFields([
          {
            name: "Tarea",
            value: originalEmbed.description,
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

    // Eliminar el mensaje con el video
    await videoMessage.delete();

    // Mostrar mensaje de éxito con la duración
    await interaction.followUp({
      content: `¡Video subido correctamente! Has completado la tarea en ${duration.hours}h ${duration.minutes}m ${duration.seconds}s.`,
      flags: [1 << 6],
    });
  } catch (error) {
    console.error("Error detallado:", error);
    // Reactivar el botón de subir video
    const row = ActionRowBuilder.from(message.components[0]);
    const uploadButton = row.components.find(
      (c) => c.data.custom_id === "upload_video"
    );
    uploadButton.setDisabled(false);
    await message.edit({ components: [row] });

    // Verificar si es una colección vacía (timeout)
    if (error instanceof Map && error.size === 0) {
      await interaction.followUp({
        content:
          'Se acabó el tiempo para subir el video. Puedes intentarlo nuevamente volviendo a pulsar en "Subir video".',
        flags: [1 << 6],
      });
    } else {
      await interaction.followUp({
        content:
          "Hubo un error al procesar el video. Por favor, intenta nuevamente.",
        flags: [1 << 6],
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
