const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require("discord.js");
const { CATEGORY_ROLES } = require("../config/constants");

// Función para configurar un canal inicial
async function setupStarterChannel(channel) {
  try {
    // Obtener los últimos 100 mensajes del canal
    const messages = await channel.messages.fetch({ limit: 100 });

    // Buscar si ya existe un mensaje con el botón
    const existingMessage = messages.find(
      (msg) =>
        msg.author.id === channel.client.user.id &&
        msg.components.length > 0 &&
        msg.components[0].components[0]?.data?.custom_id === "create_channel"
    );

    if (existingMessage) {
      // Si ya existe el mensaje, no hacer nada
      // Eliminar otros mensajes del bot si existen
      const otherBotMessages = messages.filter(
        (msg) =>
          msg.author.id === channel.client.user.id &&
          msg.id !== existingMessage.id
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

// Función para configurar el canal de asignación de tareas
async function setupAssignmentChannel(channel) {
  console.log("Iniciando configuración del canal de asignación...");
  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    console.log(`Encontrados ${messages.size} mensajes en el canal`);

    const hasAssignmentMessage = messages.some((msg) =>
      msg.author.bot && msg.components.length > 0
    );
    console.log(`¿Existe mensaje con menú? ${hasAssignmentMessage ? "Sí" : "No"}`);

    if (!hasAssignmentMessage) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("create_channel")
          .setLabel("Crear Canal")
          .setStyle(ButtonStyle.Primary)
      );

      const message = await channel.send({
        content: "¡Bienvenido! Haz clic en el botón para crear tu canal de tareas.",
        components: [row],
      });

      return message;
    }

    return null;
  } catch (error) {
    console.error("Error en setupAssignmentChannel:", error);
    throw error;
  }
}

// Función para actualizar el mensaje de asignación existente
async function updateAssignmentMessage(message) {
  if (!message) {
    console.log("No hay mensaje para actualizar");
    return;
  }

  try {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_channel")
        .setLabel("Crear Canal")
        .setStyle(ButtonStyle.Primary)
    );

    await message.edit({
      content: "¡Bienvenido! Haz clic en el botón para crear tu canal de tareas.",
      components: [row],
    });
  } catch (error) {
    console.error("Error al actualizar mensaje de asignación:", error);
    throw error;
  }
}

module.exports = {
  setupStarterChannel,
  setupAssignmentChannel,
  updateAssignmentMessage,
};
