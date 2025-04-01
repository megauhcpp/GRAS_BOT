const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

// Función para enviar mensajes iniciales al canal personal
async function sendTaskMessages(channel) {
  try {
    // Enviar mensaje de bienvenida
    const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("¡Bienvenido a tu canal personal!")
      .setDescription(
        "Este es tu canal personal para gestionar tus tareas. " +
        "Aquí podrás ver las tareas que te sean asignadas y subir los videos correspondientes."
      );

    await channel.send({ embeds: [embed] });

    // Enviar instrucciones
    const instructions = [
      "**¿Cómo funciona?**",
      "",
      "1. Cuando se te asigne una tarea, recibirás una notificación en este canal",
      "2. Para cada tarea asignada, verás:",
      "   • Descripción de la tarea",
      "   • Botón para subir el video",
      "3. Al completar una tarea:",
      "   • Graba un video mostrando la tarea completada",
      "   • Sube el video usando el botón correspondiente",
      "   • El video se enviará automáticamente a un administrador",
      "",
      "¡Buena suerte con tus tareas! 🚀"
    ].join("\n");

    await channel.send(instructions);
  } catch (error) {
    console.error("Error al enviar mensajes de tarea:", error);
  }
}

// Función para enviar una tarea al canal del usuario
async function sendTaskToUserChannel(channel, userId, task, description) {
  try {
    const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("📋 Nueva Tarea Asignada")
      .addFields(
        { name: "Tarea", value: task || "Sin título", inline: false },
        { name: "Descripción", value: description || "Sin descripción", inline: false }
      )
      .setFooter({ text: "Utiliza los botones de abajo para gestionar la tarea" })
      .setTimestamp();

    // Enviar el mensaje con el embed
    const message = await channel.send({
      content: `<@${userId}>, se te ha asignado una nueva tarea:`,
      embeds: [embed],
    });

    // Crear los botones
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`start_task_${message.id}`)
        .setLabel("Iniciar Tarea")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`upload_video_${message.id}`)
        .setLabel("Subir Video")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    // Actualizar el mensaje con los botones
    await message.edit({ components: [row] });
  } catch (error) {
    console.error("Error al enviar tarea al canal del usuario:", error);
    throw error;
  }
}

// Función para habilitar/deshabilitar botones de subida de video
async function toggleUploadButtons(channel, userId, disable = true) {
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const userMessages = messages.filter(msg => 
      msg.mentions.users.has(userId) && 
      msg.components.length > 0
    );

    for (const message of userMessages.values()) {
      const row = message.components[0];
      if (!row) continue;

      const uploadButton = row.components.find(
        component => component.data.custom_id?.startsWith('upload_video_')
      );

      if (uploadButton) {
        const newRow = new ActionRowBuilder().addComponents(
          row.components.map(button => {
            const newButton = ButtonBuilder.from(button);
            if (button.data.custom_id?.startsWith('upload_video_')) {
              newButton.setDisabled(disable);
            }
            return newButton;
          })
        );

        await message.edit({ components: [newRow] });
      }
    }
  } catch (error) {
    console.error('Error al actualizar botones:', error);
  }
}

// Función para enviar confirmación de video
async function sendVideoConfirmation(attachment, message, duration, taskTitle, taskDescription) {
  try {
    const durationString = `${duration.hours}h ${duration.minutes}m ${duration.seconds}s`;
    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle("✅ Video Recibido")
      .addFields([
        { name: "Tarea", value: taskTitle, inline: false },
        { name: "Descripción", value: taskDescription, inline: false },
        { name: "Duración", value: durationString, inline: true },
        { name: "Tamaño", value: `${Math.round(attachment.size / 1024 / 1024 * 100) / 100} MB`, inline: true }
      ])
      .setDescription(`Video subido por ${message.author}`)
      .setTimestamp();

    // Enviar el video al canal de videos
    const videosChannel = message.channel.parent.children.cache.find(
      ch => ch.name === "videos-tareas"
    );

    if (videosChannel) {
      await videosChannel.send({
        content: `Video para la tarea "${taskTitle}"`,
        embeds: [embed],
        files: [attachment]
      });
    } else {
      console.error("No se encontró el canal de videos");
      throw new Error("No se encontró el canal de videos");
    }
  } catch (error) {
    console.error("Error al enviar confirmación de video:", error);
    throw error;
  }
}

module.exports = {
  sendTaskMessages,
  sendTaskToUserChannel,
  toggleUploadButtons,
  sendVideoConfirmation,
};
