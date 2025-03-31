const { getChannelName } = require("../services/channelService");
const { sendTaskMessages } = require("../services/taskService");

async function handleTaskModal(interaction) {
  console.log("Modal recibido:", interaction.customId);

  const [, , userId] = interaction.customId.split("_");
  console.log("ID de usuario extraído:", userId);

  try {
    const user = await interaction.client.users.fetch(userId);
    console.log("Usuario encontrado:", user.tag);

    const task = interaction.fields.getTextInputValue("taskTitle");
    const description = interaction.fields.getTextInputValue("taskDescription");
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
      return matches;
    });

    if (!userChannel) {
      await interaction.reply({
        content: `No se encontró el canal de tareas para ${user.username} en la categoría ${categoryName}.\nPor favor, contacte al usuario ${user.username} para que cree su canal de tareas.`,
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
}

module.exports = {
  handleTaskModal,
};
