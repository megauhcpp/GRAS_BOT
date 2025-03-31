const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

// Función para enviar mensajes de tarea a un canal
async function sendTaskMessages(user, tasks, channel) {
  try {
    // Obtener el canal de registro
    const registroChannel = channel.parent.children.cache.find(
      (ch) => ch.name === "registro-tareas"
    );

    if (!registroChannel) {
      console.error("No se encontró el canal de registro-tareas");
      return;
    }

    for (const task of tasks) {
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Nueva Tarea")
        .setDescription(task)
        .setTimestamp();

      // Primero enviamos el mensaje para obtener su ID
      const message = await channel.send({
        content: `${user}`,
        embeds: [embed],
      });

      // Luego creamos los botones con el ID del mensaje
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`start_task_${message.id}`)
          .setLabel("Registrar inicio")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("upload_video")
          .setLabel("Subir Video")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
      );

      // Actualizamos el mensaje con los botones
      await message.edit({ components: [row] });
    }
  } catch (error) {
    console.error("Error al enviar mensajes de tarea:", error);
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
        const uploadButton = row.components.find((component) =>
          component.customId?.startsWith("upload_video_")
        );

        if (uploadButton) {
          const newRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(uploadButton).setDisabled(disable)
          );

          await message.edit({ components: [newRow] });
        }
      }
    }
  } catch (error) {
    console.error("Error al toggle botones de subida:", error);
  }
}

// Función para enviar video al canal de confirmación
async function sendVideoConfirmation(
  attachment,
  interaction,
  message,
  duration
) {
  try {
    // Obtener la categoría del mensaje original
    const category = message.channel.parent;
    if (!category)
      throw new Error("No se pudo determinar la categoría del mensaje");

    // Buscar el canal de videos en la misma categoría
    const videoChannel = category.children.cache.find(
      (ch) => ch.name === "videos-tareas"
    );

    if (!videoChannel)
      throw new Error("No se encontró el canal de videos en esta categoría");

    const { hours, minutes, seconds } = duration;
    const originalEmbed = message.embeds[0];

    const videoEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("Video de Tarea Completada")
      .setDescription(`**Tarea:** ${originalEmbed.description}`)
      .addFields([
        {
          name: "Usuario",
          value: `${interaction.user}`,
          inline: true,
        },
        {
          name: "Duración",
          value: `${hours}h ${minutes}m ${seconds}s`,
          inline: true,
        },
        {
          name: "Tarea Original",
          value: `[Ver tarea](${message.url})`,
          inline: true,
        },
      ])
      .setTimestamp();

    return await videoChannel.send({
      embeds: [videoEmbed],
      files: [
        {
          attachment: attachment.url,
          name: `tarea-${interaction.user.username}-${Date.now()}.${
            attachment.contentType.split("/")[1]
          }`,
        },
      ],
    });
  } catch (error) {
    console.error("Error al enviar confirmación de video:", error);
    throw error;
  }
}

module.exports = {
  sendTaskMessages,
  parseTaskContent,
  toggleUploadButtons,
  sendVideoConfirmation,
};
